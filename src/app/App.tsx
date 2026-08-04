import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  Info,
  Landmark,
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

interface ExamDetails {
  overview?: string;
  vacancy_details?: string;
  eligibility?: string;
  age_limit?: string;
  stipend_benefits?: string;
  selection_process?: string;
  how_to_apply?: string;
  application_fee?: string;
  important_dates_note?: string;
}

interface ExamRow {
  id: string;
  title: string;
  slug: string;
  department: string | null;
  qualification: string | null;
  age_limit: string | null;
  description: string | null;
  details?: ExamDetails | null;
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
function matchExamQuery(e: ExamRow, query: string): boolean {
  const term = query.toLowerCase().trim();
  if (!term) return false;

  // 1. Match exam title
  if (e.title.toLowerCase().includes(term)) return true;

  // 2. Match department name
  if ((e.department ?? "").toLowerCase().includes(term)) return true;

  // 3. Match category name & category slug (e.g. "Defence", "defence", "Banking", "banking", "Railway", "railway", "SSC", "ssc", "State PSC")
  if ((e.categories?.name ?? "").toLowerCase().includes(term)) return true;
  if ((e.categories?.slug ?? "").toLowerCase().includes(term)) return true;

  // 4. Match job role tags (e.g. "officer", "clerk", "constable", "teacher", "engineer")
  if (
    e.exam_job_tags?.some(
      (ejt) =>
        (ejt.job_tags?.name ?? "").toLowerCase().includes(term) ||
        (ejt.job_tags?.slug ?? "").toLowerCase().includes(term)
    )
  ) {
    return true;
  }

  return false;
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
    const searchMatch = !q || matchExamQuery(e, q);

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
    ? allExams.filter((e) => matchExamQuery(e, debouncedValue)).slice(0, 10)
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
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 z-[100] overflow-hidden text-left"
          >
            {suggestions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#5B6880]">
                No matching exams found for &ldquo;{debouncedValue.trim()}&rdquo;
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
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

interface TickerItem {
  id: string;
  type: string;
  title: string;
  text: string;
  examSlug?: string | null;
  pdfUrl?: string | null;
}

function formatTickerItem(n: any): TickerItem {
  const icons: Record<string, string> = {
    new_job: "🔔",
    result: "✅",
    admit_card: "📄",
    answer_key: "📋",
    syllabus: "📚",
  };
  const icon = icons[n.type] ?? "🔔";
  const examSlug = n.exams?.slug || null;
  return {
    id: n.id || Math.random().toString(),
    type: n.type,
    title: n.title,
    text: `${icon} ${n.title}`,
    examSlug: examSlug,
    pdfUrl: n.pdf_url || null,
  };
}

function Ticker({ items }: { items: TickerItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-[#1A3C6E] text-white py-2 overflow-hidden relative border-b border-white/10">
      <div className="flex items-center">
        <div className="flex-shrink-0 flex items-center gap-2 bg-[#FF7A00] px-4 py-1 z-10 relative">
          <TrendingUp size={13} />
          <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">Live Updates</span>
        </div>
        <div className="overflow-hidden flex-1 ml-2">
          <div
            className="flex gap-12 whitespace-nowrap hover:[animation-play-state:paused]"
            style={{
              animation: `marquee ${Math.max(30, items.length * 6)}s linear infinite`,
              willChange: "transform",
            }}
          >
            {[...items, ...items].map((item, i) => {
              const targetPath = item.examSlug
                ? `/exam/${item.examSlug}`
                : item.type === "result"
                ? "/results"
                : item.type === "admit_card"
                ? "/admit-card"
                : item.type === "answer_key"
                ? "/answer-key"
                : item.type === "syllabus"
                ? "/syllabus"
                : "/latest-jobs";

              return item.pdfUrl ? (
                <a
                  key={`${item.id}-${i}`}
                  href={item.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm text-white/90 hover:text-[#FF7A00] hover:underline inline-flex items-center gap-2 transition-all pointer-events-auto"
                >
                  <span>{item.text}</span>
                  <span className="text-white/30 ml-2">|</span>
                </a>
              ) : (
                <Link
                  key={`${item.id}-${i}`}
                  to={targetPath}
                  className="text-xs sm:text-sm text-white/90 hover:text-[#FF7A00] hover:underline inline-flex items-center gap-2 transition-all pointer-events-auto"
                >
                  <span>{item.text}</span>
                  <span className="text-white/30 ml-2">|</span>
                </Link>
              );
            })}
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

// ── Web Push Subscription Helpers ──────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function handleSubscribePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    toast.error("Push notifications are not supported by your browser.");
    return;
  }

  const publicVapidKey =
    import.meta.env.VITE_VAPID_PUBLIC_KEY ||
    "BPczYNuZboJYeyYhVuzYcSwhBp4BzVmrHMxBQMBlawTDkhhM6oN_oEPIvBf_KymR-u9SA0fr43uHZC5Ea2tAPnE";

  try {
    const permission = await Notification.requestPermission();
    if (permission === "denied") {
      toast.error("Notification permission was denied in your browser settings.");
      return;
    }
    if (permission !== "granted") {
      return;
    }

    const register = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    const subscription = await register.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
    });

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint;
    const keys = subJson.keys;

    if (!endpoint || !keys) {
      throw new Error("Failed to generate push subscription parameters.");
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint,
        keys,
        created_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      console.warn("DB subscription insert warning:", error.message);
    }

    toast.success("Job Alerts Enabled! You will receive push notifications when new exams are posted.");
  } catch (err: any) {
    console.error("Push subscription failed:", err);
    toast.error(err.message || "Failed to subscribe to job alerts.");
  }
}

// ── Header Component ─────────────────────────────────────────────────────────

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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [siteSettings, setSiteSettings] = useState<{
    whatsapp_url?: string;
    telegram_url?: string;
  }>({
    whatsapp_url: "https://chat.whatsapp.com/jobalertin",
    telegram_url: "https://t.me/jobalertin",
  });

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("*")
      .eq("id", "default")
      .single()
      .then(({ data }) => {
        if (data) setSiteSettings(data);
      });
  }, []);

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

          {/* Mobile Search Toggle Icon (below 640px) */}
          <AnimatePresence>
            {shouldShowHeaderSearch && (
              <button
                type="button"
                onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                className="sm:hidden flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white p-2 rounded-xl transition-colors flex-shrink-0"
                aria-label="Search"
              >
                <Search size={18} />
              </button>
            )}
          </AnimatePresence>

          {/* Inline Header Search Bar (Tablet: sm to lg, Desktop: lg+) */}
          <AnimatePresence>
            {shouldShowHeaderSearch && (
              <motion.form
                initial={{ opacity: 0, y: -15, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.96 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onSubmit={handleSearchSubmit}
                className="hidden sm:flex items-center bg-white rounded-xl p-1 flex-1 max-w-xs md:max-w-md lg:max-w-lg mx-2 shadow-md relative z-50 pointer-events-auto"
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

                {/* State selector visible on desktop (lg+) */}
                <div className="hidden lg:flex items-center gap-1 px-2 border-l border-gray-200">
                  <MapPin size={12} className="text-[#1A3C6E]/50 flex-shrink-0" />
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="outline-none text-xs text-[#0F1C30] bg-transparent cursor-pointer pr-1 max-w-[110px] truncate"
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

          {/* Action Buttons: WhatsApp, Telegram & Notify Me */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {siteSettings?.whatsapp_url && (
              <a
                href={siteSettings.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center justify-center bg-[#25D366] hover:bg-[#20bd5a] text-white p-2 rounded-lg transition-transform hover:scale-105 shadow-md"
                title="Join WhatsApp Channel"
                aria-label="Join WhatsApp Channel"
              >
                <WhatsAppIcon size={16} />
              </a>
            )}

            {siteSettings?.telegram_url && (
              <a
                href={siteSettings.telegram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center justify-center bg-[#229ED9] hover:bg-[#1d8cb0] text-white p-2 rounded-lg transition-transform hover:scale-105 shadow-md"
                title="Join Telegram Channel"
                aria-label="Join Telegram Channel"
              >
                <TelegramIcon size={16} />
              </a>
            )}

            <button
              onClick={handleSubscribePush}
              className="flex items-center gap-1.5 bg-[#FF7A00] hover:bg-[#E86E00] text-white text-xs sm:text-sm font-semibold px-2.5 sm:px-3 py-2 rounded-lg transition-colors shadow-md whitespace-nowrap"
            >
              <Bell size={14} />
              <span className="hidden sm:inline">Notify Me</span>
            </button>
            <button className="lg:hidden text-white/80 hover:text-white p-1.5" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Expandable Search Drawer (below 640px) */}
      <AnimatePresence>
        {shouldShowHeaderSearch && mobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="sm:hidden bg-[#122C52] border-t border-white/10 px-4 py-3 shadow-xl relative z-40"
          >
            <form
              onSubmit={(e) => {
                handleSearchSubmit(e);
                setMobileSearchOpen(false);
              }}
              className="flex flex-col gap-2.5"
            >
              <div className="flex items-center bg-white rounded-xl px-3 py-1.5 shadow-sm relative z-50">
                <Search size={16} className="text-[#1A3C6E]/50 mr-2 flex-shrink-0" />
                <SearchAutocomplete
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelectExam={(slug) => {
                    navigate(`/exam/${slug}`);
                    setMobileSearchOpen(false);
                  }}
                  allExams={allExams}
                  placeholder="Search exams, departments..."
                  inputClassName="outline-none text-[#0F1C30] placeholder-gray-400 text-sm w-full bg-transparent"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-white rounded-xl px-3 py-2 shadow-sm">
                  <MapPin size={14} className="text-[#1A3C6E]/50 mr-2 flex-shrink-0" />
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="outline-none text-xs text-[#0F1C30] bg-transparent cursor-pointer w-full"
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
                  onClick={() => setMobileSearchOpen(false)}
                  className="bg-[#FF7A00] hover:bg-[#E86E00] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-md flex-shrink-0"
                >
                  Search Jobs
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

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

          {/* Mobile Community Join Buttons */}
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2 mt-3">
            {siteSettings?.whatsapp_url && (
              <a
                href={siteSettings.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors"
              >
                <WhatsAppIcon size={16} />
                <span>Join WhatsApp Channel</span>
              </a>
            )}
            {siteSettings?.telegram_url && (
              <a
                href={siteSettings.telegram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1d8cb0] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors"
              >
                <TelegramIcon size={16} />
                <span>Join Telegram Channel</span>
              </a>
            )}
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
    <section className="bg-gradient-to-br from-[#1A3C6E] via-[#1E4780] to-[#0F2448] pt-12 pb-16 px-4 relative z-10">
      {/* Decorative grid pattern & accent blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF7A00]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
      </div>

      <div className="max-w-4xl mx-auto relative text-center z-10">
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
                className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-2 flex flex-col sm:flex-row gap-2 relative z-30 pointer-events-auto"
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

  const activeJobTags = allJobTags.filter((tag) =>
    exams.some((e) => e.exam_job_tags?.some((ejt) => ejt.job_tags?.slug === tag.slug || ejt.job_tag_id === tag.id))
  );

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

        {/* Job Type Filter Chips (Fix 6b: Only show tags with count > 0) */}
        {activeJobTags.length > 0 && (
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
              {activeJobTags.map((tag) => {
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

// ── Text Cleaning & Accordion Component for Exam Details ─────────────────────

function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  let s = text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\uFFFD\s*\./g, "")
    .replace(/\uFFFD/g, "")
    .replace(/•\s*\./g, "")
    .replace(/•\s*•/g, "•")
    .trim();

  const rawLines = s.split("\n");
  const cleanedLines: string[] = [];

  for (let line of rawLines) {
    let l = line.trim();
    l = l.replace(/^•\s*\./, "").replace(/•\s*\.$/, "").replace(/•\s*\./g, "").trim();
    if (l) cleanedLines.push(l);
  }

  return cleanedLines.join("\n");
}

function DetailSection({
  title,
  content,
  icon: Icon,
}: {
  title: string;
  content?: string | null;
  icon?: any;
}) {
  if (!content || !content.trim()) return null;

  const cleaned = cleanText(content);
  if (!cleaned) return null;
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);

  return (
    <div className="border-b border-gray-100 last:border-0 pb-6 last:pb-0">
      <h4 className="text-base sm:text-lg font-bold text-[#1A3C6E] mb-2.5 flex items-center gap-2">
        {Icon && <Icon size={18} className="text-[#FF7A00]" />}
        {title}
      </h4>
      <div className="text-sm text-[#0F1C30] leading-relaxed">
        {lines.length > 1 || lines.some((l) => l.trim().startsWith("•") || l.trim().startsWith("-")) ? (
          <ul className="space-y-2.5 pl-0.5">
            {lines.map((line, idx) => {
              const cleanLine = line.replace(/^[•\-\*]\s*/, "").replace(/\s*•\s*\.$/, "").trim();
              if (!cleanLine) return null;
              return (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="text-[#FF7A00] font-bold text-sm leading-none mt-1">•</span>
                  <span className="flex-1 text-[#0F1C30] leading-relaxed">{cleanLine}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="whitespace-pre-line text-sm text-[#0F1C30] leading-relaxed">{cleaned}</p>
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
  const [examLinks, setExamLinks] = useState<{ id: string; label: string; url: string; display_order: number }[]>([]);
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

        // Fetch exam_links
        const { data: linksData } = await supabase
          .from('exam_links')
          .select('id, label, url, display_order')
          .eq('exam_id', data.id)
          .order('display_order');
        setExamLinks(linksData ?? []);

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
      } catch (err: any) {
        console.error("Error loading exam detail:", err);
        setError("Could not load exam details. Please refresh or try again.");
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchExam();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-[#5B6880]">
        <div className="w-10 h-10 border-4 border-[#1A3C6E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="font-semibold text-sm">Loading exam details...</p>
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

  // ── Info boxes active state ──
  const hasVacancy = Boolean(exam.vacancy_count && Number(exam.vacancy_count) > 0);
  const hasAppEnd = Boolean(exam.application_end && exam.application_end.trim());
  const hasQualification = Boolean(exam.qualification && exam.qualification.trim());
  const hasAgeLimit = Boolean(exam.age_limit && exam.age_limit.trim());
  const activeInfoCount = [hasVacancy, hasAppEnd, hasQualification, hasAgeLimit].filter(Boolean).length;

  const hasShortStats = hasVacancy || hasAppEnd;
  const shortStatsCount = [hasVacancy, hasAppEnd].filter(Boolean).length;
  const hasDetailedStats = hasQualification || hasAgeLimit;
  const detailedStatsCount = [hasQualification, hasAgeLimit].filter(Boolean).length;

  // ── Dates & Links active state ──
  const hasAppStart = Boolean(exam.application_start && exam.application_start.trim());
  const hasExamDate = Boolean(exam.exam_date && exam.exam_date.trim());
  const hasOfficialLink = Boolean(exam.official_link && exam.official_link.trim());
  const activeDatesCount = [hasAppStart, hasAppEnd, hasExamDate].filter(Boolean).length;
  const hasDatesOrLinksSection = activeDatesCount > 0 || hasOfficialLink;

  const hasDescription = Boolean(exam.description && exam.description.trim().length > 0);
  const hasNotificationSection = hasDescription;

  // ── Safety check if literally no details exist ──
  const isCompletelyEmptyPage = activeInfoCount === 0 && !hasDatesOrLinksSection && !hasNotificationSection;

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

      {/* Dynamic Key Details Section — renders ONLY if at least 1 box has data */}
      {activeInfoCount > 0 && (
        <div className="space-y-4 mb-6">
          {/* Top Row: Short Stat Cards (Total Posts & Last Date to Apply) */}
          {hasShortStats && (
            <div className={`grid grid-cols-1 ${shortStatsCount === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2'} gap-4`}>
              {hasVacancy && (
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#FF7A00] flex items-center justify-center mb-2">
                    <Briefcase size={20} />
                  </div>
                  <span className="text-xs text-[#5B6880] block font-medium">Total Posts</span>
                  <span className="text-sm md:text-base font-bold text-[#0F1C30]">
                    {exam.vacancy_count!.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {hasAppEnd && (
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1A3C6E] flex items-center justify-center mb-2">
                    <Clock size={20} />
                  </div>
                  <span className="text-xs text-[#5B6880] block font-medium">Last Date to Apply</span>
                  <span className={`text-sm font-bold ${jobStatus === "closing-soon" ? "text-[#E03E3E]" : "text-[#0F1C30]"}`}>
                    {fmtDate(exam.application_end)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Bottom Row: Detailed Info Cards (Qualification & Age Limit) */}
          {hasDetailedStats && (
            <div className={`grid grid-cols-1 ${detailedStatsCount === 2 ? 'md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
              {hasQualification && (
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <GraduationCap size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[#5B6880] font-semibold uppercase tracking-wider block mb-1">
                      Qualification
                    </span>
                    <p className="text-sm font-semibold text-[#0F1C30] leading-relaxed whitespace-pre-line">
                      {exam.qualification}
                    </p>
                  </div>
                </div>
              )}

              {hasAgeLimit && (
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Tag size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[#5B6880] font-semibold uppercase tracking-wider block mb-1">
                      Age Limit
                    </span>
                    <p className="text-sm font-semibold text-[#0F1C30] leading-relaxed whitespace-pre-line">
                      {exam.age_limit}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dynamic Dates & Official Website Section — renders ONLY if at least 1 date is filled */}
      {activeDatesCount > 0 && (
        <div className="bg-white rounded-2xl border border-[#1A3C6E]/10 shadow-sm p-6 md:p-8 mb-6">
          <h3 className="text-lg font-bold text-[#0F1C30] mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-[#FF7A00]" /> Important Dates
          </h3>

          <div className={`grid grid-cols-1 ${
            activeDatesCount === 2 ? 'md:grid-cols-2' : activeDatesCount === 3 ? 'md:grid-cols-3' : 'md:grid-cols-1'
          } gap-4`}>
            {hasAppStart && (
              <div className="p-3.5 bg-gray-50 rounded-xl">
                <span className="text-xs text-[#5B6880] block font-medium">Application Start</span>
                <span className="text-sm font-bold text-[#0F1C30]">{fmtDate(exam.application_start)}</span>
              </div>
            )}
            {hasAppEnd && (
              <div className="p-3.5 bg-gray-50 rounded-xl">
                <span className="text-xs text-[#5B6880] block font-medium">Application End</span>
                <span className="text-sm font-bold text-[#0F1C30]">{fmtDate(exam.application_end)}</span>
              </div>
            )}
            {hasExamDate && (
              <div className="p-3.5 bg-gray-50 rounded-xl">
                <span className="text-xs text-[#5B6880] block font-medium">Exam Date</span>
                <span className="text-sm font-bold text-[#0F1C30]">{fmtDate(exam.exam_date)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description Card */}
      {hasDescription && (
        <div className="bg-white rounded-2xl border border-[#1A3C6E]/12 shadow-sm p-6 md:p-8 mb-8">
          <div className="flex items-center gap-2.5 mb-5 border-b border-gray-100 pb-4">
            <FileText size={20} className="text-[#FF7A00]" />
            <h3 className="text-lg font-extrabold text-[#0F1C30]" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Notification Details
            </h3>
          </div>
          <div className="exam-description text-[#374151] text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-xl font-extrabold text-[#1A3C6E] mt-6 mb-3 first:mt-0" style={{ fontFamily: "'Poppins', sans-serif" }}>{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-extrabold text-[#1A3C6E] mt-5 mb-2 first:mt-0" style={{ fontFamily: "'Poppins', sans-serif" }}>{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-bold text-[#1A3C6E] mt-4 mb-2 first:mt-0" style={{ fontFamily: "'Poppins', sans-serif" }}>{children}</h3>,
                h4: ({ children }) => <h4 className="text-sm font-bold text-[#0F1C30] mt-3 mb-1">{children}</h4>,
                p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                strong: ({ children }) => <strong className="font-bold text-[#0F1C30]">{children}</strong>,
                em: ({ children }) => <em className="italic text-[#374151]">{children}</em>,
                ul: ({ children }) => <ul className="mb-3 space-y-1 pl-1">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 space-y-1 pl-1 list-decimal list-inside">{children}</ol>,
                li: ({ children }) => (
                  <li className="flex items-start gap-2">
                    <span className="text-[#FF7A00] font-bold text-sm leading-none mt-1 flex-shrink-0">•</span>
                    <span className="flex-1">{children}</span>
                  </li>
                ),
                hr: () => <hr className="my-4 border-gray-100" />,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-[#FF7A00] pl-4 py-1 my-3 bg-[#FF7A00]/5 rounded-r-lg text-[#374151] italic">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#FF7A00] underline hover:text-[#E86E00] font-medium transition-colors">
                    {children}
                  </a>
                ),
                code: ({ children }) => (
                  <code className="bg-gray-100 text-[#0F1C30] px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-6 rounded-xl border border-gray-200 shadow-sm bg-white">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-[#1A3C6E] text-white font-bold [&_tr]:bg-[#1A3C6E] [&_tr]:hover:bg-[#1A3C6E] [&_th]:bg-[#1A3C6E] [&_th]:text-white">{children}</thead>
                ),
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-gray-200 [&_tr]:even:bg-[#F4F5F7] [&_tr]:odd:bg-white [&_tr]:hover:bg-gray-100/60">{children}</tbody>
                ),
                tr: ({ children }) => (
                  <tr className="transition-colors">
                    {children}
                  </tr>
                ),
                th: ({ children, style }) => (
                  <th
                    style={style}
                    className="px-4 py-3 bg-[#1A3C6E] text-white font-bold text-xs sm:text-sm tracking-wider border-b border-[#1A3C6E] hover:bg-[#1A3C6E] hover:text-white"
                  >
                    {children}
                  </th>
                ),
                td: ({ children, style }) => {
                  const text = typeof children === "string" ? children.trim() : Array.isArray(children) ? children.map(c => typeof c === "string" ? c : "").join("").trim() : "";
                  const isNumeric = /^\d+$/.test(text);
                  return (
                    <td
                      style={style}
                      className={`px-4 py-3 text-xs sm:text-sm text-[#0F1C30] border-t border-gray-100 ${
                        isNumeric ? "text-center" : "text-left"
                      }`}
                    >
                      {children}
                    </td>
                  );
                },
                del: ({ children }) => (
                  <del className="line-through text-gray-400">{children}</del>
                ),
                input: ({ node, ...props }) => (
                  <input
                    {...props}
                    className="mr-2 accent-[#FF7A00] rounded cursor-default"
                  />
                ),
              }}
            >
              {(exam.description ?? '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n')}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Primary Apply Now Action Section at the VERY BOTTOM */}
      {hasOfficialLink && (
        <div className="mt-8 pt-2">
          <a
            href={exam.official_link!}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-3 bg-[#FF7A00] hover:bg-[#E86E00] text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-xl hover:shadow-2xl text-base sm:text-lg group"
          >
            <span>Apply Now on Official Website</span>
            <ExternalLink size={20} className="group-hover:translate-x-1 transition-transform" />
          </a>
          <p className="text-center text-xs text-[#5B6880] mt-2.5">
            You will be redirected to the official government recruitment portal.
          </p>
        </div>
      )}

      {/* Additional Links (exam_links table) */}
      {examLinks.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-bold text-[#0F1C30] uppercase tracking-wider mb-3">Additional Resources</p>
          <div className="flex flex-wrap gap-2">
            {examLinks.map(link => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-[#1A3C6E]/20 bg-[#EEF2F8] hover:bg-[#1A3C6E] hover:border-[#1A3C6E] text-[#1A3C6E] hover:text-white text-xs font-bold transition-all group"
              >
                <ExternalLink size={12} className="flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Extreme Fallback for Completely Empty Exam Notice */}
      {isCompletelyEmptyPage && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-[#5B6880] mb-6">
          <Info size={32} className="mx-auto mb-2 text-[#1A3C6E]/40" />
          <p className="font-semibold text-base text-[#0F1C30]">No detailed information posted yet.</p>
          <p className="text-xs text-[#5B6880] mt-1">Key dates, vacancy counts, and official notification link will be updated here as soon as announced.</p>
        </div>
      )}
    </div>
  );
}

const WhatsAppIcon = ({ size = 14, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 2a10 10 0 0 0-8.66 15L2 22l5.13-1.34A10 10 0 1 0 12 2zm0 18a7.96 7.96 0 0 1-4.07-1.12l-.29-.17-3.03.79.81-2.95-.19-.3A7.96 7.96 0 1 1 12 20z"/>
  </svg>
);

const FacebookIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const TelegramIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

function Footer() {
  const [socials, setSocials] = useState<{
    twitter_url?: string;
    youtube_url?: string;
    instagram_url?: string;
    facebook_url?: string;
    telegram_url?: string;
  }>({
    twitter_url: "https://x.com/jobalertin",
    youtube_url: "https://youtube.com/@jobalertin",
    instagram_url: "https://instagram.com/jobalertin",
    facebook_url: "https://facebook.com/jobalertin",
    telegram_url: "https://t.me/jobalertin",
  });

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("*")
      .eq("id", "default")
      .single()
      .then(({ data }) => {
        if (data) setSocials(data);
      });
  }, []);

  const socialLinks = [
    { icon: Twitter, url: socials.twitter_url, label: "Twitter / X" },
    { icon: Youtube, url: socials.youtube_url, label: "YouTube" },
    { icon: Instagram, url: socials.instagram_url, label: "Instagram" },
    { icon: FacebookIcon, url: socials.facebook_url, label: "Facebook" },
    { icon: TelegramIcon, url: socials.telegram_url, label: "Telegram" },
  ].filter((s) => Boolean(s.url && s.url.trim()));

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
          <div className="flex flex-wrap gap-2.5">
            {socialLinks.map(({ icon: Icon, url, label }, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={label}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#FF7A00] flex items-center justify-center transition-colors text-white"
              >
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
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
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
          .select("id,title,slug,department,qualification,age_limit,description,details,application_start,application_end,exam_date,status,official_link,vacancy_count,is_all_india,created_at,categories(id,name,slug),exam_job_tags(job_tags(id,name,slug,color)),exam_states(states(id,name,code))")
          .order("created_at", { ascending: false })
          .limit(100);

        if (examsFullRes.error) {
          console.warn("[JobAlert] full join failed, falling back:", examsFullRes.error.message);
          const examsBasicRes = await supabase
            .from("exams")
            .select("id,title,slug,department,qualification,age_limit,description,details,application_start,application_end,exam_date,status,official_link,vacancy_count,is_all_india,created_at,categories(id,name,slug)")
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

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        // Fetch count metrics & notifications (Filter notifications strictly for today & join exams slug)
        const [
          notifsRes,
          activeCountRes,
          resultCountRes,
          admitCountRes,
          answerCountRes,
          syllabusCountRes,
          examCalRes,
        ] = await Promise.all([
          supabase
            .from("notifications")
            .select("id,type,title,published_at,pdf_url,exam_id,exams(slug,title)")
            .gte("published_at", startOfToday)
            .order("published_at", { ascending: false })
            .limit(20),
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
        const notifTickerItems: TickerItem[] = (notifsRes.data ?? []).map(formatTickerItem);
        const examTickerItems: TickerItem[] = normalizedExams.slice(0, 10).map((e) => ({
          id: `exam-${e.id}`,
          type: "new_job",
          title: `${e.title} — Recruitment Notification`,
          text: `🔔 ${e.title} — Recruitment Notification`,
          examSlug: e.slug,
          pdfUrl: null,
        }));

        const combinedTickerItems = [...notifTickerItems];
        for (const item of examTickerItems) {
          if (!combinedTickerItems.some(n => n.examSlug === item.examSlug)) {
            combinedTickerItems.push(item);
          }
        }

        setTickerItems(combinedTickerItems);

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
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const { data } = await supabase
        .from("notifications")
        .select("id,type,title,published_at,pdf_url,exam_id,exams(slug,title)")
        .gte("published_at", startOfToday)
        .order("published_at", { ascending: false })
        .limit(20);
      if (data) {
        const notifItems = data.map(formatTickerItem);
        const examItems = exams.slice(0, 10).map((e) => ({
          id: `exam-${e.id}`,
          type: "new_job",
          title: `${e.title} — Recruitment Notification`,
          text: `🔔 ${e.title} — Recruitment Notification`,
          examSlug: e.slug,
          pdfUrl: null,
        }));
        const merged = [...notifItems];
        for (const item of examItems) {
          if (!merged.some(n => n.examSlug === item.examSlug)) {
            merged.push(item);
          }
        }
        setTickerItems(merged);
      }
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
