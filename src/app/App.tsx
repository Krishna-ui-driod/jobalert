import { useState, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "sonner";
import logoUrl from "/logo.svg";
import {
  Bell,
  Briefcase,
  Search,
  ChevronRight,
  ChevronDown,
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
  AlertCircle,
  TrendingUp,
  Menu,
  X,
  ArrowLeft,
  GraduationCap,
  Building2,
  Clock,
  Tag,
  Download,
} from "lucide-react";
import { supabase } from "../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JobTag {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface DbState {
  id: string;
  name: string;
  code: string;
}

interface ExamRow {
  id: string;
  title: string;
  slug: string;
  department: string | null;
  qualification: string | null;
  age_limit: string | null;
  description: string | null;
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
  exam_states?: { states: { id: string; name: string; code: string } | null }[];
}

interface DbCategory {
  id: string;
  name: string;
  slug: string;
}

interface NotificationRow {
  id?: string;
  exam_id?: string;
  type: string;
  title: string;
  pdf_url?: string | null;
  published_at?: string;
  exams?: ExamRow | null;
}

type JobStatus = "active" | "closing-soon" | "closed";

// ── Category visual config ───────────────────────────────────────────────────

const CAT_VISUAL = [
  { key: "new-jobs", label: "New Jobs", icon: Briefcase, color: "#1A3C6E", bg: "#EEF2F8", route: "/latest-jobs" },
  { key: "result", label: "Results", icon: CheckSquare, color: "#1F9D55", bg: "#E8F7EF", route: "/results" },
  { key: "admit_card", label: "Admit Card", icon: FileText, color: "#FF7A00", bg: "#FFF3E8", route: "/admit-card" },
  { key: "answer_key", label: "Answer Key", icon: ClipboardList, color: "#7C3AED", bg: "#F3EEFF", route: "/answer-key" },
];

const SEC_CAT_VISUAL = [
  { label: "Syllabus", key: "syllabus", icon: BookOpen, color: "#0EA5E9", route: "/syllabus" },
  { label: "Cut Off", key: "cut_off", icon: AlertCircle, color: "#F59E0B", route: "/results" },
  { label: "Previous Papers", key: "previous_papers", icon: FileText, color: "#8B5CF6", route: "/syllabus" },
  { label: "Exam Calendar", key: "exam_calendar", icon: Calendar, color: "#10B981", route: "/latest-jobs" },
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

function fmtDate(d: string | null | undefined): string {
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

function filterExams(
  exams: ExamRow[],
  searchQuery: string,
  selectedState: string,
  selectedCategory?: string,
  selectedTag?: string
) {
  return exams.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    const searchMatch =
      !q ||
      e.title.toLowerCase().includes(q) ||
      (e.department ?? "").toLowerCase().includes(q) ||
      (e.categories?.name ?? "").toLowerCase().includes(q);

    const stateMatch =
      selectedState === "All" ||
      e.is_all_india ||
      e.exam_states?.some(
        (es) =>
          es.states?.name.toLowerCase() === selectedState.toLowerCase() ||
          es.states?.code.toLowerCase() === selectedState.toLowerCase()
      );

    const catMatch =
      !selectedCategory ||
      selectedCategory === "All" ||
      selectedCategory === "new-jobs" ||
      e.categories?.name === selectedCategory ||
      e.categories?.slug === selectedCategory;

    const tagMatch =
      !selectedTag ||
      selectedTag === "All" ||
      e.exam_job_tags?.some((ejt) => ejt.job_tags?.slug === selectedTag);

    return searchMatch && stateMatch && catMatch && tagMatch;
  });
}

// ── Search Autocomplete Component (Fix 1) ────────────────────────────────────

