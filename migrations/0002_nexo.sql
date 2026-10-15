-- Nexo operational schema. All rows belong to the signed-in user.

create table if not exists clients (
  id text primary key,
  user_id text not null,
  name text not null,
  company text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  segment text not null default '',
  document text not null default '',
  address text not null default '',
  status text not null default 'ativo',
  notes text not null default '',
  extra text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_user_idx on clients (user_id, status);

create table if not exists projects (
  id text primary key,
  user_id text not null,
  client_id text references clients (id) on delete set null,
  name text not null,
  description text not null default '',
  start_date date,
  due_date date,
  status text not null default 'planejamento',
  url text not null default '',
  repo text not null default '',
  database_used text not null default '',
  database_name text not null default '',
  server text not null default '',
  tech_config text not null default '',
  notes text not null default '',
  value_cents integer not null default 0,
  monthly_cents integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_idx on projects (user_id, client_id, status);

create table if not exists updates (
  id text primary key,
  user_id text not null,
  project_id text not null references projects (id) on delete cascade,
  version text not null,
  happened_on date not null,
  description text not null default '',
  bugfix text not null default '',
  feature text not null default '',
  status text not null default 'planejada',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists updates_user_idx on updates (user_id, project_id, happened_on desc);

create table if not exists contracts (
  id text primary key,
  user_id text not null,
  client_id text references clients (id) on delete set null,
  project_id text references projects (id) on delete set null,
  type text not null default '',
  start_date date,
  end_date date,
  value_cents integer not null default 0,
  monthly_cents integer not null default 0,
  conditions text not null default '',
  notes text not null default '',
  status text not null default 'rascunho',
  document_name text not null default '',
  document_data text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contracts_user_idx on contracts (user_id, status, end_date);

create table if not exists finances (
  id text primary key,
  user_id text not null,
  kind text not null,
  client_id text references clients (id) on delete set null,
  project_id text references projects (id) on delete set null,
  category text not null default '',
  description text not null default '',
  amount_cents integer not null,
  happened_on date not null,
  due_on date,
  paid_on date,
  payment_method text not null default '',
  status text not null default 'pendente',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finances_user_idx on finances (user_id, kind, status, happened_on);

create table if not exists tasks (
  id text primary key,
  user_id text not null,
  scope text not null default 'empresa',
  title text not null,
  description text not null default '',
  due_on date,
  due_time text not null default '',
  priority text not null default 'normal',
  category text not null default '',
  client_id text references clients (id) on delete set null,
  project_id text references projects (id) on delete set null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_idx on tasks (user_id, done, priority);

create table if not exists appointments (
  id text primary key,
  user_id text not null,
  title text not null,
  happens_on date not null,
  starts_at text not null default '',
  duration_min integer not null default 60,
  client_id text references clients (id) on delete set null,
  location text not null default '',
  notes text not null default '',
  status text not null default 'agendado',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_user_idx on appointments (user_id, happens_on);

create table if not exists activities (
  id text primary key,
  user_id text not null,
  client_id text,
  project_id text,
  kind text not null,
  summary text not null,
  created_at timestamptz not null default now()
);
create index if not exists activities_user_idx on activities (user_id, created_at desc);

create table if not exists assistant_messages (
  id text primary key,
  user_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists assistant_user_idx on assistant_messages (user_id, created_at);
