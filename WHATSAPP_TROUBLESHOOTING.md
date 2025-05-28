# WhatsApp Integration Troubleshooting Guide

## Environment Variables Setup

Add these to your `.env` file or deployment environment:

\`\`\`env
# Twilio Credentials (from your Twilio Console)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# WhatsApp Business Number (from Twilio Console)
WHATSAPP_BUSINESS_NUMBER=+14155238886

# Webhook Verification Token (create a random string)
WHATSAPP_VERIFY_TOKEN=your_random_verification_token_here
\`\`\`

## Twilio Sandbox Configuration

### 1. Webhook URLs
In your Twilio Console > WhatsApp > Sandbox Settings:

**When a message comes in:**
- URL: `https://pregnancyhealthtracker.onrender.com/api/whatsapp/webhook`
- Method: `POST`

**Status callback URL:**
- URL: `https://pregnancyhealthtracker.onrender.com/api/whatsapp/webhook`
- Method: `POST` (not GET as shown in your config)

### 2. Sandbox Participants
Users must first join the sandbox by sending:
\`\`\`
join third-lady
\`\`\`
to `+1 415 523 8886`

### 3. Testing Steps

1. **Join Sandbox**: Send `join third-lady` to `+1 415 523 8886`
2. **Register in App**: Create account and complete pregnancy form
3. **Link WhatsApp**: Use the app to link your WhatsApp number
4. **Test Messaging**: Send a message to the sandbox number

## Common Issues & Solutions

### Issue 1: 401 Unauthorized on Webhook
**Problem**: Webhook endpoint is protected by authentication
**Solution**: ✅ Fixed in the code above - webhook routes are now public

### Issue 2: Messages Not Received
**Possible Causes**:
- User hasn't joined sandbox with `join third-lady`
- Webhook URL is incorrect
- Environment variables are missing

### Issue 3: Can Send but Can't Receive Replies
**Problem**: Webhook configuration or authentication issues
**Solution**: ✅ Fixed - webhook is now properly configured

## Verification Commands

Test your webhook:
\`\`\`bash
curl -X GET "https://pregnancyhealthtracker.onrender.com/api/whatsapp/webhook-status"
\`\`\`

Test your environment:
\`\`\`bash
curl -X GET "https://pregnancyhealthtracker.onrender.com/health"
\`\`\`

## Production Setup (After Sandbox)

For production WhatsApp Business API:
1. Apply for WhatsApp Business API access
2. Get your business phone number approved
3. Update `WHATSAPP_BUSINESS_NUMBER` to your approved number
4. Configure message templates for proactive messaging

## Debug Logs

Monitor these logs for troubleshooting:
- `📨 Incoming WhatsApp webhook:` - Shows incoming messages
- `👤 User lookup result:` - Shows if user is found
- `🤖 AI Response generated:` - Shows AI response
- `✅ Response sent successfully` - Confirms message sent
