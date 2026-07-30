-- =============================================================================
-- Migration: Create push_subscriptions Table for Browser Web Push
-- Generated: 2026-07-31
-- =============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint   text        NOT NULL UNIQUE,
  keys       jsonb       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index endpoint for fast lookups and deletion
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone (anon & authenticated) to insert a new subscription
CREATE POLICY "Allow public push subscription insert"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow service role to select and delete (Edge Functions)
CREATE POLICY "Allow service role full access"
  ON push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
