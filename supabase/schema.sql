-- Schema for the Stair Internal Audit AI Dashboard (Supabase Postgres).
-- Applied automatically by `npm run setup`, or paste into the Supabase SQL editor.

create extension if not exists vector;

create table if not exists orgs (
  id integer generated always as identity primary key,
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id integer generated always as identity primary key,
  org_id integer references orgs(id),
  email text not null unique,
  name text not null,
  role text not null check (role in ('super_admin','client_admin','audit_team','cxo','viewer')),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id integer generated always as identity primary key,
  org_id integer not null references orgs(id),
  quarter text not null,
  fiscal_year text not null,
  title text not null,
  file_path text not null,
  summary text,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  error text,
  uploaded_by integer references users(id),
  created_at timestamptz not null default now(),
  unique (org_id, quarter, fiscal_year)
);

create table if not exists observations (
  id integer generated always as identity primary key,
  org_id integer not null references orgs(id),
  report_id integer not null references reports(id) on delete cascade,
  title text not null,
  description text,
  department text,
  risk text check (risk in ('High','Medium','Low')),
  recommendation text,
  management_response text,
  status text not null default 'Open' check (status in ('Open','In Progress','Closed')),
  owner text,
  due_date text,
  created_at timestamptz not null default now()
);

create table if not exists chunks (
  id integer generated always as identity primary key,
  org_id integer not null references orgs(id),
  report_id integer not null references reports(id) on delete cascade,
  observation_id integer references observations(id) on delete cascade,
  text text not null,
  embedding vector(768)
);

create index if not exists idx_obs_org on observations(org_id);
create index if not exists idx_chunks_org on chunks(org_id);
