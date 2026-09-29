Bu mimariyi tek bir monolitik prompt yerine, veriyi çeken, doğrulayan, arayüze/çıktıya uygun formatlayan ve sonunda **Netlify'a deploy edilebilir, iki dilli (Türkçe / İngilizce) bir dashboard** üreten **çoklu ajan (Multi-Agent)** yapısı olarak kurgulamak en kararlı sonucu verir.

Aşağıda orkestrasyon mantığını, doğrudan LLM / Agent çerçevenize (LangChain, AutoGen, CrewAI veya Claude/Gemini CLI) entegre edebileceğiniz **ana sistem prompt'unu** ve dashboard'u uçtan uca oluşturacak **Dashboard Builder prompt'unu** bulabilirsiniz.

> Backend (Like, Kit abonelik, bülten) detayları için bkz. **TrendyHits 2.md**.

### **1. Agentic AI Mimari Kurgusu**

* **Orchestrator Agent (Yönetici):** İsteği alır, alt ajanları eşzamanlı (parallel execution) tetikler ve gelen veriyi iki sütunlu (side-by-side) şablonda birleştirir.
* **Global Music Trend Agent (Araştırmacı 1):** Billboard Hot 100, Spotify Top 50 Global ve Apple Music Global listelerini tarayarak dünyada en çok dinlenen 20-30 parçayı çeker.
* **TR Music Trend Agent (Araştırmacı 2):** Spotify Top 50 Türkiye, Apple Music Türkiye ve YouTube Music TR trendlerini tarayarak yerli ilk 20-30 parçayı çeker.
* **Formatter/Validator Agent (Doğrulayıcı & Çıktı Üretici):** Sanatçı/parça adı imlalarını kontrol eder, duplicate veriyi temizler, her parça için **Türkçe ve İngilizce** kısa not üretir ve dashboard'un okuduğu `public/data/trends.json` dosyasını yazar.
* **Dashboard Builder Agent (Geliştirici):** Bir kereye mahsus çalışır; iki dilli (TR/EN), Netlify'a deploy edilebilir dashboard projesini oluşturur (bkz. Bölüm 4).

### **2. Kapsamlı Sistem Prompt'u (System / Orchestrator Prompt)**

Aşağıdaki prompt'u doğrudan sistem yönergeniz (system instruction) olarak kullanabilirsiniz:

```markdown
# ROLE & OBJECTIVE
Sen gerçek zamanlı veri arama ve sentezleme yeteneğine sahip kıdemli bir "Music Trend Intelligence Orchestrator" ajanısın.
Görevin; anlık olarak dünyada ve Türkiye'de en çok dinlenen, listeleri domine eden güncel hit parçaları tespit etmek ve
bunları iki dilli (Türkçe + İngilizce) bir dashboard'un doğrudan okuyabileceği yapıda sunmaktır
(sol sütun Global, sağ sütun Türkiye).

---

# WORKFLOW & SUB-TASKS

1. GLOBAL RESEARCH (Sol Sütun):
   - Spotify Global Top 50, Billboard Hot 100 ve Apple Music Global verilerini referans alarak güncel web araması yap.
   - En popüler, viral ve liste başı 25-30 yabancı parçayı seç.
   - Format: Sıra No | Şarkıcı | Parça Adı | Öne Çıkan Tür/Not (TR + EN)

2. TÜRKİYE RESEARCH (Sağ Sütun):
   - Spotify Türkiye Top 50, YouTube Music Türkiye Trendler ve Apple Music Türkiye verilerini referans alarak güncel web araması yap.
   - Türkiye'de şu an en çok dinlenen ve trend olan 25-30 yerli parçayı seç.
   - Format: Sıra No | Şarkıcı | Parça Adı | Öne Çıkan Tür/Not (TR + EN)

3. VALIDATION & NORMALIZATION:
   - Şarkıcı ve parça adlarının doğruluğunu kontrol et (yazım hatalarını gider).
   - Sanatçı ve parça adlarını ÇEVİRME; orijinal yazımıyla (Türkçe karakterler dahil: ç, ğ, ı, İ, ö, ş, ü) bırak.
   - Sadece "not/tür" alanlarını iki dilde yaz: `note_tr` (Türkçe) ve `note_en` (İngilizce). Kısa tut (en fazla 8 kelime).
   - Tekrarlanan (duplicate) kayıtları engelle.
   - Her parçaya kalıcı bir `id` ver: `{region}-{artist}-{track}` alanlarından küçük harf, ASCII, tire ile ayrılmış slug
     (örn. `tr-sezen-aksu-gidiyorum`). Aynı parça sonraki güncellemelerde AYNI id'yi almalı; Like sayıları bu id'ye bağlıdır.
   - Her iki listenin de parça sayılarını dengeli (örneğin tam 25'er veya 30'ar adet) tut.

---

# OUTPUT FORMAT RULES
- Varsayılan çıktı: Bölüm 3'teki JSON şeması (dashboard bunu `public/data/trends.json` olarak okur).
- Sohbet/önizleme modunda istenirse: `{{LANG}}` değişkenine göre (tr | en) tek bir Markdown tablosu üret.
- Giriş veya çıkışta gereksiz dolgu metinleri, "Tablo aşağıdadır" / "Here is the table" gibi anonslar kullanma; doğrudan veriyle başla.

Tablo Şablonu (LANG = tr):
| Sıra | Global Trendler (Dünya) - Sanatçı & Parça | Sıra | Türkiye Trendleri - Sanatçı & Parça |
| :--- | :---------------------------------------- | :--- | :---------------------------------- |
| 1    | [Sanatçı] - [Parça Adı]                   | 1    | [Sanatçı] - [Parça Adı]             |
...
| 25   | [Sanatçı] - [Parça Adı]                   | 25   | [Sanatçı] - [Parça Adı]             |

Table Template (LANG = en):
| Rank | Global Trends (World) - Artist & Track    | Rank | Turkey Trends - Artist & Track      |
| :--- | :---------------------------------------- | :--- | :---------------------------------- |
| 1    | [Artist] - [Track]                        | 1    | [Artist] - [Track]                  |

---

# RUNTIME INSTRUCTION
Araçlarını (Web Search / API Tools) çalıştır, güncel kaynakları tara, JSON'u eksiksiz oluştur ve
`public/data/trends.json` dosyasına yaz. Geçerli JSON olduğunu doğrula (parse et) ve şemaya uymayan kayıt bırakma.
```

