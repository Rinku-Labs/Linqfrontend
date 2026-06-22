# Scan-to-Pay ("Point & Pay") — Implementation Plan

Copy of Talise's "Point & pay": user points the camera at a printed account sign
(or a QR code), the app reads the **10-digit account number + bank**, resolves the
**verified account name**, and **prefills the transfer screen**. The user always
confirms before any money moves.

---

## TL;DR — the key insight

**~80% of this feature is already built.** We do **not** need a heavy OCR/AI stack,
and we do **not** need to read the account *name* off the photo. The hard parts
already exist in our codebase:

| Capability | Already exists? | Where |
|---|---|---|
| Guess bank from a 10-digit NUBAN | ✅ Yes | `Frontend/src/utils/bankSuggestion.ts` → `findMatchingBanks()` (CBN NUBAN check-digit algorithm) |
| Verified account-name enquiry | ✅ Yes | `Backend/userAuthentication/bank.go` → `VerifyBankAccountInternal()` (Centiiv API) |
| Fuzzy bank-name → bank-code match | ✅ Yes | `Backend/onramp/bank_utils.go` → `GetBankCodeByName()` (570 banks) |
| `/verifybank` HTTP endpoint (rate-limited) | ✅ Yes | `Backend/order-APi.go:1559` |
| Frontend verify client | ✅ Yes | `Frontend/src/api/bank.ts` → `verifyBankAccount()` |
| Prefill transfer flow | ✅ Yes | `Frontend/src/pages/SendFlow/AccountDetails.tsx` → navigates to `/send/amount` with `{accountNumber, bankName, bankCode, recipientName, bankLogo}` |
| QR generation lib | ✅ Yes (`qrcode`) | `Frontend/package.json` |

So the **only new work** is: **camera capture → extract a 10-digit number (and a
bank hint) → drop it into the flow that already exists.** Everything downstream
(bank guess, name resolution, confirm screen) is reused unchanged.

This is why OCR only has to reliably read **two things, and really only one**: a
10-digit number. The NUBAN algorithm already narrows the bank from those digits,
and Centiiv hands back the verified name. We never trust OCR for the name or the
amount.

---

## Recommendation on the three questions you asked

**1. Cloud OCR or on-device?** → **On-device first, cloud as an optional fallback.**

**2. Which is free?** → **On-device (Tesseract.js) + QR scanning is $0** — no cloud
account, no per-scan cost, no new backend service. Google Cloud Vision is the
paid-but-has-a-free-tier upgrade path (1,000 images/month free) if real-world
accuracy disappoints.

**3. Stay web-only?** → **Yes.** Both QR scanning and Tesseract.js run entirely in
the browser at `app.uselinq.xyz`. No native app needed.

### Why this order (it de-risks the whole thing)

- **QR first.** Many of these signs — and OPay's scanner — target QR codes. QR
  decoding in-browser is near-100% accurate, instant, free, and offline. We already
  ship the `qrcode` lib for *generating* QRs; we just add a *scanner*. Whenever a QR
  is present, we never touch OCR.
- **On-device OCR (Tesseract.js) second.** Free, MIT-licensed, runs in a Web Worker,
  zero marginal cost. Its weakness is skewed/handwritten/low-light text — **but we
  scope it to extract digits only**, which is the single thing it's most reliable at,
  and the NUBAN check-digit algorithm rejects misreads (a wrong digit usually fails
  the checksum). The user confirms the parsed result regardless.
- **Cloud OCR (Google Vision) as a deferred fallback**, behind a backend endpoint,
  added **only if** on-device accuracy proves insufficient in the field. Building the
  client around a swappable `extractText()` interface means we can add this later
  without touching the UI.

### Free-tier comparison (for the record)

| Option | Cost | Accuracy on messy phone photos | Where it runs |
|---|---|---|---|
| **Tesseract.js** (recommended start) | **Free, unlimited** | Fair — fine for printed digits, weak on skew/handwriting/low light | Browser |
| QR scanner (`html5-qrcode`/`zxing`) | **Free, unlimited** | N/A (perfect when a QR exists) | Browser |
| Google Cloud Vision | 1,000 img/mo free, then ~$1.50/1k | **Best** | Cloud (via our Go backend) |
| AWS Textract | 1,000 pg/mo free (3 mo), then ~$1.50/1k | Very good | Cloud (via our Go backend) |

---

## User flow

```
Home ── "Scan" quick action ──► /send/scan
                                    │
                  ┌─────────────────┴──────────────────┐
                  │  Live camera (getUserMedia)         │
                  │  • QR detected?  → decode → parse   │
                  │  • else "Capture" → Tesseract OCR   │
                  │  • "Type it in" fallback link       │
                  └─────────────────┬──────────────────┘
                                    │ parsed { accountNumber, bankHint }
                                    ▼
                  NUBAN algo (findMatchingBanks) → bank candidate(s)
                                    │
                                    ▼
                  verifyBankAccount() → verified account name  (REUSED)
                                    │
                                    ▼
            Navigate to /send/details (or straight to /send/amount)
            PRE-FILLED, user CONFIRMS, then normal transfer.   (REUSED)
```

