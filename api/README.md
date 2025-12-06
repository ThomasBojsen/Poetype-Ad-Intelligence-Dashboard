# API Endpoints

This directory contains Vercel Serverless Functions for the Ad Intelligence Dashboard backend.

## Environment Variables Required

Set these in your Vercel project settings:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for server-side operations)
- `APIFY_TOKEN` - Your Apify API token
- `VERCEL_URL` - Automatically set by Vercel (or `NEXT_PUBLIC_VERCEL_URL`)
- `WEBHOOK_BASE_URL` - Optional: Custom base URL for webhooks (useful for local development with ngrok)

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

