# 📐 N8N ARCHITECTURE - What to Build

## What You Need to Implement in N8N

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEBHOOK TRIGGER NODE                          │
│                   (Receives all events)                           │
│  URL: https://your-id.n8n.cloud/webhook/stolen-vehicles         │
│  Method: POST                                                     │
│  Auth: None                                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ JSON Data
                         │
                         ▼
         ┌───────────────────────────────┐
         │   SWITCH NODE (Router)        │
         │  Route by: event_type field   │
         └───────┬──────────┬────────┬───┘
                 │          │        │
          Case 0 │   Case 1 │ Case 2 │ Case 3
                 │          │        │
    ┌────────────▼┐  ┌──────▼──┐  ┌──▼────────┐  ┌──────▼──────┐
    │  EVENT 1    │  │ EVENT 2 │  │ EVENT 3  │  │  EVENT 4   │
    │  vehicle_   │  │ plate_  │  │ case_    │  │  case_     │
    │  detected   │  │ detected│  │ accepted │  │  status_   │
    │             │  │ _police │  │          │  │  updated   │
    └────────┬────┘  └────┬────┘  └────┬─────┘  └────┬───────┘
             │            │            │             │
    ┌────────▼────────┐   │        ┌────▼────────┐   │
    │  EMAIL NODE 1   │   │        │ EMAIL NODE 3│   │
    │                 │   │        │             │   │
    │ To: Customer    │   │        │ To: Customer│   │
    │ Subj: 🚨        │   │        │ Subj: ✓    │   │
    │ Vehicle Found!  │   │        │ Assigned!   │   │
    └─────────────────┘   │        └─────────────┘   │
                        ┌──▼──────────────┐          │
                        │  EMAIL NODE 2   │          │
                        │                 │          │
                        │ To: Police      │          │
                        │ Subj: 🚔 New    │          │
                        │ Case Alert      │          │
                        └─────────────────┘          │
                                              ┌──────▼──────────┐
                                              │  EMAIL NODE 4   │
                                              │                 │
                                              │ To: Customer    │
                                              │ Subj: 📋        │
                                              │ Status Update   │
                                              └─────────────────┘
```

---

## 4 EMAIL NODES YOU NEED

### NODE 1: Vehicle Detected → Customer

| Setting | Value |
|---------|-------|
| **To Email** | `{{ $json.customer_email }}` |
| **Subject** | 🚨 Your Vehicle {{ $json.vehicle_number }} Detected! |
| **Trigger When** | `event_type === 'vehicle_detected'` |
| **Body** | Alert with location, time, case ID |

**Payload Example:**
```json
{
  "event_type": "vehicle_detected",
  "customer_email": "john@example.com",
  "customer_name": "John Doe",
  "vehicle_number": "ABC123",
  "location": "Downtown",
  "detected_at": "2024-03-23T10:30:00Z",
  "case_id": "12345"
}
```

---

### NODE 2: Plate Detected → Police Officer

| Setting | Value |
|---------|-------|
| **To Email** | `{{ $json.police_email }}` |
| **Subject** | 🚔 NEW CASE: Vehicle {{ $json.vehicle_number }} Detected |
| **Trigger When** | `event_type === 'plate_detected_police'` |
| **Body** | Action alert with vehicle details, location, reporter info |

**Payload Example:**
```json
{
  "event_type": "plate_detected_police",
  "police_email": "officer@police.gov",
  "police_name": "Officer Brown",
  "police_phone": "555-0123",
  "vehicle_number": "ABC123",
  "vehicle_type": "SUV",
  "vehicle_color": "Blue",
  "location": "Downtown",
  "detected_at": "2024-03-23T10:30:00Z",
  "case_id": "12345",
  "customer_name": "John Doe",
  "customer_phone": "555-9999"
}
```

---

### NODE 3: Case Accepted → Customer

| Setting | Value |
|---------|-------|
| **To Email** | `{{ $json.customer_email }}` |
| **Subject** | ✓ Officer Assigned: Case {{ $json.case_id }} |
| **Trigger When** | `event_type === 'case_accepted'` |
| **Body** | Confirmation with officer details |

**Payload Example:**
```json
{
  "event_type": "case_accepted",
  "customer_email": "john@example.com",
  "customer_name": "John Doe",
  "vehicle_number": "ABC123",
  "police_name": "Officer Brown",
  "police_phone": "555-0123",
  "case_id": "12345",
  "updated_at": "2024-03-23T10:35:00Z"
}
```

---

### NODE 4: Status Updated → Customer

| Setting | Value |
|---------|-------|
| **To Email** | `{{ $json.customer_email }}` |
| **Subject** | 📋 Update on Your Vehicle {{ $json.vehicle_number }} |
| **Trigger When** | `event_type === 'case_status_updated'` |
| **Body** | Status change (found/closed/investigating) with notes |

**Payload Example:**
```json
{
  "event_type": "case_status_updated",
  "customer_email": "john@example.com",
  "vehicle_number": "ABC123",
  "status": "found",
  "note": "Vehicle found abandoned in parking lot",
  "updated_at": "2024-03-23T11:45:00Z"
}
```

---

## 📋 IMPLEMENTATION FLOW

| Step | What to Do | Time |
|------|-----------|------|
| 1 | Create n8n workflow | 1 min |
| 2 | Add Webhook node (GET URL!) | 2 min |
| 3 | Add Switch node | 2 min |
| 4 | Create Email Node 1 (vehicle_detected) | 3 min |
| 5 | Create Email Node 2 (plate_detected_police) | 3 min |
| 6 | Create Email Node 3 (case_accepted) | 3 min |
| 7 | Create Email Node 4 (case_status_updated) | 3 min |
| 8 | Configure email provider (Gmail/SendGrid) | 5 min |
| 9 | Test each email scenario | 5 min |
| 10 | Activate workflow (toggle ON) | 1 min |
| **TOTAL** | | **~28 min** |

---

## ✅ DELIVERABLES

After completion, you should have:

```
✓ 1 Webhook Node
  - Listens for POST requests
  - URL: https://your-id.n8n.cloud/webhook/...

