# WhatsApp Integration Setup Guide

## 🚀 Quick Setup Steps

### 1. Configure Twilio Webhook

**For Local Development (using ngrok):**

1. Install ngrok: `npm install -g ngrok`
2. Start your server: `npm run dev`
3. In another terminal: `ngrok http 3002`
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. Go to Twilio Console > WhatsApp Sandbox Settings
6. Set webhook URL: `https://abc123.ngrok.io/api/whatsapp/webhook`
7. Set HTTP method: `POST`

**For Production:**
- Set webhook URL: `https://yourdomain.com/api/whatsapp/webhook`

### 2. Environment Variables

Add to your `.env` file:
\`\`\`env
WHATSAPP_VERIFY_TOKEN=your_unique_verify_token
GEMINI_API_KEY=your_gemini_api_key
\`\`\`

### 3. Test the Integration

1. **Test webhook endpoint:**
   \`\`\`bash
   curl https://pregnancyhealthtracker.onrender.com/api/whatsapp/status
   \`\`\`

2. **Test message sending:**
   \`\`\`bash
   curl -X POST https://pregnancyhealthtracker.onrender.comapi/whatsapp/send-test \
   -H "Content-Type: application/json" \
   -d '{"phoneNumber": "+250786255860", "message": "Test message"}'
   \`\`\`

3. **Link WhatsApp to user:**
   \`\`\`bash
   curl -X POST https://pregnancyhealthtracker.onrender.com/api/whatsapp/link-whatsapp \
   -H "Content-Type: application/json" \
   -d '{"userId": 1, "phoneNumber": "+250786255860"}'
   \`\`\`

### 4. WhatsApp Sandbox Setup

1. Go to Twilio Console > Messaging > Try it out > Send a WhatsApp message
2. Follow the instructions to join the sandbox
3. Send "join <sandbox-keyword>" to the Twilio number
4. Your number is now connected to the sandbox

### 5. Test AI Responses

Once everything is set up, try these messages:

- "What's my current status?"
- "Tell me about my pregnancy journey"
- "How many weeks am I?"
- "What should I expect this week?"

## 🔧 Troubleshooting

### Common Issues:

1. **"You said: [message]. Configure your WhatsApp Sandbox's Inbound URL"**
   - This means the webhook URL is not configured correctly
   - Make sure the webhook URL points to your server's `/api/whatsapp/webhook` endpoint

2. **AI not responding with personalized information**
   - Ensure the user has completed the pregnancy form
   - Check that the phone number matches exactly in the database

3. **Messages not being sent**
   - Verify Twilio credentials are correct
   - Check that the WhatsApp Business number is correct
   - Ensure the recipient has joined the sandbox (for development)

### Debug Commands:

\`\`\`bash
# Check if webhook is accessible
curl https://your-ngrok-url.ngrok.io/api/whatsapp/status

# Test database connection
curl https://pregnancyhealthtracker.onrender.com/api/auth/profile -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check server logs
tail -f logs/app.log
\`\`\`

## 📱 How It Works

1. **User Registration**: User registers and provides phone number
2. **WhatsApp Linking**: User links WhatsApp via API call
3. **Pregnancy Form**: User completes pregnancy form
4. **AI Context**: System fetches user's complete pregnancy data
5. **Personalized Responses**: AI provides responses based on user's specific situation
6. **Daily Notifications**: Automated daily tips and milestone alerts

## 🎯 Expected Behavior

When a user sends a WhatsApp message, the AI should:

- Know their name and pregnancy status
- Provide current gestational age if pregnant
- Give personalized advice based on their trimester
- Reference their specific pregnancy history
- Offer relevant tips and reminders

Example response for "What's my current status?":
\`\`\`
Hi Ambroise! 👋

You're currently 9 weeks and 2 days pregnant - that's exciting! 🤱

📅 Current Status:
• Trimester: 1st
• Expected delivery: Jan 8, 2026
• This is your 2nd pregnancy

💡 Week 9 Tips:
Your baby is about the size of a grape! Morning sickness might be peaking, but hang in there - it usually improves by week 12. Keep taking your prenatal vitamins! 💊

Need any specific advice? Just ask! 😊
