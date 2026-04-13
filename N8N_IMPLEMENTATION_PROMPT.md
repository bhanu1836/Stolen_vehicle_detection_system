# 🎯 N8N Cloud Implementation Prompt - Complete Guide

## For You to Execute Independently

Use this guide step-by-step to set up everything in n8n cloud yourself.

---

## ✅ PRE-REQUISITES (Before You Start)

- [ ] N8N Cloud account created at https://n8n.cloud
- [ ] Gmail account OR SendGrid account (for sending emails)
- [ ] Stolen Vehicle Detection project files available
- [ ] Backend will be running on `localhost:8000`

---

## 🔗 PART 1: GET WEBHOOK URL (DO THIS FIRST)

### Step 1.1: Create New Workflow

1. Log in to https://n8n.cloud
2. Go to "Workflows" section
3. Click "New Workflow" button
4. Name it: `Stolen Vehicle Detection - Email Notifications`
5. Click "Create"

### Step 1.2: Add Webhook Trigger Node

1. In the workflow editor, you see "Start here" in the middle
2. Click the "+" button or click "Start here"
3. Search for: `Webhook`
4. Click on "Webhook" (the first result)
5. The Webhook node is added to canvas

### Step 1.3: Configure Webhook Node

**In the Webhook node settings (right panel):**

1. **HTTP Method**: Keep as `POST`
2. **Authentication**: Keep as `None` (for now, basic auth)
3. **Path** (optional): You can leave blank
4. Click the "Test URL" button to generate a webhook URL

### Step 1.4: Copy Webhook URL

1. Look for the blue box showing: "Test URL"
2. The full URL will be shown like:
   ```
   https://your-workspace-12345.n8n.cloud/webhook/abc123def456
   ```
3. **COPY THIS ENTIRE URL** - you need it in step 2

✅ **Save this URL safely** - you'll use it in backend/.env

---

## 📧 PART 2: SET UP EMAIL ROUTING

### Step 2.1: Add Switch Node (Event Router)

1. Click "+" to add next node
2. Search for: `Switch`
3. Click "Switch" node
4. Connect it from Webhook node

### Step 2.2: Configure Switch for Event Types

**In Switch node settings:**

1. **Mode**: Select `Expression` (from dropdown)
2. **Add Cases** - Click "Add Case" button for each:

**Case 1:**
```
Condition: $json.event_type === 'vehicle_detected'
Output: 0
```

**Case 2:**
```
Condition: $json.event_type === 'plate_detected_police'
Output: 1
```

**Case 3:**
```
Condition: $json.event_type === 'case_accepted'
Output: 2
```

**Case 4:**
```
Condition: $json.event_type === 'case_status_updated'
Output: 3
```

3. **Fallback Output**: Leave as default (logs unknown events)

✅ **Now you have 4 routes** - one for each notification type

---

## 🚀 PART 3: CREATE EMAIL NOTIFICATION BRANCHES

### Step 3.1: Email #1 - Vehicle Detected (to Customer)

1. From Switch node output 0, add a new node
2. Search and add: `Gmail` or `SendGrid` node
3. Name it: `Send Email - Vehicle Detected`

**Email Node Settings:**

```
From Email: noreply@stolen-vehicle-system.com
To Email: {{ $json.customer_email }}

Subject: 🚨 Your Vehicle {{ $json.vehicle_number }} Detected!

Body (HTML):
<h2>🚨 Vehicle Detection Alert</h2>
<p>Dear {{ $json.customer_name }},</p>
<p>Good news! Your reported stolen vehicle <strong>{{ $json.vehicle_number }}</strong> has been detected!</p>

<div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p><strong>📍 Location:</strong> {{ $json.location }}</p>
  <p><strong>⏰ Time:</strong> {{ $json.detected_at }}</p>
  <p><strong>👮 Case ID:</strong> {{ $json.case_id }}</p>
</div>

<p>A police officer will be investigating this case. You will receive updates as the investigation progresses.</p>

<p>Best regards,<br/><strong>Smart Plate AI - Stolen Vehicle Detection System</strong></p>
```

