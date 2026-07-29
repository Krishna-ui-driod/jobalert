-- =============================================================================
-- JobAlert — Seed Data
-- Run AFTER the migration has been applied.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CATEGORIES  (5 major exam categories for India)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO categories (id, name, slug, icon) VALUES
  ('11111111-0000-0000-0000-000000000001', 'SSC',       'ssc',       'briefcase'),
  ('11111111-0000-0000-0000-000000000002', 'Railway',   'railway',   'train'),
  ('11111111-0000-0000-0000-000000000003', 'Banking',   'banking',   'landmark'),
  ('11111111-0000-0000-0000-000000000004', 'State PSC', 'state-psc', 'building-2'),
  ('11111111-0000-0000-0000-000000000005', 'Defence',   'defence',   'shield')
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. STATES & UNION TERRITORIES  (28 States + 8 UTs = 36 total)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO states (name, code) VALUES
  -- ── 28 States ─────────────────────────────────────────────────────────────
  ('Andhra Pradesh',        'AP'),
  ('Arunachal Pradesh',     'AR'),
  ('Assam',                 'AS'),
  ('Bihar',                 'BR'),
  ('Chhattisgarh',          'CG'),
  ('Goa',                   'GA'),
  ('Gujarat',               'GJ'),
  ('Haryana',               'HR'),
  ('Himachal Pradesh',      'HP'),
  ('Jharkhand',             'JH'),
  ('Karnataka',             'KA'),
  ('Kerala',                'KL'),
  ('Madhya Pradesh',        'MP'),
  ('Maharashtra',           'MH'),
  ('Manipur',               'MN'),
  ('Meghalaya',             'ML'),
  ('Mizoram',               'MZ'),
  ('Nagaland',              'NL'),
  ('Odisha',                'OD'),
  ('Punjab',                'PB'),
  ('Rajasthan',             'RJ'),
  ('Sikkim',                'SK'),
  ('Tamil Nadu',            'TN'),
  ('Telangana',             'TS'),
  ('Tripura',               'TR'),
  ('Uttar Pradesh',         'UP'),
  ('Uttarakhand',           'UK'),
  ('West Bengal',           'WB'),
  -- ── 8 Union Territories ───────────────────────────────────────────────────
  ('Andaman and Nicobar Islands',              'AN'),
  ('Chandigarh',                               'CH'),
  ('Dadra & Nagar Haveli and Daman & Diu',     'DD'),
  ('Delhi',                                    'DL'),
  ('Jammu & Kashmir',                          'JK'),
  ('Ladakh',                                   'LA'),
  ('Lakshadweep',                              'LD'),
  ('Puducherry',                               'PY')
ON CONFLICT (code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SAMPLE EXAMS  (one per category for demo / dev)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO exams (
  id, title, slug, category_id, department,
  description, qualification, age_limit,
  application_start, application_end, exam_date,
  status, official_link
) VALUES
  (
    '22222222-0000-0000-0000-000000000001',
    'SSC CGL 2026',
    'ssc-cgl-2026',
    '11111111-0000-0000-0000-000000000001',
    'Staff Selection Commission',
    'Combined Graduate Level Examination 2026 for recruitment to Group B and Group C posts in various ministries and departments of the Government of India.',
    'Bachelor''s Degree from a recognised university',
    '18–32 years (relaxation as per govt. norms)',
    '2026-05-01', '2026-06-15', '2026-09-10',
    'active',
    'https://ssc.gov.in'
  ),
  (
    '22222222-0000-0000-0000-000000000002',
    'RRB NTPC 2026',
    'rrb-ntpc-2026',
    '11111111-0000-0000-0000-000000000002',
    'Railway Recruitment Board',
    'Non-Technical Popular Categories recruitment for various posts including Junior Clerk, Accounts Clerk, Junior Time Keeper, Trains Clerk, and Station Master.',
    '12th Pass / Graduation (depending on post)',
    '18–33 years',
    '2026-06-01', '2026-07-31', NULL,
    'upcoming',
    'https://www.rrbcdg.gov.in'
  ),
  (
    '22222222-0000-0000-0000-000000000003',
    'IBPS PO 2026',
    'ibps-po-2026',
    '11111111-0000-0000-0000-000000000003',
    'Institute of Banking Personnel Selection',
    'Probationary Officer / Management Trainee recruitment across 11 participating public sector banks in India.',
    'Graduate in any discipline from a recognised university',
    '20–30 years',
    '2026-07-01', '2026-07-21', '2026-10-05',
    'active',
    'https://www.ibps.in'
  ),
  (
    '22222222-0000-0000-0000-000000000004',
    'UPPSC PCS 2026',
    'uppsc-pcs-2026',
    '11111111-0000-0000-0000-000000000004',
    'Uttar Pradesh Public Service Commission',
    'Provincial Civil Services examination for recruitment to various State Civil Services posts in Uttar Pradesh including Deputy Collector, DSP, and BDO.',
    'Graduate from a recognised university',
    '21–40 years (relaxation as per UP govt. norms)',
    '2026-04-15', '2026-05-30', '2026-10-18',
    'closed',
    'https://uppsc.up.nic.in'
  ),
  (
    '22222222-0000-0000-0000-000000000005',
    'Indian Army Agniveer 2026',
    'army-agniveer-2026',
    '11111111-0000-0000-0000-000000000005',
    'Indian Army',
    'Agnipath scheme recruitment for short-term military service in the Indian Army as Agniveer across General Duty, Technical, Clerk, and Tradesman categories.',
    '10th / 12th Pass (varies by category)',
    '17.5–23 years',
    '2026-08-01', '2026-09-15', NULL,
    'upcoming',
    'https://joinindianarmy.nic.in'
  )
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SAMPLE NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO notifications (exam_id, type, title, pdf_url, published_at) VALUES
  (
    '22222222-0000-0000-0000-000000000001',
    'new_job',
    'SSC CGL 2026 Official Notification Released',
    NULL,
    '2026-05-01 10:00:00+05:30'
  ),
  (
    '22222222-0000-0000-0000-000000000003',
    'admit_card',
    'IBPS PO 2026 Prelims Admit Card Available for Download',
    NULL,
    '2026-09-25 09:00:00+05:30'
  ),
  (
    '22222222-0000-0000-0000-000000000004',
    'result',
    'UPPSC PCS 2026 Prelims Result Declared — Download Scorecard',
    NULL,
    '2026-07-10 14:00:00+05:30'
  );
-- =============================================================================
