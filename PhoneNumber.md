# Twilio Integration Guide: WhatsApp & SMS

This guide will help you configure Twilio for both WhatsApp and SMS messaging in your pregnancy support application.

## 📋 Prerequisites

1. **Twilio Account**: Sign up at [twilio.com](https://www.twilio.com)
2. **Phone Numbers**: 
   - A Twilio phone number for SMS
   - WhatsApp Business API access through Twilio
3. **Webhook URL**: Your deployed application URL

## 🔧 Twilio Dashboard Configuration

### Step 1: Get Your Twilio Credentials

1. **Login to Twilio Console**: Go to [console.twilio.com](https://console.twilio.com)
2. **Find Your Credentials**:
   - Account SID: `ACa9755dd56de5cafed70007909ec4ce0a` (already in your .env)
   - Auth Token: `064d15ac143eb43d0341653eabfe2552` (already in your .env)

### Step 2: Configure SMS

#### 2.1 Purchase a Phone Number for SMS

1. **Navigate to Phone Numbers**:
   - Go to **Phone Numbers** → **Manage** → **Buy a number**
   
2. **Select Country**: Choose your country (e.g., United States)

3. **Choose Capabilities**:
   - ✅ **SMS** (Required)
   - ✅ **Voice** (Optional)
   - ✅ **MMS** (Optional)

4. **Buy Number**: Complete the purchase

5. **Update .env**: Add your purchased number to `.env`:
   \`\`\`env
   TWILIO_PHONE_NUMBER=+1234567890
   \`\`\`

#### 2.2 Configure SMS Webhook

1. **Go to Phone Numbers**:
   - Navigate to **Phone Numbers** → **Manage** → **Active numbers**
   - Click on your purchased phone number

2. **Configure Messaging**:
   - **Webhook URL**: `https://yourdomain.com/api/sms/webhook`
   - **HTTP Method**: `POST`
   - **Primary Handler**: Select this option

3. **Save Configuration**: Click **Save**

### Step 3: Configure WhatsApp

#### 3.1 Access WhatsApp Business API

1. **Navigate to Messaging**:
   - Go to **Messaging** → **Try WhatsApp** → **Send a WhatsApp Message**

2. **Set Up WhatsApp Sandbox**:
   - Follow the instructions to join your WhatsApp sandbox
   - Note your WhatsApp sandbox number (e.g., +14155238886)

3. **Update .env**:
   \`\`\`env
   WHATSAPP_BUSINESS_NUMBER=+14155238886
   \`\`\`

#### 3.2 Configure WhatsApp Webhook

1. **Go to WhatsApp Settings**:
   - Navigate to **Messaging** → **Settings** → **WhatsApp Sandbox Settings**

2. **Configure Webhook**:
   - **Webhook URL**: `https://yourdomain.com/api/whatsapp/webhook`
   - **HTTP Method**: `POST`

3. **Save Configuration**: Click **Save**

## 🚀 Testing Your Setup

### Test SMS

#### Test 1: Send Test SMS via API

\`\`\`bash
curl -X POST https://yourdomain.com/api/sms/send-test \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "message": "Test message from Pregnancy Support!"
  }'
\`\`\`

#### Test 2: Send SMS via Twilio Console

1. **Go to Messaging**:
   - Navigate to **Messaging** → **Try it out** → **Send an SMS**

2. **Fill Details**:
   - **To**: Your personal phone number (must be verified)
   - **From**: Your Twilio phone number
   - **Message**: "Hello from Pregnancy Support!"

3. **Send**: Click **Send an SMS**

#### Test 3: Receive SMS (AI Chat)

1. **Send SMS to Your Twilio Number**:
   - Text: "What's my pregnancy status?"
   - From: Your registered phone number

2. **Expected Response**:
   - AI-powered response based on your pregnancy data
   - Or registration prompt if not registered

### Test WhatsApp

#### Test 1: Send Test WhatsApp Message via API

\`\`\`bash
curl -X POST https://yourdomain.com/api/whatsapp/send-test \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "message": "Test WhatsApp message from Pregnancy Support!"
  }'
\`\`\`

#### Test 2: Join WhatsApp Sandbox

1. **Join Sandbox**:
   - Send the join code (provided by Twilio) to your WhatsApp sandbox number
   - Example: "join <your-sandbox-code>"

2. **Send Message**:
   - After joining, send: "What's my pregnancy status?"

3. **Expected Response**:
   - AI-powered response based on your pregnancy data
   - Or registration prompt if not registered

## 📱 User Registration Flow

### For New Users:

1. **User registers** in your app with phone number
2. **Welcome message** sent automatically via WhatsApp or SMS
3. **User completes** pregnancy form
4. **Confirmation message** sent with pregnancy details
5. **Daily tips** start automatically

### For Existing Users:

1. **User messages** your Twilio number (WhatsApp or SMS)
2. **AI responds** with personalized advice
3. **User can ask** pregnancy-related questions
4. **System provides** contextual responses

## 🔄 Daily Automation

### Scheduled Messages:

- **9:00 AM**: Daily pregnancy tips
- **10:00 AM**: Daily articles
- **8:00 AM**: Milestone alerts

### Message Examples:

**Daily Tip (Week 12)**:
\`\`\`
Week 12: Congratulations! You've completed your first trimester! 
Risk of miscarriage drops significantly. Time to share the news?
\`\`\`

**Daily Article**:
\`\`\`
📝 Week 12 Update: First Trimester Complete!

Your baby is now about 2 inches long and weighs about half an ounce...

Check our app for the full article! 📱
\`\`\`

## 🛠️ Troubleshooting

### Common Issues:

1. **Messages Not Sending**:
   - Check Twilio credentials in `.env`
   - Verify phone number format (+1234567890)
   - Check Twilio account balance

2. **Webhook Not Working**:
   - Verify webhook URL is accessible
   - Check HTTPS (required for production)
   - Test webhook endpoint manually

3. **AI Not Responding**:
   - Check Gemini API key
   - Verify user exists in database
   - Check pregnancy form completion

### Debug Commands:

\`\`\`bash
# Check WhatsApp service status
curl https://yourdomain.com/api/whatsapp/status

# Check SMS service status
curl https://yourdomain.com/api/sms/status

# Test webhook locally (use ngrok for local testing)
ngrok http 3002
# Then use: https://abc123.ngrok.io/api/whatsapp/webhook
\`\`\`

## 📊 Monitoring & Analytics

### Twilio Console Monitoring:

1. **Message Logs**:
   - Go to **Monitor** → **Logs** → **Messages**
   - View sent/received messages
   - Check delivery status

2. **Usage Statistics**:
   - Go to **Monitor** → **Usage**
   - Track SMS/WhatsApp volume
   - Monitor costs

3. **Error Logs**:
   - Go to **Monitor** → **Logs** → **Errors**
   - Debug webhook issues
   - Check failed messages

## 💰 Cost Optimization

### Pricing:
- **SMS**: ~$0.0075 per message
- **WhatsApp**: Varies by country, generally more expensive than SMS
- **Phone Number**: ~$1.00 per month

### Tips to Reduce Costs:
1. **Prefer WhatsApp** when available (better user experience)
2. **Fall back to SMS** when WhatsApp fails
3. **Optimize message length**
4. **Allow users to unsubscribe** (STOP keyword)
5. **Monitor usage** regularly

## 🔒 Security Best Practices

1. **Webhook Validation**:
   - Verify Twilio signatures
   - Use HTTPS only
   - Validate request origin

2. **Rate Limiting**:
   - Implement rate limits
   - Prevent spam/abuse
   - Monitor unusual activity

3. **Data Protection**:
   - Don't log sensitive data
   - Encrypt stored messages
   - Follow HIPAA guidelines

## 📞 Support

### Twilio Support:
- **Documentation**: [twilio.com/docs](https://www.twilio.com/docs)
- **Support**: [support.twilio.com](https://support.twilio.com)
- **Community**: [twilio.com/community](https://www.twilio.com/community)

### Application Support:
- **WhatsApp Webhook**: `https://yourdomain.com/api/whatsapp/webhook`
- **SMS Webhook**: `https://yourdomain.com/api/sms/webhook`
- **Status Endpoints**: 
  - `https://yourdomain.com/api/whatsapp/status`
  - `https://yourdomain.com/api/sms/status`

---

## 🎯 Quick Setup Checklist

- [ ] Twilio account created
- [ ] SMS phone number purchased
- [ ] WhatsApp sandbox configured
- [ ] Webhooks configured for both channels
- [ ] Environment variables set
- [ ] Test messages sent successfully
- [ ] Webhooks receiving messages
- [ ] AI responses working
- [ ] Daily automation active
- [ ] Monitoring setup complete

**Your dual-channel integration is ready! 🎉**