### Step 3.2: Email #2 - Police Alert (to Officer)

1. From Switch node output 1, add new node: `Gmail` or `SendGrid`
2. Name it: `Send Email - Police Alert`

**Email Node Settings:**

```
From Email: noreply@stolen-vehicle-system.com
To Email: {{ $json.police_email }}

Subject: 🚔 NEW CASE: Vehicle {{ $json.vehicle_number }} Detected

Body (HTML):
<h2>🚔 New Case Assignment</h2>
<p>Officer {{ $json.police_name }},</p>
<p>A stolen vehicle matching reports has been detected!</p>

<div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3>📊 Vehicle Details:</h3>
  <ul>
    <li><strong>Plate:</strong> {{ $json.vehicle_number }}</li>
    <li><strong>Type:</strong> {{ $json.vehicle_type }}</li>
    <li><strong>Color:</strong> {{ $json.vehicle_color }}</li>
    <li><strong>Location:</strong> {{ $json.location }}</li>
    <li><strong>Time:</strong> {{ $json.detected_at }}</li>
  </ul>
</div>

<div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3>👤 Reporter Information:</h3>
  <ul>
    <li><strong>Name:</strong> {{ $json.customer_name }}</li>
    <li><strong>Phone:</strong> {{ $json.customer_phone }}</li>
  </ul>
</div>

<p><strong>🔗 Case ID:</strong> {{ $json.case_id }}</p>

<p>Please log in to the police portal to accept this case and begin investigation.</p>

<p>Best regards,<br/><strong>Smart Plate AI - Police Dispatch System</strong></p>
```

### Step 3.3: Email #3 - Case Accepted (to Customer)

1. From Switch node output 2, add new node: `Gmail` or `SendGrid`
2. Name it: `Send Email - Case Accepted`

**Email Node Settings:**

```
From Email: noreply@stolen-vehicle-system.com
To Email: {{ $json.customer_email }}

Subject: ✓ Officer Assigned: Case {{ $json.case_id }}

Body (HTML):
<h2>✓ Case Accepted</h2>
<p>Dear {{ $json.customer_name }},</p>
<p>Great news! A police officer has been assigned to your case.</p>

<div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p><strong>Officer Name:</strong> {{ $json.police_name }}</p>
  <p><strong>Officer Phone:</strong> {{ $json.police_phone }}</p>
  <p><strong>Vehicle Number:</strong> {{ $json.vehicle_number }}</p>
  <p><strong>Case ID:</strong> {{ $json.case_id }}</p>
</div>

<p>The officer will keep you updated on the investigation progress.</p>

<p>Best regards,<br/><strong>Smart Plate AI Team</strong></p>
```

### Step 3.4: Email #4 - Status Update (to Customer)

1. From Switch node output 3, add new node: `Gmail` or `SendGrid`
2. Name it: `Send Email - Status Update`

**Email Node Settings:**

```
From Email: noreply@stolen-vehicle-system.com
To Email: {{ $json.customer_email }}

Subject: 📋 Update on Your Vehicle {{ $json.vehicle_number }}

Body (HTML):
<h2>📋 Case Status Update</h2>
<p>Dear Customer,</p>
<p>There's an update on your reported vehicle <strong>{{ $json.vehicle_number }}</strong>:</p>

<div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p><strong>Status:</strong> <span style="color: #0066cc; font-size: 18px; font-weight: bold;">{{ $json.status }}</span></p>
  <p><strong>Note:</strong> {{ $json.note }}</p>
  <p><strong>Updated:</strong> {{ $json.updated_at }}</p>
</div>

<p>If you have any questions, please contact the investigating officer.</p>

<p>Best regards,<br/><strong>Smart Plate AI Team</strong></p>
```

---

## 🔐 PART 4: CONFIGURE EMAIL PROVIDER

### Step 4.1: Choose Your Email Provider

**Option A: Gmail (Recommended)**

