# Certificate Render (Vercel + Sharp)

Standalone project scaffold for deterministic certificate image rendering with `sharp`, designed for deployment on Vercel Node runtime.

## What this includes

- Exact logic parity with source generator:
  - red rectangle text area detection
  - template fallback handling
  - SVG text overlay with fixed sizing heuristics
  - WebP output
- Vercel serverless endpoint:
  - `POST /api/certificates/generate`
- Local development server:
  - `POST /api/certificates/generate`
  - `GET /health`

## Requirements

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Local endpoint:

- `POST http://localhost:3000/api/certificates/generate`

## Build and run production mode locally

```bash
npm run build
npm run start
```

## Deploy to Vercel

1. Copy this folder into a new repository root.
2. Push repository to Git provider.
3. Import project in Vercel.
4. Ensure runtime stays Node.js (already configured in code and `vercel.json`).

## Request payload

```json
{
  "display_name": "The Dragon",
  "watermark_detection_image_url": "https://example.com/watermark-red-rectangle.webp",
  "watermark_image_url": "https://example.com/watermark.webp",
  "stats": {
    "average_score": 72.45,
    "high_finish": 151,
    "best_leg": 18,
    "score_140_count": 7,
    "score_170_count": 1
  }
}
```

## Response

- `200 OK` with `Content-Type: image/webp` and binary image body.
- `400` for invalid payload.
- `500` for generation/fetch/render failures.
# Certificate renderer (Vercel)

Standalone Vercel function project for rendering certificate PNGs with Sharp, matching the integration contract expected by the main app.

## Endpoint

- `POST /api/certificates/render`
- Auth: `Authorization: Bearer <CERTIFICATE_RENDER_SECRET>`
- Request: `CertificateAIPromptInput` JSON
- Response: `image/png` binary

## Setup

1. Install dependencies:
   - `npm install`
2. Configure env:
   - copy `.env.example` to `.env.local`
   - set `CERTIFICATE_RENDER_SECRET`
   - set `SUPABASE_URL` (for font loading from public bucket)
3. Run local dev:
   - `npm run dev`

## Required env vars

- `CERTIFICATE_RENDER_SECRET`
- `SUPABASE_URL`

## Optional env vars

- `CERTIFICATE_FONT_URL`
- `CERTIFICATE_FONT_FAMILY`
- `RENDER_ENGINE=sharp|resvg` (default: `sharp`)

## Main app integration

Set in the main Astro/Cloudflare project:

- `CERTIFICATE_RENDER_URL=https://<your-vercel-domain>/api/certificates/render`
- `CERTIFICATE_RENDER_SECRET=<same-value-as-this-project>`

When both are set, the main app delegates rendering to this service.
