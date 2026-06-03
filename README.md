# Lookloop

Paste links to clothing from online stores (or upload images) and see the whole
outfit composited onto a single model — so you can judge how items look layered
together (e.g. a jacket over a shirt with a tie) before buying.

## How it works

1. **Add garments** — paste a store URL (the server scrapes the product image via
   Open Graph / JSON-LD / `<img>` tags) or upload an image directly. Each item gets
   a type (top, jacket, tie, bottoms, …).
2. **Pick a base model** — a bundled mannequin, or upload a real front-facing photo
   for the most realistic result.
3. **Choose an image model** — Gemini or GPT, selectable per generation.
4. **Generate** — the items are sorted into layer order (skin-adjacent → outerwear)
   and applied one at a time, each edit stacking on the previous so layering reads
   correctly. You get an image you can regenerate or download.

## Image generation (OpenRouter)

Image generation runs through [OpenRouter](https://openrouter.ai), so a single API
key + credit balance covers multiple models. The UI lets you pick per generation:

| UI option | OpenRouter model        |
| --------- | ----------------------- |
| Gemini    | `google/gemini-2.5-flash-image` |
| GPT       | `openai/gpt-5-image`    |

Both are image-**output** models that accept the base photo + garment image and
return an edited composite (OpenAI-compatible `chat/completions` with
`modalities: ["image","text"]`; the result image comes back in `message.images`).
Cost is billed to your OpenRouter credits and the app shows the actual per-generation
cost OpenRouter reports.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in OPENROUTER_API_KEY
npm run dev                  # http://localhost:3000
```

- Get an OpenRouter API key at https://openrouter.ai/keys and add credits at
  https://openrouter.ai/credits.
- `OPENROUTER_API_KEY` is required in every environment. Local changes to
  `.env.local` require restarting `npm run dev`.

## Architecture

- `app/page.tsx` — client UI: garment list, base-model picker, model picker, result panel.
- `app/api/extract` — scrapes a product image from a store URL (SSRF-guarded).
- `app/api/tryon` — iterative composition into one outfit image, with a `model` param.
- `lib/scrape.ts` — HTML → product image/title extraction.
- `lib/imagegen.ts` — `composeOutfit()`, the OpenRouter image generation pipeline.
- `lib/model-options.ts` — client-safe model keys/labels shared by UI and server.
- `lib/garments.ts` — garment types and `sortByLayer()` layering logic.

## Notes & limitations

- Scraping arbitrary stores is best-effort; if a site blocks it, use the image
  upload fallback.
- Try-on fidelity varies for fine items (ties, patterns); iterative editing can
  drift, so regenerate if a result looks off.
- The bundled mannequins are stylized SVG placeholders — for realistic output,
  upload a real model photo as the base.

## Deploy

Deploys to [Vercel](https://vercel.com). Set `OPENROUTER_API_KEY` as a project
environment variable. The API routes run on the Node.js runtime.
