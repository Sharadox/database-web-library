--
-- PostgreSQL database dump, as pg_dump 18 writes it with --inserts
--

\restrict abc123

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_table_access_method = heap;

CREATE TABLE "public"."note" (
    "id" "uuid" DEFAULT "uuidv7"() NOT NULL,
    "text" "text" NOT NULL,
    CONSTRAINT "note_id_check" CHECK (("uuid_extract_version"("id") = 7))
);

CREATE TABLE "public"."tag" (
    "id" "uuid" NOT NULL,
    "note_id" "uuid" NOT NULL
);

INSERT INTO "public"."note" VALUES ('0198f5a2-7a4c-7000-8000-000000000001', 'first');
INSERT INTO "public"."note" VALUES ('0198f5a2-7a4c-7000-8000-000000000002', 'it''s second');
INSERT INTO "public"."tag" VALUES ('0198f5a2-7a4c-7000-8000-000000000003', '0198f5a2-7a4c-7000-8000-000000000001');

ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."tag"
    ADD CONSTRAINT "tag_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."note"("id") ON UPDATE CASCADE ON DELETE CASCADE;

\unrestrict abc123
