create table note (id uuid primary key default uuidv7() check (uuid_extract_version(id) = 7), text text not null);
