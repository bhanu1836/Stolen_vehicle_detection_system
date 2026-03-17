import os
import warnings

# Avoid startup delay from Paddle source reachability checks.
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

# Silence requests version compatibility warning from transitive deps.
warnings.filterwarnings(
    "ignore",
    message=r"urllib3 .* doesn't match a supported version!",
)

import torch
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
from collections import Counter 
from paddleocr import PaddleOCR
import base64
import io
from PIL import Image
import uvicorn
from concurrent.futures import ThreadPoolExecutor
import asyncio
from functools import lru_cache

# Fix path issue for Windows
import pathlib
if os.name == 'nt':
    pathlib.PosixPath = pathlib.WindowsPath

app = FastAPI()

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Check if CUDA is available and set device
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Using device: {DEVICE}")

# Load YOLOv5 model for number plate detection with optimizations
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "best.pt")
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model weights not found at {MODEL_PATH}")

yolo_model = torch.hub.load(
    'ultralytics/yolov5',
    'custom',
    path=MODEL_PATH,
    force_reload=False,
    trust_repo=True,
    device=DEVICE,
)
yolo_model.conf = 0.3  # Lower threshold improves recall for distant/blurred plates
yolo_model.iou = 0.45  # NMS IoU threshold
yolo_model.agnostic = False  # NMS class-agnostic
yolo_model.multi_label = False  # NMS multiple labels per box
yolo_model.max_det = 3  # Allow multiple plate candidates per frame

OCR_CONFIDENCE_THRESHOLD = 0.45
PLATE_MIN_LEN = 6
PLATE_MAX_LEN = 10

# Initialize PaddleOCR with settings tuned for cropped license plates.
# On some Windows CPU environments, oneDNN (MKLDNN) can fail at runtime for OCR models.
OCR_DEVICE = "gpu" if torch.cuda.is_available() else "cpu"
ocr = PaddleOCR(
    lang="en",
    device=OCR_DEVICE,
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,
    enable_cinn=False,
    cpu_threads=2,
)

# Create thread pool for parallel processing
executor = ThreadPoolExecutor(max_workers=3)

def preprocess_image(image: np.ndarray) -> np.ndarray:
    """Optimize image for processing."""
    # Resize image to a reasonable size for faster processing
    max_dimension = 800
    height, width = image.shape[:2]
    if max(height, width) > max_dimension:
        scale = max_dimension / max(height, width)
        new_width = int(width * scale)
        new_height = int(height * scale)
        image = cv2.resize(image, (new_width, new_height))
    
    # Enhance contrast
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    cl = clahe.apply(l)
    enhanced = cv2.merge((cl,a,b))
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
    
    return enhanced

def decode_base64_image(base64_string: str) -> np.ndarray:
    """Convert base64 image to a numpy array with optimization."""
    if "base64," in base64_string:
        base64_string = base64_string.split("base64,")[1]

    image_bytes = base64.b64decode(base64_string)
    image = Image.open(io.BytesIO(image_bytes))
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

def encode_image_to_base64(image: np.ndarray) -> str:
    """Convert numpy array image to base64 string with optimization."""
    success, encoded_image = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if success:
        return base64.b64encode(encoded_image.tobytes()).decode('utf-8')
    return ""

@lru_cache(maxsize=128)
def clean_text(text: str) -> str:
    """Clean and format license plate text with caching."""
    return ''.join(c for c in text if c.isalnum()).upper()

def preprocess_plate_region_for_ocr(plate_region: np.ndarray) -> np.ndarray:
    """Apply local enhancements to improve OCR on low-contrast plate crops."""
    # Upscale small crops so OCR can resolve characters better.
    h, w = plate_region.shape[:2]
    if h < 48 or w < 140:
        scale = max(2.0, 48 / max(h, 1), 140 / max(w, 1))
        plate_region = cv2.resize(
            plate_region,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_CUBIC,
        )

    gray = cv2.cvtColor(plate_region, cv2.COLOR_BGR2GRAY)
    denoised = cv2.bilateralFilter(gray, d=5, sigmaColor=75, sigmaSpace=75)
    boosted = cv2.convertScaleAbs(denoised, alpha=1.3, beta=8)
    return cv2.cvtColor(boosted, cv2.COLOR_GRAY2BGR)

def looks_like_plate(text: str) -> bool:
    """Basic structure guard to avoid accepting random OCR noise."""
    has_letter = any(c.isalpha() for c in text)
    has_digit = any(c.isdigit() for c in text)
    return has_letter and has_digit and PLATE_MIN_LEN <= len(text) <= PLATE_MAX_LEN

