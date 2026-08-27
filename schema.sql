-- Arsenal Home Ticket Tracker — Supabase schema
-- Run this once in your Supabase project's SQL editor (Project → SQL Editor → New query → Run).

create table if not exists people (
  id bigint generated always as identity primary key,
  name text not null unique,
  is_regular boolean not null default true,
  sort_order int not null default 0
);

insert into people (name, is_regular, sort_order) values
  ('Tarik', true, 1),
  ('Barry', true, 2),
  ('Oliver', true, 3),
  ('Josh', false, 4)
on conflict (name) do nothing;

create table if not exists matches (
  id bigint generated always as identity primary key,
  opponent text not null,
  competition text not null default 'Premier League',
  kickoff timestamptz not null,
  notes text default '',
  season text default '2026/27',
  fixture_key text, -- stable id like 'pl-2627-chelsea', used by the weekly fixture sync
  created_at timestamptz not null default now()
);

-- Safe to re-run against an already-created table from an earlier version of this schema.
alter table matches add column if not exists season text default '2026/27';
alter table matches add column if not exists fixture_key text;
create unique index if not exists matches_fixture_key_key on matches (fixture_key);

create table if not exists ticket_status (
  id bigint generated always as identity primary key,
  match_id bigint not null references matches(id) on delete cascade,
  person_id bigint not null references people(id) on delete cascade,
  requested boolean not null default false,
  requested_qty int not null default 1,
  used boolean not null default false,
  declined boolean not null default false, -- "can't make it" for this game
  updated_at timestamptz not null default now(),
  unique (match_id, person_id)
);

-- Safe to re-run against an already-created table from an earlier version of this schema.
alter table ticket_status add column if not exists declined boolean not null default false;

-- Row Level Security: this is a small trusted-friend-group app with no login,
-- so we open read/write to anyone who has the anon key (which ships in the app).
-- Do not reuse this schema/policy set for anything containing sensitive data.
alter table people enable row level security;
alter table matches enable row level security;
alter table ticket_status enable row level security;

drop policy if exists "public read people" on people;
create policy "public read people" on people for select using (true);

drop policy if exists "public read matches" on matches;
create policy "public read matches" on matches for select using (true);
drop policy if exists "public write matches" on matches;
create policy "public write matches" on matches for insert with check (true);
drop policy if exists "public update matches" on matches;
create policy "public update matches" on matches for update using (true);
drop policy if exists "public delete matches" on matches;
create policy "public delete matches" on matches for delete using (true);

drop policy if exists "public read tickets" on ticket_status;
create policy "public read tickets" on ticket_status for select using (true);
drop policy if exists "public write tickets" on ticket_status;
create policy "public write tickets" on ticket_status for insert with check (true);
drop policy if exists "public update tickets" on ticket_status;
create policy "public update tickets" on ticket_status for update using (true);
drop policy if exists "public delete tickets" on ticket_status;
create policy "public delete tickets" on ticket_status for delete using (true);

-- Enable realtime so everyone's screen updates live when someone requests/confirms a ticket.
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table ticket_status;

-- Seed: Arsenal's 19 confirmed Premier League home fixtures for 2026/27.
-- Sourced from arsenal.com's fixture-list article (date list) cross-checked
-- against Sports Illustrated's published schedule (which cites the same
-- official release) for opponents and kick-off times — the two agree on
-- every fixture below. Kick-off times not yet confirmed by broadcasters
-- default to the standard UK slot (Sat 15:00, midweek 20:00) and will be
-- corrected automatically by the weekly fixture sync as TV picks are
-- announced — see README.md.
-- Champions League and domestic cup home fixtures aren't fixed yet (UCL league
-- phase draw, FA/EFL Cup draws) — the weekly sync adds them as rounds are drawn.
insert into matches (opponent, competition, kickoff, season, fixture_key) values
  ('Coventry City',            'Premier League', '2026-08-21T20:00:00+01:00', '2026/27', 'pl-2627-coventry-city'),
  ('Chelsea',                  'Premier League', '2026-09-05T15:00:00+01:00', '2026/27', 'pl-2627-chelsea'),
  ('Leeds United',              'Premier League', '2026-10-10T15:00:00+01:00', '2026/27', 'pl-2627-leeds-united'),
  ('Everton',                  'Premier League', '2026-10-24T15:00:00+01:00', '2026/27', 'pl-2627-everton'),
  ('Hull City',                'Premier League', '2026-11-07T15:00:00+00:00', '2026/27', 'pl-2627-hull-city'),
  ('Manchester City',          'Premier League', '2026-11-28T15:00:00+00:00', '2026/27', 'pl-2627-manchester-city'),
  ('AFC Bournemouth',          'Premier League', '2026-12-12T15:00:00+00:00', '2026/27', 'pl-2627-bournemouth'),
  ('Manchester United',        'Premier League', '2026-12-19T15:00:00+00:00', '2026/27', 'pl-2627-manchester-united'),
  ('Ipswich Town',             'Premier League', '2027-01-02T15:00:00+00:00', '2026/27', 'pl-2627-ipswich-town'),
  ('Brentford',                'Premier League', '2027-01-06T20:00:00+00:00', '2026/27', 'pl-2627-brentford'),
  ('Newcastle United',         'Premier League', '2027-01-23T15:00:00+00:00', '2026/27', 'pl-2627-newcastle-united'),
  ('Liverpool',                'Premier League', '2027-02-06T15:00:00+00:00', '2026/27', 'pl-2627-liverpool'),
  ('Fulham',                   'Premier League', '2027-02-20T15:00:00+00:00', '2026/27', 'pl-2627-fulham'),
  ('Crystal Palace',           'Premier League', '2027-03-03T20:00:00+00:00', '2026/27', 'pl-2627-crystal-palace'),
  ('Sunderland',               'Premier League', '2027-03-20T15:00:00+00:00', '2026/27', 'pl-2627-sunderland'),
  ('Aston Villa',              'Premier League', '2027-04-17T15:00:00+01:00', '2026/27', 'pl-2627-aston-villa'),
  ('Tottenham Hotspur',        'Premier League', '2027-05-01T15:00:00+01:00', '2026/27', 'pl-2627-tottenham-hotspur'),
  ('Nottingham Forest',        'Premier League', '2027-05-15T15:00:00+01:00', '2026/27', 'pl-2627-nottingham-forest'),
  ('Brighton and Hove Albion', 'Premier League', '2027-05-30T16:00:00+01:00', '2026/27', 'pl-2627-brighton-and-hove-albion')
on conflict (fixture_key) do nothing;
