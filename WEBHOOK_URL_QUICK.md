# 🔗 GET WEBHOOK URL - QUICK STEPS ONLY

## In N8N Cloud (Takes 2 Minutes)

### ✅ Step 1: Create Workflow
- Login to https://n8n.cloud
- Click "New Workflow"
- Name: `Stolen Vehicle Detection`
- Click "Create"

### ✅ Step 2: Add Webhook
- Click "+" or "Start here"
- Search: `Webhook`
- Click it
- Webhook node appears

### ✅ Step 3: Get Your URL
- In Webhook node (right panel)
- **HTTP Method**: `POST`
- **Authentication**: `None`
- Click **"Test URL"** button
- Look for blue box showing your URL
- **COPY THIS URL** ⬇️

```
https://your-workspace-id.n8n.cloud/webhook/YOUR_PATH_HERE
```

### ✅ Example Webhook URL:
```
https://n8n-abc12345.n8n.cloud/webhook/stolen-vehicles-123
```

---

## In Backend (Takes 1 Minute)

### Open: `backend/.env`

Add this line:
```env
N8N_WEBHOOK_URL=https://your-workspace-id.n8n.cloud/webhook/YOUR_PATH_HERE
```

Replace with YOUR actual URL from Step 3 above.

### Example:
```env
N8N_WEBHOOK_URL=https://n8n-abc12345.n8n.cloud/webhook/stolen-vehicles-123
```

---

## ✓ Done!

Your webhook URL is:
```
https://your-workspace-id.n8n.cloud/webhook/YOUR_PATH_HERE
```

Now follow: **N8N_IMPLEMENTATION_PROMPT.md** for full setup!

---

## Behind the Scenes

When vehicle detected:
```
Backend (localhost:8000)
         ↓
    Webhook URL (you just got)
         ↓
     N8N Cloud
         ↓
    Send Email
```

---

**Next Step**: Open `N8N_IMPLEMENTATION_PROMPT.md` and follow PART 2 onwards (Email setup)
