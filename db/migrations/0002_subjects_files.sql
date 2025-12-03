-- Additional tables for subjects and lesson files metadata

create table if not exists subjects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  color text default '#4f46e5',
  created_at timestamptz default now()
);

create table if not exists lesson_files (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  name text not null,
  path text not null,
  bucket text not null default 'attachments',
  mime text,
  size bigint,
  created_at timestamptz default now()
);

alter table subjects enable row level security;
alter table lesson_files enable row level security;

create policy "subjects per user" on subjects for all using (auth.uid() = user_id);
create policy "lesson_files per user" on lesson_files for all using (auth.uid() = user_id);
