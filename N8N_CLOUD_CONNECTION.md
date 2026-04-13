# 🔗 Complete Guide: Connecting N8N Cloud to Your System

## Architecture Overview

```
┌─────────────────────────────────────┐
│   Your Flask/FastAPI Backend        │
│   (localhost:8000)                  │
├─────────────────────────────────────┤
│  When vehicle detected:             │
│  → Webhook POST to N8N              │
└──────────────┬──────────────────────┘
               │
               │ JSON Event Payload
               │ (HTTP POST)
               ▼
┌─────────────────────────────────────┐
│        N8N Cloud Instance           │
│  https://your-id.n8n.cloud          │
├─────────────────────────────────────┤
│  Webhook Trigger                    │
│    ↓ Switch by event_type           │
│  Email Nodes (Gmail/SendGrid)       │
└──────────────┬──────────────────────┘
               │
               │ Email via SMTP
               │
               ▼
        ┌──────────┬──────────┐
        │          │          │
        ▼          ▼          ▼
     Gmail      SendGrid   Other SMTP
```

## Step-by-Step Setup

### 1️⃣ Create N8N Cloud Account

**If you don't have n8n yet:**

1. Go to https://n8n.cloud
2. Click "Sign Up"
3. Create account with email
4. Verify email
5. Create workspace

**Sign In (if already have account):**

1. Go to https://n8n.cloud/login
2. Enter credentials
3. Click "Sign In"

### 2️⃣ Create a Webhook Node

**In your n8n workflow:**

1. **New Workflow**
   - Click "New" workflow
   - Name it: "Stolen Vehicle Detection - Notifications"

2. **Add Webhook Node**
   - Click "+" (Add Trigger)
   - Search for: "Webhook"
   - Click "Webhook" node

3. **Configure Webhook**
   - HTTP Method: `POST`
   - Authentication: Keep as "None" (or add API key later)
   - Click "Test URL"
   - Copy the webhook URL (full URL displayed)

**The URL will look like:**
```
https://your-workspace-id.n8n.cloud/webhook/e1a2b3c4d5e6f7g8
```

### 3️⃣ Save Webhook URL

1. Copy the full webhook URL
2. Open `backend/.env` in your text editor
3. Find the line: `N8N_WEBHOOK_URL=`
4. Paste your URL:
   ```env
   N8N_WEBHOOK_URL=https://your-workspace-id.n8n.cloud/webhook/e1a2b3c4d5e6f7g8
   ```
5. Save the file

### 4️⃣ Import N8N Workflow (Option A - Easier)

**Import Pre-built Workflow:**

1. In n8n, go back to Workflows list
2. Click "Create New Workflow"
3. Click "Import" button
4. Upload file: `n8n_workflow_export.json` (from your project root)
5. Click "Import"
6. Workflow loads with all nodes and email templates ready! ✓

### 4️⃣ Manual Setup (Option B - If import doesn't work)

**Manual Configuration:**

1. Add nodes in order:
   - Webhook (trigger) ✓ (already added)
   - Add "Switch" node
   - Add "Send Email" nodes (Gmail or SendGrid)

2. Connect nodes:
   - Webhook → Switch
   - Switch → Each email node
   - See `n8n_workflow_export.json` for details

### 5️⃣ Configure Email Provider

**Choose One:**

#### Option A: Gmail (Recommended)

1. In n8n, click "Send Email" node
2. Click "Select a credential" dropdown
3. Click "Create New"
4. Choose "Gmail" credential type
5. Follow Google OAuth flow:
   - Sign in to your Gmail account
   - Allow n8n to send emails
   - Click "Save"

6. Fill email fields:
   - From Email: `noreply@yourcompany.com`
   - To Email: `{{ $json.customer_email }}`
   - Subject: `🚨 Your Vehicle {{ $json.vehicle_number }} Detected!`

#### Option B: SendGrid

1. Get SendGrid API key:
   - Go to https://app.sendgrid.com
   - Settings → API Keys
   - Create new API key (copy it)

2. In n8n, click "Send Email" node
3. Click "Select a credential"
4. Choose "SendGrid"
5. Paste API key
6. Fill email fields with same template

#### Option C: Custom SMTP

1. In n8n, click "Send Email" node
2. Choose "SMTP" credential type
3. Fill in your email provider details:
   ```
   Host: smtp.yourprovider.com
   Port: 587 or 465
   User: your@email.com
   Password: your-password
   ```

### 6️⃣ Review Email Templates

**Each email node has:**
- **To:** `{{ $json.customer_email }}` (dynamic)
- **Subject:** Custom for each event
- **Body:** HTML formatted with variables

**Available Variables** (from webhook payload):
```
{{ $json.customer_email }}
{{ $json.customer_name }}
{{ $json.vehicle_number }}
{{ $json.police_name }}
{{ $json.location }}
{{ $json.detected_at }}
{{ $json.case_id }}
```

### 7️⃣ Test the Webhook

**Method 1: Use curl (easiest)**

```bash
# Open terminal/PowerShell
# Paste your webhook URL where it says WEBHOOK_URL

curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "vehicle_detected",
    "customer_email": "your-test@gmail.com",
    "customer_name": "Test Customer",
    "vehicle_number": "ABC123XYZ",
    "location": "Test Street, Downtown",
    "detected_at": "2024-03-23T10:30:00Z",
    "case_id": "507f1f77bcf86cd799439011"
  }' \
  WEBHOOK_URL
```

