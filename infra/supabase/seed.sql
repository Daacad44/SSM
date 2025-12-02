insert into profiles (id, full_name, university, program, timezone)
values
  ('00000000-0000-0000-0000-000000000000', 'Demo Student', 'Sample University', 'Computer Science', 'Africa/Mogadishu')
on conflict (id) do nothing;

insert into semesters (id, user_id, title, year, start_date, end_date, status)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'Fall', extract(year from now())::smallint, current_date, current_date + interval '90 days', 'current')
on conflict (id) do nothing;

insert into courses (id, semester_id, code, title, lecturer, credits, color)
values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'CS101', 'Intro to CS', 'Dr. Ahmed', 3, '#6366f1')
on conflict (id) do nothing;

insert into activities (id, course_id, type, title, due_at, priority, status)
values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'assignment', 'Week 1 Lab', now() + interval '5 days', 2, 'todo')
on conflict (id) do nothing;

insert into alarms (id, user_id, activity_id, label, fire_at, lead_minutes, channel)
values
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'Reminder: Week 1 Lab', now() + interval '4 days', 60, 'both')
on conflict (id) do nothing;
