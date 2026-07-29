-- =============================================================================
-- JobAlert — Initial Schema Migration
-- Generated: 2026-07-28
-- Run via:  supabase db push
--        OR paste into Supabase Dashboard > SQL Editor
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- future full-text/fuzzy search


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENUM TYPES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE exam_status AS ENUM (
  'upcoming',
  'active',
  'closed',
  'result_declared'
);

CREATE TYPE notification_type AS ENUM (
  'new_job',
  'result',
  'admit_card',
  'answer_key',
  'syllabus'
);

CREATE TYPE admin_role AS ENUM (
  'editor',
  'super_admin'
);

CREATE TYPE alert_type AS ENUM (
  'email',
  'push'
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLES
-- (ordered so FK dependencies are satisfied)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.1  categories
CREATE TABLE categories (
  id    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name  text NOT NULL,
  slug  text NOT NULL,
  icon  text,
  CONSTRAINT categories_slug_unique UNIQUE (slug)
);

-- 2.2  states
CREATE TABLE states (
  id    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name  text NOT NULL,
  code  text NOT NULL,
  CONSTRAINT states_code_unique UNIQUE (code)
);

-- 2.3  exams
CREATE TABLE exams (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             text        NOT NULL,
  slug              text        NOT NULL,
  category_id       uuid        REFERENCES categories(id) ON DELETE SET NULL,
  department        text,
  description       text,
  qualification     text,
  age_limit         text,
  application_start date,
  application_end   date,
  exam_date         date,            -- nullable: date not announced yet
  status            exam_status NOT NULL DEFAULT 'upcoming',
  official_link     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exams_slug_unique UNIQUE (slug)
);

-- 2.4  exam_states  (junction: many-to-many exams ↔ states)
CREATE TABLE exam_states (
  exam_id  uuid NOT NULL REFERENCES exams(id)  ON DELETE CASCADE,
  state_id uuid NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  PRIMARY KEY (exam_id, state_id)
);

-- 2.5  notifications
CREATE TABLE notifications (
  id           uuid              PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id      uuid              REFERENCES exams(id) ON DELETE CASCADE,
  type         notification_type NOT NULL,
  title        text              NOT NULL,
  pdf_url      text,             -- Supabase Storage path or signed URL
  published_at timestamptz       NOT NULL DEFAULT now()
);

-- 2.6  admins
CREATE TABLE admins (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       admin_role  NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.7  subscriptions
CREATE TABLE subscriptions (
  id          uuid       PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid       REFERENCES categories(id) ON DELETE CASCADE,
  exam_id     uuid       REFERENCES exams(id)      ON DELETE CASCADE,
  alert_type  alert_type NOT NULL DEFAULT 'email',
  -- constraint: at least one target must be set
  CONSTRAINT subscriptions_target_check CHECK (
    category_id IS NOT NULL OR exam_id IS NOT NULL
  )
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- exams
CREATE INDEX idx_exams_slug            ON exams(slug);
CREATE INDEX idx_exams_status          ON exams(status);
CREATE INDEX idx_exams_category_id     ON exams(category_id);
CREATE INDEX idx_exams_application_end ON exams(application_end);
CREATE INDEX idx_exams_created_at      ON exams(created_at DESC);

-- categories
CREATE INDEX idx_categories_slug       ON categories(slug);

-- notifications
CREATE INDEX idx_notifications_exam_id      ON notifications(exam_id);
CREATE INDEX idx_notifications_published_at ON notifications(published_at DESC);
CREATE INDEX idx_notifications_type         ON notifications(type);

-- exam_states
CREATE INDEX idx_exam_states_state_id  ON exam_states(state_id);

-- subscriptions
CREATE INDEX idx_subscriptions_user_id     ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_category_id ON subscriptions(category_id);
CREATE INDEX idx_subscriptions_exam_id     ON subscriptions(exam_id);

-- GIN trigram index for fuzzy title search
CREATE INDEX idx_exams_title_trgm ON exams USING gin(title gin_trgm_ops);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.1  Generic updated_at stamper
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Wire it to exams
CREATE TRIGGER trg_exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at();

-- 4.2  is_admin(uid uuid) → boolean
--      SECURITY DEFINER so it can query admins table bypassing RLS.
--      Used in all write policies for protected tables.
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   admins
    WHERE  user_id = uid
  );
$$;

-- 4.3  is_super_admin(uid uuid) → boolean
--      Gates mutations on the admins table itself.
CREATE OR REPLACE FUNCTION is_super_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   admins
    WHERE  user_id = uid
      AND  role    = 'super_admin'
  );
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE states        ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_states   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ── 5.1  categories ───────────────────────────────────────────────────────────
CREATE POLICY "categories: public read"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "categories: admin insert"
  ON categories FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "categories: admin update"
  ON categories FOR UPDATE
  USING     (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "categories: admin delete"
  ON categories FOR DELETE
  USING (is_admin(auth.uid()));

-- ── 5.2  states ───────────────────────────────────────────────────────────────
CREATE POLICY "states: public read"
  ON states FOR SELECT
  USING (true);

CREATE POLICY "states: admin insert"
  ON states FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "states: admin update"
  ON states FOR UPDATE
  USING     (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "states: admin delete"
  ON states FOR DELETE
  USING (is_admin(auth.uid()));

-- ── 5.3  exams ────────────────────────────────────────────────────────────────
CREATE POLICY "exams: public read"
  ON exams FOR SELECT
  USING (true);

CREATE POLICY "exams: admin insert"
  ON exams FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "exams: admin update"
  ON exams FOR UPDATE
  USING     (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "exams: admin delete"
  ON exams FOR DELETE
  USING (is_admin(auth.uid()));

-- ── 5.4  exam_states ──────────────────────────────────────────────────────────
CREATE POLICY "exam_states: public read"
  ON exam_states FOR SELECT
  USING (true);

CREATE POLICY "exam_states: admin insert"
  ON exam_states FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "exam_states: admin delete"
  ON exam_states FOR DELETE
  USING (is_admin(auth.uid()));

-- ── 5.5  notifications ────────────────────────────────────────────────────────
CREATE POLICY "notifications: public read"
  ON notifications FOR SELECT
  USING (true);

CREATE POLICY "notifications: admin insert"
  ON notifications FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "notifications: admin update"
  ON notifications FOR UPDATE
  USING     (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "notifications: admin delete"
  ON notifications FOR DELETE
  USING (is_admin(auth.uid()));

-- ── 5.6  admins ───────────────────────────────────────────────────────────────
-- Any admin can see the admins table; only super_admins can modify it.
CREATE POLICY "admins: admin read"
  ON admins FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "admins: super_admin insert"
  ON admins FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "admins: super_admin update"
  ON admins FOR UPDATE
  USING     (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "admins: super_admin delete"
  ON admins FOR DELETE
  USING (is_super_admin(auth.uid()));

-- ── 5.7  subscriptions ────────────────────────────────────────────────────────
-- Users manage only their own rows.
CREATE POLICY "subscriptions: user select own"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "subscriptions: user insert own"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions: user delete own"
  ON subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all subscriptions for dashboard metrics.
CREATE POLICY "subscriptions: admin read all"
  ON subscriptions FOR SELECT
  USING (is_admin(auth.uid()));


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. STORAGE BUCKET  (run separately or via Supabase CLI)
-- ─────────────────────────────────────────────────────────────────────────────
-- Create a public bucket named 'pdfs' in Dashboard → Storage, then:
--
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('pdfs', 'pdfs', true)
--   ON CONFLICT (id) DO NOTHING;
--
--   CREATE POLICY "pdfs: public read"
--     ON storage.objects FOR SELECT
--     USING (bucket_id = 'pdfs');
--
--   CREATE POLICY "pdfs: admin upload"
--     ON storage.objects FOR INSERT
--     WITH CHECK (bucket_id = 'pdfs' AND is_admin(auth.uid()));
--
--   CREATE POLICY "pdfs: admin delete"
--     ON storage.objects FOR DELETE
--     USING (bucket_id = 'pdfs' AND is_admin(auth.uid()));
-- =============================================================================