**Method 2: Use N8N Test**

1. In n8n workflow, click "Test" (top right)
2. Fill in test data:
   ```json
   {
     "event_type": "vehicle_detected",
     "customer_email": "test@example.com",
     ...
   }
   ```
3. Click "Execute"
4. Watch execution logs

**Expected Result:**
- ✓ HTTP 200 response
- ✓ Email sent in 10-30 seconds
- ✓ Check your inbox

### 8️⃣ Verify Email Received

1. Check your email inbox (and spam folder)
2. Email should have:
   - ✓ Correct subject line
   - ✓ Dynamic variables filled in (not `{{ }}`)
   - ✓ Professional HTML formatting
   - ✓ Action buttons or links

### 9️⃣ Deploy Backend

```bash
# Stop backend if running (Ctrl+C)

# Update .env file with your webhook URL
cd backend

# Install/update dependencies
pip install -r requirements.txt

# Start backend
python main.py
```

**Look for this in logs:**
```
Using device: cuda
Loaded YOLO model
FastAPI server running on http://0.0.0.0:8000
```

### 🔟 Full System Test

Now test the complete flow:

1. **Upload test image** via API or frontend
2. **Wait for detection** (~5-10 seconds)
3. **Check emails:**
   - Customer should receive: "🚨 Your Vehicle ABC123 Detected!"
   - Police should receive: "🚔 NEW CASE: Vehicle ABC123 Detected"
4. **Check n8n logs:** Each event should show execution
5. **Success!** ✓

---

## 🔍 Monitoring & Debugging

### Check N8N Execution Logs

1. In n8n, click "Executions" tab
2. See all webhook triggers
3. Click any execution to see details:
   - Input payload
   - Output from each node
   - Errors (if any)

### Debug Email Issues

**In n8n, click the email node:**
```
Show: Current execution output
Input: Webhook data
Process: Email node functions
Output: Email delivery status
```

### Debug Backend Issues

**Check backend logs:**
```bash
# Look for these messages:
"Maybe sending notification: vehicle_detected"
"Webhook POST to N8N success"
"Event sent: plate_detected_police"
```

---

## 🚨 Common Issues & Fixes

### "Webhook returns 404"
- **Cause**: Webhook URL is wrong or webhook node disabled
- **Fix**: 
  - Copy URL again (click test URL button)
  - Make sure workflow is active (toggle at top)
  - Redeploy backend with correct URL

### "Email not sending"
- **Cause**: Gmail/SendGrid credentials expired
- **Fix**:
  - Test email node manually
  - Re-authenticate credentials
  - Check API rate limits

### "Webhook timeout"
- **Cause**: Backend not running
- **Fix**:
  - Verify backend is running: `python main.py`
  - Check port 8000 is not blocked
  - Verify .env has correct settings

### "Email variables show {{ }}"
- **Cause**: Wrong variable name or format
- **Fix**:
  - Check webhook payload includes that field
  - Use exact variable name: `{{ $json.field_name }}`
  - Use correct case: `$json.customer_email` (not customerEmail)

---

## 📊 What Happens Next

### User Journey When Vehicle Detected

```
1. Vehicle Image → Backend Detection
   ⏱ 2-3 seconds

2. Backend Matches Vehicle
   ⏱ 1 second

3. Backend Sends Webhook to N8N
   ⏱ 1 second

4. N8N Routes Event to Email Nodes
   ⏱ <1 second

5. Emails Sent to Customer & Police
   ⏱ 5-15 seconds

TOTAL: ~20 seconds from detection to inbox
```

### User Notifications Timeline

```
T+0s    → Vehicle detected in camera feed
T+10s   → Customer receives: "🚨 Vehicle ABC123 Detected!"
T+10s   → Police receives: "🚔 NEW CASE: Vehicle ABC123"
T+30s   → Officer logs in, accepts case
T+35s   → Customer receives: "✓ Officer Assigned"
T+2hrs  → Officer finds vehicle, updates case
T+2h5s  → Customer receives: "📋 Vehicle Found!"
```

---

## 🔐 Security Checklist

- [ ] N8N webhook URL is HTTPS (should be by default)
- [ ] Your Gmail/SendGrid credentials are kept secure
- [ ] Backend .env is in .gitignore (not committed)
- [ ] Database credentials are strong
- [ ] JWT_SECRET is changed in production
- [ ] N8N workflow logs are monitored for errors

---

## 📱 Testing Checklist

- [ ] Webhook URL copied correctly
- [ ] Backend .env updated
- [ ] N8N workflow imported (or manually created)
- [ ] Email credentials configured
- [ ] Test webhook sent successfully
- [ ] Test email received
- [ ] Backend running locally
- [ ] Full system test passed

---

## 🎯 Production Deployment (When Ready)

1. **Update domain** in email templates
2. **Use production N8N** (not free tier if high volume)
3. **Set JWT_SECRET** to strong random value
4. **Enable SSL/TLS** for backend
5. **Monitor N8N logs** continuously
6. **Set email rate limits** in N8N
7. **Test failover** if email fails
8. **Document workflow** for team

---

Need help? Check:
- N8N_QUICKSTART.md (5-minute version)
- N8N_SETUP.md (comprehensive documentation)
- N8N documentation: https://docs.n8n.io

Good luck! 🚀
