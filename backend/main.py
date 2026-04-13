import asyncio
import base64
import io
import os
import pathlib
import warnings
from collections import Counter
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
import requests
import torch
import uvicorn
from bson import ObjectId
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from paddleocr import PaddleOCR
from passlib.context import CryptContext
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError
from pydantic import BaseModel, EmailStr, Field
from PIL import Image
from dotenv import load_dotenv

# Load env vars from backend/.env first, then workspace root .env.
BACKEND_DIR = pathlib.Path(__file__).resolve().parent
WORKSPACE_DIR = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env", override=False)
load_dotenv(WORKSPACE_DIR / ".env", override=False)

os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
warnings.filterwarnings("ignore", message=r"urllib3 .* doesn't match a supported version!")

if os.name == "nt":
    pathlib.PosixPath = pathlib.WindowsPath

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await startup_tasks()
    except ServerSelectionTimeoutError as exc:
        raise RuntimeError(
            "MongoDB connection failed during startup. "
            "Set MONGODB_URI to a reachable MongoDB Atlas URI or start local MongoDB."
        ) from exc
    yield


app = FastAPI(title="Stolen Vehicle Detection API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "stolen_vehicle_portal")
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "")

ADMIN_SEED_EMAIL = os.getenv("ADMIN_SEED_EMAIL", "admin@portal.local")
ADMIN_SEED_PASSWORD = os.getenv("ADMIN_SEED_PASSWORD", "Admin@123")
POLICE_SEED_EMAIL = os.getenv("POLICE_SEED_EMAIL", "police@portal.local")
POLICE_SEED_PASSWORD = os.getenv("POLICE_SEED_PASSWORD", "Police@123")

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")

mongo_client = AsyncIOMotorClient(MONGODB_URI)
db = mongo_client[MONGODB_DB]
users_col = db["users"]
vehicles_col = db["stolen_vehicles"]
cases_col = db["cases"]
detections_col = db["detections"]
refresh_tokens_col = db["refresh_tokens"]

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {DEVICE}")

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "best.pt")
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model weights not found at {MODEL_PATH}")

yolo_model = torch.hub.load(
    "ultralytics/yolov5",
    "custom",
    path=MODEL_PATH,
    force_reload=False,
    trust_repo=True,
    device=DEVICE,
)
# YOLO Detection thresholds - increased for better accuracy, reduced false positives
yolo_model.conf = 0.55  # Confidence threshold (increased from 0.35 to reduce false positives)
yolo_model.iou = 0.50   # IOU threshold (increased from 0.45 for stricter NMS)
yolo_model.agnostic = False
yolo_model.multi_label = False
yolo_model.max_det = 5  # Increased from 2 to capture multiple plates if present

# OCR Confidence threshold - increased for better text accuracy
OCR_CONFIDENCE_THRESHOLD = 0.50  # Increased from 0.35 to filter low-confidence OCR results
PLATE_MIN_LEN = 4  # Minimum plate length
PLATE_MAX_LEN = 15  # Maximum plate length

# Plate region validation thresholds
PLATE_MIN_AREA = 500  # Minimum plate area in pixels
PLATE_MAX_AREA = 100000  # Maximum plate area
PLATE_ASPECT_RATIO_MIN = 2.0  # Min width/height ratio
PLATE_ASPECT_RATIO_MAX = 6.0  # Max width/height ratio

ocr = PaddleOCR(
    lang="en",
    device="gpu" if torch.cuda.is_available() else "cpu",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,
    enable_cinn=False,
    cpu_threads=2,
)

executor = ThreadPoolExecutor(max_workers=4)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RegisterCustomerRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: str = ""


class RegisterStolenVehicleRequest(BaseModel):
    vehicle_number: str = Field(min_length=4, max_length=20)
    vehicle_type: str = Field(min_length=2, max_length=30)
    make: str = ""
    model: str = ""
    color: str = ""
    last_seen_location: str = Field(min_length=2, max_length=140)
    last_seen_time: datetime
    notes: str = ""


class UpdateCaseRequest(BaseModel):
    status: str = Field(pattern="^(assigned|accepted|investigating|found|closed)$")
    note: str = ""


class CreateStaffRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(pattern="^(admin|police)$")
    phone: str = ""


class UpdateUserStatusRequest(BaseModel):
    is_active: bool


