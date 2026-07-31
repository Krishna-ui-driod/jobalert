-- =============================================================================
-- Migration: Add details (jsonb) column to exams table
-- Generated: 2026-07-31
-- =============================================================================

ALTER TABLE exams ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}'::jsonb;
