# Online Fit Checker

Paste links to clothing from online stores (or upload images) and see the whole
outfit composited onto a single model — so you can judge how items look layered
together (e.g. a jacket over a shirt with a tie) before buying.

## How it works

1. **Add garments** — paste a store URL (the server scrapes the product image via
   Open Graph / JSON-LD / `<img>` tags) or upload an image directly. Each item gets
   a type (top, jacket, tie, bottoms, …).
2. **Pick a base model** — a bundled mannequin, or upload a real front-facing photo
   for the most realistic result.
3. **Generate** — the items are sorted into layer order (skin-adjacent → outerwear)
   and applied one at a time with [Gemini 2.5 Flash Image](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image),
   each edit stacking on the previous so layering reads correctly. You get a
   photorealistic image you can regenerate or download.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

- Get a Gemini API key at https://aistudio.google.com/apikey.
- Leave `MOCK_TRYON=1` (or omit the key) to develop against a bundled sample
  composite without spending API credits. Set `MOCK_TRYON=0` with a real key for
  actual try-on.

## Cost

Each garment is one Gemini image edit (~$0.039), so a 3-item outfit costs ~$0.12
per generation. Regenerating re-runs the whole stack.

## Architecture

- `app/page.tsx` — client UI: garment list, base-model picker, result panel.
- `app/api/extract` — scrapes a product image from a store URL (SSRF-guarded).
- `app/api/tryon` — iterative Gemini composition into one outfit image.
- `lib/scrape.ts` — HTML → product image/title extraction.
- `lib/gemini.ts` — `composeOutfit()`, the per-garment edit loop (+ mock mode).
- `lib/garments.ts` — garment types and `sortByLayer()` layering logic.

## Notes & limitations

- Scraping arbitrary stores is best-effort; if a site blocks it, use the image
  upload fallback.
- Try-on fidelity varies for fine items (ties, patterns); iterative editing can
  drift, so regenerate if a result looks off.
- The bundled mannequins are stylized SVG placeholders — for realistic output,
  upload a real model photo as the base.

## Deploy

Deploys to [Vercel](https://vercel.com). Set `GEMINI_API_KEY` (and `MOCK_TRYON=0`)
as project environment variables. The API routes run on the Node.js runtime.