class DetectFrame(BaseModel):
    data: str


class AdminDetectRequest(BaseModel):
    frames: List[DetectFrame]
    location: str = "Unknown"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_access_token(user_id: str, role: str) -> str:
    expire = now_utc() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = now_utc() + timedelta(days=30)
    payload = {"sub": user_id, "type": "refresh", "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def serialize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    out = dict(doc)
    out["id"] = str(out.pop("_id"))
    for key, value in list(out.items()):
        if isinstance(value, ObjectId):
            out[key] = str(value)
        if isinstance(value, datetime):
            out[key] = value.isoformat()
    return out


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    user = await users_col.find_one({"_id": ObjectId(user_id), "is_active": True})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def ensure_role(current_user: Dict[str, Any], roles: List[str]) -> None:
    if current_user.get("role") not in roles:
        raise HTTPException(status_code=403, detail="Permission denied")


async def ensure_seed_user(email: str, password: str, role: str, full_name: str) -> None:
    existing = await users_col.find_one({"email": email.lower()})
    if existing:
        return
    await users_col.insert_one(
        {
            "full_name": full_name,
            "email": email.lower(),
            "phone": "",
            "password_hash": hash_password(password),
            "role": role,
            "is_active": True,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
    )


async def startup_tasks() -> None:
    await users_col.create_index("email", unique=True)
    await users_col.create_index("role")
    await vehicles_col.create_index("vehicle_number")
    await vehicles_col.create_index([("customer_id", 1), ("status", 1)])
    await cases_col.create_index([("police_id", 1), ("status", 1)])
    await detections_col.create_index([("detected_at", -1)])
    await refresh_tokens_col.create_index([("user_id", 1), ("expires_at", -1)])
    await ensure_seed_user(ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, "admin", "Portal Admin")
    await ensure_seed_user(POLICE_SEED_EMAIL, POLICE_SEED_PASSWORD, "police", "Assigned Police")


@lru_cache(maxsize=256)
def clean_text(text: str) -> str:
    return "".join(c for c in text if c.isalnum()).upper()


def preprocess_image(image: np.ndarray) -> np.ndarray:
    # Keep inference fast enough for realtime admin detection requests.
    max_dimension = 576
    height, width = image.shape[:2]
    if max(height, width) > max_dimension:
        scale = max_dimension / max(height, width)
        image = cv2.resize(image, (int(width * scale), int(height * scale)))

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_chan, a_chan, b_chan = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = cv2.merge((clahe.apply(l_chan), a_chan, b_chan))
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)


def preprocess_plate_region_for_ocr(plate_region: np.ndarray) -> np.ndarray:
    h, w = plate_region.shape[:2]
    if h < 48 or w < 140:
        scale = max(2.0, 48 / max(h, 1), 140 / max(w, 1))
        plate_region = cv2.resize(plate_region, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(plate_region, cv2.COLOR_BGR2GRAY)
    denoised = cv2.bilateralFilter(gray, d=5, sigmaColor=75, sigmaSpace=75)
    boosted = cv2.convertScaleAbs(denoised, alpha=1.3, beta=8)
    return cv2.cvtColor(boosted, cv2.COLOR_GRAY2BGR)


def decode_base64_image(base64_string: str) -> np.ndarray:
    raw = base64_string.split("base64,")[-1]
    image = Image.open(io.BytesIO(base64.b64decode(raw))).convert("RGB")
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def encode_image_to_base64(image: np.ndarray) -> str:
    success, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not success:
        return ""
    return base64.b64encode(encoded.tobytes()).decode("utf-8")


def extract_ocr_candidates(ocr_result: Any) -> List[tuple[str, float]]:
    candidates: List[tuple[str, float]] = []
    if not ocr_result:
        return candidates

    for item in ocr_result:
        try:
            rec_texts = item.get("rec_texts", [])
            rec_scores = item.get("rec_scores", [])
            if rec_texts and rec_scores:
                for text, score in zip(rec_texts, rec_scores):
                    candidates.append((str(text), float(score)))
                continue
        except Exception:
            pass

        if isinstance(item, list):
            for word_info in item:
                try:
                    candidates.append((str(word_info[1][0]), float(word_info[1][1])))
                except Exception:
                    continue

    return candidates


def looks_like_plate(text: str) -> bool:
    """Validate if text looks like a license plate with improved accuracy."""
    # Remove common OCR artifacts and normalize
    text = text.strip().upper()
    
    # Check length
    if not (PLATE_MIN_LEN <= len(text) <= PLATE_MAX_LEN):
        return False
    
    # Must have alphanumeric characters
    alphanumeric = sum(1 for c in text if c.isalnum())
    if alphanumeric < PLATE_MIN_LEN:
        return False
    
    # Remove common OCR errors - allow max 2 non-alphanumeric chars
    non_alphanum = sum(1 for c in text if not c.isalnum())
    if non_alphanum > 2:
        return False
    
    # Most plates have letters and digits mixed
    has_letter = any(c.isalpha() for c in text)
    has_digit = any(c.isdigit() for c in text)
    
    return has_letter and has_digit


def validate_plate_region(x1: int, y1: int, x2: int, y2: int, frame_h: int, frame_w: int) -> bool:
    """Validate if bounding box looks like a valid plate region."""
    box_w = x2 - x1
    box_h = y2 - y1
    area = box_w * box_h
    
    # Check area constraints
    if area < PLATE_MIN_AREA or area > PLATE_MAX_AREA:
        return False
    
    # Check aspect ratio (plates are wider than tall)
    if box_h > 0:
        aspect_ratio = box_w / box_h
        if not (PLATE_ASPECT_RATIO_MIN <= aspect_ratio <= PLATE_ASPECT_RATIO_MAX):
            return False
    
    # Check if region is within frame bounds
    margin = 10
    if x1 < -margin or y1 < -margin or x2 > frame_w + margin or y2 > frame_h + margin:
        return False
    
    return True


def process_single_frame(frame: np.ndarray) -> Dict[str, Any]:
    processed = preprocess_image(frame)
    frame_h, frame_w = frame.shape[:2]
    
    with torch.no_grad():
        results = yolo_model(processed)

    detected_plates: List[str] = []
    best_plate_image: Optional[np.ndarray] = None
    best_confidence = 0.0

    for det in results.xyxy[0]:
        detection_confidence = float(det[4])
        if detection_confidence < yolo_model.conf:
            continue

        x1, y1, x2, y2 = map(int, det[:4])
        
        # Validate plate region before OCR to reduce false positives
        if not validate_plate_region(x1, y1, x2, y2, frame_h, frame_w):
            continue
        
        box_h = y2 - y1
        box_w = x2 - x1
        x1 = max(0, x1 - max(4, int(0.08 * box_w)))
        y1 = max(0, y1 - max(3, int(0.12 * box_h)))
        x2 = min(processed.shape[1], x2 + max(4, int(0.08 * box_w)))
        y2 = min(processed.shape[0], y2 + max(3, int(0.12 * box_h)))

        plate_region = processed[y1:y2, x1:x2]
        if plate_region.shape[0] < 20 or plate_region.shape[1] < 20:
            continue

        try:
            # Run OCR on raw crop first; only run enhanced OCR when raw pass finds nothing.
            raw_candidates = extract_ocr_candidates(ocr.predict(plate_region))
            candidate_batches = [raw_candidates]
            if not raw_candidates:
                candidate_batches.append(
                    extract_ocr_candidates(ocr.predict(preprocess_plate_region_for_ocr(plate_region)))
                )

            for candidates in candidate_batches:
                for text, confidence in candidates:
                    if confidence < OCR_CONFIDENCE_THRESHOLD:
                        continue
                    cleaned = clean_text(text)
                    if not looks_like_plate(cleaned):
                        continue
                    detected_plates.append(cleaned)
                    if confidence > best_confidence:
                        best_confidence = confidence
                        best_plate_image = plate_region
        except Exception as exc:
            print(f"OCR Error: {exc}")

    return {"plates": detected_plates, "plate_image": best_plate_image, "best_confidence": best_confidence}


async def process_frame_async(frame_data: DetectFrame) -> Dict[str, Any]:
    loop = asyncio.get_event_loop()
    try:
        frame = await loop.run_in_executor(executor, decode_base64_image, frame_data.data)
        return await loop.run_in_executor(executor, process_single_frame, frame)
    except Exception:
        # Drop malformed frames instead of failing the full detection request.
        return {"plates": [], "plate_image": None, "best_confidence": 0.0}


async def maybe_send_notification(event_type: str, payload: Dict[str, Any]) -> None:
    if not N8N_WEBHOOK_URL:
        return
    try:
        requests.post(N8N_WEBHOOK_URL, json={"event_type": event_type, **payload}, timeout=6)
    except Exception:
        pass


async def issue_tokens(user: Dict[str, Any]) -> Dict[str, str]:
    access_token = create_access_token(str(user["_id"]), user["role"])
    refresh_token = create_refresh_token(str(user["_id"]))
    await refresh_tokens_col.insert_one(
        {
            "user_id": user["_id"],
            "token": refresh_token,
            "is_revoked": False,
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(days=30),
        }
    )
    return {"access_token": access_token, "refresh_token": refresh_token}


async def run_detection_flow(frames: List[DetectFrame], location: str, admin_user: Dict[str, Any]) -> Dict[str, Any]:
    results = await asyncio.gather(*[process_frame_async(frame) for frame in frames])

    all_detections: List[str] = []
    best_plate_image: Optional[np.ndarray] = None
    best_confidence = 0.0

    for result in results:
        all_detections.extend(result["plates"])
        if result["plate_image"] is not None and result["best_confidence"] > best_confidence:
            best_plate_image = result["plate_image"]
            best_confidence = result["best_confidence"]

    if not all_detections:
        return {"error": "No license plates detected", "total_frames_processed": len(frames), "total_detections": 0, "plate_image": None}

    plate_counts = Counter(all_detections)
    plate_number, occurrences = plate_counts.most_common(1)[0]
    matched_vehicle = await vehicles_col.find_one({"vehicle_number": plate_number, "status": {"$in": ["reported", "investigating"]}})

    case_id = None
    assigned_police_id = None

    if matched_vehicle:
        police = await users_col.find_one({"role": "police", "is_active": True})
        if police:
            assigned_police_id = str(police["_id"])

        case_doc = {
            "vehicle_id": matched_vehicle["_id"],
            "customer_id": matched_vehicle["customer_id"],
            "police_id": ObjectId(assigned_police_id) if assigned_police_id else None,
            "status": "assigned" if assigned_police_id else "detected",
            "history": [{"status": "detected", "note": f"Matched at {location}", "updated_by": str(admin_user["_id"]), "updated_at": now_utc()}],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        case_insert = await cases_col.insert_one(case_doc)
        case_id = str(case_insert.inserted_id)

        await vehicles_col.update_one(
            {"_id": matched_vehicle["_id"]},
            {"$set": {
                "status": "investigating",
                "updated_at": now_utc(),
                "last_detected_at": now_utc(),
                "last_detected_location": location,
                "assigned_police_id": ObjectId(assigned_police_id) if assigned_police_id else None,
                "latest_case_id": case_insert.inserted_id,
            }},
        )

        # Send notification to customer
        await maybe_send_notification("vehicle_detected", {
            "customer_email": matched_vehicle.get("customer_email", ""),
            "vehicle_number": plate_number,
            "location": location,
            "detected_at": now_utc().isoformat(),
            "case_id": case_id,
            "reason": "Your reported stolen vehicle has been detected",
        })
        
        # Send notification to assigned police officer
        if police:
            # Get customer user info to get phone number
            customer_user = await users_col.find_one({"_id": matched_vehicle["customer_id"]})
            customer_phone = customer_user.get("phone", "") if customer_user else "+917842149538"
            customer_name = customer_user.get("full_name", "") if customer_user else matched_vehicle.get("customer_name", "Bhanu")
            
            await maybe_send_notification("plate_detected_police", {
                "police_email": police.get("email", ""),
                "police_name": police.get("full_name", ""),
                "vehicle_number": plate_number,
                "vehicle_type": matched_vehicle.get("vehicle_type", ""),
                "vehicle_color": matched_vehicle.get("color", ""),
                "location": location,
                "detected_at": now_utc().isoformat(),
                "case_id": case_id,
                "customer_name": customer_user.get("full_name", "") if customer_user else matched_vehicle.get("customer_name", "Bhanu"),
                "customer_phone": customer_user.get("phone", "") if customer_user else "+917842149538",
                "reason": "A stolen vehicle has been detected by the camera network",
            })

    await detections_col.insert_one({
        "plate_number": plate_number,
        "confidence": occurrences / max(len(frames), 1),
        "total_detections": len(all_detections),
        "matched_vehicle_id": matched_vehicle.get("_id") if matched_vehicle else None,
        "case_id": ObjectId(case_id) if case_id else None,
        "location": location,
        "captured_by_admin": admin_user["_id"],
        "detected_at": now_utc(),
    })

    return {
        "plate_number": plate_number,
        "confidence": occurrences / len(frames),
        "total_frames_processed": len(frames),
        "total_detections": len(all_detections),
        "plate_image": encode_image_to_base64(best_plate_image) if best_plate_image is not None else None,
        "match_found": bool(matched_vehicle),
        "case_id": case_id,
        "assigned_police_id": assigned_police_id,
    }


@app.get("/")
async def root() -> Dict[str, str]:
    return {"message": "Stolen Vehicle Detection API running"}


@app.post("/auth/customer/register")
async def register_customer(payload: RegisterCustomerRequest) -> Dict[str, Any]:
    if await users_col.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        inserted = await users_col.insert_one({
            "full_name": payload.full_name,
            "email": payload.email.lower(),
            "phone": payload.phone,
            "password_hash": hash_password(payload.password),
            "role": "customer",
            "is_active": True,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        })
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=400, detail="Email already registered") from exc

    created_user = await users_col.find_one({"_id": inserted.inserted_id})
    tokens = await issue_tokens(created_user)
    return {
        "token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "user": {"id": str(inserted.inserted_id), "full_name": payload.full_name, "email": payload.email, "role": "customer"},
    }


@app.post("/auth/login")
async def login(payload: LoginRequest) -> Dict[str, Any]:
    user = await users_col.find_one({"email": payload.email.lower(), "is_active": True})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    tokens = await issue_tokens(user)
    return {
        "token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "user": {"id": str(user["_id"]), "full_name": user.get("full_name", ""), "email": user["email"], "role": user["role"]},
    }


@app.post("/auth/refresh")
async def refresh_access_token(payload: RefreshTokenRequest) -> Dict[str, str]:
    try:
        decoded = jwt.decode(payload.refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = decoded.get("sub")
    stored = await refresh_tokens_col.find_one({"token": payload.refresh_token, "is_revoked": False})
    if not user_id or not stored:
        raise HTTPException(status_code=401, detail="Refresh token revoked or expired")

    user = await users_col.find_one({"_id": ObjectId(user_id), "is_active": True})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return {"token": create_access_token(str(user["_id"]), user["role"])}


@app.post("/auth/logout")
async def logout(payload: RefreshTokenRequest) -> Dict[str, str]:
    await refresh_tokens_col.update_one({"token": payload.refresh_token}, {"$set": {"is_revoked": True}})
    return {"message": "Logged out"}


@app.get("/customer/stolen-vehicles")
async def customer_vehicles(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    ensure_role(current_user, ["customer"])
    items = []
    async for vehicle in vehicles_col.find({"customer_id": current_user["_id"]}).sort("created_at", -1):
        doc = serialize_doc(vehicle)
        if vehicle.get("latest_case_id"):
            case_doc = await cases_col.find_one({"_id": vehicle["latest_case_id"]})
            doc["latest_case"] = serialize_doc(case_doc)
            detection_doc = await detections_col.find_one(
                {"case_id": vehicle["latest_case_id"]},
                sort=[("detected_at", -1)],
            )
            if detection_doc:
                doc["latest_detection"] = {
                    "location": detection_doc.get("location", "Unknown"),
                    "detected_at": detection_doc.get("detected_at"),
                }
        elif vehicle.get("last_detected_location"):
            doc["latest_detection"] = {
                "location": vehicle.get("last_detected_location", "Unknown"),
                "detected_at": vehicle.get("last_detected_at"),
            }
        items.append(doc)
    return {"vehicles": items}


@app.post("/customer/stolen-vehicles")
async def register_stolen_vehicle(payload: RegisterStolenVehicleRequest, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    ensure_role(current_user, ["customer"])

    vehicle_number = clean_text(payload.vehicle_number)
    if await vehicles_col.find_one({"vehicle_number": vehicle_number, "status": {"$in": ["reported", "investigating"]}}):
        raise HTTPException(status_code=400, detail="This vehicle is already reported")

    inserted = await vehicles_col.insert_one({
        "customer_id": current_user["_id"],
        "customer_email": current_user.get("email", ""),
        "vehicle_number": vehicle_number,
        "vehicle_type": payload.vehicle_type,
        "make": payload.make,
        "model": payload.model,
        "color": payload.color,
        "last_seen_location": payload.last_seen_location,
        "last_seen_time": payload.last_seen_time,
        "notes": payload.notes,
        "status": "reported",
        "created_at": now_utc(),
        "updated_at": now_utc(),
    })

    vehicle = await vehicles_col.find_one({"_id": inserted.inserted_id})
    return {"vehicle": serialize_doc(vehicle)}


@app.get("/admin/insights")
async def admin_insights(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    ensure_role(current_user, ["admin"])
    return {
        "total_users": await users_col.count_documents({}),
        "total_customers": await users_col.count_documents({"role": "customer"}),
        "total_police": await users_col.count_documents({"role": "police"}),
        "active_theft_reports": await vehicles_col.count_documents({"status": {"$in": ["reported", "investigating"]}}),
        "found_vehicles": await vehicles_col.count_documents({"status": "found"}),
        "open_cases": await cases_col.count_documents({"status": {"$in": ["assigned", "accepted", "investigating", "detected"]}}),
    }


@app.get("/admin/users")
async def admin_users(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    ensure_role(current_user, ["admin"])
    items = []
    async for user in users_col.find({}, {"password_hash": 0}).sort("created_at", -1):
        items.append(serialize_doc(user))
    return {"users": items}


@app.post("/admin/users/staff")
async def admin_create_staff(payload: CreateStaffRequest, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    ensure_role(current_user, ["admin"])
    if await users_col.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=400, detail="Email already exists")

    try:
        inserted = await users_col.insert_one(
            {
                "full_name": payload.full_name,
                "email": payload.email.lower(),
                "phone": payload.phone,
                "password_hash": hash_password(payload.password),
                "role": payload.role,
                "is_active": True,
                "created_at": now_utc(),
                "updated_at": now_utc(),
            }
        )
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=400, detail="Email already exists") from exc
    user_doc = await users_col.find_one({"_id": inserted.inserted_id}, {"password_hash": 0})
    return {"user": serialize_doc(user_doc)}


@app.patch("/admin/users/{user_id}/status")
async def admin_update_user_status(
    user_id: str,
    payload: UpdateUserStatusRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    ensure_role(current_user, ["admin"])
    if str(current_user["_id"]) == user_id and not payload.is_active:
        raise HTTPException(status_code=400, detail="Admin cannot disable self")

    updated = await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": payload.is_active, "updated_at": now_utc()}},
    )
    if updated.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User status updated"}


@app.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    """Delete a user. Only admin can delete users."""
    ensure_role(current_user, ["admin"])
    
    # Prevent admin from deleting themselves
    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Admin cannot delete self")
    
    try:
        user_exists = await users_col.find_one({"_id": ObjectId(user_id)})
        if not user_exists:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete user
        await users_col.delete_one({"_id": ObjectId(user_id)})
        
        # Clean up related data
        if user_exists.get("role") == "customer":
            # Delete vehicles associated with customer
            await vehicles_col.delete_many({"customer_id": ObjectId(user_id)})
            # Delete cases associated with customer
            await cases_col.delete_many({"customer_id": ObjectId(user_id)})
        elif user_exists.get("role") == "police":
            # Unassign cases from police
            await cases_col.update_many(
                {"police_id": ObjectId(user_id)},
                {"$set": {"police_id": None, "status": "detected"}}
            )
        
        return {"message": f"User {user_exists.get('email')} deleted successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/admin/detections")
async def admin_detections(limit: int = 20, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    ensure_role(current_user, ["admin"])
    safe_limit = max(1, min(limit, 100))
    items: List[Dict[str, Any]] = []
    async for detection in detections_col.find({}).sort("detected_at", -1).limit(safe_limit):
        items.append(serialize_doc(detection))
    return {"detections": items}


@app.get("/admin/analytics/daily")
async def admin_daily_analytics(days: int = 7, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    ensure_role(current_user, ["admin"])
    safe_days = max(1, min(days, 60))
    start = now_utc() - timedelta(days=safe_days)

    pipeline = [
        {"$match": {"detected_at": {"$gte": start}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$detected_at"}
                },
                "detections": {"$sum": 1},
                "matches": {"$sum": {"$cond": [{"$ne": ["$matched_vehicle_id", None]}, 1, 0]}},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    rows = await detections_col.aggregate(pipeline).to_list(length=200)
    return {"daily": [{"date": row["_id"], "detections": row["detections"], "matches": row["matches"]} for row in rows]}


@app.post("/admin/detect")
async def admin_detect(payload: AdminDetectRequest, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    ensure_role(current_user, ["admin"])
    if not payload.frames:
        raise HTTPException(status_code=400, detail="At least one frame is required")
    return await run_detection_flow(payload.frames, payload.location, current_user)


@app.get("/police/cases")
async def police_cases(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    ensure_role(current_user, ["police"])
    query = {"$or": [{"police_id": current_user["_id"]}, {"police_id": None, "status": "detected"}]}
    items = []
    async for case_doc in cases_col.find(query).sort("created_at", -1):
        item = serialize_doc(case_doc)
        item["vehicle"] = serialize_doc(await vehicles_col.find_one({"_id": case_doc["vehicle_id"]}))
        item["customer"] = serialize_doc(await users_col.find_one({"_id": case_doc["customer_id"]}, {"password_hash": 0}))
        detection_doc = await detections_col.find_one(
            {"case_id": case_doc["_id"]},
            sort=[("detected_at", -1)],
        )
        if detection_doc:
            item["latest_detection"] = {
                "location": detection_doc.get("location", "Unknown"),
                "detected_at": detection_doc.get("detected_at"),
                "plate_number": detection_doc.get("plate_number", ""),
            }
        items.append(item)
    return {"cases": items}


@app.post("/police/cases/{case_id}/accept")
async def police_accept_case(case_id: str, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    ensure_role(current_user, ["police"])
    case_doc = await cases_col.find_one({"_id": ObjectId(case_id)})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Case not found")

    await cases_col.update_one(
        {"_id": case_doc["_id"]},
        {"$set": {"police_id": current_user["_id"], "status": "accepted", "updated_at": now_utc()}},
    )
    
    # Get vehicle and customer details for notification
    vehicle = await vehicles_col.find_one({"_id": case_doc["vehicle_id"]})
    customer = await users_col.find_one({"_id": case_doc["customer_id"]})
    
    # Send notification to customer
    if vehicle and customer:
        await maybe_send_notification("case_accepted", {
            "customer_email": customer.get("email", ""),
            "customer_name": customer.get("full_name", ""),
            "vehicle_number": vehicle.get("vehicle_number", ""),
            "police_name": current_user.get("full_name", ""),
            "police_phone": current_user.get("phone", ""),
            "case_id": case_id,
            "updated_at": now_utc().isoformat(),
            "reason": f"Police officer {current_user.get('full_name')} has accepted your case",
        })
    
    return {"message": "Case accepted"}


@app.patch("/police/cases/{case_id}")
async def police_update_case(case_id: str, payload: UpdateCaseRequest, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    ensure_role(current_user, ["police"])
    case_doc = await cases_col.find_one({"_id": ObjectId(case_id)})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Case not found")

    if case_doc.get("police_id") and str(case_doc.get("police_id")) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Case assigned to another officer")

    await cases_col.update_one(
        {"_id": case_doc["_id"]},
        {"$set": {"status": payload.status, "police_id": current_user["_id"], "updated_at": now_utc()}},
    )

    vehicle_status = "investigating"
    if payload.status in ["found", "closed"]:
        vehicle_status = "found" if payload.status == "found" else "closed"

    await vehicles_col.update_one({"_id": case_doc["vehicle_id"]}, {"$set": {"status": vehicle_status, "updated_at": now_utc()}})
    vehicle = await vehicles_col.find_one({"_id": case_doc["vehicle_id"]})

    await maybe_send_notification("case_status_updated", {
        "customer_email": vehicle.get("customer_email", "") if vehicle else "",
        "vehicle_number": vehicle.get("vehicle_number", "") if vehicle else "",
        "status": payload.status,
        "note": payload.note,
        "updated_at": now_utc().isoformat(),
    })

    return {"message": "Case updated"}


@app.post("/detect_plate")
async def detect_plate_compat(frames: List[Dict[str, str]]) -> Dict[str, Any]:
    converted = [DetectFrame(data=item["data"]) for item in frames]
    return await run_detection_flow(converted, "legacy-endpoint", {"_id": ObjectId(), "role": "admin"})


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
