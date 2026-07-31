-- =============================================================================
-- Migration: Expand Categories and Job Type Tags for JobAlert
-- Generated: 2026-07-31
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ADD NEW CATEGORIES (10 Sector Expansion)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO categories (id, name, slug, icon) VALUES
  ('21111111-0000-0000-0000-000000000001', 'Teaching',                          'teaching',            'graduation-cap'),
  ('21111111-0000-0000-0000-000000000002', 'Police & Paramilitary',             'police-paramilitary', 'shield-alert'),
  ('21111111-0000-0000-0000-000000000003', 'PSU (Public Sector Undertakings)',  'psu',                 'factory'),
  ('21111111-0000-0000-0000-000000000004', 'Post Office / India Post',           'post-office',         'mail'),
  ('21111111-0000-0000-0000-000000000005', 'UPSC / Central Services',           'upsc',                'crown'),
  ('21111111-0000-0000-0000-000000000006', 'Insurance',                         'insurance',           'heart-handshake'),
  ('21111111-0000-0000-0000-000000000007', 'Healthcare / Medical',              'healthcare',          'activity'),
  ('21111111-0000-0000-0000-000000000008', 'Judiciary',                         'judiciary',           'scale'),
  ('21111111-0000-0000-0000-000000000009', 'Municipal / Local Bodies',         'municipal',           'building'),
  ('21111111-0000-0000-0000-000000000010', 'Agriculture & Cooperative',        'agriculture',         'sprout')
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ADD NEW JOB TYPE TAGS (10 Specific Role Badges)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO job_tags (id, name, slug, color) VALUES
  ('31111111-0000-0000-0000-000000000001', 'Constable',             'constable',             '#2563EB'),
  ('31111111-0000-0000-0000-000000000002', 'Postal Assistant',      'postal-assistant',      '#D97706'),
  ('31111111-0000-0000-0000-000000000003', 'Staff Nurse',           'staff-nurse',           '#059669'),
  ('31111111-0000-0000-0000-000000000004', 'Junior Engineer (JE)',  'junior-engineer',      '#4F46E5'),
  ('31111111-0000-0000-0000-000000000005', 'Civil Judge / Judicial', 'civil-judge',          '#9333EA'),
  ('31111111-0000-0000-0000-000000000006', 'Scientist',             'scientist',             '#0284C7'),
  ('31111111-0000-0000-0000-000000000007', 'Probationary Officer',  'probationary-officer',  '#EA580C'),
  ('31111111-0000-0000-0000-000000000008', 'Specialist Officer',    'specialist-officer',    '#D946EF'),
  ('31111111-0000-0000-0000-000000000009', 'Gramin Dak Sevak (GDS)', 'gramin-dak-sevak',     '#CA8A04'),
  ('31111111-0000-0000-0000-000000000010', 'Anganwadi Worker',      'anganwadi-worker',      '#E11D48')
ON CONFLICT (slug) DO NOTHING;
