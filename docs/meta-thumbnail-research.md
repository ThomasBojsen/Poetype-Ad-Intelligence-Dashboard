# Meta API Creative Thumbnails — Research Notes

Sidst opdateret: 2026-05-01

Dokumentation af hvordan vi henter høj-kvalitets creative thumbnails fra Meta Marketing API til Ad Index. Skrevet ned så vi ikke skal grave det frem igen.

---

## TL;DR

- **`creative.thumbnail_url`** er ALTID lav opløsning (typisk hard-capped til 64×64 via en URL-parameter). Field expansion `.width().height()` IGNORERES for dette felt.
- **Statiske billed-ads** virker via `creative.image_url` → fuld opløsning ✓
- **Video-ads og DPA-ads** har INTET pålideligt felt der returnerer høj opløsning gennem Marketing API. Apify klarer det ved at scrape Ad Library hvor `og:image`-tag'et er server-side renderet højere op.
- **Workaround**: Modificer Metas CDN-URL ved at ændre `stp`-parameteren — det er en transform-token (ikke del af signaturen), så `p64x64` → `p1080x1080` virker.

---

## Meta CDN URL-format

Eksempel-URL fra Marketing API's `creative.thumbnail_url`:

```
https://scontent-iad6-1.xx.fbcdn.net/v/t15.5256-10/670569843_1689600265728617_578272881035683285_n.jpg
  ?_nc_cat=109
  &ccb=1-7
  &_nc_ohc=w0duaNxArvIQ7kNvwF2No_f
  &_nc_oc=AdoqbELt94hepIVezv0g5-viurM6fU7LEuKOMi1hQYN_EuwzgBItYZF-MsLooYKBSZM
  &_nc_zt=23
  &_nc_ht=scontent-iad6-1.xx
  &edm=AOgd6ZUEAAAA
  &_nc_gid=kUJX4dJGC7oezl6NC82_tg
  &_nc_tpa=Q5bMBQFmt23xftUTxQlfiJhG6ZOF_illT9Pe9smIRxsmrj3o_GvuyhQ8vPiDNqOLACgMsK3fICeXrw5AHQ
  &stp=c0.5000x0.5000f_dst-emg0_p64x64_q75_tt6   ← LAVT
  &ur=b696e2
  &_nc_sid=58080a
  &oh=00_Af5sbmq4lH4UvMPj0w3hxQSTSubFrCQr2Q1j-KSc6UjPuw
  &oe=69FA4018
```

### Parameter-betydning

| Parameter | Betydning |
|-----------|-----------|
| `t15.5256-10` (path) | CDN-namespace for ad creative summaries — ofte 64×64 |
| `t39.35426-6` (path) | Video thumbnails — kan requestes ved højere størrelser |
| `t45.1600-4` (path) | Statiske ad creatives i fuld størrelse |
| `t39.2147-6` (path) | Page videos / story videos |
| `stp=` | **Size Transform Parameter** — beskriver hvordan billedet skal serveres |
| `_nc_ohc`, `_nc_oc`, `_nc_tpa` | Tokens (sandsynligvis access-relaterede) |
| `oh=` | **Outbound hash** (signatur) — beregnet over URL-path + `oe` |
| `oe=` | **Outbound expiration** — Unix timestamp i hex |

### `stp`-parameter syntax

`stp=c{cx}x{cy}f_dst-{format}_p{w}x{h}_q{quality}_tt6`

- `c0.5000x0.5000f` — crop fra 50%×50% midten
- `dst-emg0` / `dst-jpg` — destination format
- `p64x64` — pixel dimensioner 64×64 (ELLER `s600x600` for "scale")
- `q75` — JPEG kvalitet 75
- `tt6` — transform type

**Apify (skarp):** `stp=dst-jpg_s600x600_tt6` → 600×600 JPG, ingen crop
**Marketing API (blurry):** `stp=c0.5000x0.5000f_dst-emg0_p64x64_q75_tt6` → cropped til 64×64

