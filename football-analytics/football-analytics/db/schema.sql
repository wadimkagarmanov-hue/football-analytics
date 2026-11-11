-- Схема базы данных (PostgreSQL 13+). Применение: npm run db:migrate

create table if not exists leagues (
  id          text primary key,            -- id у текущего футбольного провайдера
  name        text not null,
  country     text not null,
  season      text not null,
  updated_at  timestamptz not null default now()
);

create table if not exists teams (
  id          text primary key,
  league_id   text references leagues(id) on delete set null,
  name        text not null,
  short       text,
  country     text,
  coach       text,
  stadium     text,
  updated_at  timestamptz not null default now()
);

create table if not exists matches (
  id          text primary key,
  league_id   text references leagues(id) on delete cascade,
  round       int,
  kickoff     timestamptz not null,
  home_id     text not null references teams(id),
  away_id     text not null references teams(id),
  status      text not null check (status in ('scheduled','live','finished')),
  home_goals  int,
  away_goals  int,
  updated_at  timestamptz not null default now()
);
create index if not exists matches_kickoff_idx on matches (kickoff);
create index if not exists matches_home_idx    on matches (home_id, kickoff desc);
create index if not exists matches_away_idx    on matches (away_id, kickoff desc);

-- История коэффициентов: одна строка = одно зафиксированное изменение цены.
-- По ней строится график движения. match_id без FK: коэффициенты могут прийти раньше матча.
create table if not exists odds_snapshots (
  id          bigserial primary key,
  match_id    text not null,
  bookmaker   text not null,
  market      text not null check (market in ('1X2','TOTAL','BTTS','HANDICAP')),
  line        numeric(5,2),                -- линия тотала / форы (для форы — линия хозяев)
  selection   text not null,               -- 1,X,2 | Over,Under | Yes,No | Home,Away
  price       numeric(8,3) not null check (price > 1),
  captured_at timestamptz not null default now()
);
create index if not exists odds_snap_idx on odds_snapshots (match_id, bookmaker, market, selection, captured_at);

-- Общий кэш ответов провайдеров (разделяется веб-процессом и воркером)
create table if not exists api_cache (
  key         text primary key,
  value       jsonb not null,
  fetched_at  timestamptz not null default now()
);

-- Задел под аккаунты (в интерфейсе избранное пока хранится в localStorage)
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  created_at  timestamptz not null default now()
);

create table if not exists favorites (
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null check (kind in ('match','team')),
  ref_id      text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, kind, ref_id)
);