For EACH email node you created:
1. In node settings, click "Select a credential" dropdown
2. Click "Create New"
3. Search for and select: `Gmail`
4. Click "Connect with Google"
5. Sign in with your Gmail account
6. Grant n8n permission to send emails
7. Click "Save"

**Option B: SendGrid**

For EACH email node:
1. In node settings, click "Select a credential" 
2. Click "Create New"
3. Select: `SendGrid`
4. Get your API key from: https://app.sendgrid.com/settings/api_keys
5. Paste the API key in n8n
6. Click "Save"

**Option C: Custom SMTP**

For EACH email node:
1. In node settings, click "Select a credential"
2. Click "Create New"
3. Select: `SMTP`
4. Fill in:
   - **Host**: smtp.yourprovider.com
   - **Port**: 587 or 465
   - **User**: your@email.com
   - **Password**: your-app-password
5. Click "Save"

---

## 🧪 PART 5: TEST THE WORKFLOW

### Step 5.1: Test in N8N

1. In top right corner, click **"Test"**
2. The Webhook node asks for test data
3. Choose event type and fill data:

**For vehicle_detected test:**
```json
{
  "event_type": "vehicle_detected",
  "customer_email": "your-email@gmail.com",
  "customer_name": "John Doe",
  "vehicle_number": "UP01AB1234",
  "location": "Downtown Shopping Center",
  "detected_at": "2024-03-23T10:30:00Z",
  "case_id": "507f1f77bcf86cd799439011"
}
```

4. Click "Execute"
5. Watch the nodes execute
6. Check your email inbox

**Expected Result:** Email arrives in **10-30 seconds** ✓

### Step 5.2: Test All 4 Events

Repeat Step 5.1 with these test payloads:

**Test vehicle_detected (to customer):**
```json
{
  "event_type": "vehicle_detected",
  "customer_email": "your-email@gmail.com",
  "customer_name": "John Doe",
  "vehicle_number": "ABC123",
  "location": "Downtown",
  "detected_at": "2024-03-23T10:30:00Z",
  "case_id": "12345"
}
```

**Test plate_detected_police (to police):**
```json
{
  "event_type": "plate_detected_police",
  "police_email": "your-email@gmail.com",
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

**Test case_accepted (to customer):**
```json
{
  "event_type": "case_accepted",
  "customer_email": "your-email@gmail.com",
  "customer_name": "John Doe",
  "vehicle_number": "ABC123",
  "police_name": "Officer Brown",
  "police_phone": "555-0123",
  "case_id": "12345",
  "updated_at": "2024-03-23T10:35:00Z"
}
```

**Test case_status_updated (to customer):**
```json
{
  "event_type": "case_status_updated",
  "customer_email": "your-email@gmail.com",
  "vehicle_number": "ABC123",
  "status": "found",
  "note": "Vehicle found abandoned in parking lot",
  "updated_at": "2024-03-23T11:45:00Z"
}
```

✅ **Each test should** send an email to your inbox

---

## 💾 PART 6: ACTIVATE & SAVE

### Step 6.1: Enable Workflow

1. In top right, toggle switch to **ON** (green)
2. You see: "Workflow is active"
3. Workflow is now listening for webhooks

### Step 6.2: Save Workflow

1. Ctrl+S or click "Save" button
2. Workflow is saved

✅ **Your N8N setup is complete!**

---

## 🔄 PART 7: CONNECT TO BACKEND

Now you need to tell your backend about this webhook URL.

### Step 7.1: Get Final Webhook URL

1. In n8n, click on Webhook node
2. Click **"Copy"** button next to the Test URL
3. URL is copied to clipboard
4. Example: `https://your-id.n8n.cloud/webhook/abc123def456`

### Step 7.2: Update Backend Configuration

1. Open file: `backend/.env`
2. Add this line:
```env
N8N_WEBHOOK_URL=https://your-id.n8n.cloud/webhook/abc123def456
```

Replace with your actual URL

### Step 7.3: Restart Backend

```bash
cd backend
python main.py
```