**Non-negotiable:** the parsed result is always shown and the user must confirm
before money is sent. Never auto-send off a scan.

---

## Frontend work (`tantasui/Linq-v2-Frontend`)

Branch: `claude/ocr-account-extraction-plan-9mxseo`

### New dependencies
- `html5-qrcode` (or `@zxing/browser`) — camera QR scanning.
- `tesseract.js` — on-device OCR. Lazy-load it (`import()` on first capture) so it
  never bloats the initial bundle.

### New files
1. **`src/pages/SendFlow/ScanToPay.tsx`** — the scanner screen.
   - Open camera via `getUserMedia({ video: { facingMode: 'environment' } })`.
   - Run the QR scanner continuously on the video frames.
   - "Capture" button grabs the current frame to a `<canvas>` and runs Tesseract
     (lazy-loaded, in a worker) restricted to a digit-friendly config.
   - Show a live framing box + "Scanned successfully" confirmation (matches the
     Talise UX in the reference screenshots).
   - Graceful states: permission denied → show "Type it in" link to `/send/details`.

2. **`src/utils/scanParser.ts`** — pure, unit-testable text parser.
   - `extractAccountNumber(text)`: regex for a standalone **10-digit** run. Reject
     11-digit strings starting with `0` (phone numbers) and anything failing the
     NUBAN checksum where a bank is known.
   - `extractBankHint(text)`: fuzzy-match tokens against the bank list / known
     fintech aliases (Moniepoint, OPay, Kuda, PalmPay, GTB…). Reuse the
     `NAME_MAPPING` already in `bankSuggestion.ts`.
   - Returns `{ accountNumber, bankHint, rawText }`.

3. **`src/api/scan.ts`** *(only if/when we add cloud fallback)* — thin client to a
   backend `/ocr` endpoint. Keep an `extractText()` interface so the cloud path is a
   drop-in.

### Reused (no changes, or tiny ones)
- `bankSuggestion.ts` → `findMatchingBanks(accountNumber)` to propose the bank from
  the scanned digits.
- `api/bank.ts` → `verifyBankAccount(accountNumber, bankCode)` for the verified name.
- `SendFlow/AccountDetails.tsx` already accepts and validates the same fields — the
  cleanest integration is to **route the scan result into `/send/details` with the
  fields prefilled** (account number + selected bank pill pre-applied), so the
  existing verify/confirm UI handles edge cases (multiple bank candidates, failed
  verification) for free. Minimal change: have `AccountDetails` read optional
  `location.state` prefill.

### Wiring
- **`src/App.tsx`**: add `<Route path="/send/scan" element={<ScanToPay />} />`.
- **`src/pages/Home.tsx`**: add a **"Scan"** quick action (camera icon) next to
  Swap / Top Up / Electricity that navigates to `/send/scan`. (Place it where the
  Talise "Point & pay" entry sits.)

### Tests
- Unit tests for `scanParser.ts` against strings like the reference sign:
  `"8224043406 MONIEPOINT AJUAH EMMANUEL BEANS PALACE"` → `{ accountNumber:
  "8224043406", bankHint: "moniepoint" }`. Include phone-number rejection and
  multi-number cases. (Vitest is already configured.)

---

## Backend work (`rinku-labs/linq-v2`)

Branch: `claude/ocr-account-extraction-plan-9mxseo`

**Phase 1: none required.** The on-device path reuses `/verifybank` exactly as-is.
This is the whole point — we ship the feature with zero backend changes.

**Phase 2 (optional, only if cloud OCR is needed):**
- Add `POST /ocr` in `order-APi.go` (rate-limited via the existing `tollbooth`
  pattern used by `/verifybank`): accepts a base64 image, calls Google Cloud Vision
  `DOCUMENT_TEXT_DETECTION` over HTTP, returns raw text. Parsing stays on the client
  (or mirror `scanParser` server-side). Add `GOOGLE_VISION_KEY` to `.env.example`.
- Keep the image transient — do not persist user photos.

---

## Phasing

- **Phase 1 — Free, on-device, web-only (ship this):** QR scanner + Tesseract.js
  digit extraction + `scanParser` → reuse NUBAN guess + `/verifybank` + SendFlow.
  No backend changes, no cloud cost.
- **Phase 2 — Cloud fallback (only if field accuracy is poor):** `/ocr` endpoint
  backed by Google Cloud Vision, swapped in behind the existing `extractText()`
  interface. UI unchanged.

## Risks / guardrails
- **Wrong digit read** → mitigated by NUBAN checksum + mandatory name-enquiry +
  user confirmation. A misread that resolves to a real account is the residual risk,
  which is exactly why the confirm screen is non-negotiable.
- **Camera permissions / iOS Safari quirks** → always provide the "Type it in"
  fallback; `getUserMedia` requires HTTPS (we're already on `app.uselinq.xyz`).
- **Bundle size** → Tesseract.js and its language data are lazy-loaded on first use.
- **Multiple bank candidates from one NUBAN** → fall through to the existing bank
  selector pills in `AccountDetails`, which already handle this case.
</content>
</invoke>