def extract_ocr_candidates(ocr_result) -> List[tuple]:
    """Normalize OCR output from PaddleOCR v2/v3 into (text, score) pairs."""
    candidates = []

    if not ocr_result:
        return candidates

    # PaddleOCR v3: list of OCRResult mappings with rec_texts/rec_scores.
    for item in ocr_result:
        try:
            rec_texts = item.get("rec_texts", [])
            rec_scores = item.get("rec_scores", [])
            if rec_texts and rec_scores:
                for text, score in zip(rec_texts, rec_scores):
                    candidates.append((text, float(score)))
                continue
        except Exception:
            pass

        # PaddleOCR v2 fallback: nested line format [[box, (text, score)], ...].
        if isinstance(item, list):
            for word_info in item:
                try:
                    text = word_info[1][0]
                    score = float(word_info[1][1])
                    candidates.append((text, score))
                except Exception:
                    continue

    return candidates

def process_single_frame(frame: np.ndarray) -> Dict:
    """Detects license plates and extracts text from a single frame with optimizations."""
    # Preprocess the image
    processed_frame = preprocess_image(frame)
    
    # Run detection on preprocessed image
    with torch.no_grad():  # Disable gradient calculation for inference
        results = yolo_model(processed_frame)
    
    detected_plates = []
    best_plate_image = None
    best_confidence = 0

    # Process detections
    for det in results.xyxy[0]:
        confidence = float(det[4])
        if confidence > yolo_model.conf:
            x1, y1, x2, y2 = map(int, det[:4])

            # Expand bbox slightly to avoid clipping edge characters.
            box_h = y2 - y1
            box_w = x2 - x1
            pad_x = max(4, int(0.08 * box_w))
            pad_y = max(3, int(0.12 * box_h))
            x1 = max(0, x1 - pad_x)
            y1 = max(0, y1 - pad_y)
            x2 = min(processed_frame.shape[1], x2 + pad_x)
            y2 = min(processed_frame.shape[0], y2 + pad_y)

            plate_region = processed_frame[y1:y2, x1:x2]
            
            # Skip small regions
            if plate_region.shape[0] < 20 or plate_region.shape[1] < 20:
                continue

            try:
                ocr_inputs = [plate_region, preprocess_plate_region_for_ocr(plate_region)]

                # OCR pass on both raw and enhanced variants improves resilience.
                for ocr_input in ocr_inputs:
                    ocr_result = ocr.predict(ocr_input)
                    for text, ocr_confidence in extract_ocr_candidates(ocr_result):
                        if ocr_confidence < OCR_CONFIDENCE_THRESHOLD:
                            continue
                        cleaned_text = clean_text(text)
                        if looks_like_plate(cleaned_text):
                            detected_plates.append(cleaned_text)
                            if ocr_confidence > best_confidence:
                                best_confidence = ocr_confidence
                                best_plate_image = plate_region
            except Exception as e:
                print(f"OCR Error: {e}")
                continue

    return {
        "plates": detected_plates,
        "plate_image": best_plate_image
    }

async def process_frame_async(frame_data: dict) -> Dict:
    """Process a single frame asynchronously."""
    loop = asyncio.get_event_loop()
    frame = await loop.run_in_executor(executor, decode_base64_image, frame_data["data"])
    result = await loop.run_in_executor(executor, process_single_frame, frame)
    return result

@app.post("/detect_plate")
async def detect_plate(frames: List[dict]):
    """Process multiple frames concurrently and return the most frequently detected number plate."""
    all_detections = []
    best_plate_image = None
    best_confidence = 0

    # Process frames concurrently
    tasks = [process_frame_async(frame_data) for frame_data in frames]
    results = await asyncio.gather(*tasks)

    # Aggregate results
    for result in results:
        all_detections.extend(result["plates"])
        if result["plate_image"] is not None:
            if best_plate_image is None or best_confidence < 0.7:
                best_plate_image = result["plate_image"]
                best_confidence = 0.7

    if not all_detections:
        return {
            "error": "No license plates detected",
            "total_frames_processed": len(frames),
            "total_detections": 0,
            "plate_image": None,
        }

    # Get most common plate number
    plate_counts = Counter(all_detections)
    most_common_plate, occurrences = plate_counts.most_common(1)[0]
    confidence_score = occurrences / len(frames)

    # Convert the best plate image to base64
    plate_image_base64 = None
    if best_plate_image is not None:
        plate_image_base64 = await asyncio.get_event_loop().run_in_executor(
            executor, encode_image_to_base64, best_plate_image
        )

    return {
        "plate_number": most_common_plate,
        "confidence": confidence_score,
        "total_frames_processed": len(frames),
        "total_detections": len(all_detections),
        "plate_image": plate_image_base64
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)