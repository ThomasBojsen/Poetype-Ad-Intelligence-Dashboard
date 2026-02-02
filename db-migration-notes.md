# Supabase schema changes for storing insights

## performance_insights table (Ad Index)

Used by `get-performance-insights` and `sync-meta-insights` to store Meta Ads performance data. The `roas` column is **computed in the sync job** as `purchase_value / spend` (when spend > 0); it is not read from the Meta API.

If you need to create this table:

```sql
create table if not exists performance_insights (
  ad_id text primary key,
  account_id text,
  name text,
  spend numeric not null default 0,
  impressions numeric not null default 0,
  clicks numeric not null default 0,
  cpm numeric not null default 0,
  cpc numeric not null default 0,
  ctr numeric not null default 0,
  purchases numeric not null default 0,
  purchase_value numeric not null default 0,
  roas numeric,
  currency text,
  date_preset text,
  fetched_at timestamptz
);
create index if not exists performance_insights_account_id_idx on performance_insights(account_id);
create index if not exists performance_insights_spend_idx on performance_insights(spend);
```

---

## ads table (Konkurrentanalyse)

Run these SQL statements in Supabase (SQL editor):

```sql
-- Ads table: add identifiers and insights fields
alter table ads add column if not exists ad_id text;
create index if not exists ads_ad_id_idx on ads(ad_id);

alter table ads add column if not exists spend numeric;
alter table ads add column if not exists impressions numeric;
alter table ads add column if not exists clicks numeric;
alter table ads add column if not exists cpm numeric;
alter table ads add column if not exists cpc numeric;
alter table ads add column if not exists ctr numeric;
alter table ads add column if not exists roas numeric;
alter table ads add column if not exists purchases numeric;
alter table ads add column if not exists purchase_value numeric;
alter table ads add column if not exists insights_currency text;
alter table ads add column if not exists insights_date_preset text;
alter table ads add column if not exists last_insights_at timestamptz;
```

Optional: add a table to map clients/users to ad accounts for future admin UI management.
```sql
create table if not exists client_accounts (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references clients(id),
  ad_account_id text not null,
  created_at timestamptz default now()
);
create index if not exists client_accounts_ad_account_id_idx on client_accounts(ad_account_id);
```
