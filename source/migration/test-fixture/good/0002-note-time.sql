alter table note add column created_at timestamptz not null default now();
comment on table note is 'Notes; with a semicolon';