✓ 1 Switch Node  
  - Routes to correct branch based on event_type

✓ 4 Email Nodes
  - Node 1: vehicle_detected → customer email
  - Node 2: plate_detected_police → police email
  - Node 3: case_accepted → customer email
  - Node 4: case_status_updated → customer email

✓ Email Credentials
  - Gmail OR SendGrid configured
  - Can send emails successfully

✓ Active Workflow
  - Toggle is ON
  - Listening for webhooks 24/7
```

---

## 🔗 HOW IT WORKS

```
Timeline:

T+0s   → Vehicle detected in camera feed
         Backend processes image
         ↓

T+2s   → Plate recognized
         Vehicle matched to database
         ↓

T+3s   → Backend sends webhook to N8N
         POST to: https://your-id.n8n.cloud/webhook/...
         Payload: { event_type: "vehicle_detected", ... }
         ↓

T+4s   → N8N receives webhook
         Switch node evaluates: event_type === "vehicle_detected"
         Routes to Email Node 1
         ↓

T+5s   → Email node processes template
         Fills in variables: {{ $json.customer_email }}, etc.
         Sends via Gmail/SendGrid
         ↓

T+15s  → Email arrives in customer inbox
         Customer sees: "🚨 Your Vehicle ABC123 Detected!"
         ✓ COMPLETE
```

---

## 🎯 SUCCESS CRITERIA

✅ Workflow is Active (toggle ON)
✅ Received test email within 30 seconds
✅ Email subject has variables filled (not `{{ }}`)
✅ Email body is HTML-formatted properly
✅ N8N shows successful executions in log
✅ Backend can reach webhook URL

---

## 📄 REFERENCES

For detailed setup steps, see:
- **N8N_IMPLEMENTATION_PROMPT.md** ← FULL GUIDE (follow this step-by-step)
- **WEBHOOK_URL_QUICK.md** ← Just getting the webhook URL
- **N8N_SETUP.md** ← Comprehensive documentation
- **N8N_QUICKSTART.md** ← Quick reference

---

## 🚀 YOU'VE GOT THIS!

Follow N8N_IMPLEMENTATION_PROMPT.md step-by-step and you'll have the complete notification system working in ~30 minutes!

Questions? Check the troubleshooting section in N8N_IMPLEMENTATION_PROMPT.md