---

## Hvilke Marketing API-felter giver hvilken kvalitet?

### Statiske billed-ads (Hansen&Nissen-typen) ✅

| Felt | Resultat |
|------|----------|
| `creative.image_url` | **Fuld opløsning** (1080+) — virker |
| `creative.thumbnail_url` | 64×64 — blurry |
| `creative.image_hash` → `/act_X/adimages` | Fuld opløsning (URL til original upload) |

→ For statiske billed-ads: brug `image_url` (eller adimages-lookup)

### Video-ads (UGC Vimpel-typen) ❌

| Felt | Resultat |
|------|----------|
| `creative.thumbnail_url` (med `width(600)` expansion) | 64×64 — expansion ignoreres |
| `creative.image_url` | Tom for video-ads |
| `/v21.0/{video_id}?fields=picture` | Ofte lav-res frame for UGC-videoer |
| `/v21.0/{video_id}?fields=thumbnails` | Array af pre-genererede sizes — ofte alle små |
| `/v21.0/{video_id}?fields=custom_thumbnails` | Kun sat hvis brand uploadede custom thumbnail manuelt |
| `creative.object_story_spec.video_data.image_url` | Auto-genereret video-cover (typisk 1280×720) — IKKE altid sat |

→ For video-ads: ingen pålidelig API-vej til høj kvalitet. Brug URL-transform-trick (se nedenfor) eller scrape Ad Library.

### DPA / Katalog-ads (BottlesWithHistory DPA) ❌

| Felt | Resultat |
|------|----------|
| `creative.thumbnail_url` | Tom (dynamisk feed) |
| `creative.image_url` | Tom |
| `creative.effective_object_story_id` → `/{post_id}?fields=full_picture` | Lav-medium kvalitet |
| `attachments.media.image.src` | Hvis sat: høj kvalitet rendered media |

→ For DPA: brug post-attachments hvis tilgængeligt; ellers placeholder

### Ad Library API (offentlig) ❌

`GET /ads_archive?...` returnerer kun `ad_snapshot_url` (en URL til render-side), ikke direkte billede. Det er kun til research-formål for politiske/udvalgte ads — ikke til ejede ads.

---

## Apify's snydegreb: scrape Ad Library

Apify's "Facebook Ad Library Scraper" actor tager `https://www.facebook.com/ads/library/?id={ad_id}` og parser `og:image`-meta-tag. Meta server-side optimerer `og:image` til høj kvalitet (typisk 600×600 i namespace `t39.35426-6`) for sociale shares.

**Fordel:** virker for ALLE ads (også video og DPA)
**Ulempe:** Det er scraping — kan brydes hvis Meta ændrer side-struktur. Også: kræver vi har ad_id'et offentligt tilgængeligt i Ad Library (kun aktive eller nyligt politiske ads vises).

---

## URL-Transform Trick (anbefalet workaround)

`stp`-parameteren er en CDN-transform-token og er IKKE del af signaturen (`oh`). Det betyder vi kan modificere den efter at have modtaget URL'en fra Meta.

```typescript
function upgradeFbCdnUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('fbcdn.net')) return url;
    const stp = u.searchParams.get('stp');
    if (!stp) return url;
    const upgraded = stp
      .replace(/(?<![a-z])p\d+x\d+/g, 'p1080x1080')   // pixel: 64x64 → 1080x1080
      .replace(/(?<![a-z])s\d+x\d+/g, 's1080x1080');  // scale: 600x600 → 1080x1080
    if (upgraded === stp) return url;
    u.searchParams.set('stp', upgraded);
    return u.toString();
  } catch {
    return url;
  }
}
```

**Risiko:** Hvis Meta's CDN HAR signaturen over `stp`, fejler URL'en og billedet loader ikke. Mitigation: frontend bruger upgraded URL med `<img onerror>` fallback til original URL.

---

## Hvad vi har implementeret

I `api/sync-meta-insights.ts`, prioriteret rækkefølge:

1. `/act_X/adimages?hashes=[...]` for `creative.image_hash` → original upload
2. Video `custom_thumbnails` → brand-uploadet HD
3. Video `thumbnails` (largest, eller `is_preferred=true`) → pre-genererede sizes
4. Video `picture` → auto-genereret frame
5. Post `attachments.media.image.src` → rendered media
6. Post `full_picture` → fallback
7. `creative.image_url` → statisk creative
8. `object_story_spec.video_data.image_url` → video cover spec
9. `object_story_spec.link_data.picture` → link preview
10. `creative.thumbnail_url` → sidste mulighed

Alle batches kører parallelt (Promise.all) per account, så fetch-tiden er konstant uanset ad-antal.

**Endnu ikke implementeret (TODO):**
- URL-transform-trick (se ovenfor) — frontend `upgradeFbCdnUrl` på alle thumbnails
- Ad Library scrape som sidste fallback for video-ads uden HD-thumbnail
- Custom thumbnail upload-flow til ads der mangler creative

---

## Permissions & Tokens

`META_TOKEN` skal have følgende scopes:
- `ads_read` — for at læse insights og ad-creatives
- `ads_management` — IKKE påkrævet for read-only sync
- `business_management` — IKKE påkrævet hvis token er knyttet til ad-account

Token-typen i brug: long-lived system user token. Renew årligt.

`META_AD_ACCOUNTS` env-var: comma-separeret liste af ad-account-IDs med `act_`-prefix:
```
META_AD_ACCOUNTS=act_160601090255453,act_291563024,act_4535200689936481,...
```

---

## Test-snippets (for fremtidige debug-sessions)

### Tjek hvilke felter Meta returnerer for et specifikt ad

```bash
AD_ID="120247790787500285"
curl "https://graph.facebook.com/v21.0/${AD_ID}?fields=id,name,creative{thumbnail_url,image_url,image_hash,video_id,effective_object_story_id,object_story_spec}&access_token=${META_TOKEN}" | jq
```

### Tjek video-thumbnails for et video-id

```bash
VIDEO_ID="..."
curl "https://graph.facebook.com/v21.0/${VIDEO_ID}?fields=picture,thumbnails,custom_thumbnails,format&access_token=${META_TOKEN}" | jq
```

### Hent original-upload URL for image_hash

```bash
ACT_ID="act_160601090255453"
HASH="abc123..."
curl "https://graph.facebook.com/v21.0/${ACT_ID}/adimages?hashes=%5B%22${HASH}%22%5D&fields=hash,url,permalink_url,width,height&access_token=${META_TOKEN}" | jq
```

### SQL: tjek hvilke URL-typer der ender i DB

```sql
SELECT
  CASE
    WHEN thumbnail_url LIKE '%t15.5256-10%' THEN 'creative-summary (low-res)'
    WHEN thumbnail_url LIKE '%t39.35426-6%' THEN 'video-thumbnail (HD)'
    WHEN thumbnail_url LIKE '%t45.1600-4%' THEN 'creative-fullsize'
    WHEN thumbnail_url LIKE '%external%' THEN 'external-proxy'
    ELSE 'other'
  END AS namespace,
  COUNT(*) AS n
FROM performance_insights
WHERE thumbnail_url IS NOT NULL
GROUP BY namespace
ORDER BY n DESC;
```

---

## Referencer

- [Meta AdCreative reference](https://developers.facebook.com/docs/marketing-api/reference/ad-creative/)
- [Meta AdImage reference](https://developers.facebook.com/docs/marketing-api/reference/ad-image/)
- [Meta Video Thumbnail reference](https://developers.facebook.com/docs/graph-api/reference/video-thumbnail/)
- [Meta Ad Library API](https://www.facebook.com/ads/library/api)
- [Apify Facebook Ad Library Scraper (reference for og:image scraping)](https://apify.com/curious_coder/facebook-ads-library-scraper)
