Bu sistemi uçtan uca hayata geçirmek için gereken mimariyi **3 katman** halinde kurgulayabiliriz. Tüm katmanlar **Netlify** üzerinde çalışır ve arayüz **Türkçe + İngilizce** iki dillidir:

> 1. **Arayüz & Etkileşim (Frontend, statik):** Vite + React ile iki dilli (`/tr/`, `/en/`) dashboard: sol ve sağ listeler, her parçanın yanında kapak görseli (thumbnail), 30 sn ses önizlemesi (▶️), canlı Like butonu ve alt kısımda Kit (kit.com) ile entegre bülten abonelik formu.
> 2. **Arka Plan & Veritabanı (Netlify Functions + Postgres):** Like sayılarını tutan ve Kit API v4'e yeni aboneyi **dil etiketiyle** ekleyen serverless fonksiyonlar.
> 3. **Agentic AI & Otomasyon (Newsletter Sender):** Belirli periyotlarla (örneğin haftada 1) trend listelerini çıkaran ve Kit Broadcasts API üzerinden abonelere **kendi dillerinde** şık bir e-posta bülteni gönderen ajan.

Aşağıda bu sistemi oluşturmak için **Veritabanı**, **Frontend & i18n**, **Netlify Functions & Kit Entegrasyonu**, **Agentic AI E-posta Gönderim Prompt'u** ve **Netlify Deploy** ayarlarını bulabilirsiniz. Trend verisinin şeması ve Dashboard Builder prompt'u için bkz. **TrendyHits 1.md**.

### **1. Veritabanı Şeması (SQL)**

Like sayılarını ve şarkıları tutmak için basit ve esnek bir tablo (Netlify DB / Neon veya Supabase Postgres):

```sql
CREATE TABLE IF NOT EXISTS tracks (
    id          VARCHAR(128) PRIMARY KEY,           -- trends.json'daki kalıcı slug, örn: 'tr-sezen-aksu-gidiyorum'
    title       VARCHAR(255) NOT NULL,
    artist      VARCHAR(255) NOT NULL,
    region      VARCHAR(10)  NOT NULL CHECK (region IN ('GLOBAL', 'TR')),
    likes_count INT          NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### **2. Frontend, i18n & Like Mantığı (React)**

#### **A. Çeviri dosyaları**

Tüm arayüz metinleri çeviri dosyalarından gelir; bileşenlerde hard-code metin yoktur. İki dosya birebir aynı anahtarlara sahip olmalıdır.

`src/i18n/tr.json`
```json
{
  "app.title": "TrendyHits",
  "app.tagline": "Dünyada ve Türkiye'de şu an en çok dinlenenler",
  "header.lastUpdated": "Son güncelleme",
  "lists.global": "🌍 Global Top Hits",
  "lists.turkey": "🇹🇷 Türkiye Top Hits",
  "track.like": "Beğen",
  "track.liked": "Beğendin",
  "track.play": "Önizlemeyi dinle",
  "track.pause": "Durdur",
  "track.openApple": "Apple Music'te aç",
  "track.previewError": "Önizleme oynatılamadı.",
  "newsletter.title": "Trendleri e-posta ile al",
  "newsletter.description": "Her hafta Global ve Türkiye listeleri gelen kutunda.",
  "newsletter.placeholder": "E-posta adresin",
  "newsletter.submit": "Abone ol",
  "newsletter.success": "Bültene başarıyla kaydoldun!",
  "newsletter.error": "Bir sorun oluştu, lütfen tekrar dene.",
  "footer.sources": "Kaynaklar",
  "footer.previews": "Kapak görselleri ve 30 sn önizlemeler: Apple Music",
  "lang.tr": "Türkçe",
  "lang.en": "English"
}
```

`src/i18n/en.json`
```json
{
  "app.title": "TrendyHits",
  "app.tagline": "What the world and Turkey are listening to right now",
  "header.lastUpdated": "Last updated",
  "lists.global": "🌍 Global Top Hits",
  "lists.turkey": "🇹🇷 Turkey Top Hits",
  "track.like": "Like",
  "track.liked": "Liked",
  "track.play": "Play preview",
  "track.pause": "Pause",
  "track.openApple": "Open in Apple Music",
  "track.previewError": "Couldn't play the preview.",
  "newsletter.title": "Get the trends by email",
  "newsletter.description": "Global and Turkey charts in your inbox every week.",
  "newsletter.placeholder": "Your email address",
  "newsletter.submit": "Subscribe",
  "newsletter.success": "You're subscribed to the newsletter!",
  "newsletter.error": "Something went wrong, please try again.",
  "footer.sources": "Sources",
  "footer.previews": "Artwork and 30-second previews: Apple Music",
  "lang.tr": "Türkçe",
  "lang.en": "English"
}
```

#### **B. TrackRow bileşeni (iki dilli, thumbnail + önizleme)**

Her parçanın solunda kapak görseli yer alır; görsel aynı zamanda 30 saniyelik önizlemeyi çalan ▶️ / ⏸ butonudur. Sayfada tek bir paylaşılan `<audio>` vardır (`usePreviewPlayer`): yeni bir önizleme başlayınca önceki durur. Sağda beğeni butonu ve sayacı bulunur. Not alanı seçili dile göre seçilir, sanatçı/parça adı çevrilmez, sayı locale'e göre formatlanır:

```ts
// src/hooks/usePreviewPlayer.ts — tek paylaşılan oynatıcı
export function usePreviewPlayer(onError: () => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0..1

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none'; // ses sadece tıklanınca indirilir
    audioRef.current = audio;
    audio.addEventListener('timeupdate', () => setProgress(audio.currentTime / (audio.duration || 1)));
    audio.addEventListener('ended', () => { setPlayingId(null); setProgress(0); });
    return () => audio.pause();
  }, []);

  const toggle = useCallback((id: string, url: string) => {
    const audio = audioRef.current!;
    if (playingId === id) { audio.pause(); setPlayingId(null); return; }
    audio.pause();
    audio.src = url;
    setPlayingId(id);
    audio.play().catch(() => { setPlayingId(null); onError(); }); // → t('track.previewError')
  }, [playingId, onError]);

  return { playingId, progress, toggle };
}
```

```tsx
// src/components/TrackRow.tsx
import { useI18n } from '../i18n';

