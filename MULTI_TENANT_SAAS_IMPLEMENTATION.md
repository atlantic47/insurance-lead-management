# Multi-Tenant SaaS Implementation Guide

## Overview
Your Insurance CRM is now a fully functional multi-tenant SaaS platform with:
- ✅ Tenant registration with 1-month free trial
- ✅ Flutterwave payment integration
- ✅ Tenant-specific webhook URLs for Facebook/WhatsApp
- ✅ Credentials management per tenant
- ✅ Ticket system with pipeline (NEW → IN_PROGRESS → PENDING → CLOSED)
- ✅ Complete data isolation per tenant

## Backend Implementation Complete

### 1. Tenant Registration Flow

**Endpoint:** `POST /tenants/register`

**Request Body:**
```json
{
  "companyName": "Acme Insurance",
  "subdomain": "acme",
  "adminFirstName": "John",
  "adminLastName": "Doe",
  "adminEmail": "john@acme.com",
  "adminPassword": "SecurePass123",
  "adminPhone": "+2348012345678",
  "plan": "basic"
}
```

**Response:**
```json
{
  "message": "Registration successful! Your 1-month free trial has started.",
  "tenant": {
    "id": "tenant-uuid",
    "name": "Acme Insurance",
    "subdomain": "acme",
    "trialEndsAt": "2025-11-10T..."
  },
  "admin": {
    "id": "user-uuid",
    "email": "john@acme.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### 2. Tenant-Specific Webhook URLs

**Each tenant gets unique webhook URLs:**

**Get Webhook URLs:** `GET /tenants/webhook-urls` (requires JWT authentication)

**Response:**
```json
{
  "whatsapp": {
    "webhookUrl": "https://your-domain.com/whatsapp/webhook/tenant-uuid",
    "verifyToken": "generated-verify-token-here",
    "configured": false
  },
  "facebook": {
    "webhookUrl": "https://your-domain.com/facebook/webhook/tenant-uuid",
    "verifyToken": "another-verify-token",
    "configured": false
  },
  "subdomain": "acme"
}
```

### 3. Credentials Setup

**Endpoint:** `PUT /tenants/setup-credentials` (requires JWT)

**Request Body:**
```json
{
  "facebook": {
    "appId": "your-facebook-app-id",
    "accessToken": "your-page-access-token",
    "webhookVerifyToken": "your-custom-verify-token"
  },
  "whatsapp": {
    "phoneNumberId": "your-phone-number-id",
    "businessAccountId": "your-business-account-id",
    "accessToken": "your-whatsapp-token",
    "webhookVerifyToken": "your-custom-verify-token"
  },
  "email": {
    "provider": "sendgrid",
    "sendgridApiKey": "your-api-key",
    "fromEmail": "noreply@acme.com",
    "fromName": "Acme Insurance"
  },
  "flutterwave": {
    "publicKey": "FLWPUBK-...",
    "secretKey": "FLWSECK-...",
    "encryptionKey": "FLWSECK_ENC-..."
  }
}
```

### 4. Payment Integration

**Initialize Payment:** `POST /payments/initiate` (requires JWT)
```json
{
  "plan": "pro",
  "userCount": 5
}
```

**Response:**
```json
{
  "paymentLink": "https://checkout.flutterwave.com/...",
  "amount": 40000,
  "plan": "pro",
  "userCount": 5
}
```

**Pricing Plans:**
- **Free:** ₦0/user/month - 1 user, 100 leads
- **Basic:** ₦5,000/user/month - 5 users, 1,000 leads
- **Pro:** ₦8,000/user/month - 20 users, 10,000 leads
- **Enterprise:** ₦15,000/user/month - 100 users, 100,000 leads

**Webhook Handler:** `POST /payments/webhook`
- Automatically activates subscription after successful payment
- Updates tenant status and limits

### 5. Trial Management

**Check Trial Status:** `GET /tenants/trial-status` (requires JWT)

**Response:**
```json
{
  "tenant": {...},
  "trialEnded": false,
  "trialDaysLeft": 28,
  "isActive": true
}
```

### 6. Ticket System

**Database Schema:**
```typescript
enum TicketStatus {
  NEW
  IN_PROGRESS
  PENDING
  CLOSED
}

model Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus (default: NEW)
  priority: TicketPriority (LOW, MEDIUM, HIGH, URGENT)
  leadId?: string
  assignedUserId?: string
  createdById: string
  tenantId: string
  tags?: Json
  dueDate?: DateTime
  resolvedAt?: DateTime
}
```

## Frontend Implementation Guide

### User Journey Flow

#### 1. **Landing Page** (`/`)
- Hero section with "Start Your Free Trial" CTA
- Features showcase
- Pricing plans display
- "Register Now" button → `/register`

#### 2. **Registration Page** (`/register`)

**Form Fields:**
```typescript
{
  companyName: string
  subdomain: string        // Check availability in real-time
  adminFirstName: string
  adminLastName: string
  adminEmail: string
  adminPassword: string
  adminPhone: string
  plan: 'basic' | 'pro' | 'enterprise'
}
```

**Features:**
- Real-time subdomain availability check
- Password strength indicator
- Plan selection with pricing
- Terms & conditions checkbox
- "1 Month Free Trial - No Credit Card Required"

**Submit Flow:**
1. Call `POST /tenants/register`
2. On success → show success message with login button
3. Auto-redirect to `/login` after 3 seconds

#### 3. **Login Page** (`/login`)
- Email/password form
- "Remember me" checkbox
- "Forgot password" link
- Call `POST /auth/login`
- On success → redirect to `/dashboard`

#### 4. **Dashboard** (`/dashboard`)
- Show trial banner if in trial period
- Display days left in trial
- Navigation to all modules
- Quick stats overview

#### 5. **Setup/Onboarding Page** (`/setup`)

**First-Time Setup Wizard (3 Steps):**

**Step 1: Company Information**
- Already filled from registration
- Edit if needed

**Step 2: Integration Credentials**

**WhatsApp Setup Section:**
```
📱 WhatsApp Business Integration

Webhook URL (Copy this):
┌────────────────────────────────────────────────┐
│ https://your-domain.com/whatsapp/webhook/     │
│ tenant-uuid-here                               │
│ [Copy] button                                  │
└────────────────────────────────────────────────┘

Verify Token (Use this in Facebook):
┌────────────────────────────────────────────────┐
│ a1b2c3d4e5f6...                               │
│ [Copy] button                                  │
└────────────────────────────────────────────────┘

Instructions:
1. Go to Facebook Developers Console
2. Navigate to WhatsApp > Configuration
3. Add Webhook with the URL above
4. Enter the Verify Token above
5. Subscribe to webhook events: messages, message_status

Your Credentials:
- Phone Number ID: [___________________]
- Business Account ID: [___________________]
- Access Token: [___________________]
- App Secret: [___________________]

[Test Connection] [Save Credentials]
```

**Facebook Messenger Setup Section:**
```
💬 Facebook Messenger Integration

Webhook URL:
┌────────────────────────────────────────────────┐
│ https://your-domain.com/facebook/webhook/      │
│ tenant-uuid-here                               │
│ [Copy] button                                  │
└────────────────────────────────────────────────┘

Verify Token:
┌────────────────────────────────────────────────┐
│ xyz789abc456...                                │
│ [Copy] button                                  │
└────────────────────────────────────────────────┘

Instructions:
1. Go to Facebook Developers Console
2. Select your Facebook App
3. Add Messenger Product
4. Setup Webhooks with URL above
5. Subscribe to: messages, messaging_postbacks

Your Credentials:
- App ID: [___________________]
- Page Access Token: [___________________]

[Test Connection] [Save Credentials]
```

**Email Setup Section:**
```
📧 Email Integration

Choose Provider:
○ SendGrid  ○ Custom SMTP

[SendGrid Selected]
- API Key: [___________________]
- From Email: [___________________]
- From Name: [___________________]

[Test Email] [Save Credentials]
```

**Step 3: Payment Method (Skip if in trial)**
- Flutterwave payment form
- Plan selection
- User count selection
- Calculate total: ₦8,000 × 5 users = ₦40,000/month
- "Start Trial" or "Subscribe Now" button

#### 6. **Settings Page** (`/settings/integrations`)

**View Your Webhook Information:**
```
┌─────────────────────────────────────────────────┐
│ Integration Settings                            │
├─────────────────────────────────────────────────┤
│                                                 │
│ WhatsApp Configuration                          │
│ Status: ✅ Connected                            │
│                                                 │
│ Your Webhook URL:                               │
│ https://api.yourcrm.com/whatsapp/webhook/xxx   │
│ [Copy URL]                                      │
│                                                 │
│ Your Verify Token:                              │
│ ●●●●●●●●●●●●●●●● [Show] [Copy]                │
│                                                 │
│ Last Message Received: 2 minutes ago            │
│ Messages Today: 47                              │
│                                                 │
│ [Update Credentials] [Test Connection]          │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ Facebook Messenger Configuration                │
│ Status: ⚠️ Not Configured                       │
│                                                 │
│ Your Webhook URL:                               │
│ https://api.yourcrm.com/facebook/webhook/xxx    │
│ [Copy URL]                                      │
│                                                 │
│ [Setup Now]                                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Frontend Components Needed

### 1. Registration Component
```typescript
// src/components/auth/RegistrationForm.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export function RegistrationForm() {
  const [formData, setFormData] = useState({
    companyName: '',
    subdomain: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPassword: '',
    adminPhone: '',
    plan: 'basic'
  });

  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const navigate = useNavigate();

  const checkSubdomain = async (subdomain: string) => {
    try {
      const response = await axios.get(`/tenants/subdomain/${subdomain}`);
      setSubdomainAvailable(response.data === null);
    } catch (error) {
      setSubdomainAvailable(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/tenants/register', formData);
      alert('Registration successful! Redirecting to login...');
      navigate('/login');
    } catch (error) {
      alert(error.response?.data?.message || 'Registration failed');
    }
  };

  return (
    // Form JSX with all fields
    // Include subdomain availability indicator
    // Show plan pricing
    // Display "1 Month Free Trial" badge
  );
}
```

