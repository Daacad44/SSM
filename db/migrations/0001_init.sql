-- Schema for Semester & Study Manager
-- Run via Supabase SQL or migration runner

create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users (id),
  full_name text,
  university text,
  program text,
  timezone text default 'Africa/Mogadishu',
  clock_format smallint default 24,
  created_at timestamptz default now()
);

create table if not exists semesters (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  year smallint not null,
  start_date date not null,
  end_date date not null,
  status text check (status in ('current','past','upcoming')) default 'current',
  created_at timestamptz default now()
);

create table if not exists courses (
  id uuid primary key default uuid_generate_v4(),
  semester_id uuid references semesters(id) on delete cascade,
  code text,
  title text not null,
  lecturer text,
  credits numeric,
  color text default '#3b82f6',
  schedule jsonb,
  created_at timestamptz default now()
);

create table if not exists activities (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references courses(id) on delete cascade,
  type text check (type in ('assignment','quiz','exam','project','lab','reading','other')) not null,
  title text not null,
  description text,
  due_at timestamptz not null,
  priority smallint default 2,
  weight numeric default 0,
  status text check (status in ('todo','in_progress','done')) default 'todo',
  attachments jsonb,
  created_at timestamptz default now()
);

create table if not exists alarms (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  activity_id uuid references activities(id),
  label text,
  fire_at timestamptz not null,
  lead_minutes int default 0,
  ringtone text,
  channel text check (channel in ('browser','email','both')) default 'both',
  created_at timestamptz default now()
);

create table if not exists reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  week_start date,
  week_end date,
  storage_path text,
  created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
alter table semesters enable row level security;
alter table courses enable row level security;
alter table activities enable row level security;
alter table alarms enable row level security;
alter table reports enable row level security;

create policy "User can view their profile" on profiles for select using (auth.uid() = id);
create policy "User manages own profile" on profiles for all using (auth.uid() = id);

create policy "Semesters are per user" on semesters for all using (auth.uid() = user_id);
create policy "Courses are per user" on courses for all using (exists (select 1 from semesters s where s.id = semester_id and s.user_id = auth.uid()));
create policy "Activities per user" on activities for all using (exists (select 1 from courses c join semesters s on c.semester_id = s.id where c.id = course_id and s.user_id = auth.uid()));
create policy "Alarms per user" on alarms for all using (user_id = auth.uid());
create policy "Reports per user" on reports for all using (user_id = auth.uid());

-- Storage buckets
-- run via Supabase Storage SQL or dashboard
-- select storage.create_bucket('attachments', true);
-- select storage.create_bucket('ringtones', true);
-- select storage.create_bucket('reports', true);
