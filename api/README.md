# API Endpoints

This directory contains Vercel Serverless Functions for the Ad Intelligence Dashboard backend.

## Environment Variables Required

Set these in your Vercel project settings:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for server-side operations)
- `APIFY_TOKEN` - Your Apify API token
- `VERCEL_URL` - Automatically set by Vercel (or `NEXT_PUBLIC_VERCEL_URL`)
- `WEBHOOK_BASE_URL` - Optional: Custom base URL for webhooks (useful for local development with ngrok)
- **Ad Index (Meta insights):** `META_TOKEN` - Meta Marketing API long-lived token (with `ads_read`). `META_AD_ACCOUNTS` - **Comma-separated list of all ad account IDs** (e.g. `act_123,act_456,act_789`). You must list every brand/client account here; otherwise only the first account is synced.

## Endpoints

### POST `/api/add-brand`
Adds a new brand/competitor to the current session.

**Request Body:**
```json
{
  "sessionId": "string",
  "url": "string (Facebook Ad Library URL)"
}
```

**Response:**
```json
{
  "success": true,
  "brand": { ... }
}
```

### POST `/api/trigger-scrape`
Starts a scraping job for all active brands in the session.

**Request Body:**
```json
{
  "sessionId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "runId": "string",
  "message": "string",
  "brands": ["string"]
}
```

### POST `/api/save-ads`
Webhook endpoint called by Apify when scraping completes. Processes and saves ads to the database.

**Request Body (from Apify):**
```json
{
  "runId": "string",
  "defaultDatasetId": "string",
  "sessionId": "string"
}
```

### POST `/api/sync-meta-insights`
Fetches Meta Ads insights for configured ad accounts and upserts into `performance_insights`. Supports batching: pass `accountOffset` and `accountsPerBatch` (default 3) to process a slice of accounts per request (avoids timeouts). The frontend calls this in a loop until `hasMore` is false to sync all brands.

**Request Body:**
```json
{
  "accountOffset": 0,
  "accountsPerBatch": 3,
  "maxAdsPerAccount": 20,
  "datePreset": "last_7d"
}
```

**Response:** `{ success, synced, totalAccounts, accountOffset, hasMore, message?, errors? }`

### GET/POST `/api/get-ads`
Fetches ads for the dashboard, filtered by session.

**Query Params (GET) or Body (POST):**
```
sessionId: string
```

**Response:**
```json
{
  "success": true,
  "ads": [...],
  "count": number
}
```

## Database Schema

### `brands` table
- `id`: bigint (PK)
- `session_id`: text
- `name`: text
- `ad_library_url`: text
- `is_active`: boolean

### `ads` table
- `id`: text (PK, Facebook ad_archive_id)
- `page_name`: text
- `reach`: int
- `video_url`: text
- `thumbnail_url`: text
- `heading`: text
- `ad_copy`: text
- `ad_library_url`: text
- `first_seen`: timestamptz
- `last_seen`: timestamptz

