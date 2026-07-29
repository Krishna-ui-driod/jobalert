# JobAlert Monorepo Project Structure

This document provides a comprehensive overview of the directory hierarchy, architectural patterns, and file organization for the **JobAlert** project.

---

## 📁 Monorepo Overview

```text
figma/
├── public/                      # Static branding assets & icons
│   ├── Asset 1.svg              # Source vector logo
│   ├── favicon.ico
│   └── logo.svg                 # White-bordered brand logo for header & footer
├── src/                         # Public Frontend Application (React + Vite)
│   ├── app/
│   │   ├── App.tsx              # Main JobAlert public portal (Search, Filters, Exams, Admit Cards, Results)
│   │   └── components/
│   │       ├── figma/           # Custom layout components (ImageWithFallback.tsx)
│   │       └── ui/              # 48+ Radix UI / Shadcn design system primitives
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client setup for Vite frontend
│   │   └── utils.ts             # Styling & class merger utilities (clsx, tailwind-merge)
│   ├── styles/                  # Global CSS variables, themes, & utility imports
│   └── main.tsx                 # React DOM root entry point
├── admin/                       # Admin Dashboard Application (Next.js 14 App Router)
│   ├── app/
│   │   ├── admin/               # Protected Admin Portal Routes
│   │   │   ├── dashboard/       # Key metrics, statistics, & recent activity
│   │   │   ├── exams/           # CRUD management interface for exams & jobs
│   │   │   ├── notifications/   # Admit card, answer key, & result notifications
│   │   │   ├── settings/        # System settings & admin profile
│   │   │   ├── subscribers/     # Alert subscriber management
│   │   │   ├── layout.tsx       # Main admin portal shell with persistent Sidebar
│   │   │   └── page.tsx         # Dashboard landing redirect
│   │   ├── login/               # Secure admin login authentication page
│   │   ├── globals.css          # Next.js / Tailwind CSS stylesheet
│   │   └── layout.tsx           # Admin app HTML root layout
│   ├── components/
│   │   ├── exams/               # Exam management components (ExamTable, ExamForm)
│   │   ├── notifications/       # Notification management components
│   │   ├── ui/                  # Shared Admin UI primitives (Badge, Modal, Button, Card)
│   │   ├── AddContentModal.tsx  # Unified modal for content creation
│   │   └── Sidebar.tsx          # Responsive navigation sidebar
│   ├── lib/
│   │   ├── supabase.ts          # Supabase SSR client helper (@supabase/ssr)
│   │   ├── types.ts             # TypeScript definitions for database models
│   │   └── utils.ts             # Tailwind class merging utility
│   └── middleware.ts            # Route guard enforcing authentication & admin roles
├── supabase/                    # Backend Database & Migrations
│   ├── migrations/
│   │   └── 20260728000000_init_schema.sql  # SQL schema, RLS policies, & admin security functions
│   └── seed.sql                 # Initial database seeds (5 Categories, 36 Indian States/UTs)
├── guidelines/
│   └── Guidelines.md            # Coding standards & design system guidelines
├── package.json                 # Root Vite workspace package configuration
├── vite.config.ts               # Vite configuration & path alias resolvers (@ -> ./src)
├── pnpm-workspace.yaml          # Monorepo workspace configuration
├── project_summary.md           # Project implementation log & feature progress
└── PROJECT_STRUCTURE.md         # This structural reference document
```

---

## 🏛️ Architecture & Component Breakdown

### 1. Public Portal (`/src`)
- **Technology Stack**: React 18, Vite 6, Tailwind CSS v4, Lucide Icons, Radix UI.
- **Key Features**:
  - Government job & exam listing catalog.
  - Multi-faceted filtering (by Category, State, Eligibility, and Search term).
  - Quick action tabs: All Exams, Admit Cards, Results, Answer Keys, Latest Alerts.
  - Supabase integration for fetching real-time active exam notifications.

### 2. Admin Dashboard (`/admin`)
- **Technology Stack**: Next.js 14 (App Router), TypeScript, `@supabase/ssr`, Tailwind CSS.
- **Key Features**:
  - Middleware route protection (`middleware.ts`) enforcing `is_admin()` server-side verification.
  - Complete CRUD functionality for Exam postings, Official PDF attachment uploads to Supabase Storage, and state assignment.
  - Analytics overview dashboard displaying active exams, closing deadlines, and subscriber numbers.

### 3. Database Layer (`/supabase`)
- **Database Engine**: PostgreSQL on Supabase.
- **Core Entities**:
  - `exams`: Stores job title, organization, qualification, total vacancies, application start/end dates, fee, and official PDF links.
  - `categories`: Exam groupings (Banking, UPSC, SSC, Railways, Defense, State PSCs).
  - `states`: Indian States & UTs for geographic filtering.
  - `exam_states`: Junction table handling many-to-many state applicability for exams.
  - `notifications`: Timely updates (Admit Cards, Results, Answer Keys, Syllabi).
  - `admins`: Security table mapping Supabase auth users to admin roles (`admin` / `super_admin`).
  - `subscriptions`: User notification alert preferences.

---

## 🚀 Environment & Setup

- **Root Environment (`.env`)**: Contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the public site.
- **Admin Environment (`admin/.env.local`)**: Contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