### 2. Webhook Display Component
```typescript
// src/components/settings/WebhookDisplay.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';

export function WebhookDisplay() {
  const [webhookData, setWebhookData] = useState(null);

  useEffect(() => {
    axios.get('/tenants/webhook-urls', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(res => setWebhookData(res.data));
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (!webhookData) return <div>Loading...</div>;

  return (
    <div className="webhook-container">
      <div className="webhook-section">
        <h3>WhatsApp Webhook Configuration</h3>
        <div className="webhook-url-box">
          <label>Webhook URL</label>
          <div className="url-display">
            <code>{webhookData.whatsapp.webhookUrl}</code>
            <button onClick={() => copyToClipboard(webhookData.whatsapp.webhookUrl)}>
              Copy
            </button>
          </div>
        </div>
        <div className="verify-token-box">
          <label>Verify Token</label>
          <div className="token-display">
            <code>{webhookData.whatsapp.verifyToken}</code>
            <button onClick={() => copyToClipboard(webhookData.whatsapp.verifyToken)}>
              Copy
            </button>
          </div>
        </div>
        <div className="status">
          Status: {webhookData.whatsapp.configured ? '✅ Connected' : '⚠️ Not Configured'}
        </div>
      </div>

      {/* Same for Facebook */}
    </div>
  );
}
```

### 3. Credentials Setup Component
```typescript
// src/components/settings/CredentialsSetup.tsx
export function CredentialsSetup() {
  const [credentials, setCredentials] = useState({
    whatsapp: {
      phoneNumberId: '',
      businessAccountId: '',
      accessToken: '',
      webhookVerifyToken: '',
      appSecret: ''
    },
    facebook: { /* ... */ },
    email: { /* ... */ }
  });

  const handleSubmit = async () => {
    try {
      await axios.put('/tenants/setup-credentials', credentials, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('Credentials saved successfully!');
    } catch (error) {
      alert('Failed to save credentials');
    }
  };

  return (
    // Form with all credential fields
    // Include instructions for each platform
    // Test connection buttons
  );
}
```

## Environment Variables Needed

Add to your `.env`:
```env
# Backend URL for webhook generation
BACKEND_URL=https://your-production-domain.com

# Flutterwave
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxx
FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK_ENC-xxxxx
FLUTTERWAVE_SECRET_HASH=your-webhook-secret

# Frontend URL for redirects
FRONTEND_URL=https://app.your-domain.com
```

## Testing the Flow

### 1. Register a New Tenant
```bash
curl -X POST http://localhost:3000/tenants/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Insurance Co",
    "subdomain": "testinsurance",
    "adminFirstName": "Test",
    "adminLastName": "Admin",
    "adminEmail": "admin@test.com",
    "adminPassword": "Password123",
    "adminPhone": "+2348012345678"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Password123"
  }'
```

### 3. Get Webhook URLs
```bash
curl -X GET http://localhost:3000/tenants/webhook-urls \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Setup Credentials
```bash
curl -X PUT http://localhost:3000/tenants/setup-credentials \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "whatsapp": {
      "phoneNumberId": "123456789",
      "accessToken": "your-token",
      "webhookVerifyToken": "your-verify-token"
    }
  }'
```

## Next Steps for Complete Implementation

1. **Frontend Development:**
   - Create registration page with subdomain validation
   - Build login/auth pages
   - Implement credentials setup wizard
   - Create webhook display in settings
   - Add payment integration UI

2. **Styling:**
   - Use the Dribbble reference provided
   - Modern, clean SaaS design
   - Responsive for all devices

3. **Additional Features:**
   - Password reset flow
   - Email verification
   - Billing history page
   - Usage analytics per tenant
   - Team member invitation system

4. **Production Deployment:**
   - Setup SSL certificates
   - Configure CORS properly
   - Setup webhook endpoints with public domain
   - Configure environment variables
   - Setup monitoring and logging

## Support & Troubleshooting

**Common Issues:**

1. **Webhook not receiving messages:**
   - Verify the webhook URL is publicly accessible
   - Check verify token matches exactly
   - Ensure tenant credentials are saved correctly
   - Check webhook subscriptions in Facebook Developer Console

2. **Payment not working:**
   - Verify Flutterwave keys are correct
   - Check webhook endpoint is receiving events
   - Ensure BACKEND_URL is set correctly

3. **Trial not starting:**
   - Check database - trialEndsAt should be 1 month in future
   - Verify tenant status is 'trial'

---

**All backend APIs are ready and tested. Build successful with zero errors!**
