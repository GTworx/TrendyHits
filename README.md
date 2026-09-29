# 🎧 TrendyHits

**TR** · Dünyada ve Türkiye'de şu an en çok dinlenen parçaları gösteren, iki dilli (Türkçe / İngilizce), Netlify'a deploy edilebilir müzik trend dashboard'u ve onu besleyen çoklu ajan (multi-agent) sistemi.

**EN** · A bilingual (Turkish / English) music trends dashboard for Netlify, showing what the world and Turkey are listening to right now — fed by a multi-agent pipeline.

Spec: [`prompt/TrendyHits 1.md`](prompt/TrendyHits%201.md), [`prompt/TrendyHits 2.md`](prompt/TrendyHits%202.md)

---

## Mimari / Architecture

```
Orchestrator (scripts/agents/orchestrator.mjs)
├── GlobalAgent ─┐  chart tools: Spotify Global (kworb), Billboard Hot 100, Apple Music US/UK
├── TRAgent ─────┤  chart tools: Spotify TR (kworb), Apple Music TR, YouTube TR trending
│                │  (+ Google Search grounding when the Gemini key has quota)
├── Validator ───┘  spelling, dedupe, note_tr/note_en, stable ids
└── MediaAgent      iTunes Search: artwork + 30s preview + Apple Music link → public/data/trends.json

Dashboard (Vite + React + TS + Tailwind, /tr/ & /en/) — thumbnails, ▶️ 30s previews, likes
├── GET  /api/likes      netlify/functions/likes.mts
├── POST /api/like       netlify/functions/like.mts       → Postgres (or Netlify Blobs fallback)
└── POST /api/subscribe  netlify/functions/subscribe.mts  → Kit v4 subscriber + language tag

Newsletter Dispatcher (scripts/agents/newsletter.mjs)
└── trends.json + /api/likes → TR & EN HTML → Kit Broadcasts (per language tag)
```

Agent system prompts are read directly from the `prompt/*.md` files, so the spec is the single source of truth.

---

## 🇹🇷 Kurulum ve Deploy

### Lokal geliştirme
```bash
npm install
cp .env.example .env         # GEMINI_API_KEY, KIT_API_KEY, KIT_TAG … doldurun
npm run agents:trends        # trend listelerini güncelle (public/data/trends.json)
npx netlify-cli dev          # frontend + functions → http://localhost:8888
```
- `npm run dev` yalnızca frontend'i açar (`/api/*` çalışmaz).
- `npm run agents:trends -- --table --lang=tr` → iki sütunlu Markdown tablo önizlemesi.
- `npm run agents:trends -- --media-only` → sadece kapak görselleri / önizlemeleri günceller (LLM çalışmaz).
- `npm run agents:newsletter` → `out/newsletter-{tr,en}.html` üretir, **göndermez**. `--draft` Kit'te taslak oluşturur, `--send` gönderimi planlar.