export function TrackRow({ track, likes, liked, onLike, playing, progress, onTogglePlay }) {
  const { t, lang, locale } = useI18n(); // lang: 'tr' | 'en', locale: 'tr-TR' | 'en-US'
  const note = lang === 'tr' ? track.note_tr : track.note_en;

  const artwork = track.artwork_url
    ? <img src={track.artwork_url} alt="" loading="lazy" width={48} height={48} className="h-12 w-12 object-cover" />
    : <span className="flex h-12 w-12 items-center justify-center bg-gradient-to-br from-rose-400 to-indigo-500 font-bold text-white">
        {track.track.charAt(0)}
      </span>;

  return (
    <li className={`flex items-center justify-between gap-3 px-4 py-3 ${playing ? 'bg-rose-50 dark:bg-rose-950/20' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-bold text-gray-500 w-6">{track.rank}</span>

        {/* Thumbnail + Önizleme / Preview */}
        {track.preview_url ? (
          <button
            onClick={() => onTogglePlay(track)}
            aria-pressed={playing}
            aria-label={`${playing ? t('track.pause') : t('track.play')}: ${track.artist} – ${track.track}`}
            className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"
          >
            {artwork}
            <span className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white ${playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {playing ? '⏸' : '▶'}
            </span>
            {playing && <span className="absolute bottom-0 left-0 h-1 bg-rose-500" style={{ width: `${progress * 100}%` }} />}
          </button>
        ) : (
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">{artwork}</div>
        )}

        <div className="min-w-0">
          {track.apple_music_url
            ? <a href={track.apple_music_url} target="_blank" rel="noopener noreferrer" title={t('track.openApple')}
                 className="block font-semibold truncate hover:underline">{track.track}</a>
            : <p className="font-semibold truncate">{track.track}</p>}
          <p className="text-sm text-gray-500 truncate">{track.artist}</p>
          {note && <p className="text-xs text-gray-400 truncate">{note}</p>}
        </div>
      </div>

      {/* Beğeni Butonu / Like Button */}
      <button
        onClick={() => onLike(track)}
        disabled={liked}
        aria-label={liked ? t('track.liked') : t('track.like')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 transition"
      >
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
        <span className="text-xs font-semibold">{new Intl.NumberFormat(locale).format(likes ?? 0)}</span>
      </button>
    </li>
  );
}
```

> Görsel ve önizleme verisi (`artwork_url`, `preview_url`, `apple_music_url`) Media Enricher ajanından gelir (bkz. **TrendyHits 1.md**). Ses Apple CDN'inden doğrudan çalınır; ek bir backend fonksiyonu gerekmez.

#### **C. Dil seçimi kuralları**

- Dil URL'den okunur (`/tr/...` veya `/en/...`); `/` isteği Netlify tarafından tarayıcı diline göre yönlendirilir (Bölüm 5).
- Dil değişince `<html lang>`, `<title>` ve meta description güncellenir; tercih `localStorage`'da (try/catch ile) saklanır.
- Abonelik formu seçili dili de gönderir: `POST /api/subscribe` → `{ "email": "...", "language": "tr" | "en" }`.

### **3. Netlify Functions & Kit (kit.com, eski adıyla ConvertKit) Entegrasyonu**

Tüm backend uç noktaları **Netlify Functions v2** olarak `netlify/functions/` altında yer alır; `config.path` ile `/api/*` yollarına bağlanır. Gizli anahtarlar yalnızca Netlify ortam değişkenlerindedir.

#### **A. Like uç noktaları**

```ts
// netlify/functions/like.mts  →  POST /api/like   body: { id }
import { neon } from '@neondatabase/serverless';
import type { Config } from '@netlify/functions';

const sql = neon(process.env.NETLIFY_DATABASE_URL ?? process.env.DATABASE_URL!);

export default async (req: Request) => {
  const { id } = await req.json().catch(() => ({}));

  // Sadece güncel trends.json'da olan parçalar beğenilebilir; başlık/sanatçı istemciden değil, veriden alınır
  const trends = await fetch(new URL('/data/trends.json', req.url)).then((r) => r.json());
  const all = [
    ...trends.global_trends.map((t) => ({ ...t, region: 'GLOBAL' })),
    ...trends.turkey_trends.map((t) => ({ ...t, region: 'TR' })),
  ];
  const track = all.find((t) => t.id === id);
  if (!track) return Response.json({ error: 'unknown_track' }, { status: 400 });

  const [row] = await sql`
    INSERT INTO tracks (id, title, artist, region, likes_count)
    VALUES (${track.id}, ${track.track}, ${track.artist}, ${track.region}, 1)
    ON CONFLICT (id) DO UPDATE SET likes_count = tracks.likes_count + 1, updated_at = NOW()
    RETURNING likes_count`;

  return Response.json({ id: track.id, likes_count: row.likes_count });
};

export const config: Config = { path: '/api/like', method: 'POST' };
```

```ts
// netlify/functions/likes.mts  →  GET /api/likes   yanıt: { [trackId]: number }
import { neon } from '@neondatabase/serverless';
import type { Config } from '@netlify/functions';

const sql = neon(process.env.NETLIFY_DATABASE_URL ?? process.env.DATABASE_URL!);

export default async () => {
  const rows = await sql`SELECT id, likes_count FROM tracks`;
  return Response.json(Object.fromEntries(rows.map((r) => [r.id, r.likes_count])), {
    headers: { 'Cache-Control': 'public, max-age=30' },
  });
};

export const config: Config = { path: '/api/likes', method: 'GET' };
```

#### **B. Bültene Abone Kaydetme (Kit API v4)**

Kullanıcı formu doldurduğunda Kit'te abone (Subscriber) oluşturulur ve seçtiği dile göre **"TrendyHits TR"** veya **"TrendyHits EN"** etiketine (Tag) eklenir. Kit'te abone grupları Tag (veya Form) ile yönetilir; bülten gönderiminde bu etiketler dil filtresi olarak kullanılır:

```ts
// netlify/functions/subscribe.mts  →  POST /api/subscribe   body: { email, language }
import type { Config } from '@netlify/functions';

const KIT_API = 'https://api.kit.com/v4';
const TAGS = {
  tr: process.env.KIT_TAG_ID_TR, // Kit panelindeki "TrendyHits TR" etiketinin ID'si
  en: process.env.KIT_TAG_ID_EN, // Kit panelindeki "TrendyHits EN" etiketinin ID'si
};

const kit = (path: string, body: object) =>
  fetch(`${KIT_API}${path}`, {
    method: 'POST',
    headers: {
      'X-Kit-Api-Key': process.env.KIT_API_KEY!, // Kit > Settings > Developer > API Keys (v4)
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).errors?.join(', ') || r.statusText);
    return r.json();
  });

export default async (req: Request) => {
  const { email, language } = await req.json().catch(() => ({}));
  const lang = language === 'en' ? 'en' : 'tr';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ success: false, error: 'invalid_email' }, { status: 400 });
  }

  try {
    // 1) Aboneyi oluştur (e-posta zaten varsa Kit mevcut kaydı günceller / döndürür)
    await kit('/subscribers', { email_address: email });

    // 2) Aboneyi dil etiketine ekle
    await kit(`/tags/${TAGS[lang]}/subscribers`, { email_address: email });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 400 });
  }
};

export const config: Config = { path: '/api/subscribe', method: 'POST' };
```

> **Not:** Başarı/hata mesajları sunucudan değil, frontend'deki çeviri dosyalarından (`newsletter.success` / `newsletter.error`) gösterilir; böylece mesaj her zaman kullanıcının dilindedir.
>
> **Double opt-in:** Onay e-postası istiyorsanız etiket yerine dil başına bir Kit Form'u kullanın: `POST /v4/forms/{form_id}/subscribers`. Kit, formun "incentive email" ayarına göre (her form kendi dilinde) onay maili gönderir.

### **4. Agentic AI Newsletter Kurgusu (Ajan Rolü ve Prompt)**

Bu aşamada çalışan **"Music Newsletter Dispatcher Agent"** haftalık olarak GitHub Actions (`.github/workflows/send-newsletter.yml`) üzerinden tetiklenir ve üç görevi yerine getirir:

> 1. Canlı sitedeki güncel listeleri (`https://<site>.netlify.app/data/trends.json`) ve en çok like alan parçaları (`/api/likes`) bir araya getirir.
> 2. **Türkçe ve İngilizce** olmak üzere iki ayrı modern HTML e-posta üretir.
> 3. Kit Broadcasts API üzerinden her dili kendi etiketli abonelerine gönderir.

#### **Ajan Sistem Prompt'u (System Prompt):**

````markdown
# ROLE & MISSION
Sen "Music Trend Intelligence & Newsletter Agent"sın.
Görevin, en güncel Global ve Türkiye müzik trendlerini TrendyHits sitesinden almak, bunları Türkçe ve İngilizce
iki ayrı şık e-posta bülteni (HTML email) formatına dönüştürmek ve Kit (kit.com) API aracılığıyla her dili
kendi abone kitlesine göndermektir.

---

# CONTEXT & TOOLS
- HTTP Fetch Tool: `{{SITE_URL}}/data/trends.json` (trend listeleri + `artwork_url` / `preview_url` / `apple_music_url`) ve `{{SITE_URL}}/api/likes` (beğeni sayıları).
- Kit Broadcast Tool / API: Bülten içeriğini ilgili dil etiketine (KIT_TAG_ID_TR / KIT_TAG_ID_EN) sahip abonelere Broadcast olarak gönderir.

---

# WORKFLOW

1. DATA GATHERING:
   - trends.json'dan Global ve Türkiye listelerini al (20-30'ar parça).
   - /api/likes'tan gelen beğeni sayılarını parça `id`'leri ile eşleştir (eşleşme yoksa 0).
   - Her iki listede en çok beğenilen ilk 3 parçayı "Topluluğun Favorileri / Community Favorites" olarak işaretle.

2. NEWSLETTER CONTENT COMPILATION (her dil için ayrı):
   - Konu satırı:
     * TR: "🎧 Haftanın Hit Parçaları: Global & Türkiye Trendleri"
     * EN: "🎧 This Week's Hits: Global & Turkey Trends"
   - Önizleme metni (preview text): 1 cümle, konu satırını tekrar etme.
   - Giriş: Kısa, enerjik bir editoryal giriş yazısı. EN metni TR'nin birebir çevirisi değil, doğal İngilizce yazılmış olsun.
   - 2 Sütunlu Responsive HTML Kart Tasarımı (tablo tabanlı, inline CSS, mobilde alt alta):
     * Sol: 🌍 Global Top Hits (Sıra, Kapak Görseli, Sanatçı, Parça, Beğeni Sayısı)
     * Sağ: 🇹🇷 Türkiye / Turkey Top Hits (Sıra, Kapak Görseli, Sanatçı, Parça, Beğeni Sayısı)
   - Kapak görseli: `artwork_url` → 40x40 `<img>` (width/height attribute + inline style, `alt=""`); yoksa renkli yedek kutu.
   - E-posta istemcileri ses çalamaz: `apple_music_url` varsa parça adını oraya linkle (dinleyici önizlemeyi Apple Music'te açar).
   - Parça notları için dile göre `note_tr` / `note_en` kullan. Sanatçı ve parça adlarını ÇEVİRME.
   - Sayıları dile göre formatla (TR: 1.234 — EN: 1,234).
   - `<html lang="tr">` / `<html lang="en">` etiketini doğru ayarla.
   - Alt Kısım CTA butonu (abonenin diline ait sayfaya link):
     * TR: "En çok beğendiğin parçayı oylamak için sitemizi ziyaret et!" → `{{SITE_URL}}/tr/`
     * EN: "Visit our site to vote for your favorite track!" → `{{SITE_URL}}/en/`

3. DISPATCH (KIT ENTEGRASYONU):
   - Her dil için ayrı bir istek at: `POST https://api.kit.com/v4/broadcasts` (Header: `X-Kit-Api-Key: <KIT_API_KEY>`).
   - `send_at` alanına şu anki (veya planlanan) ISO 8601 zamanı verilirse bülten o zamanda gönderilir; `null` bırakılırsa taslak olarak kaydedilir.
   - Gönderici adı/adresi Kit hesabındaki doğrulanmış gönderici ayarlarından gelir; `email_address` ile doğrulanmış başka bir gönderici adresi seçilebilir.
   - Türkçe bülten örneği (İngilizce için `subject`, `preview_text`, `content` ve `KIT_TAG_ID_EN` değişir):
   ```json
   {
     "email_address": "bulten@alanadiniz.com",
     "subject": "🎧 Haftanın Hit Parçaları: Global & Türkiye Trendleri",
     "preview_text": "Bu hafta listelerde neler oldu, topluluk hangi parçaları sevdi?",
     "description": "TrendyHits haftalık bülten - TR",
     "content": "<!DOCTYPE html><html lang=\"tr\">...</html>",
     "public": false,
     "send_at": "2026-10-05T09:00:00Z",
     "subscriber_filter": [
       { "all": [{ "type": "tag", "ids": [KIT_TAG_ID_TR] }], "any": null, "none": null }
     ]
   }
   ```
   - Not: Kit'in ayrı bir transactional (tekil) e-posta API'si yoktur; tüm abonelere toplu gönderim Broadcast ile yapılır.

4. VERIFICATION:
   - Her iki isteğin de 2xx döndüğünü doğrula; dönen broadcast `id`'lerini ve dilini logla.
   - Bir dil başarısız olursa diğerini geri alma; hatayı raporla ve workflow'u başarısız olarak bitir.
````

### **5. Netlify Deploy Ayarları**

#### **A. `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"

# Kök adres: Türkçe tarayıcılar /tr/'ye, diğer herkes /en/'e
[[redirects]]
  from = "/"
  to = "/tr/"
  status = 302
  force = true
  conditions = { Language = ["tr"] }

[[redirects]]
  from = "/"
  to = "/en/"
  status = 302
  force = true

# SPA fallback: her iki dil rotası aynı index.html'i yükler, dil URL'den okunur
[[redirects]]
  from = "/tr/*"
  to = "/index.html"
  status = 200

[[redirects]]
  from = "/en/*"
  to = "/index.html"
  status = 200
```

> `/api/*` yolları fonksiyonlardaki `config.path` ile tanımlandığı için ayrıca redirect gerekmez. `/data/trends.json` statik dosya olduğundan SPA fallback'ten etkilenmez.

#### **B. Ortam Değişkenleri (Netlify > Site configuration > Environment variables)**

| Değişken | Açıklama |
| :--- | :--- |
| `KIT_API_KEY` | Kit v4 API anahtarı |
| `KIT_TAG_ID_TR` | "TrendyHits TR" etiket ID'si |
| `KIT_TAG_ID_EN` | "TrendyHits EN" etiket ID'si |
| `NETLIFY_DATABASE_URL` | Netlify DB (Neon) etkinleştirilince otomatik gelir; Supabase kullanıyorsanız `DATABASE_URL` girin |

GitHub Actions tarafında (Repo > Settings > Secrets): `KIT_API_KEY`, `KIT_TAG_ID_TR`, `KIT_TAG_ID_EN`, `SITE_URL` ve kullandığınız LLM sağlayıcısının API anahtarı.

#### **C. Deploy Adımları**

1. Repo'yu GitHub'a push'layın ve Netlify'da **Add new site → Import an existing project** ile bağlayın (build ayarları `netlify.toml`'dan okunur).
2. Netlify DB'yi (Neon) etkinleştirin veya Supabase bağlantı adresini girin; Bölüm 1'deki SQL'i bir kez çalıştırın.
3. Kit panelinde "TrendyHits TR" ve "TrendyHits EN" etiketlerini oluşturun, ID'lerini ve API anahtarını env değişkenlerine girin.
4. Deploy edin; `/tr/` ve `/en/` sayfalarını, Like butonunu ve abonelik formunu test edin.
5. Lokal geliştirme: `netlify dev` (frontend + functions birlikte çalışır, env değişkenleri Netlify'dan çekilir).

### **6. Özet Mimari Akışı**

```
[ Kullanıcı Arayüzü — Netlify (statik, /tr/ & /en/) ]
├── Üst Bar: Dil Seçici (TR | EN)
├── Sol Kolon: Global Trendler + [🖼 Thumbnail · ▶️ 30 sn Önizleme] + [❤️ Like Butonu]
├── Sağ Kolon: TR Trendler + [🖼 Thumbnail · ▶️ 30 sn Önizleme] + [❤️ Like Butonu]
└── Alt Kısım: "Trendleri E-posta ile Al / Get the trends by email" Formu
        │
        ├── (0. ▶️ Tıklandı)      ──> [Tek paylaşılan <audio>] ──> [Apple CDN preview_url (30 sn)]
        │
        ├── (1. Like Tıklandı)   ──> [Netlify Function /api/like] ──> [Postgres: likes_count + 1]
        │
        └── (2. E-posta Girildi) ──> [Netlify Function /api/subscribe] ──> [Kit Subscribers + Tags API]
                                                                         ──> ["TrendyHits TR" / "TrendyHits EN" etiketli aboneler]

[ Otomasyon — GitHub Actions ]
├── Günlük:   Orchestrator Agent ──> Media Enricher (iTunes: kapak + önizleme) ──> public/data/trends.json commit ──> Netlify otomatik yeniden deploy
└── Haftalık: Newsletter Agent
      ├── 1. trends.json + /api/likes verilerini analiz eder.
      ├── 2. TR ve EN olmak üzere iki responsive HTML bülten derler (kapak görselleri + Apple Music linkleri).
      └── 3. Kit Broadcasts API ile her dili kendi etiketli abonelerine postalar.
```
