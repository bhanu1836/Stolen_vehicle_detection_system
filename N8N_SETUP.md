# N8N Email Notification Setup Guide

This guide explains how to set up n8n workflows to send email notifications to customers and police officers when vehicles are detected or case statuses change.

## Overview

The backend sends webhook events to n8n via the `N8N_WEBHOOK_URL` environment variable. N8n then processes these events and sends emails to the appropriate recipients.

### Events Sent by Backend

1. **vehicle_detected** - Triggered when a stolen vehicle is detected
   - Sent to: Customer email
   - Also triggers: `plate_detected_police` event for assigned police officer

2. **plate_detected_police** - Triggered when a vehicle is detected (police notification)
   - Sent to: Police officer email
   - Contains: Vehicle details, location, customer info

3. **case_accepted** - Triggered when a police officer accepts a case
   - Sent to: Customer email
   - Contains: Police officer details, case info

4. **case_status_updated** - Triggered when a case status changes (found/closed/investigating)
   - Sent to: Customer email
   - Contains: New status, update notes

## Setting Up N8N Cloud

### Step 1: Create N8N Account

1. Go to [n8n.cloud](https://n8n.cloud)
2. Click "Sign Up"
3. Create an account with your email
4. Verify your email address
5. Create a new workspace

### Step 2: Create Webhook Node

1. In your n8n workflow, add a **Webhook** trigger node
2. Configure it as follows:
   - **HTTP Method**: POST
   - **Authentication**: None (or Basic Auth if you want to add API key)
   - Copy the webhook URL shown in the node

### Step 3: Set N8N_WEBHOOK_URL

Add your webhook URL to the backend `.env` file:

```env
N8N_WEBHOOK_URL=https://your-n8n-instance.n8n.cloud/webhook/your-webhook-path
```

Replace `your-n8n-instance` with your actual n8n cloud instance ID.

## N8N Workflow Templates

### Workflow 1: Customer Notifications (Vehicle Detected & Status Updates)

**Nodes:**
1. **Webhook** (Trigger)
   - Receives: `vehicle_detected` and `case_status_updated` events

2. **IF** (Condition Node)
   - Check if event_type is 'vehicle_detected' or 'case_status_updated'

3. **Set** (Data node) - For Vehicle Detected
   - Subject: `🚨 Your Vehicle {{$json.vehicle_number}} Detected!`
   - Body: 
   ```
   Dear {{$json.customer_name}},
   
   Good news! Your reported stolen vehicle {{$json.vehicle_number}} has been detected!
   
   📍 Location: {{$json.location}}
   ⏰ Time: {{$json.detected_at}}
   👮 Case ID: {{$json.case_id}}
   
   A police officer will be investigating this case. You will receive updates as the investigation progresses.
   
   Best regards,
   Smart Plate AI - Stolen Vehicle Detection System
   ```

4. **Set** (Data node) - For Status Updated
   - Subject: `📋 Update on Your Vehicle {{$json.vehicle_number}}`
   - Body:
   ```
   Dear Customer,
   
   There's an update on your reported vehicle {{$json.vehicle_number}}:
   
   Status: {{$json.status | toUpper}}
   Note: {{$json.note}}
   Updated: {{$json.updated_at}}
   
   Best regards,
   Smart Plate AI Team
   ```

5. **Gmail** or **SendGrid** (Email node)
   - To: `{{$json.customer_email}}`
   - Subject: `{{$json.subject}}`
   - Text: `{{$json.body}}`

### Workflow 2: Police Officer Notifications

**Nodes:**
1. **Webhook** (Trigger)
   - Receives: `plate_detected_police` and `case_accepted` events

2. **Set** (Data node) - For Plate Detected
   - Subject: `🚔 NEW CASE: Vehicle {{$json.vehicle_number}} Detected`
   - Body:
   ```
   Officer {{$json.police_name}},
   
   A stolen vehicle matching reports has been detected!
   
   📊 Vehicle Details:
   - Plate: {{$json.vehicle_number}}
   - Type: {{$json.vehicle_type}}
   - Color: {{$json.vehicle_color}}
   
   📍 Location: {{$json.location}}
   ⏰ Time: {{$json.detected_at}}
   
   👤 Reporter Information:
   - Name: {{$json.customer_name}}
   - Phone: {{$json.customer_phone}}
   
   🔗 Case ID: {{$json.case_id}}
   
   Please log in to the portal to accept this case and begin investigation.
   
   Portal: https://your-app-domain.com
   ```

3. **Set** (Data node) - For Case Accepted
   - Subject: `✓ Confirmation: Case {{$json.case_id}} Accepted`
   - Body:
   ```
   Update notification sent to customer confirming case acceptance by {{$json.police_name}}.
   ```

4. **Gmail** or **SendGrid** (Email node)
   - To: `{{$json.police_email}}`
   - Subject: `{{$json.subject}}`
   - Text: `{{$json.body}}`

## Integration Steps

### Step 1: Install N8N Packages

The backend already includes the required packages. Ensure `requests` is installed:

```bash
pip install requests
```

### Step 2: Set Environment Variables

In `backend/.env`:

```env
# N8N Webhook Configuration
N8N_WEBHOOK_URL=https://your-instance.n8n.cloud/webhook/stolen-vehicles

# Email Provider (choose one)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Step 3: Configure Email Provider in N8N

**For Gmail:**
1. Enable 2-Factor Authentication on your Gmail account
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Use this password in n8n Gmail node configuration

**For SendGrid:**
1. Get your SendGrid API key from dashboard
2. In n8n SendGrid node, configure with your API key

### Step 4: Test Webhook

1. In n8n, click "Test" on the webhook node
2. Get the webhook URL
3. Use curl to test:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "vehicle_detected",
    "customer_email": "test@example.com",
    "vehicle_number": "ABC123",
    "location": "Downtown",
    "detected_at": "2024-03-23T10:30:00Z",
    "case_id": "123456"
  }' \
  https://your-instance.n8n.cloud/webhook/stolen-vehicles
```

### Step 5: Deploy Backend with N8N

Restart the backend with the N8N_WEBHOOK_URL configured:

```bash
cd backend
python main.py
```

## Webhook Payload Examples

### vehicle_detected Event
```json
{
  "event_type": "vehicle_detected",
  "customer_email": "citizen@example.com",
  "customer_name": "John Doe",
  "vehicle_number": "UP01AB1234",
  "vehicle_type": "SUV",
  "location": "Main Street, Downtown",
  "detected_at": "2024-03-23T10:30:45Z",
  "case_id": "507f1f77bcf86cd799439011"
}
```

### plate_detected_police Event
```json
{
  "event_type": "plate_detected_police",
  "police_email": "officer@police.gov",
  "police_name": "Officer Brown",
  "police_phone": "555-0123",
  "vehicle_number": "UP01AB1234",
  "vehicle_type": "SUV",
  "vehicle_color": "Blue",
  "location": "Main Street, Downtown",
  "detected_at": "2024-03-23T10:30:45Z",
  "case_id": "507f1f77bcf86cd799439011",
  "customer_name": "John Doe",
  "customer_phone": "555-9999",
  "reason": "A stolen vehicle has been detected by the camera network"
}
```

### case_accepted Event
```json
{
  "event_type": "case_accepted",
  "customer_email": "citizen@example.com",
  "customer_name": "John Doe",
  "vehicle_number": "UP01AB1234",
  "police_name": "Officer Brown",
  "police_phone": "555-0123",
  "case_id": "507f1f77bcf86cd799439011",
  "updated_at": "2024-03-23T10:35:12Z",
  "reason": "Police officer Officer Brown has accepted your case"
}
```

### case_status_updated Event
```json
{
  "event_type": "case_status_updated",
  "customer_email": "citizen@example.com",
  "vehicle_number": "UP01AB1234",
  "status": "found",
  "note": "Vehicle found abandoned in parking lot",
  "updated_at": "2024-03-23T11:45:30Z"
}
```

## Troubleshooting

### Webhooks Not Received

1. **Check N8N_WEBHOOK_URL**: Verify it's correctly set in `.env`
2. **Check Logs**: Look for webhook calls in n8n execution logs
3. **Test Manually**: Use curl to send test webhook
4. **Firewall**: Ensure n8n cloud URL is accessible from backend server

### Emails Not Sending

1. **Verify SMTP Settings**: Check email provider credentials
2. **Check N8N Logs**: Review email node execution logs
3. **Test Email Node**: Use n8n's test function on email node
4. **Rate Limits**: Ensure email provider rate limits aren't exceeded

### Wrong Recipients

1. **Check Webhook Data**: Verify email addresses in webhook payload
2. **Check Mapping**: Ensure n8n nodes map emails correctly
3. **Check Database**: Verify customer/police records have correct emails

## Security Best Practices

1. **Use HTTPS**: N8N cloud webhooks are HTTPS by default ✓
2. **Validate Webhook**: Add a secret header to webhook for verification
3. **Rate Limiting**: Set rate limits in n8n to prevent abuse
4. **Email Verification**: Use sender verification in email provider
5. **Data Privacy**: Ensure sensitive info is encrypted in transit

## Next Steps

After setup:
1. Test the detection flow end-to-end
2. Verify emails arrive in customer/police inbox
3. Monitor n8n logs for any errors
4. Set up dashboard alerts in n8n for failed workflows
5. Create backups of n8n workflows

---

For more n8n documentation, visit: https://docs.n8n.io
