# MSG91 OTP Integration Guide

This document is a reusable reference for integrating MSG91-based OTP authentication in Node.js/Express projects.

NearHub implementation note:
- OTPs are sent using MSG91 SMS delivery via the MSG91 Flow API (`https://control.msg91.com/api/v5/flow/`).
- OTP verification is handled in our backend (`otpService.verifyOTP`), not by MSG91 Verify API.

It includes:
- Account and DLT prerequisites
- Environment variables
- Backend service design
- API contracts for send/verify OTP
- Security and production checklist
- NearHub-specific implementation notes

## 1. Prerequisites

Before coding, complete these in MSG91:

1. Create MSG91 account: https://msg91.com
2. Generate API key (`authkey`).
3. Configure Sender ID (for India SMS compliance).
4. Create and approve DLT template(s).
5. If using MSG91 Flow API for OTP, create a Flow template and note:
   - `template_id`
   - OTP variable key in Flow (for example `otp`, `VAR1`, `Param1`)

## 2. Environment Variables

Use the following env keys (safe defaults shown):

```env
# Enable/disable MSG91
MSG91_ENABLED=true

# Required auth
MSG91_API_KEY=your_msg91_api_key

# Sender and routing
MSG91_SENDER_ID=SYNVDE
MSG91_ROUTE=4

# Optional template IDs
MSG91_TEMPLATE_ID=your_msg91_template_id
MSG91_OTP_TEMPLATE_ID=your_msg91_otp_template_id
MSG91_FLOW_OTP_KEY=otp

# OTP policy
OTP_VALIDITY_MINUTES=5
OTP_MAX_ATTEMPTS=3
OTP_RATE_LIMIT_REQUESTS=5
OTP_RATE_LIMIT_WINDOW=3600
```

### 2.1 All OTP/SMS Variables Used In This Project

These are the keys currently read by NearHub code:

1. `MSG91_ENABLED`
2. `MSG91_API_KEY`
3. `MSG91_SENDER_ID`
4. `MSG91_ROUTE`
5. `MSG91_TEMPLATE_ID`
6. `MSG91_OTP_TEMPLATE_ID`
7. `MSG91_FLOW_OTP_KEY`
8. `OTP_VALIDITY_MINUTES`
9. `OTP_MAX_ATTEMPTS`
10. `OTP_RATE_LIMIT_REQUESTS`
11. `OTP_RATE_LIMIT_WINDOW`
12. `BSNL_DLT_ENABLED`
13. `BSNL_DLT_USERNAME`
14. `BSNL_DLT_PASSWORD`
15. `BSNL_DLT_SENDER_ID`
16. `BSNL_DLT_ROUTE`
17. `BSNL_DLT_TEMPLATE_ID`

Code locations:

1. `server/shared/notifications/msg91.ts`
2. `server/shared/notifications/bsnl-dlt.ts`
3. `server/lib/config.ts`

Notes:

1. `MSG91_OTP_TEMPLATE_ID` and `MSG91_FLOW_OTP_KEY` are read directly in `msg91.ts` (not via `lib/config.ts`).
2. Current OTP send flow in `server/shared/utils/otp.ts` uses MSG91 path, with `console` fallback when provider is unavailable.
3. BSNL variables are still part of project config and service module, but OTP service is currently not routing through BSNL.

### 2.2 Current NearHub `.env` Values (Reference)

From `server/.env` (verified on March 6, 2026):

```env
OTP_VALIDITY_MINUTES=5
OTP_MAX_ATTEMPTS=3
OTP_RATE_LIMIT_REQUESTS=5
OTP_RATE_LIMIT_WINDOW=3600

MSG91_ENABLED=true
MSG91_API_KEY=***redacted***
MSG91_SENDER_ID=SYNVDE
MSG91_TEMPLATE_ID=1407177194371662927
MSG91_OTP_TEMPLATE_ID=69a274dd3af0f7ec5f0d36d2
MSG91_FLOW_OTP_KEY=numeric
```

If you need route-based non-flow SMS calls, you can also set:

```env
MSG91_ROUTE=4
```

### 2.3 Flow Payload Keys Sent By This Project

When sending OTP via MSG91 Flow API, this project sends all of these keys in `recipients[0]`:

1. `mobiles`
2. `mobile`
3. `phone`
4. `otp`
5. `OTP`
6. `var`
7. `var1`
8. `VAR1`
9. `Param1`
10. `numeric`
11. dynamic key from `MSG91_FLOW_OTP_KEY` (currently `numeric` in your `.env`)

## 3. Integration Architecture

Recommended backend structure:

1. `msg91 service`
- Owns API calls to MSG91.
- Exposes `sendOTP(phone, otp)` and optionally `sendSMS(phone, message)`.

2. `otp service`
- Generates OTP.
- Stores OTP + expiry + attempt count.
- Handles per-phone rate limiting.
- Calls msg91 service for delivery.

3. `auth routes`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`

## 4. MSG91 Service Contract

Use a response shape like this to standardize error handling:

```ts
export interface MSG91Response {
  success: boolean;
  messageId?: string;
  requestId?: string;
  error?: string;
  statusCode?: string;
  data?: unknown;
}
```

Behavior to implement:

1. Validate required config (`MSG91_ENABLED`, `MSG91_API_KEY`).
2. Normalize phone to E.164-like format without `+` (e.g. `919876543210`).
3. Validate OTP is 6 digits.
4. Use Flow API for OTP (`https://control.msg91.com/api/v5/flow/`) with `MSG91_OTP_TEMPLATE_ID`.
5. Parse provider success from `type/success/status` because response formats vary.
6. Return provider message when HTTP 200 contains business error.

## 5. OTP Service Contract

Recommended OTP record:

```ts
interface OTPRecord {
  otp: string;
  phone: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  sentVia: 'msg91' | 'console';
}
```

Recommended rules:

1. Phone validation (example India mobile): `^[6-9]\d{9}$`.
2. OTP length: 6 digits.
3. OTP validity: 5 minutes.
4. Max verify attempts: 3.
5. Send rate limit: 5 requests/hour per phone.
6. Delete OTP after success/expiry/max attempts.
7. Periodic cleanup for expired OTP records.

## 6. API Contract (Backend)

### `POST /api/auth/send-otp`

Request:

```json
{ "phone": "9876543210" }
```

Success response:

```json
{
  "success": true,
  "message": "OTP sent to your mobile via MSG91",
  "expiresIn": 300,
  "sentVia": "msg91"
}
```

Failure response:

```json
{
  "success": false,
  "message": "Too many OTP requests. Please try again in 1 hour.",
  "expiresIn": 0
}
```

### `POST /api/auth/verify-otp`

Request:

```json
{ "phone": "9876543210", "otp": "123456" }
```

Success response:

```json
{ "success": true, "message": "OTP verified successfully" }
```

Failure response:

```json
{ "success": false, "message": "Invalid OTP. 2 attempts remaining." }
```

## 7. NearHub Implementation Mapping

Current implementation files:

1. MSG91 service: `server/shared/notifications/msg91.ts`
2. OTP manager: `server/shared/utils/otp.ts`
3. Auth routes: `server/features/auth/routes/auth.ts`
4. OpenAPI entries: `server/shared/docs/openapi.ts`
5. Example env template: `server/.env.example`

NearHub currently:

1. Uses MSG91 SMS channel with MSG91 Flow API (`/api/v5/flow/`) to send OTPs.
2. Falls back to server logs (`sentVia: console`) when MSG91 is not configured or fails.
3. Exposes test endpoints:
   - `POST /api/admin/test/msg91/send-otp`
   - `POST /api/admin/test/msg91/send-sms`
   - `GET /api/admin/test/msg91/status`

## 8. Production Checklist

1. Never return OTP in API response.
2. Never log real OTP in production logs.
3. Store OTP hashed (recommended) instead of plain text.
4. Use Redis/DB instead of in-memory maps for multi-instance deployments.
5. Add IP + phone + device-based throttling.
6. Add audit logs and alerting for OTP abuse patterns.
7. Enforce HTTPS and secure secrets management.
8. Keep fallback SMS provider optional for resilience.