function SearchAutocomplete({
  value,
  onChange,
  onSelectExam,
  allExams,
  placeholder,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (val: string) => void;
  onSelectExam: (slug: string) => void;
  allExams: ExamRow[];
  placeholder: string;
  className?: string;
  inputClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, 300);
    return () => clearTimeout(handler);
  }, [value]);

  const suggestions = debouncedValue.trim()
    ? allExams
        .filter(
          (e) =>
            e.title.toLowerCase().includes(debouncedValue.toLowerCase().trim()) ||
            (e.department ?? "").toLowerCase().includes(debouncedValue.toLowerCase().trim())
        )
        .slice(0, 6)
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className={`relative flex-1 ${className || ""}`} ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={inputClassName}
      />

      <AnimatePresence>
        {isOpen && debouncedValue.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden text-left"
          >
            <div className="px-3 py-2 border-b border-gray-100 bg-[#FAFBFD] flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#1A3C6E]">
              <span>Exam Suggestions</span>
              <span>{suggestions.length} matching</span>
            </div>

            {suggestions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#5B6880]">
                No matching exams found for &ldquo;{debouncedValue.trim()}&rdquo;
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {suggestions.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectExam(item.slug);
                      setIsOpen(false);
                    }}
                    className="p-3 hover:bg-[#FFF7F0] cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold text-[#1A3C6E] bg-blue-50 px-2 py-0.5 rounded">
                          {item.categories?.name ?? "General"}
                        </span>
                        {item.department && (
                          <span className="text-[11px] text-[#5B6880] truncate">{item.department}</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[#0F1C30] group-hover:text-[#FF7A00] transition-colors truncate">
                        {item.title}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-[11px] font-semibold text-[#FF7A00] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        View <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

// ── Ticker ────────────────────────────────────────────────────────────────────

function Ticker({ items }: { items: string[] }) {
  const displayItems = items.length > 0 ? items : ["Loading live updates…"];
  return (
    <div className="bg-[#1A3C6E] text-white py-2 overflow-hidden relative border-b border-white/10">
      <div className="flex items-center">
        <div className="flex-shrink-0 flex items-center gap-2 bg-[#FF7A00] px-4 py-1 z-10 relative">
          <TrendingUp size={13} />
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
              <span key={i} className="text-xs sm:text-sm text-white/90 inline-flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
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

// ── Header Component (Fixed State Dropdown & Autocomplete Search) ─────────────

function Header({
  searchQuery,
  setSearchQuery,
  selectedState,
  setSelectedState,
  isScrolledPastHero,
  allExams,
  dbStates,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedState: string;
  setSelectedState: (s: string) => void;
  isScrolledPastHero: boolean;
  allExams: ExamRow[];
  dbStates: DbState[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();

  const isHome = location.pathname === "/";
  const shouldShowHeaderSearch = isScrolledPastHero || !isHome;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/category?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate(`/category`);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMoreDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isMoreActive = ["/admit-card", "/syllabus", "/answer-key"].includes(location.pathname);

  return (
    <header className="bg-[#1A3C6E] border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-3 md:gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0 group">
            <div className="bg-white rounded-xl px-2 py-1 group-hover:scale-105 transition-transform shadow-sm">
              <img src={logoUrl} alt="JobAlert logo" className="h-8 md:h-9 w-auto" />
            </div>
            <div className="leading-tight">
              <span className="text-white font-bold text-lg md:text-xl tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Job<span className="text-[#FF7A00]">Alert</span>
              </span>
              <p className="text-white/50 text-[8px] md:text-[9px] uppercase tracking-widest hidden sm:block">Govt Jobs &amp; Exams India</p>
            </div>
          </Link>

          {/* Docked Autocomplete Search Bar */}
          <AnimatePresence>
            {shouldShowHeaderSearch && (
              <motion.form
                initial={{ opacity: 0, y: -15, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.96 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onSubmit={handleSearchSubmit}
                className="flex items-center bg-white rounded-xl p-1 flex-1 max-w-sm md:max-w-md lg:max-w-lg mx-1 md:mx-2 shadow-md relative z-50 pointer-events-auto"
              >
                <div className="flex items-center flex-1 px-2 gap-1.5 min-w-0">
                  <Search size={15} className="text-[#1A3C6E]/50 flex-shrink-0" />
                  <SearchAutocomplete
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSelectExam={(slug) => navigate(`/exam/${slug}`)}
                    allExams={allExams}
                    placeholder="Search jobs..."
                    inputClassName="outline-none text-[#0F1C30] placeholder-gray-400 text-xs sm:text-sm w-full bg-transparent min-w-0"
                  />
                </div>
                {/* Dynamic State Selector (Fix 2) */}
                <div className="hidden sm:flex items-center gap-1 px-2 border-l border-gray-200">
                  <MapPin size={12} className="text-[#1A3C6E]/50" />
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="outline-none text-xs text-[#0F1C30] bg-transparent cursor-pointer pr-1"
                  >
                    <option value="All">All States</option>
                    {dbStates.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="bg-[#FF7A00] hover:bg-[#E86E00] text-white font-semibold text-xs px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                >
                  Search
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                location.pathname === "/" ? "bg-white/15 text-white font-bold" : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              Home
            </Link>
            <Link
              to="/latest-jobs"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                location.pathname === "/latest-jobs" ? "bg-[#FF7A00] text-white font-bold shadow-sm" : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              Latest Jobs
            </Link>
            <Link
              to="/category"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                location.pathname === "/category" ? "bg-white/15 text-white font-bold" : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              Category
            </Link>
            <Link
              to="/results"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                location.pathname === "/results" ? "bg-[#FF7A00] text-white font-bold shadow-sm" : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              Results
            </Link>

            {/* "More" Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                onMouseEnter={() => setMoreDropdownOpen(true)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isMoreActive ? "bg-[#FF7A00] text-white font-bold" : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                More <ChevronDown size={14} className={`transition-transform duration-200 ${moreDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {moreDropdownOpen && (
                <div
                  onMouseLeave={() => setMoreDropdownOpen(false)}
                  className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <Link
                    to="/admit-card"
                    onClick={() => setMoreDropdownOpen(false)}
                    className={`flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors ${
                      location.pathname === "/admit-card" ? "bg-[#EEF2F8] text-[#FF7A00] font-bold" : "text-[#0F1C30] hover:bg-[#EEF2F8] hover:text-[#FF7A00]"
                    }`}
                  >
                    <FileText size={15} className="text-[#FF7A00]" /> Admit Card
                  </Link>
                  <Link
                    to="/syllabus"
                    onClick={() => setMoreDropdownOpen(false)}
                    className={`flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors ${
                      location.pathname === "/syllabus" ? "bg-[#EEF2F8] text-[#FF7A00] font-bold" : "text-[#0F1C30] hover:bg-[#EEF2F8] hover:text-[#FF7A00]"
                    }`}
                  >
                    <BookOpen size={15} className="text-[#0EA5E9]" /> Syllabus
                  </Link>
                  <Link
                    to="/answer-key"
                    onClick={() => setMoreDropdownOpen(false)}
                    className={`flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors ${
                      location.pathname === "/answer-key" ? "bg-[#EEF2F8] text-[#FF7A00] font-bold" : "text-[#0F1C30] hover:bg-[#EEF2F8] hover:text-[#FF7A00]"
                    }`}
                  >
                    <ClipboardList size={15} className="text-[#7C3AED]" /> Answer Key
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* Action Button & Mobile Toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="flex items-center gap-1.5 bg-[#FF7A00] hover:bg-[#E86E00] text-white text-xs sm:text-sm font-semibold px-2.5 sm:px-3 py-2 rounded-lg transition-colors shadow-md whitespace-nowrap">
              <Bell size={14} />
              <span className="hidden sm:inline">Notify Me</span>
            </button>
            <button className="lg:hidden text-white/80 hover:text-white p-1.5" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="lg:hidden bg-[#122C52] border-t border-white/10 px-4 pb-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center bg-white/10 border border-white/20 rounded-lg mt-3 mb-2 px-3">
            <Search size={14} className="text-white/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exams, jobs, state..."
              className="bg-transparent text-white placeholder-white/40 text-sm px-2 py-2.5 outline-none w-full"
            />
          </form>
          <div className="flex flex-col space-y-1">
            <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center text-white/80 hover:text-white py-2 border-b border-white/10 text-sm font-medium gap-2">
              <ChevronRight size={14} className="text-[#FF7A00]" /> Home
            </Link>
            <Link to="/latest-jobs" onClick={() => setMenuOpen(false)} className="flex items-center text-white/80 hover:text-white py-2 border-b border-white/10 text-sm font-medium gap-2">
              <ChevronRight size={14} className="text-[#FF7A00]" /> Latest Jobs
            </Link>
            <Link to="/category" onClick={() => setMenuOpen(false)} className="flex items-center text-white/80 hover:text-white py-2 border-b border-white/10 text-sm gap-2">
              <ChevronRight size={14} className="text-[#FF7A00]" /> Category
            </Link>
            <Link to="/results" onClick={() => setMenuOpen(false)} className="flex items-center text-white/80 hover:text-white py-2 border-b border-white/10 text-sm font-medium gap-2">
              <ChevronRight size={14} className="text-[#FF7A00]" /> Results
            </Link>
            <Link to="/admit-card" onClick={() => setMenuOpen(false)} className="flex items-center text-white/80 hover:text-white py-2 border-b border-white/10 text-sm font-medium gap-2">
              <ChevronRight size={14} className="text-[#FF7A00]" /> Admit Card
            </Link>
            <Link to="/syllabus" onClick={() => setMenuOpen(false)} className="flex items-center text-white/80 hover:text-white py-2 border-b border-white/10 text-sm font-medium gap-2">
              <ChevronRight size={14} className="text-[#FF7A00]" /> Syllabus
            </Link>
            <Link to="/answer-key" onClick={() => setMenuOpen(false)} className="flex items-center text-white/80 hover:text-white py-2 border-b border-white/10 text-sm font-medium gap-2">
              <ChevronRight size={14} className="text-[#FF7A00]" /> Answer Key
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ── Hero Section (Home Page) ──────────────────────────────────────────────────

function Hero({
  searchQuery,
  setSearchQuery,
  selectedState,
  setSelectedState,
  isScrolledPastHero,
  allExams,
  dbStates,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedState: string;
  setSelectedState: (s: string) => void;
  isScrolledPastHero: boolean;
  allExams: ExamRow[];
  dbStates: DbState[];
}) {
  const navigate = useNavigate();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/category?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate(`/category`);
    }
  };

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
          Real-Time Govt Job &amp; Exam Alerts
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

        {/* Hero Autocomplete Search Bar */}
        <div className="min-h-[56px] flex items-center justify-center">
          <AnimatePresence>
            {!isScrolledPastHero && (
              <motion.form
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onSubmit={handleSearchSubmit}
                className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-2 flex flex-col sm:flex-row gap-2 relative z-20 pointer-events-auto"
              >
                <div className="flex items-center flex-1 px-3 gap-2">
                  <Search size={16} className="text-[#1A3C6E]/40 flex-shrink-0" />
                  <SearchAutocomplete
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSelectExam={(slug) => navigate(`/exam/${slug}`)}
                    allExams={allExams}
                    placeholder="Search by exam name, department..."
                    inputClassName="outline-none text-[#0F1C30] placeholder-gray-400 text-sm w-full bg-transparent"
                  />
                </div>
                {/* Dynamic State Selector (Fix 2) */}
                <div className="flex items-center gap-2 px-3 border-t sm:border-t-0 sm:border-l border-gray-100 pt-2 sm:pt-0">
                  <MapPin size={14} className="text-[#1A3C6E]/40" />
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="outline-none text-sm text-[#0F1C30] bg-transparent pr-2 cursor-pointer max-w-[140px] truncate"
                  >
                    <option value="All">All States</option>
                    {dbStates.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="bg-[#FF7A00] hover:bg-[#E86E00] text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap shadow-md"
                >
                  Search Jobs
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

// ── Redesigned Compact Grid Job Listings ──────────────────────────────────────

function HomeJobListings({
  exams,
  loading,
  error,
  selectedState,
  searchQuery,
}: {
  exams: ExamRow[];
  loading: boolean;
  error: string | null;
  selectedState: string;
  searchQuery: string;
}) {
  const [visibleCount, setVisibleCount] = useState(8);
  const navigate = useNavigate();

  const filteredExams = filterExams(exams, searchQuery, selectedState);
  const visible = filteredExams.slice(0, visibleCount);

  return (
    <section id="latest-jobs" className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[#0F1C30] font-bold text-2xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Latest Job Notifications
          </h2>
          <p className="text-[#5B6880] text-sm mt-1">
            Real-time government recruitment announcements
            {selectedState !== "All" && (
              <span className="text-[#FF7A00] font-semibold ml-1.5">
                • Filtered by {selectedState}
              </span>
            )}
          </p>
        </div>
        <Link
          to="/latest-jobs"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF7A00] hover:text-[#E86E00] transition-colors"
        >
          View All Latest Jobs <ChevronRight size={16} />
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-5 py-4 rounded-xl mb-4 flex items-center gap-3">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>Could not load exam data: {error}. Please refresh the page.</span>
        </div>
      )}

      {/* 2-Column Responsive Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-2xl border border-gray-100 p-5 h-44" />
          ))
        ) : visible.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-gray-100 p-12 text-center text-[#5B6880] text-sm">
            No active job listings found for the selected state/search filter.
          </div>
        ) : (
          visible.map((exam) => {
            const jobStatus = calcJobStatus(exam);
            return (
              <div
                key={exam.id}
                onClick={() => navigate(`/exam/${exam.slug}`)}
                className="group bg-white rounded-2xl border border-[#1A3C6E]/12 p-5 shadow-sm hover:shadow-md hover:border-[#FF7A00]/40 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-[#1A3C6E] bg-blue-50 px-2.5 py-0.5 rounded-md truncate max-w-[60%]">
                      {exam.categories?.name ?? "General"}
                    </span>
                    <StatusTag status={jobStatus} />
                  </div>

                  <h3 className="font-bold text-[#0F1C30] text-base group-hover:text-[#FF7A00] transition-colors leading-snug mb-1">
                    {exam.title}
                  </h3>

                  {exam.department && (
                    <p className="text-[#5B6880] text-xs font-medium mb-3 truncate">
                      {exam.department}
                    </p>
                  )}

                  {/* Job type & All India tags */}
                  {(exam.is_all_india || (exam.exam_job_tags && exam.exam_job_tags.length > 0)) && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {exam.is_all_india && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                          🇮🇳 All India
                        </span>
                      )}
                      {exam.exam_job_tags?.map((ejt) =>
                        ejt.job_tags ? (
                          <span
                            key={ejt.job_tags.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: ejt.job_tags.color + "18", color: ejt.job_tags.color }}
                          >
                            ● {ejt.job_tags.name}
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs mt-2">
                  <span className="text-[#5B6880]">
                    Last Date:{" "}
                    <span className={`font-bold ${jobStatus === "closing-soon" ? "text-[#E03E3E]" : "text-[#0F1C30]"}`}>
                      {fmtDate(exam.application_end)}
                    </span>
                  </span>
                  <span className="text-[#FF7A00] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    View Details <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && filteredExams.length > visibleCount && (
        <div className="mt-6 flex justify-center">
          <Link
            to="/latest-jobs"
            className="text-[#1A3C6E] hover:text-[#FF7A00] text-sm font-bold bg-white border border-[#1A3C6E]/20 hover:border-[#FF7A00]/40 px-6 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            View All Latest Jobs <ChevronRight size={15} />
          </Link>
        </div>
      )}
    </section>
  );
}

// ── Dedicated Page: /latest-jobs ──────────────────────────────────────────────

function LatestJobsPage({
  exams,
  loading,
  error,
  allJobTags,
  selectedState,
}: {
  exams: ExamRow[];
  loading: boolean;
  error: string | null;
  allJobTags: JobTag[];
  selectedState: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("All");
  const [visibleCount, setVisibleCount] = useState(12);
  const navigate = useNavigate();

  const filteredExams = filterExams(exams, searchQuery, selectedState, "All", selectedTag);
  const visible = filteredExams.slice(0, visibleCount);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#0F1C30]" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Latest Government Job Notifications
        </h1>
        <p className="text-[#5B6880] text-sm mt-1">
          Explore all active recruitment notifications across India, sorted by date.
          {selectedState !== "All" && (
            <span className="text-[#FF7A00] font-semibold ml-1.5">
              • Showing exams for {selectedState} &amp; All India
            </span>
          )}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-5 border border-[#1A3C6E]/10 shadow-sm mb-8 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Search */}
        <div className="flex items-center bg-[#F4F5F7] border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-md">
          <Search size={16} className="text-[#1A3C6E]/40 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by exam name or department..."
            className="bg-transparent text-[#0F1C30] placeholder-gray-400 text-sm outline-none w-full"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Job Type Tag Filter */}
        {allJobTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-bold text-[#5B6880] uppercase tracking-wider mr-1">Role:</span>
            <button
              onClick={() => setSelectedTag("All")}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                selectedTag === "All"
                  ? "bg-[#FF7A00] border-[#FF7A00] text-white shadow-sm"
                  : "bg-white border-gray-200 text-[#5B6880] hover:border-[#FF7A00]"
              }`}
            >
              All Roles
            </button>
            {allJobTags.map((tag) => {
              const active = selectedTag === tag.slug;
              return (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTag(tag.slug)}
                  className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                  style={
                    active
                      ? { backgroundColor: tag.color, borderColor: tag.color, color: "white" }
                      : { backgroundColor: "white", borderColor: tag.color + "40", color: tag.color }
                  }
                >
                  ● {tag.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-5 py-4 rounded-xl mb-6 flex items-center gap-3">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>Could not load job data: {error}.</span>
        </div>
      )}

      {/* Grid of All Exams */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-2xl border border-gray-100 p-5 h-44" />
          ))
        ) : visible.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-gray-100 p-12 text-center text-[#5B6880]">
            <AlertCircle size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="font-bold text-[#0F1C30] text-base">No Job Notifications Found</p>
            <p className="text-xs text-[#5B6880] mt-1">Try clearing your search or role filters.</p>
          </div>
        ) : (
          visible.map((exam) => {
            const jobStatus = calcJobStatus(exam);
            return (
              <div
                key={exam.id}
                onClick={() => navigate(`/exam/${exam.slug}`)}
                className="group bg-white rounded-2xl border border-[#1A3C6E]/12 p-5 shadow-sm hover:shadow-md hover:border-[#FF7A00]/40 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-[#1A3C6E] bg-blue-50 px-2.5 py-0.5 rounded-md truncate max-w-[60%]">
                      {exam.categories?.name ?? "General"}
                    </span>
                    <StatusTag status={jobStatus} />
                  </div>

                  <h3 className="font-bold text-[#0F1C30] text-base group-hover:text-[#FF7A00] transition-colors leading-snug mb-1">
                    {exam.title}
                  </h3>

                  {exam.department && (
                    <p className="text-[#5B6880] text-xs font-medium mb-3 truncate">
                      {exam.department}
                    </p>
                  )}

                  {(exam.is_all_india || (exam.exam_job_tags && exam.exam_job_tags.length > 0)) && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {exam.is_all_india && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                          🇮🇳 All India
                        </span>
                      )}
                      {exam.exam_job_tags?.map((ejt) =>
                        ejt.job_tags ? (
                          <span
                            key={ejt.job_tags.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: ejt.job_tags.color + "18", color: ejt.job_tags.color }}
                          >
                            ● {ejt.job_tags.name}
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs mt-2">
                  <span className="text-[#5B6880]">
                    Last Date:{" "}
                    <span className={`font-bold ${jobStatus === "closing-soon" ? "text-[#E03E3E]" : "text-[#0F1C30]"}`}>
                      {fmtDate(exam.application_end)}
                    </span>
                  </span>
                  <span className="text-[#FF7A00] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    View Details <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && filteredExams.length > visibleCount && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setVisibleCount((c) => c + 6)}
            className="text-[#1A3C6E] hover:text-[#FF7A00] text-sm font-bold bg-white border border-[#1A3C6E]/20 hover:border-[#FF7A00]/40 px-6 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            Load More Jobs <ChevronRight size={15} className="rotate-90" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Dedicated Page for Results, Admit Card, Syllabus, Answer Key ─────────────

function NotificationTypePage({
  type,
  title,
  subtitle,
  icon: PageIcon,
  emptyTitle,
  emptyMessage,
}: {
  type: string;
  title: string;
  subtitle: string;
  icon: any;
  emptyTitle: string;
  emptyMessage: string;
}) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchNotifications() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from("notifications")
          .select("*, exams(*, categories(id,name,slug), exam_job_tags(job_tags(id,name,slug,color)))")
          .eq("type", type)
          .order("published_at", { ascending: false });

        if (err) throw err;
        setItems((data as any) ?? []);
      } catch (e: any) {
        console.error(`Error fetching ${type} notifications:`, e);
        setError(e.message || "Failed to load notifications.");
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, [type]);

  const filteredItems = items.filter((n) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      (n.exams?.title ?? "").toLowerCase().includes(q) ||
      (n.exams?.department ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#1A3C6E] text-[#FF7A00] flex items-center justify-center flex-shrink-0 shadow-md">
          <PageIcon size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-[#0F1C30]" style={{ fontFamily: "'Poppins', sans-serif" }}>
            {title}
          </h1>
          <p className="text-[#5B6880] text-sm mt-1">{subtitle}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#1A3C6E]/10 shadow-sm mb-8 flex items-center gap-2">
        <Search size={16} className="text-[#1A3C6E]/40 flex-shrink-0 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}...`}
          className="bg-transparent text-[#0F1C30] placeholder-gray-400 text-sm outline-none w-full"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600 pr-1">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-5 py-4 rounded-xl mb-6 flex items-center gap-3">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>Could not load notifications: {error}.</span>
        </div>
      )}

      {/* List / Grid of Notifications */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-2xl border border-gray-100 p-5 h-36" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#1A3C6E]/12 p-12 text-center max-w-xl mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-[#1A3C6E] flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={28} />
          </div>
          <h3 className="font-bold text-[#0F1C30] text-lg mb-1">{emptyTitle}</h3>
          <p className="text-[#5B6880] text-sm mb-6">{emptyMessage}</p>
          <Link
            to="/category"
            className="inline-flex items-center gap-2 bg-[#1A3C6E] hover:bg-[#FF7A00] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            Browse All Categories <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-[#1A3C6E]/12 p-5 shadow-sm hover:shadow-md hover:border-[#FF7A00]/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-[#1A3C6E] bg-blue-50 px-2.5 py-0.5 rounded-md">
                    {item.exams?.categories?.name ?? "Official Notice"}
                  </span>
                  <span className="text-xs text-[#5B6880] flex items-center gap-1 font-medium">
                    <Clock size={12} /> {fmtDate(item.published_at)}
                  </span>
                </div>

                <h3 className="font-bold text-[#0F1C30] text-base leading-snug mb-1">
                  {item.title}
                </h3>

                {item.exams?.title && (
                  <p className="text-[#5B6880] text-xs font-medium mb-3">
                    Linked Exam: <span className="text-[#1A3C6E] font-semibold">{item.exams.title}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs mt-2">
                {item.pdf_url ? (
                  <a
                    href={item.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#FF7A00] hover:text-[#E86E00]"
                  >
                    <Download size={14} /> Download PDF
                  </a>
                ) : (
                  <span className="text-xs text-[#5B6880] font-medium">Official Notice</span>
                )}

                {item.exams?.slug && (
                  <button
                    onClick={() => navigate(`/exam/${item.exams!.slug}`)}
                    className="bg-[#1A3C6E] hover:bg-[#FF7A00] text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors"
                  >
                    View Exam Details
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Category Page ─────────────────────────────────────────────────────────────

function CategoryPage({
  categories,
  allJobTags,
  catCounts,
  exams,
  loading,
  selectedState,
}: {
  categories: DbCategory[];
  allJobTags: JobTag[];
  catCounts: Record<string, number>;
  exams: ExamRow[];
  loading: boolean;
  selectedState: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedCategory = searchParams.get("cat") || "All";
  const selectedTag = searchParams.get("tag") || "All";
  const searchQuery = searchParams.get("search") || "";

  const categoryChips = ["All", ...categories.map((c) => c.name)];

  const filteredExams = filterExams(exams, searchQuery, selectedState, selectedCategory, selectedTag);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Category Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#0F1C30]" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Browse Government Jobs by Category
        </h1>
        <p className="text-[#5B6880] text-sm mt-1">
          Select a category or job type to quickly find active recruitment notifications.
          {selectedState !== "All" && (
            <span className="text-[#FF7A00] font-semibold ml-1.5">
              • Filtered by {selectedState} &amp; All India
            </span>
          )}
        </p>
      </div>

      {/* Visual Category Cards Section */}
      <div className="mb-10">
        <h2 className="text-[#0F1C30] font-bold text-lg mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Quick Navigation
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {CAT_VISUAL.map(({ key, label, icon: Icon, color, bg, route }) => (
            <Link
              key={key}
              to={route}
              className="group bg-white rounded-xl p-5 border border-[#1A3C6E]/10 shadow-sm hover:shadow-lg hover:border-[#FF7A00]/40 text-left transition-all duration-200 cursor-pointer block"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ backgroundColor: bg }}>
                <Icon size={22} style={{ color }} />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[#0F1C30] font-bold text-base">{label}</p>
                  <p className="text-[#5B6880] text-xs mt-0.5">Updated today</p>
                </div>
                <span className="text-white text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: color }}>
                  {catCounts[key] ?? 0}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SEC_CAT_VISUAL.map(({ label, key, icon: Icon, color, route }) => (
            <Link
              key={key}
              to={route}
              className="group bg-white rounded-lg px-4 py-3 border border-[#1A3C6E]/10 shadow-sm hover:border-[#FF7A00]/40 hover:shadow-md text-left transition-all flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "18" }}>
                <Icon size={17} style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[#0F1C30] font-semibold text-sm truncate">{label}</p>
                <p className="text-[#5B6880] text-xs">{loading ? "—" : (catCounts[key] ?? 0)} items</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Filter Chips Container */}
      <div className="bg-white rounded-2xl p-6 border border-[#1A3C6E]/10 shadow-sm mb-8">
        {/* Category Filter Chips */}
        <div className="mb-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#1A3C6E] mb-2">
            Filter by Department / Category:
          </label>
          <div className="flex flex-wrap gap-2">
            {categoryChips.map((chip) => {
              const active = selectedCategory === chip || (chip === "All" && selectedCategory === "All");
              return (
                <button
                  key={chip}
                  onClick={() => setSearchParams({ cat: chip, tag: selectedTag })}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    active
                      ? "bg-[#1A3C6E] border-[#1A3C6E] text-white shadow-sm"
                      : "bg-white border-gray-200 text-[#5B6880] hover:border-[#1A3C6E]/40 hover:text-[#1A3C6E]"
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>

        {/* Job Type Filter Chips */}
        {allJobTags.length > 0 && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1A3C6E] mb-2">
              Filter by Job Role / Type:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSearchParams({ cat: selectedCategory, tag: "All" })}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  selectedTag === "All"
                    ? "bg-[#FF7A00] border-[#FF7A00] text-white shadow-sm"
                    : "bg-white border-gray-200 text-[#5B6880] hover:border-[#FF7A00]"
                }`}
              >
                All Job Types
              </button>
              {allJobTags.map((tag) => {
                const active = selectedTag === tag.slug;
                return (
                  <button
                    key={tag.id}
                    onClick={() => setSearchParams({ cat: selectedCategory, tag: tag.slug })}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={
                      active
                        ? { backgroundColor: tag.color, borderColor: tag.color, color: "white" }
                        : { backgroundColor: "white", borderColor: tag.color + "40", color: tag.color }
                    }
                  >
                    ● {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Filtered Exams Cards Grid */}
      <div className="bg-white rounded-2xl border border-[#1A3C6E]/12 shadow-sm overflow-hidden p-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
          <h3 className="font-bold text-[#0F1C30] text-lg">
            Job Listings <span className="text-[#FF7A00]">({filteredExams.length})</span>
          </h3>
          {(selectedCategory !== "All" || selectedTag !== "All" || searchQuery) && (
            <button
              onClick={() => setSearchParams({})}
              className="text-xs text-[#E03E3E] font-semibold hover:underline flex items-center gap-1"
            >
              <X size={12} /> Clear Filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[#5B6880]">Loading exams...</div>
        ) : filteredExams.length === 0 ? (
          <div className="p-12 text-center text-[#5B6880]">
            <AlertCircle size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="font-semibold text-[#0F1C30]">No exams found matching selected filters.</p>
            <p className="text-xs text-[#5B6880] mt-1">Try resetting your category or job type selection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredExams.map((exam) => {
              const jobStatus = calcJobStatus(exam);
              return (
                <div
                  key={exam.id}
                  onClick={() => navigate(`/exam/${exam.slug}`)}
                  className="group bg-white rounded-xl border border-[#1A3C6E]/10 p-5 hover:border-[#FF7A00]/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-[#1A3C6E] bg-blue-50 px-2.5 py-0.5 rounded-md truncate max-w-[60%]">
                        {exam.categories?.name ?? "General"}
                      </span>
                      <StatusTag status={jobStatus} />
                    </div>

                    <h4 className="font-bold text-[#0F1C30] text-base group-hover:text-[#FF7A00] transition-colors leading-snug mb-1">
                      {exam.title}
                    </h4>
                    <p className="text-[#5B6880] text-xs font-medium mb-3 truncate">{exam.department ?? "Government Department"}</p>

                    {/* Job type tags */}
                    {(exam.is_all_india || (exam.exam_job_tags && exam.exam_job_tags.length > 0)) && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {exam.is_all_india && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                            🇮🇳 All India
                          </span>
                        )}
                        {exam.exam_job_tags?.map((ejt) =>
                          ejt.job_tags ? (
                            <span
                              key={ejt.job_tags.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: ejt.job_tags.color + "18", color: ejt.job_tags.color }}
                            >
                              ● {ejt.job_tags.name}
                            </span>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                    <span className="text-[#5B6880]">
                      Last Date:{" "}
                      <span className={`font-bold ${jobStatus === "closing-soon" ? "text-[#E03E3E]" : "text-[#0F1C30]"}`}>
                        {fmtDate(exam.application_end)}
                      </span>
                    </span>
                    <button className="bg-[#1A3C6E] group-hover:bg-[#FF7A00] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Exam Detail Page (Fix 3: Contextual Toast Notification) ───────────────────

function ExamDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toastShownRef = useRef(false);

  useEffect(() => {
    async function fetchExam() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from("exams")
          .select("*, categories(id,name,slug), exam_job_tags(job_tags(id,name,slug,color))")
          .eq("slug", slug)
          .single();

        if (err) throw err;
        setExam(data as any);

        // Show non-blocking toast notification (Fix 3)
        if (data && !toastShownRef.current) {
          toastShownRef.current = true;
          toast.custom((t) => (
            <div className="bg-[#1A3C6E] text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between gap-4 max-w-md w-full animate-in fade-in slide-in-from-top-3 duration-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FF7A00] flex items-center justify-center flex-shrink-0 text-white shadow-sm">
                  <Bell size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-[#FFB066] font-bold uppercase tracking-wider">Exam Details</p>
                  <p className="text-xs font-bold text-white truncate">{data.title}</p>
                  <p className="text-[11px] text-white/80 mt-0.5">
                    Last Date to Apply: <span className="text-[#FF7A00] font-bold">{fmtDate(data.application_end)}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => toast.dismiss(t)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ), { duration: 3500 });
        }
      } catch (e: any) {
        console.error("Error fetching exam details:", e);
        setError(e.message || "Failed to load exam details.");
      } finally {
        setLoading(false);
      }
    }
    fetchExam();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#FF7A00] border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-[#5B6880] text-sm font-medium">Loading exam details...</p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle size={40} className="mx-auto text-red-500 mb-3" />
        <h2 className="text-xl font-bold text-[#0F1C30]">Exam Not Found</h2>
        <p className="text-[#5B6880] text-sm mt-1">{error || "The exam entry you are looking for does not exist in the database."}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 inline-flex items-center gap-2 bg-[#1A3C6E] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-[#FF7A00] transition-colors"
        >
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  const jobStatus = calcJobStatus(exam);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#1A3C6E] hover:text-[#FF7A00] mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Listings
      </button>

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl border border-[#1A3C6E]/12 shadow-md p-6 md:p-8 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {exam.categories && (
            <span className="bg-blue-100 text-[#1A3C6E] text-xs font-bold px-3 py-1 rounded-full">
              {exam.categories.name}
            </span>
          )}
          <StatusTag status={jobStatus} />
          {exam.is_all_india && (
            <span className="bg-blue-50 text-blue-600 border border-blue-100 text-xs font-bold px-3 py-1 rounded-full">
              🇮🇳 All India Recruitment
            </span>
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold text-[#0F1C30] leading-tight mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {exam.title}
        </h1>

        {exam.department && (
          <p className="text-[#5B6880] text-base font-medium flex items-center gap-2 mb-4">
            <Building2 size={18} className="text-[#1A3C6E]" /> {exam.department}
          </p>
        )}

        {/* Dynamic Job Type Tags */}
        {exam.exam_job_tags && exam.exam_job_tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
            <span className="text-xs font-bold uppercase text-[#5B6880] self-center mr-1">Job Type:</span>
            {exam.exam_job_tags.map((ejt) =>
              ejt.job_tags ? (
                <span
                  key={ejt.job_tags.id}
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: ejt.job_tags.color + "18", color: ejt.job_tags.color }}
                >
                  ● {ejt.job_tags.name}
                </span>
              ) : null
            )}
          </div>
        )}
      </div>

      {/* Dynamic Key Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#FF7A00] flex items-center justify-center mx-auto mb-2">
            <Briefcase size={20} />
          </div>
          <span className="text-xs text-[#5B6880] block font-medium">Total Posts</span>
          <span className="text-lg font-bold text-[#0F1C30]">
            {exam.vacancy_count ? exam.vacancy_count.toLocaleString("en-IN") : "—"}
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1A3C6E] flex items-center justify-center mx-auto mb-2">
            <Clock size={20} />
          </div>
          <span className="text-xs text-[#5B6880] block font-medium">Last Date to Apply</span>
          <span className={`text-sm font-bold ${jobStatus === "closing-soon" ? "text-[#E03E3E]" : "text-[#0F1C30]"}`}>
            {fmtDate(exam.application_end)}
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-2">
            <GraduationCap size={20} />
          </div>
          <span className="text-xs text-[#5B6880] block font-medium">Qualification</span>
          <span className="text-sm font-bold text-[#0F1C30]">{exam.qualification || "—"}</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-2">
            <Tag size={20} />
          </div>
          <span className="text-xs text-[#5B6880] block font-medium">Age Limit</span>
          <span className="text-sm font-bold text-[#0F1C30]">{exam.age_limit || "—"}</span>
        </div>
      </div>

      {/* Dynamic Dates & Official Website Section */}
      <div className="bg-white rounded-2xl border border-[#1A3C6E]/10 shadow-sm p-6 md:p-8 mb-6">
        <h3 className="text-lg font-bold text-[#0F1C30] mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-[#FF7A00]" /> Important Dates &amp; Links
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-3.5 bg-gray-50 rounded-xl">
            <span className="text-xs text-[#5B6880] block font-medium">Application Start</span>
            <span className="text-sm font-bold text-[#0F1C30]">{fmtDate(exam.application_start)}</span>
          </div>
          <div className="p-3.5 bg-gray-50 rounded-xl">
            <span className="text-xs text-[#5B6880] block font-medium">Application End</span>
            <span className="text-sm font-bold text-[#0F1C30]">{fmtDate(exam.application_end)}</span>
          </div>
          <div className="p-3.5 bg-gray-50 rounded-xl">
            <span className="text-xs text-[#5B6880] block font-medium">Exam Date</span>
            <span className="text-sm font-bold text-[#0F1C30]">{fmtDate(exam.exam_date)}</span>
          </div>
        </div>

        {/* Apply Now Link */}
        {exam.official_link ? (
          <a
            href={exam.official_link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-[#FF7A00] hover:bg-[#E86E00] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md text-base"
          >
            Apply Now on Official Website <ExternalLink size={18} />
          </a>
        ) : (
          <button disabled className="w-full py-3.5 bg-gray-100 text-gray-400 font-bold rounded-xl cursor-not-allowed text-center text-sm">
            Official Application Link Not Provided
          </button>
        )}
      </div>

      {/* Dynamic Description / Multi-Paragraph Content Section */}
      <div className="bg-white rounded-2xl border border-[#1A3C6E]/10 shadow-sm p-6 md:p-8">
        <h3 className="text-lg font-bold text-[#0F1C30] mb-3">Notification Details &amp; Overview</h3>
        {exam.description ? (
          <div className="text-[#0F1C30] text-sm leading-relaxed whitespace-pre-line">{exam.description}</div>
        ) : (
          <div className="text-[#5B6880] text-sm leading-relaxed space-y-3">
            <p>
              Official recruitment notification released for <span className="font-semibold text-[#0F1C30]">{exam.title}</span>
              {exam.department ? ` by ${exam.department}` : ""}. Candidates meeting the eligibility requirements can register and submit their applications online before the specified closing date.
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-[#1A3C6E] space-y-1">
              <p><span className="font-bold">Qualification:</span> {exam.qualification || "Refer to official advertisement"}</p>
              <p><span className="font-bold">Age Limit:</span> {exam.age_limit || "As per government guidelines"}</p>
              <p><span className="font-bold">Total Vacancies:</span> {exam.vacancy_count ? exam.vacancy_count.toLocaleString("en-IN") : "Specified in official PDF"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Footer Component ──────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-[#0F1C30] text-white mt-12">
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
          {
            title: "Quick Links",
            links: [
              { label: "Latest Jobs", path: "/latest-jobs" },
              { label: "Results", path: "/results" },
              { label: "Admit Card", path: "/admit-card" },
              { label: "Syllabus", path: "/syllabus" },
              { label: "Answer Key", path: "/answer-key" },
            ],
          },
          {
            title: "Categories",
            links: [
              { label: "SSC Jobs", path: "/category?cat=ssc" },
              { label: "Railway Jobs", path: "/category?cat=railway" },
              { label: "Banking Jobs", path: "/category?cat=banking" },
              { label: "Defence Jobs", path: "/category?cat=defence" },
              { label: "State PSC", path: "/category?cat=state-psc" },
            ],
          },
          {
            title: "Resources",
            links: [
              { label: "About Us", path: "#" },
              { label: "Contact", path: "#" },
              { label: "Privacy Policy", path: "#" },
              { label: "Terms of Use", path: "#" },
              { label: "Sitemap", path: "#" },
            ],
          },
        ].map(({ title, links }) => (
          <div key={title}>
            <h4 className="font-bold text-sm uppercase tracking-wider text-white/80 mb-4">{title}</h4>
            <ul className="space-y-2.5">
              {links.map((link) => (
                <li key={link.label}>
                  <Link to={link.path} className="text-white/50 hover:text-[#FF7A00] text-sm transition-colors flex items-center gap-1.5 group">
                    <ChevronRight size={12} className="text-white/20 group-hover:text-[#FF7A00] flex-shrink-0" />
                    {link.label}
                  </Link>
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

// ── Main Home View Component ──────────────────────────────────────────────────

function HomeView({
  searchQuery,
  setSearchQuery,
  selectedState,
  setSelectedState,
  isScrolledPastHero,
  exams,
  loading,
  error,
  allExams,
  dbStates,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedState: string;
  setSelectedState: (s: string) => void;
  isScrolledPastHero: boolean;
  exams: ExamRow[];
  loading: boolean;
  error: string | null;
  allExams: ExamRow[];
  dbStates: DbState[];
}) {
  return (
    <>
      <Hero
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedState={selectedState}
        setSelectedState={setSelectedState}
        isScrolledPastHero={isScrolledPastHero}
        allExams={allExams}
        dbStates={dbStates}
      />
      <HomeJobListings
        exams={exams}
        loading={loading}
        error={error}
        selectedState={selectedState}
        searchQuery={searchQuery}
      />
    </>
  );
}

// ── App Container Component ───────────────────────────────────────────────────

function AppContent() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [allJobTags, setAllJobTags] = useState<JobTag[]>([]);
  const [dbStates, setDbStates] = useState<DbState[]>([]);
  const [tickerItems, setTickerItems] = useState<string[]>([]);
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("All");

  // Scroll listener for Header Search Bar animation
  const [isScrolledPastHero, setIsScrolledPastHero] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 220) {
        setIsScrolledPastHero(true);
      } else {
        setIsScrolledPastHero(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    async function loadAll() {
      try {
        const today = new Date().toISOString().split("T")[0];

        let examsData: any[] = [];
        let jobTagsData: any[] = [];
        let catsData: any[] = [];
        let statesData: any[] = [];

        // Fetch exams with categories, job tags, and states
        const examsFullRes = await supabase
          .from("exams")
          .select("id,title,slug,department,qualification,age_limit,description,application_start,application_end,exam_date,status,official_link,vacancy_count,is_all_india,created_at,categories(id,name,slug),exam_job_tags(job_tags(id,name,slug,color)),exam_states(states(id,name,code))")
          .order("created_at", { ascending: false })
          .limit(100);

        if (examsFullRes.error) {
          console.warn("[JobAlert] full join failed, falling back:", examsFullRes.error.message);
          const examsBasicRes = await supabase
            .from("exams")
            .select("id,title,slug,department,qualification,age_limit,description,application_start,application_end,exam_date,status,official_link,vacancy_count,is_all_india,created_at,categories(id,name,slug)")
            .order("created_at", { ascending: false })
            .limit(100);
          if (examsBasicRes.error) throw examsBasicRes.error;
          examsData = examsBasicRes.data ?? [];
        } else {
          examsData = examsFullRes.data ?? [];
        }

        // Fetch categories
        const catsRes = await supabase.from("categories").select("id,name,slug").order("name");
        if (catsRes.error) throw catsRes.error;
        catsData = catsRes.data ?? [];

        // Fetch job tags
        const jobTagsRes = await supabase.from("job_tags").select("id,name,slug,color").order("name");
        if (!jobTagsRes.error) {
          jobTagsData = jobTagsRes.data ?? [];
        }

        // Fetch states dynamically (Fix 2)
        const statesRes = await supabase.from("states").select("id,name,code").order("name");
        if (!statesRes.error) {
          statesData = statesRes.data ?? [];
        }

        // Fetch count metrics & notifications
        const [
          notifsRes,
          activeCountRes,
          resultCountRes,
          admitCountRes,
          answerCountRes,
          syllabusCountRes,
          examCalRes,
        ] = await Promise.all([
          supabase.from("notifications").select("type,title").order("published_at", { ascending: false }).limit(20),
          supabase.from("exams").select("*", { count: "exact", head: true }).in("status", ["active", "upcoming"]),
          supabase.from("notifications").select("*", { count: "exact", head: true }).eq("type", "result"),
          supabase.from("notifications").select("*", { count: "exact", head: true }).eq("type", "admit_card"),
          supabase.from("notifications").select("*", { count: "exact", head: true }).eq("type", "answer_key"),
          supabase.from("notifications").select("*", { count: "exact", head: true }).eq("type", "syllabus"),
          supabase.from("exams").select("*", { count: "exact", head: true }).gte("exam_date", today),
        ]);

        const normalizedExams = examsData.map((e: any) => ({
          ...e,
          exam_job_tags: e.exam_job_tags ?? [],
          exam_states: e.exam_states ?? [],
          is_all_india: e.is_all_india ?? false,
        })) as ExamRow[];

        setExams(normalizedExams);
        setCategories(catsData);
        setAllJobTags(jobTagsData);
        setDbStates(statesData);
        setTickerItems((notifsRes.data ?? []).map(fmtTicker));

        setCatCounts({
          "new-jobs": activeCountRes.count ?? 0,
          result: resultCountRes.count ?? 0,
          admit_card: admitCountRes.count ?? 0,
          answer_key: answerCountRes.count ?? 0,
          syllabus: syllabusCountRes.count ?? 0,
          exam_calendar: examCalRes.count ?? 0,
          cut_off: 0,
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

  // Shared Layout Header Height Measurement (ResizeObserver)
  const [headerHeight, setHeaderHeight] = useState(105);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerRef.current) return;
    const element = headerRef.current;

    const updateHeight = () => {
      if (element) {
        setHeaderHeight(element.getBoundingClientRect().height);
      }
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Toaster position="top-right" />

      {/* Shared Fixed Top Header Container */}
      <div ref={headerRef} className="fixed top-0 left-0 right-0 z-50 bg-[#1A3C6E] shadow-lg">
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedState={selectedState}
          setSelectedState={setSelectedState}
          isScrolledPastHero={isScrolledPastHero}
          allExams={exams}
          dbStates={dbStates}
        />
        <Ticker items={tickerItems} />
      </div>

      {/* Main Content Wrapper with Dynamic Padding-Top Matching Header Height */}
      <main style={{ paddingTop: `${headerHeight}px` }} className="flex-1">
        <Routes>
          <Route
            path="/"
            element={
              <HomeView
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedState={selectedState}
                setSelectedState={setSelectedState}
                isScrolledPastHero={isScrolledPastHero}
                exams={exams}
                loading={loading}
                error={error}
                allExams={exams}
                dbStates={dbStates}
              />
            }
          />
          <Route
            path="/latest-jobs"
            element={
              <LatestJobsPage
                exams={exams}
                loading={loading}
                error={error}
                allJobTags={allJobTags}
                selectedState={selectedState}
              />
            }
          />
          <Route
            path="/category"
            element={
              <CategoryPage
                categories={categories}
                allJobTags={allJobTags}
                catCounts={catCounts}
                exams={exams}
                loading={loading}
                selectedState={selectedState}
              />
            }
          />
          <Route
            path="/results"
            element={
              <NotificationTypePage
                type="result"
                title="Exam Results &amp; Merit Lists"
                subtitle="Latest government recruitment exam results, scorecards, and selection lists."
                icon={CheckSquare}
                emptyTitle="No Results Declared Yet"
                emptyMessage="Check back soon! Official results and merit lists will be published here as soon as they are announced."
              />
            }
          />
          <Route
            path="/admit-card"
            element={
              <NotificationTypePage
                type="admit_card"
                title="Admit Cards &amp; Hall Tickets"
                subtitle="Download official call letters, hall tickets, and admit cards for upcoming competitive exams."
                icon={FileText}
                emptyTitle="No Admit Cards Available Yet"
                emptyMessage="Admit card download links and official exam call letters will be listed here when released."
              />
            }
          />
          <Route
            path="/syllabus"
            element={
              <NotificationTypePage
                type="syllabus"
                title="Syllabus &amp; Exam Pattern"
                subtitle="Detailed subject syllabus, exam scheme, and selection pattern for all government recruitment exams."
                icon={BookOpen}
                emptyTitle="No Syllabus Updates Available Yet"
                emptyMessage="Official syllabus documents and exam pattern notifications will appear here."
              />
            }
          />
          <Route
            path="/answer-key"
            element={
              <NotificationTypePage
                type="answer_key"
                title="Answer Keys &amp; Response Sheets"
                subtitle="Official answer keys, candidate response sheets, and objection submission links."
                icon={ClipboardList}
                emptyTitle="No Answer Keys Published Yet"
                emptyMessage="Official answer keys and objection tracking links will be updated here after exams are conducted."
              />
            }
          />
          <Route path="/exam/:slug" element={<ExamDetailPage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
