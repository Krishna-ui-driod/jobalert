import { useState, useEffect } from "react";
import logoUrl from "/logo.svg";
import {
  Bell,
  Briefcase,
  Search,
  ChevronRight,
  FileText,
  ClipboardList,
  CheckSquare,
  BookOpen,
  MapPin,
  Calendar,
  ExternalLink,
  Twitter,
  Youtube,
  Instagram,
  Send,
  AlertCircle,
  TrendingUp,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JobTag {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface ExamRow {
  id: string;
  title: string;
  slug: string;
  department: string | null;
  qualification: string | null;
  application_start: string | null;
  application_end: string | null;
  exam_date: string | null;
  status: "upcoming" | "active" | "closed" | "result_declared";
  official_link: string | null;
  vacancy_count: number | null;
  is_all_india: boolean;
  created_at: string;
  categories: { id: string; name: string; slug: string } | null;
  exam_job_tags: { job_tags: JobTag | null }[];
}

interface DbCategory {
  id: string;
  name: string;
  slug: string;
}

interface NotificationRow {
  type: string;
  title: string;
}

type JobStatus = "active" | "closing-soon" | "closed";

interface CatCount {
  label: string;
  count: number;
}

// ── Static nav ────────────────────────────────────────────────────────────────
const NAV_LINKS = ["Home", "Latest Jobs", "Results", "Admit Card", "Syllabus", "Answer Key"];

// ── Category visual config (icons/colors — NOT counts, those come from DB) ────
const CAT_VISUAL = [
  { key: "new-jobs",    label: "New Jobs",    icon: Briefcase,    color: "#1A3C6E", bg: "#EEF2F8" },
  { key: "result",      label: "Results",     icon: CheckSquare,  color: "#1F9D55", bg: "#E8F7EF" },
  { key: "admit_card",  label: "Admit Card",  icon: FileText,     color: "#FF7A00", bg: "#FFF3E8" },
  { key: "answer_key",  label: "Answer Key",  icon: ClipboardList,color: "#7C3AED", bg: "#F3EEFF" },
];

const SEC_CAT_VISUAL = [
  { label: "Syllabus",        key: "syllabus",         icon: BookOpen,    color: "#0EA5E9" },
  { label: "Cut Off",         key: "cut_off",          icon: AlertCircle, color: "#F59E0B" },
  { label: "Previous Papers", key: "previous_papers",  icon: FileText,    color: "#8B5CF6" },
  { label: "Exam Calendar",   key: "exam_calendar",    icon: Calendar,    color: "#10B981" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcJobStatus(exam: ExamRow): JobStatus {
  const { status, application_end } = exam;
  if (status === "closed" || status === "result_declared") return "closed";
  if (!application_end) return "active";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(application_end);
  const daysLeft = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "closed";
  if (daysLeft <= 7) return "closing-soon";
  return "active";
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTicker(n: NotificationRow): string {
  const icons: Record<string, string> = {
    new_job: "🔔",
    result: "✅",
    admit_card: "📄",
    answer_key: "📋",
    syllabus: "📚",
  };
  return `${icons[n.type] ?? "🔔"} ${n.title}`;
}

function fmtStat(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K+`;
  return `${n}+`;
}

// ── StatusTag ─────────────────────────────────────────────────────────────────

function StatusTag({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { label: string; className: string }> = {
    active: {
      label: "Active",
      className: "bg-[#E8F7EF] text-[#1F9D55] border border-[#1F9D55]/20",
    },
    "closing-soon": {
      label: "Closing Soon",
      className: "bg-[#FEE9E9] text-[#E03E3E] border border-[#E03E3E]/20",
    },
    closed: {
      label: "Closed",
      className: "bg-[#EAECF0] text-[#6B7280] border border-[#D1D5DB]",
    },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

// ── Skeleton helpers ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-5 py-4">
        <div className="h-4 bg-gray-200 rounded w-48 mb-1" />
        <div className="h-3 bg-gray-100 rounded w-32" />
      </td>
      <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
      <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
      <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
      <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
      <td className="px-4 py-4"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
      <td className="px-4 py-4"><div className="h-7 bg-gray-200 rounded-lg w-20" /></td>
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <div className="w-12 h-12 rounded-xl bg-gray-200 mb-4" />
      <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
      <div className="h-3 bg-gray-100 rounded w-16" />
    </div>
  );
}

// ── Ticker ────────────────────────────────────────────────────────────────────

function Ticker({ items }: { items: string[] }) {
  const displayItems = items.length > 0 ? items : ["Loading live updates…"];
  return (
    <div className="bg-[#1A3C6E] text-white py-2.5 overflow-hidden relative">
      <div className="flex items-center">
        <div className="flex-shrink-0 flex items-center gap-2 bg-[#FF7A00] px-4 py-1 z-10 relative">
          <TrendingUp size={14} />
          <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">Live Updates</span>
        </div>
        <div className="overflow-hidden flex-1 ml-2">
          <div
            className="flex gap-12 whitespace-nowrap"
            style={{
              animation: `marquee ${Math.max(30, displayItems.length * 5)}s linear infinite`,
              willChange: "transform",
            }}
          >
            {[...displayItems, ...displayItems].map((item, i) => (
              <span key={i} className="text-sm text-white/90 inline-flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                {item}
                <span className="text-white/30">|</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="bg-[#1A3C6E] sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="bg-white rounded-xl px-2 py-1 group-hover:scale-105 transition-transform shadow-sm">
              <img src={logoUrl} alt="JobAlert logo" className="h-10 w-auto" />
            </div>
            <div className="leading-tight">
              <span className="text-white font-bold text-xl tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Job<span className="text-[#FF7A00]">Alert</span>
              </span>
              <p className="text-white/50 text-[9px] uppercase tracking-widest hidden sm:block">Govt Jobs &amp; Exams India</p>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a key={link} href="#" className="text-white/80 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap">
                {link}
              </a>
            ))}
          </nav>

          {/* Search + Bell */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`hidden md:flex items-center bg-white/10 border border-white/20 rounded-lg overflow-hidden transition-all ${searchOpen ? "w-52" : "w-40"} focus-within:border-[#FF7A00]/60 focus-within:bg-white/15`}>
              <Search size={14} className="ml-3 text-white/50 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search exams..."
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setSearchOpen(false)}
                className="bg-transparent text-white placeholder-white/40 text-sm px-2 py-2 outline-none w-full"
              />
            </div>
            <button className="flex items-center gap-1.5 bg-[#FF7A00] hover:bg-[#E86E00] text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors shadow-md whitespace-nowrap">
              <Bell size={14} />
              <span className="hidden sm:inline">Notify Me</span>
            </button>
            <button className="lg:hidden text-white/80 hover:text-white p-1.5" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {menuOpen && (
        <div className="lg:hidden bg-[#122C52] border-t border-white/10 px-4 pb-4">
          <div className="flex items-center bg-white/10 border border-white/20 rounded-lg mt-3 mb-2">
            <Search size={14} className="ml-3 text-white/50" />
            <input type="text" placeholder="Search exams, results..." className="bg-transparent text-white placeholder-white/40 text-sm px-2 py-2.5 outline-none w-full" />
          </div>
          {NAV_LINKS.map((link) => (
            <a key={link} href="#" className="flex items-center text-white/80 hover:text-white py-2.5 border-b border-white/10 text-sm font-medium gap-2">
              <ChevronRight size={14} className="text-[#FF7A00]" /> {link}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

interface HeroProps {
  stats: { activeJobs: number; vacanciesListed: number; dailyVisitors: number; examsTracked: number };
  categories: DbCategory[];
  onFilter: (cat: string) => void;
  activeFilter: string;
}

function Hero({ stats, categories, onFilter, activeFilter }: HeroProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const chips = ["All", ...categories.map((c) => c.name)];

  const statDisplay = [
    { label: "Active Jobs",      value: stats.activeJobs > 0      ? fmtStat(stats.activeJobs)      : "—" },
    { label: "Vacancies Listed", value: stats.vacanciesListed > 0 ? fmtStat(stats.vacanciesListed) : "—" },
    { label: "Daily Visitors",   value: stats.dailyVisitors > 0   ? fmtStat(stats.dailyVisitors)   : "—" },
    { label: "Exams Tracked",    value: stats.examsTracked > 0    ? fmtStat(stats.examsTracked)    : "—" },
  ];

  return (
    <section className="bg-gradient-to-br from-[#1A3C6E] via-[#1E4780] to-[#0F2448] pt-12 pb-16 px-4 relative overflow-hidden">
      {/* Decorative grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Accent blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF7A00]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

      <div className="max-w-4xl mx-auto relative text-center">
        <div className="inline-flex items-center gap-2 bg-[#FF7A00]/15 border border-[#FF7A00]/30 text-[#FFB066] text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
          <Bell size={12} />
          India&apos;s Most Trusted Govt Job Portal
        </div>

        <h1 className="text-white font-extrabold text-3xl sm:text-4xl md:text-5xl leading-tight mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Never Miss a{" "}
          <span className="text-[#FF7A00] relative">
            Government Job
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FF7A00]/40 rounded" />
          </span>{" "}
          Update
        </h1>

        <p className="text-white/60 text-base sm:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
          Real-time alerts for SSC, Railway, Banking, State PSC &amp; Defence exams. Results, Admit Cards, Syllabus — all in one place.
        </p>

        {/* Main Search */}
        <div className="bg-white rounded-xl shadow-2xl p-2 flex flex-col sm:flex-row gap-2 mb-6 max-w-2xl mx-auto">
          <div className="flex items-center flex-1 px-3 gap-2">
            <Search size={16} className="text-[#1A3C6E]/40 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by exam name, state, qualification..."
              className="outline-none text-[#0F1C30] placeholder-gray-400 text-sm w-full bg-transparent"
            />
          </div>
          <div className="flex items-center gap-2 px-3 border-t sm:border-t-0 sm:border-l border-gray-100 pt-2 sm:pt-0">
            <MapPin size={14} className="text-[#1A3C6E]/40" />
            <select className="outline-none text-sm text-[#0F1C30] bg-transparent pr-2">
              <option>All States</option>
              <option>Uttar Pradesh</option>
              <option>Rajasthan</option>
              <option>Bihar</option>
              <option>Maharashtra</option>
            </select>
          </div>
          <button className="bg-[#FF7A00] hover:bg-[#E86E00] text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap shadow-md">
            Search Jobs
          </button>
        </div>

        {/* Filter Chips — from DB categories */}
        <div className="flex flex-wrap justify-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => onFilter(chip)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                activeFilter === chip
                  ? "bg-[#FF7A00] border-[#FF7A00] text-white shadow-md"
                  : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:text-white"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Stats row — live from DB */}
        <div className="flex flex-wrap justify-center gap-6 mt-10 pt-8 border-t border-white/10">
          {statDisplay.map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-[#FF7A00] font-extrabold text-xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {value}
              </div>
              <div className="text-white/50 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Category Cards ────────────────────────────────────────────────────────────

interface CategoryCardsProps {
  counts: Record<string, number>;
  loading: boolean;
}

function CategoryCards({ counts, loading }: CategoryCardsProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[#0F1C30] font-bold text-xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Browse by Category
          </h2>
          <p className="text-[#5B6880] text-sm mt-0.5">Find the latest government notifications</p>
        </div>
        <a href="#" className="text-[#1A3C6E] text-sm font-semibold hover:text-[#FF7A00] transition-colors flex items-center gap-1">
          View All <ChevronRight size={14} />
        </a>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CAT_VISUAL.map(({ key, label, icon: Icon, color, bg }) => (
            <a
              key={key}
              href="#"
              className="group bg-white rounded-xl p-5 border border-[#1A3C6E]/8 shadow-sm hover:shadow-lg hover:border-[#FF7A00]/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ backgroundColor: bg }}>
                <Icon size={22} style={{ color }} />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[#0F1C30] font-bold text-base" style={{ fontFamily: "'Poppins', sans-serif" }}>{label}</p>
                  <p className="text-[#5B6880] text-xs mt-0.5">Updated today</p>
                </div>
                <span className="text-white text-xs font-bold px-2 py-0.5 rounded-full mt-0.5" style={{ backgroundColor: color }}>
                  {counts[key] ?? 0}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold group-hover:text-[#FF7A00] text-[#1A3C6E] transition-colors">
                View All <ChevronRight size={12} />
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Secondary category row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {SEC_CAT_VISUAL.map(({ label, key, icon: Icon, color }) => (
          <a
            key={key}
            href="#"
            className="group bg-white rounded-lg px-4 py-3 border border-[#1A3C6E]/8 shadow-sm hover:border-[#FF7A00]/30 hover:shadow-md transition-all flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "18" }}>
              <Icon size={17} style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[#0F1C30] font-semibold text-sm truncate">{label}</p>
              <p className="text-[#5B6880] text-xs">{loading ? "—" : (counts[key] ?? 0)} items</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ── Job Listings ──────────────────────────────────────────────────────────────

interface JobListingsProps {
  exams: ExamRow[];
  loading: boolean;
  error: string | null;
  activeTab: string;
  setActiveTab: (t: string) => void;
  categories: DbCategory[];
  allJobTags: JobTag[];
  activeJobFilter: string;
  setActiveJobFilter: (t: string) => void;
}

function JobListings({ exams, loading, error, activeTab, setActiveTab, categories, allJobTags, activeJobFilter, setActiveJobFilter }: JobListingsProps) {
  const [visibleCount, setVisibleCount] = useState(6);
  const chips = ["All", ...categories.map((c) => c.name)];
  const jobChips = ["All", ...allJobTags.map((t) => t.slug)];

  const filtered = exams.filter((e) => {
    const catMatch = activeTab === "All" || e.categories?.name === activeTab;
    const tagMatch = activeJobFilter === "All" ||
      e.exam_job_tags.some((ejt) => ejt.job_tags?.slug === activeJobFilter);
    return catMatch && tagMatch;
  });
  const visible = filtered.slice(0, visibleCount);

  return (
    <section className="max-w-7xl mx-auto px-4 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[#0F1C30] font-bold text-xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Latest Job Notifications
          </h2>
          <p className="text-[#5B6880] text-sm mt-0.5">
            Showing <span className="text-[#1A3C6E] font-semibold">{filtered.length}</span> active listings
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => { setActiveTab(chip); setVisibleCount(6); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeTab === chip
                  ? "bg-[#1A3C6E] border-[#1A3C6E] text-white"
                  : "bg-white border-[#1A3C6E]/15 text-[#5B6880] hover:border-[#1A3C6E]/40 hover:text-[#1A3C6E]"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Job type filter chips */}
      {allJobTags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          <span className="text-[#5B6880] text-xs font-semibold self-center mr-1">Job Type:</span>
          {jobChips.map((slug) => {
            const tag = allJobTags.find(t => t.slug === slug);
            const isAll = slug === "All";
            const active = activeJobFilter === slug;
            return (
              <button
                key={slug}
                onClick={() => { setActiveJobFilter(slug); setVisibleCount(6); }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={active
                  ? { backgroundColor: tag?.color ?? '#1A3C6E', borderColor: tag?.color ?? '#1A3C6E', color: 'white' }
                  : { backgroundColor: 'white', borderColor: (tag?.color ?? '#1A3C6E') + '30', color: tag?.color ?? '#5B6880' }
                }
              >
                {isAll ? "All Types" : (tag?.name ?? slug)}
              </button>
            );
          })}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-5 py-4 rounded-xl mb-4 flex items-center gap-3">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>Could not load exam data: {error}. Please refresh the page.</span>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border border-[#1A3C6E]/10 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#EEF2F8] border-b border-[#1A3C6E]/10">
              <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-5 py-3.5">Exam / Organization</th>
              <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-4 py-3.5">Posts</th>
              <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-4 py-3.5">Posted</th>
              <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-4 py-3.5">Last Date</th>
              <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-4 py-3.5">Qualification</th>
              <th className="text-left text-xs font-bold text-[#1A3C6E] uppercase tracking-wider px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A3C6E]/6">
            {loading
              ? [1, 2, 3, 4, 5, 6].map((i) => <SkeletonRow key={i} />)
              : visible.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-[#5B6880] text-sm">
                    No listings found for this category. Add exams via the admin panel.
                  </td>
                </tr>
              )
              : visible.map((exam, i) => {
                const jobStatus = calcJobStatus(exam);
                return (
                  <tr key={exam.id} className={`group hover:bg-[#FFF7F0] transition-colors ${i % 2 === 0 ? "" : "bg-[#FAFBFD]"}`}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#0F1C30] text-sm group-hover:text-[#1A3C6E] transition-colors">
                        {exam.title}
                      </p>
                      <p className="text-[#5B6880] text-xs mt-0.5">{exam.department ?? "—"}</p>
                      {/* Job type tag pills */}
                      {exam.exam_job_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {exam.is_all_india && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                              🇮🇳 All India
                            </span>
                          )}
                          {exam.exam_job_tags.map((ejt) =>
                            ejt.job_tags ? (
                              <span
                                key={ejt.job_tags.id}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{ backgroundColor: ejt.job_tags.color + '18', color: ejt.job_tags.color }}
                              >
                                ● {ejt.job_tags.name}
                              </span>
                            ) : null
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[#0F1C30] font-bold text-sm">
                        {exam.vacancy_count ? exam.vacancy_count.toLocaleString("en-IN") : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[#5B6880] text-sm">{fmtDate(exam.created_at)}</td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-semibold ${jobStatus === "closing-soon" ? "text-[#E03E3E]" : "text-[#5B6880]"}`}>
                        {fmtDate(exam.application_end)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[#5B6880] text-sm">{exam.qualification ?? "—"}</td>
                    <td className="px-4 py-4"><StatusTag status={jobStatus} /></td>
                    <td className="px-4 py-4">
                      {exam.official_link && jobStatus !== "closed" ? (
                        <a
                          href={exam.official_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all bg-[#FF7A00] hover:bg-[#E86E00] text-white shadow-sm hover:shadow-md"
                        >
                          Apply Now <ExternalLink size={10} />
                        </a>
                      ) : (
                        <button
                          disabled
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#EAECF0] text-[#9CA3AF] cursor-not-allowed"
                        >
                          Closed
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
        {!loading && filtered.length > visibleCount && (
          <div className="px-5 py-4 border-t border-[#1A3C6E]/8 bg-[#FAFBFD] flex justify-center">
            <button
              onClick={() => setVisibleCount((c) => c + 4)}
              className="text-[#1A3C6E] hover:text-[#FF7A00] text-sm font-semibold transition-colors flex items-center gap-1.5"
            >
              Load More <ChevronRight size={14} className="rotate-90" />
            </button>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading
          ? [1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-[#1A3C6E]/10 shadow-sm p-4 h-40" />
          ))
          : visible.length === 0
          ? (
            <div className="bg-white rounded-xl border border-[#1A3C6E]/10 shadow-sm p-8 text-center text-[#5B6880] text-sm">
              No listings for this category yet.
            </div>
          )
          : visible.map((exam) => {
            const jobStatus = calcJobStatus(exam);
            return (
              <div key={exam.id} className="bg-white rounded-xl border border-[#1A3C6E]/10 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[#0F1C30] text-sm">{exam.title}</p>
                    <p className="text-[#5B6880] text-xs mt-0.5">{exam.department ?? "—"}</p>
                    {/* Tag pills */}
                    {(exam.is_all_india || exam.exam_job_tags.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {exam.is_all_india && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                            🇮🇳 All India
                          </span>
                        )}
                        {exam.exam_job_tags.map((ejt) =>
                          ejt.job_tags ? (
                            <span
                              key={ejt.job_tags.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: ejt.job_tags.color + '18', color: ejt.job_tags.color }}
                            >
                              ● {ejt.job_tags.name}
                            </span>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                  <StatusTag status={jobStatus} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-xs">
                  <div>
                    <span className="text-[#5B6880]">Posts: </span>
                    <span className="font-bold text-[#0F1C30]">{exam.vacancy_count ? exam.vacancy_count.toLocaleString("en-IN") : "—"}</span>
                  </div>
                  <div>
                    <span className="text-[#5B6880]">Category: </span>
                    <span className="font-semibold text-[#1A3C6E]">{exam.categories?.name ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-[#5B6880]">Last Date: </span>
                    <span className={`font-semibold ${jobStatus === "closing-soon" ? "text-[#E03E3E]" : "text-[#0F1C30]"}`}>
                      {fmtDate(exam.application_end)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#5B6880]">Qual: </span>
                    <span className="font-semibold text-[#0F1C30]">{exam.qualification ?? "—"}</span>
                  </div>
                </div>
                {exam.official_link && jobStatus !== "closed" ? (
                  <a
                    href={exam.official_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-lg transition-all bg-[#FF7A00] hover:bg-[#E86E00] text-white shadow-sm"
                  >
                    <ExternalLink size={14} /> Apply Now
                  </a>
                ) : (
                  <button disabled className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-lg bg-[#EAECF0] text-[#9CA3AF] cursor-not-allowed">
                    Application Closed
                  </button>
                )}
              </div>
            );
          })
        }
        {!loading && filtered.length > visibleCount && (
          <button
            onClick={() => setVisibleCount((c) => c + 4)}
            className="w-full py-3 text-[#1A3C6E] font-semibold text-sm border border-[#1A3C6E]/20 rounded-xl bg-white hover:border-[#FF7A00]/40 hover:text-[#FF7A00] transition-all"
          >
            Load More Jobs
          </button>
        )}
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  const [email, setEmail] = useState("");

  return (
    <footer className="bg-[#0F1C30] text-white">
      {/* Newsletter */}
      <div className="bg-[#1A3C6E] py-10 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-bold text-lg" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Get instant job alerts in your inbox
            </h3>
            <p className="text-white/60 text-sm mt-1">Subscribe to daily digest — no spam, only relevant jobs.</p>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 sm:w-56 bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#FF7A00]/60 transition-colors"
            />
            <button className="bg-[#FF7A00] hover:bg-[#E86E00] text-white font-bold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <Send size={14} /> Subscribe
            </button>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2.5 mb-4">
            <img
              src={logoUrl}
              alt="JobAlert logo"
              className="h-9 w-auto"
              style={{ filter: "brightness(0) invert(1) drop-shadow(0 0 4px rgba(255,122,0,0.5))" }}
            />
            <span className="font-bold text-lg" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Job<span className="text-[#FF7A00]">Alert</span>
            </span>
          </div>
          <p className="text-white/50 text-sm leading-relaxed mb-4">
            Real-time government job &amp; exam notification platform for Indian job seekers.
          </p>
          <div className="flex gap-3">
            {[Twitter, Youtube, Instagram].map((Icon, i) => (
              <a key={i} href="#" className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#FF7A00] flex items-center justify-center transition-colors">
                <Icon size={14} />
              </a>
            ))}
          </div>
        </div>

        {[
          { title: "Quick Links", links: ["Latest Jobs", "Results", "Admit Card", "Syllabus", "Answer Key", "Cut Off"] },
          { title: "Categories",  links: ["SSC Jobs", "Railway Jobs", "Banking Jobs", "Defence Jobs", "State PSC", "Teaching Jobs"] },
          { title: "Resources",   links: ["About Us", "Contact", "Privacy Policy", "Terms of Use", "Sitemap", "Advertise With Us"] },
        ].map(({ title, links }) => (
          <div key={title}>
            <h4 className="font-bold text-sm uppercase tracking-wider text-white/80 mb-4">{title}</h4>
            <ul className="space-y-2.5">
              {links.map((link) => (
                <li key={link}>
                  <a href="#" className="text-white/50 hover:text-[#FF7A00] text-sm transition-colors flex items-center gap-1.5 group">
                    <ChevronRight size={12} className="text-white/20 group-hover:text-[#FF7A00] flex-shrink-0" />
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Disclaimer + Copyright */}
      <div className="border-t border-white/8 px-4 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 mb-4 flex gap-3">
            <AlertCircle size={16} className="text-[#FF7A00] flex-shrink-0 mt-0.5" />
            <p className="text-white/40 text-xs leading-relaxed">
              <span className="text-[#FF7A00] font-semibold">Disclaimer:</span> JobAlert.in is not an official government website. We aggregate publicly available recruitment notifications for informational purposes only. Always verify information from official sources before applying.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-white/30 text-xs">
            <p>© 2025 JobAlert. All rights reserved. Made with ❤️ for Indian job seekers.</p>
            <p>Last updated: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── App — root data fetcher ───────────────────────────────────────────────────

export default function App() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [allJobTags, setAllJobTags] = useState<JobTag[]>([]);
  const [tickerItems, setTickerItems] = useState<string[]>([]);
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ activeJobs: 0, vacanciesListed: 0, dailyVisitors: 0, examsTracked: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeJobFilter, setActiveJobFilter] = useState("All");

  useEffect(() => {
    async function loadAll() {
      try {
        const today = new Date().toISOString().split("T")[0];

        // Parallel fetches — exams query tries with job tags first, falls back without
        let examsData: any[] = [];
        let jobTagsData: any[] = [];
        let catsData: any[] = [];

        // Try the full query with exam_job_tags join
        const examsFullRes = await supabase
          .from("exams")
          .select("id,title,slug,department,qualification,application_start,application_end,exam_date,status,official_link,vacancy_count,is_all_india,created_at,categories(id,name,slug),exam_job_tags(job_tags(id,name,slug,color))")
          .order("created_at", { ascending: false })
          .limit(100);

        if (examsFullRes.error) {
          // Fallback: table might not exist yet — query without the join
          console.warn("[JobAlert] exam_job_tags join failed, falling back:", examsFullRes.error.message);
          const examsBasicRes = await supabase
            .from("exams")
            .select("id,title,slug,department,qualification,application_start,application_end,exam_date,status,official_link,vacancy_count,is_all_india,created_at,categories(id,name,slug)")
            .order("created_at", { ascending: false })
            .limit(100);
          if (examsBasicRes.error) throw examsBasicRes.error;
          examsData = examsBasicRes.data ?? [];
        } else {
          examsData = examsFullRes.data ?? [];
        }

        // Fetch categories (always needed)
        const catsRes = await supabase.from("categories").select("id,name,slug").order("name");
        if (catsRes.error) throw catsRes.error;
        catsData = catsRes.data ?? [];

        // Fetch job tags (may not exist yet — non-fatal)
        const jobTagsRes = await supabase.from("job_tags").select("id,name,slug,color").order("name");
        if (!jobTagsRes.error) {
          jobTagsData = jobTagsRes.data ?? [];
        }

        // Remaining parallel count queries (these are all safe — they use existing tables)
        const [
          notifsRes,
          activeCountRes,
          examsTotalRes,
          resultCountRes,
          admitCountRes,
          answerCountRes,
          syllabusCountRes,
          examCalRes,
        ] = await Promise.all([
          supabase.from("notifications").select("type,title").order("published_at", { ascending: false }).limit(20),
          supabase.from("exams").select("*", { count: "exact", head: true }).in("status", ["active", "upcoming"]),
          supabase.from("exams").select("*", { count: "exact", head: true }),
          supabase.from("notifications").select("*", { count: "exact", head: true }).eq("type", "result"),
          supabase.from("notifications").select("*", { count: "exact", head: true }).eq("type", "admit_card"),
          supabase.from("notifications").select("*", { count: "exact", head: true }).eq("type", "answer_key"),
          supabase.from("notifications").select("*", { count: "exact", head: true }).eq("type", "syllabus"),
          supabase.from("exams").select("*", { count: "exact", head: true }).gte("exam_date", today),
        ]);

        // Normalize exam_job_tags — guarantee the field is always an array
        const normalizedExams = examsData.map((e: any) => ({
          ...e,
          exam_job_tags: e.exam_job_tags ?? [],
          is_all_india: e.is_all_india ?? false,
        })) as ExamRow[];

        setExams(normalizedExams);
        setCategories(catsData);
        setAllJobTags(jobTagsData);
        setTickerItems((notifsRes.data ?? []).map(fmtTicker));

        // Vacancy sum
        const vacancySum = ((examsRes.data ?? []) as ExamRow[]).reduce(
          (acc, e) => acc + (e.vacancy_count ?? 0), 0
        );

        // Page views — increment then read today's count
        await supabase.from("page_views").insert({});
        const pvRes = await supabase.from("page_views").select("*", { count: "exact", head: true }).gte("viewed_at", `${today}T00:00:00`);

        setStats({
          activeJobs: activeCountRes.count ?? 0,
          vacanciesListed: vacancySum,
          dailyVisitors: pvRes.count ?? 0,
          examsTracked: examsTotalRes.count ?? 0,
        });

        setCatCounts({
          "new-jobs":     activeCountRes.count ?? 0,
          result:         resultCountRes.count ?? 0,
          admit_card:     admitCountRes.count ?? 0,
          answer_key:     answerCountRes.count ?? 0,
          syllabus:       syllabusCountRes.count ?? 0,
          exam_calendar:  examCalRes.count ?? 0,
          cut_off:        0,
          previous_papers: 0,
        });
      } catch (err: any) {
        console.error("[JobAlert] Data fetch failed:", err);
        setError(err.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadAll();

    // Auto-refresh ticker every 5 minutes
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("notifications")
        .select("type,title")
        .order("published_at", { ascending: false })
        .limit(20);
      if (data) setTickerItems(data.map(fmtTicker));
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F5F7]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Header />
      <Ticker items={tickerItems} />
      <Hero
        stats={stats}
        categories={categories}
        onFilter={setActiveFilter}
        activeFilter={activeFilter}
      />
      <CategoryCards counts={catCounts} loading={loading} />
      <JobListings
        exams={exams}
        loading={loading}
        error={error}
        activeTab={activeFilter}
        setActiveTab={setActiveFilter}
        categories={categories}
        allJobTags={allJobTags}
        activeJobFilter={activeJobFilter}
        setActiveJobFilter={setActiveJobFilter}
      />
      <Footer />
    </div>
  );
}