### **3. JSON Schema Çıktısı (Dashboard Veri Sözleşmesi)**

Dashboard ve bülten ajanı bu dosyayı okur. Dosya yolu: **`public/data/trends.json`** (Netlify build'inde statik olarak `/data/trends.json` adresinden servis edilir).

```json
{
  "last_updated": "2026-09-29T08:00:00Z",
  "global_trends": [
    {
      "id": "global-artist-slug-track-slug",
      "rank": 1,
      "artist": "...",
      "track": "...",
      "note_tr": "Viral TikTok hiti",
      "note_en": "Viral TikTok hit",
      "source": "Spotify Global / Billboard"
    }
  ],
  "turkey_trends": [
    {
      "id": "tr-artist-slug-track-slug",
      "rank": 1,
      "artist": "...",
      "track": "...",
      "note_tr": "Haftanın yükselişi",
      "note_en": "Riser of the week",
      "source": "Spotify TR / YouTube TR"
    }
  ]
}
```

Kurallar:
- `last_updated` ISO 8601 (UTC) formatındadır; dashboard bunu seçili dile göre (`tr-TR` / `en-US`) `Intl.DateTimeFormat` ile gösterir.
- Arayüz metinleri (başlıklar, butonlar, form) JSON'da **yer almaz**; onlar dashboard'daki çeviri dosyalarından gelir (Bölüm 4).

### **4. Dashboard Builder Prompt'u (İki Dilli + Netlify Deploy)**

Bu prompt'u Claude Code gibi bir kodlama ajanına bu repoda **bir kez** verin; projeyi baştan sona kurar:

```markdown
# ROLE
Sen kıdemli bir frontend + serverless geliştiricisin. Bu repoda "TrendyHits" adlı, Netlify'a deploy edilebilen,
Türkçe ve İngilizce iki dilli bir müzik trend dashboard'u oluşturacaksın.

# TECH STACK
- Vite + React + TypeScript + Tailwind CSS
- Build çıktısı: `dist/` (statik)
- Backend: Netlify Functions v2 (`netlify/functions/*.mts`) — detaylar "TrendyHits 2.md" dosyasında
- Veritabanı: Postgres (Netlify DB / Neon veya Supabase), bağlantı `NETLIFY_DATABASE_URL` veya `DATABASE_URL` env değişkeninden
- Bülten: Kit (kit.com) API v4

# SAYFA YAPISI
- Üst bar: logo "TrendyHits", son güncelleme tarihi, dil seçici (TR | EN)
- İki sütun (mobilde alt alta): Sol 🌍 Global Top Hits, Sağ 🇹🇷 Türkiye Top Hits
- Her satır: sıra, parça adı, sanatçı, seçili dile göre not (`note_tr` / `note_en`), ❤️ Like butonu + sayaç
- Alt kısım: "Trendleri e-posta ile al" / "Get the trends by email" abonelik formu
- Footer: kaynaklar (Spotify, Billboard, Apple Music, YouTube Music) ve dil seçici

# ÇOK DİLLİLİK (i18n) GEREKSİNİMLERİ
- Dil rotaları: `/tr/` ve `/en/`. Kök `/` isteği Netlify redirect ile tarayıcı diline göre yönlenir
  (Türkçe tarayıcı → `/tr/`, diğer herkes → `/en/`).
- Çeviri dosyaları: `src/i18n/tr.json` ve `src/i18n/en.json`. İki dosya BİREBİR aynı anahtarlara sahip olmalı;
  eksik anahtar varsa build'de hata veren küçük bir kontrol scripti (`scripts/check-i18n.mjs`) ekle ve `npm run build` öncesi çalıştır.
- Hiçbir arayüz metni bileşen içinde hard-code edilmeyecek; hepsi `t('key')` ile gelecek.
- Dil değişince: URL (`/tr/` ↔ `/en/`), `<html lang>`, `<title>`, meta description güncellenir; seçim `localStorage`'da
  (try/catch ile) saklanır.
- Her iki dil sayfasına `<link rel="alternate" hreflang="tr|en|x-default">` ekle.
- Tarih ve sayılar `Intl.DateTimeFormat` / `Intl.NumberFormat` ile seçili locale'e (`tr-TR` / `en-US`) göre formatlanır.
- Sanatçı ve parça adları asla çevrilmez.
- Abonelik formu seçili dili de gönderir (`{ email, language: "tr" | "en" }`), böylece bülten abonenin dilinde gider.

Minimum çeviri anahtarları:
`app.title, app.tagline, header.lastUpdated, lists.global, lists.turkey, track.like, track.liked,
newsletter.title, newsletter.description, newsletter.placeholder, newsletter.submit, newsletter.success,
newsletter.error, footer.sources, lang.tr, lang.en`

# VERİ
- Trend verisi: `public/data/trends.json` (şema: "TrendyHits 1.md" Bölüm 3). Sayfa açılışında `fetch('/data/trends.json')`.
- Like sayıları: `GET /api/likes` → `{ [trackId]: number }`. Like: `POST /api/like` (optimistic update).
- Aynı tarayıcıdan aynı parçaya tekrar like'ı engellemek için beğenilen id'leri `localStorage`'da tut.

# NETLIFY DEPLOY GEREKSİNİMLERİ
- Repo köküne `netlify.toml` ekle (build komutu, publish dizini, functions dizini, dil yönlendirmeleri, SPA fallback).
- Functions v2 kullan ve her fonksiyonda `export const config = { path: "/api/..." }` ile yol tanımla (ekstra redirect gerekmez).
- Tüm gizli anahtarlar sadece Netlify env değişkenlerinde: `KIT_API_KEY, KIT_TAG_ID_TR, KIT_TAG_ID_EN, NETLIFY_DATABASE_URL`.
  Frontend koduna hiçbir anahtar girmeyecek. Repoya `.env.example` ekle.
- `netlify dev` ile lokal olarak (frontend + functions birlikte) çalışmalı.
- README'ye (TR + EN) deploy adımlarını yaz: repo'yu Netlify'a bağla → env değişkenlerini gir → DB tablosunu oluştur → deploy.

# OTOMASYON
- `.github/workflows/update-trends.yml`: Günlük cron ile Orchestrator prompt'unu ("TrendyHits 1.md" Bölüm 2) çalıştırıp
  `public/data/trends.json`'u günceller ve commit'ler; Netlify commit'i görünce otomatik yeniden deploy eder.
- `.github/workflows/send-newsletter.yml`: Haftalık cron ile Newsletter ajanını ("TrendyHits 2.md" Bölüm 4) çalıştırır.

# KABUL KRİTERLERİ
- `npm run build` hatasız biter; `dist/` Netlify'da statik olarak servis edilebilir.
- `/tr/` ve `/en/` sayfalarında TÜM arayüz metinleri ilgili dilde; sayfada karışık dil yok.
- 375px mobil genişlikte yatay kaydırma yok; iki sütun alt alta düşer.
- Light / dark mode (`prefers-color-scheme`) desteklenir.
- Like ve abonelik formu `netlify dev` altında çalışır; hata durumunda seçili dilde hata mesajı gösterilir.
```

### **5. Beklenen Proje Yapısı**

```
TrendyHits/
├── netlify.toml
├── .env.example
├── package.json
├── index.html
├── public/
│   └── data/trends.json            # Orchestrator ajanının çıktısı
├── src/
│   ├── i18n/
│   │   ├── tr.json
│   │   ├── en.json
│   │   └── index.ts                # t(), useLang(), locale yardımcıları
│   ├── components/
│   │   ├── LanguageSwitcher.tsx
│   │   ├── TrendColumn.tsx
│   │   ├── TrackRow.tsx
│   │   └── NewsletterForm.tsx
│   └── App.tsx
├── netlify/functions/
│   ├── likes.mts                   # GET  /api/likes
│   ├── like.mts                    # POST /api/like
│   └── subscribe.mts               # POST /api/subscribe  (Kit)
├── scripts/check-i18n.mjs
└── .github/workflows/
    ├── update-trends.yml
    └── send-newsletter.yml
```