Once backend is running, test it:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "vehicle_detected",
    "customer_email": "your-email@gmail.com",
    "vehicle_number": "TEST123",
    "location": "Test Location",
    "detected_at": "2024-03-23T10:30:00Z",
    "case_id": "test-123"
  }' \
  https://your-id.n8n.cloud/webhook/abc123def456
```

✅ **You should receive an email**

---

## 📋 CHECKLIST - VERIFY EVERYTHING

- [ ] Webhook node created in n8n
- [ ] Switch node configured with 4 cases
- [ ] Email #1 (vehicle_detected) created
- [ ] Email #2 (plate_detected_police) created
- [ ] Email #3 (case_accepted) created
- [ ] Email #4 (case_status_updated) created
- [ ] All email credentials configured (Gmail/SendGrid)
- [ ] Workflow activated (toggle ON)
- [ ] Test emails received in inbox
- [ ] Webhook URL copied
- [ ] Backend .env updated with N8N_WEBHOOK_URL
- [ ] Backend running (`python main.py`)
- [ ] Backend test webhook works

---

## 🆘 TROUBLESHOOTING

### Email not sending?
1. Check n8n Executions tab - see error details
2. Verify email credentials are correct
3. Check your spam/junk folder
4. Test manually: Click "Execute" in email node

### Webhook not receiving?
1. Verify workflow is activated (toggle ON)
2. Check webhook URL is correct in backend
3. See n8n Executions to verify webhook triggered
4. Check backend logs for "sending notification"

### Variables showing {{ }}?
1. Variable name is wrong
2. Check webhook payload includes that field
3. Use exact spelling: `customer_email` not `customerEmail`

### Gmail OAuth not working?
1. Enable 2-Factor Authentication on your Gmail
2. Create App Password: https://myaccount.google.com/apppasswords
3. Use the generated password in n8n instead of Google OAuth

---

## 📊 WORKFLOW DIAGRAM

```
┌─────────────┐
│   Webhook   │ (Receives events from backend)
└──────┬──────┘
       │
┌──────▼──────────────┐
│   Switch Node       │ (Routes by event_type)
└──────┬──────┬───────┬──────┐
       │      │       │      │
    0  │      │ 1     │ 2    │ 3
       │      │       │      │
   ┌───▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
   │Email │ │Email│ │Email│ │Email│
   │ Cust │ │Police│ │ Cust│ │ Cust│
   │Detect│ │Alert │ │Accpt│ │Updt │
   └──────┘ └──────┘ └──────┘ └──────┘
      │        │        │        │
      └────────┼────────┼────────┘
               │
           Customer & Police Inbox
```

---

## 🎯 WHAT YOU'VE DONE

✅ Created n8n workflow with webhook
✅ Configured 4 email notification events
✅ Set up email provider (Gmail/SendGrid)
✅ Tested all email scenarios
✅ Connected to backend
✅ Now receiving real-time notifications!

---

## 📱 NEXT: FULL SYSTEM TEST

When you detect a vehicle through your system:

1. Backend detects plate
2. Backend sends webhook to n8n
3. N8N routes to correct email node
4. Email sent to customer OR police
5. ✓ They receive email in 10-30 seconds

**Your complete notification system is live!** 🚀

---

## 📚 REFERENCE

**Available Email Variables:**
- `{{ $json.event_type }}`
- `{{ $json.customer_email }}`
- `{{ $json.customer_name }}`
- `{{ $json.customer_phone }}`
- `{{ $json.police_email }}`
- `{{ $json.police_name }}`
- `{{ $json.police_phone }}`
- `{{ $json.vehicle_number }}`
- `{{ $json.vehicle_type }}`
- `{{ $json.vehicle_color }}`
- `{{ $json.location }}`
- `{{ $json.detected_at }}`
- `{{ $json.case_id }}`
- `{{ $json.status }}`
- `{{ $json.note }}`
- `{{ $json.updated_at }}`

Use these in email subjects, bodies, and conditions.

---

Good luck! You've got this! 🎯