## 9. Troubleshooting

1. `MSG91 service not configured`
- Check `MSG91_ENABLED=true` and `MSG91_API_KEY`.

2. `MSG91_OTP_TEMPLATE_ID is required for Flow API`
- Add approved Flow template ID or switch to standard SMS template path.

3. HTTP 200 but OTP not delivered
- Inspect provider payload (`type/success/status/message`).
- Validate DLT template, sender ID, and route settings.

4. OTP always invalid
- Verify same phone key is used for send and verify.
- Check expiry and attempts logic.
- Check for formatting mismatch (`+91` vs `91` vs local 10-digit).

## 10. Reuse in Other Projects

For any new project, copy this pattern in order:

1. Add env keys.
2. Add `msg91 service` module.
3. Add `otp service` module.
4. Add `/send-otp` and `/verify-otp` routes.
5. Add tests for:
   - valid send
   - rate limit
   - expired OTP
   - wrong OTP attempts
   - provider failure fallback

This gives a predictable OTP integration that teams can reuse with minimal changes.

## 11. Direct Flow API Test Script

Use this when you want to test MSG91 Flow API directly (without hitting app routes).

Create a local file like `server/scripts/test-msg91-flow-direct.mjs`:

```js
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Loads: server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.MSG91_API_KEY;
const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
const flowOtpKey = process.env.MSG91_FLOW_OTP_KEY || 'otp';

// Pass phone/otp from CLI:
// node server/scripts/test-msg91-flow-direct.mjs 9876543210 123456
const inputPhone = process.argv[2];
const inputOtp = process.argv[3] || '123456';

if (!apiKey) {
  console.error('Missing MSG91_API_KEY in server/.env');
  process.exit(1);
}
if (!templateId) {
  console.error('Missing MSG91_OTP_TEMPLATE_ID in server/.env');
  process.exit(1);
}
if (!inputPhone) {
  console.error('Usage: node server/scripts/test-msg91-flow-direct.mjs <phone> [otp]');
  process.exit(1);
}

let phone = String(inputPhone).replace(/^\+/, '');
if (!phone.startsWith('91')) phone = `91${phone}`;

const payload = {
  template_id: templateId,
  short_url: '0',
  recipients: [
    {
      mobiles: phone,
      mobile: phone,
      phone: phone,
      otp: inputOtp,
      OTP: inputOtp,
      var: inputOtp,
      var1: inputOtp,
      VAR1: inputOtp,
      Param1: inputOtp,
      numeric: inputOtp,
      [flowOtpKey]: inputOtp,
    },
  ],
};

try {
  const res = await axios.post('https://control.msg91.com/api/v5/flow/', payload, {
    headers: {
      authkey: apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    timeout: 15000,
  });

  console.log('HTTP:', res.status);
  console.log('Response:', JSON.stringify(res.data, null, 2));
} catch (err) {
  if (axios.isAxiosError(err)) {
    console.error('HTTP Error:', err.response?.status || 'no-status');
    console.error('Response:', JSON.stringify(err.response?.data || {}, null, 2));
    console.error('Message:', err.message);
  } else {
    console.error('Error:', err);
  }
  process.exit(1);
}
```

Run:

```bash
node server/scripts/test-msg91-flow-direct.mjs 9876543210 123456
```

Expected success indicator in response is usually one of:

1. `type: "success"`
2. `success: true`
3. `status: "success"`

## 12. Verification Record (NearHub)

Last verified: **March 6, 2026**

Verified items:

1. MSG91 Flow endpoint used: `https://control.msg91.com/api/v5/flow/`
2. Flow response received with success marker: `type: "success"`
3. SMS delivery confirmed on a real device using Indian 10-digit input format.

Command pattern used:

```bash
node server/scripts/test-msg91-flow-direct.mjs 9704569280 123456
```