### Netlify'a deploy
1. Repo'yu GitHub'a push'layın, Netlify'da **Add new site → Import an existing project** ile bağlayın (ayarlar `netlify.toml`'dan okunur).
2. **Ortam değişkenleri** (Site configuration → Environment variables): `KIT_API_KEY`, `KIT_TAG` (varsayılan `TrendyHits`), isteğe bağlı `KIT_TAG_ID_TR` / `KIT_TAG_ID_EN`.
   Dil etiketi ID'leri girilmezse `"TrendyHits TR"` / `"TrendyHits EN"` etiketleri adla bulunur, yoksa oluşturulur.
3. **Veritabanı:** Netlify DB (Neon) etkinleştirin (`NETLIFY_DATABASE_URL` otomatik gelir) veya `DATABASE_URL` girin. Tablo ilk istekte otomatik oluşur; elle kurmak için `db/schema.sql` veya `npm run db:init`.
   Hiçbir DB bağlantısı yoksa beğeniler **Netlify Blobs**'ta tutulur.
4. Deploy edin; `/tr/`, `/en/`, Like butonu ve abonelik formunu test edin.

### GitHub Actions
Repo → Settings → Secrets and variables → Actions:
- **Secrets:** `GEMINI_API_KEY`, `KIT_API_KEY`, `SITE_URL` (örn. `https://trendyhits.netlify.app`), isteğe bağlı `KIT_TAG_ID_TR`, `KIT_TAG_ID_EN`
- **Variables:** `AI_MODEL` (örn. `gemini-flash-latest`), `KIT_TAG`, isteğe bağlı `KIT_SENDER_EMAIL`, `WEB_SEARCH=off`

| Workflow | Zamanlama | Ne yapar |
| :--- | :--- | :--- |
| `update-trends.yml` | Her gün 05:00 UTC (08:00 TR) | Orchestrator'ı çalıştırır, `trends.json`'u commit'ler → Netlify yeniden deploy eder |
| `send-newsletter.yml` | Pazartesi & Cuma 06:00 UTC (09:00 TR) | TR bülteni "TrendyHits TR", EN bülteni "TrendyHits EN" etiketli abonelere gönderir (manuel çalıştırmada varsayılan: taslak) |

---

## 🇬🇧 Setup & Deploy

### Local development
```bash
npm install
cp .env.example .env         # fill in GEMINI_API_KEY, KIT_API_KEY, KIT_TAG …
npm run agents:trends        # refresh the charts (public/data/trends.json)
npx netlify-cli dev          # frontend + functions → http://localhost:8888
```
- `npm run dev` runs the frontend only (`/api/*` won't work).
- `npm run agents:trends -- --table --lang=en` → side-by-side Markdown table preview.
- `npm run agents:trends -- --media-only` → refresh artwork / previews only (no LLM calls).
- `npm run agents:newsletter` writes `out/newsletter-{tr,en}.html` and **sends nothing**. `--draft` creates Kit drafts, `--send` schedules the broadcasts.

### Deploy to Netlify
1. Push to GitHub and connect it in Netlify via **Add new site → Import an existing project** (settings come from `netlify.toml`).
2. **Environment variables:** `KIT_API_KEY`, `KIT_TAG` (default `TrendyHits`), optional `KIT_TAG_ID_TR` / `KIT_TAG_ID_EN`.
   Without language tag IDs, tags named `"TrendyHits TR"` / `"TrendyHits EN"` are looked up and created if missing.
3. **Database:** enable Netlify DB (Neon; sets `NETLIFY_DATABASE_URL`) or set `DATABASE_URL`. The table is created on first request; to create it manually use `db/schema.sql` or `npm run db:init`.
   With no database configured, likes are stored in **Netlify Blobs**.
4. Deploy and test `/tr/`, `/en/`, the Like button and the subscribe form.

### GitHub Actions
Add the secrets/variables listed in the Turkish section above. `update-trends.yml` refreshes the data daily and commits it (Netlify redeploys on commit); `send-newsletter.yml` runs every Monday and Friday at 06:00 UTC and sends the Turkish edition to "TrendyHits TR" subscribers and the English edition to "TrendyHits EN" subscribers via Kit Broadcasts.

---

## Proje yapısı / Project structure
```
netlify.toml · .env.example · index.html · vite.config.ts
public/data/trends.json          # Orchestrator output (data contract: TrendyHits 1.md §3)
src/i18n/{tr,en}.json, index.tsx # translations, t(), useI18n()
src/components/                  # LanguageSwitcher, TrendColumn, TrackRow, NewsletterForm
src/hooks/usePreviewPlayer.ts     # single shared <audio> for 30s previews
netlify/functions/               # likes.mts, like.mts, subscribe.mts
netlify/lib/                     # likes store (Postgres | Blobs), trends loader
shared/kit.mjs                   # Kit v4 client (functions + newsletter agent)
scripts/agents/                  # orchestrator.mjs, newsletter.mjs, lib/
scripts/check-i18n.mjs           # runs before every build
db/schema.sql
.github/workflows/               # update-trends.yml, send-newsletter.yml
```
