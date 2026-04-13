# Quick Start: N8N Email Notifications Setup

## 🚀 5-Minute Setup Guide

### Prerequisites
- N8N Cloud account (https://n8n.cloud)
- Gmail account with App Password OR SendGrid API key
- Backend running with Python

### Step 1: Get N8N Webhook URL (2 minutes)

1. Log in to [n8n.cloud](https://n8n.cloud)
2. Create a new workflow or open existing one
3. Add "Webhook" node:
   - Click "+" → Search "Webhook" → Click it
   - In node settings, copy the displayed Webhook URL
   - It should look like: `https://your-instance-id.n8n.cloud/webhook/something`

### Step 2: Configure Backend (1 minute)

1. Open `backend/.env`
2. Add this line with your webhook URL:
   ```
   N8N_WEBHOOK_URL=https://your-instance-id.n8n.cloud/webhook/your-path
   ```
3. Save file

### Step 3: Import N8N Workflow (1 minute)

1. In n8n, go to Workflows
2. Click "Create Workflow" → "Import"
3. Upload `n8n_workflow_export.json` from project root
4. This creates all email notification nodes automatically ✓

### Step 4: Configure Email Provider (1 minute)

**If using Gmail:**
1. In n8n workflow, click each email node
2. Click "Select a credential" → "Create New"
3. Choose Gmail
4. Connect your Gmail account or use App Password

**If using SendGrid:**
1. Get API key from https://app.sendgrid.com/settings/api_keys
2. In n8n email node, paste the API key
3. Set Sender Email address

### Step 5: Deploy and Test (1 minute)

1. Restart backend:
   ```bash
   cd backend
   python main.py
   ```

2. Test webhook:
   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"event_type":"vehicle_detected","customer_email":"test@example.com","vehicle_number":"ABC123","location":"Downtown","detected_at":"2024-03-23T10:30:00Z","case_id":"123"}' \
     YOUR_WEBHOOK_URL
   ```

3. Check inbox for test email ✓

---

## 📧 What Emails Will Send Automatically

| Event | To | When |
|-------|-----|------|
| 🚨 Vehicle Detected | Customer | Stolen vehicle found by camera |
| 🚔 New Case Alert | Police | Case assigned to officer |
| ✓ Case Accepted | Customer | Officer accepts the case |
| 📋 Status Update | Customer | Case status changes (found/closed) |

---

## 🔧 Troubleshooting

### Email not sending?
- Check n8n workflow is active (switch on at top)
- Click "Execute" to test manually
- Check email credentials are correct

### Webhook not receiving events?
- Verify N8N_WEBHOOK_URL is set correctly in backend/.env
- Check backend console for "Maybe sending notification" logs
- Manually test webhook with curl command above

### Getting 404 error?
- Webhook URL path must match n8n webhook node path
- Example: If node path is "/stolen-vehicles", URL must end with "/stolen-vehicles"

---

## 📱 Email Template Customization

Edit email templates in n8n by:
1. Click email node
2. Edit "Subject" field
3. Edit "htmlEmail" field (use HTML format)
4. Use `{{ $json.variable_name }}` for dynamic data

Available variables:
- `customer_email`, `customer_name`, `customer_phone`
- `police_email`, `police_name`, `police_phone`
- `vehicle_number`, `vehicle_type`, `vehicle_color`
- `location`, `detected_at`, `case_id`
- `status`, `note`

---

## ✅ Success Indicators

- ✓ Backend logs show "event_type: vehicle_detected" when detection occurs
- ✓ N8N workflow executes (see execution history)
- ✓ Emails arrive in inbox within 30 seconds
- ✓ Email variables are populated (not showing `{{ }}`)

---

## 🆘 Support

For more help, see: [N8N_SETUP.md](./N8N_SETUP.md)

For n8n documentation: https://docs.n8n.io
