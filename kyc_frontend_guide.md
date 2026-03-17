# KYC Frontend Implementation Guide

This document provides a detailed breakdown of the backend KYC flow implementation so that the frontend AI can build the exact features needed to correctly verify a user.

## Overview
The KYC process in `Linq-v2` is currently simplified to a **single-step NIN verification process**. The backend handles the validation with Smile ID's Enhanced KYC endpoint. 

> **Important Note:** The OTP verification step is currently **PAUSED/DISABLED** in the backend. As soon as the NIN is successfully verified by the Smile ID API, the user is automatically marked as `Verified = true` directly in the database. You do **not** need to build OTP Input views or flows right now.

---

## API Endpoints to Implement

### 1. Verify NIN (Primary Action)
This is the only endpoint you need to actively execute on the frontend to get the user verified.

**Endpoint:** `POST /kyc/verify-nin`
**Headers Required:** `Authorization` Header (Bearer token) must be present since it requires authentication.

**Request Payload:**
```json
{
  "nin": "12345678901",  
  "user_id": "123"       
}
```
*Constraints:* `nin` must be exactly 11 digits long. `user_id` should be the ID string of the logged-in user making the request.

**Handling Responses:**

*   **Success (200 OK): Identity Verified**
    ```json
    {
      "job_id": "job_170842...",
      "masked_phone": "",
      "message": "Identity verified successfully",
      "status": "verified"
    }
    ```
    *Action:* Upon receiving this, display a success state and proceed to route the user away, update their global state to "verified", or refresh their dashboard. 

*   **Success (200 OK): Already Verified**
    ```json
    {
      "job_id": "...",
      "masked_phone": "",
      "message": "User is already verified",
      "status": "verified"
    }
    ```
    *Action:* You can cleanly skip the interface here and drop them at the success screen as well.

*   **Client Errors (400 / 422): User Input/Verification Issues**
    *   `400 Bad Request`: Usually returned if the NIN string isn't exactly 11 characters. 
        (*Error JSON:* `{"error": "Invalid NIN format. NIN must be 11 digits."}`)
    *   `422 Unprocessable Entity`: The NIN could not be verified by the authoritative ID body. Smile ID result text is mapped to standard errors (e.g., "NIN not found in ID authority database", "Invalid NIN format"). 
    *Action:* Display the `error` message string directly to the user in a red toast or under the input field.

---

### 2. Check Verification Status
Use this endpoint to check if the current user has already completed KYC. Call this on app load / when navigating to settings / before showing the KYC form to decide whether to show the verification UI or a "Verified" badge.

**Endpoint:** `GET /user/verification-status`
**Headers Required:** `Authorization` Header (Bearer token) must be present since it requires authentication.

**Request Payload:** None (GET request, no body).

**Response (200 OK):**
```json
{
  "verified": true,
  "verification_status": true
}
```
or if not yet verified:
```json
{
  "verified": false,
  "verification_status": false
}
```

*Action:*
- If `verified` is `true` → Show a "Verified" badge/status. Do **not** show the NIN input form.
- If `verified` is `false` → Show the NIN verification form (endpoint #1 above).

---

### 3. OTP Endpoints (Bypassed - DO NOT USE YET)
For your awareness, the backend does have routes registered for `POST /kyc/verify-otp` and `POST /kyc/resend-otp`. Because the backend automatically flags the user as verified immediately after evaluating the NIN (skipping OTP), these secondary endpoints are functionally inactive. **Do not create UI/UX flows for these until the backend team dictates they are un-paused.**

## Implementation Checklist for Frontend AI
- [ ] Create a form UI expecting exactly 11 digits for a "NIN Input" field.
- [ ] Read the current User's ID from contexts or local storage to attach as `user_id` to the payload.
- [ ] Handle Loading states while waiting for the `POST /kyc/verify-nin` response.
- [ ] Display the "error" field value from the response payload under the form input if the request fails (400, 422).
- [ ] Show a Success screen or redirect upon `status: "verified"` being returned correctly.
