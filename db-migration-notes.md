# Supabase schema changes for storing insights

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
