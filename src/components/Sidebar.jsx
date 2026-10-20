import {
  FileText,
  List,
  Bookmark,
  Database,
  Globe2,
  ChartNoAxesColumnIncreasing,
  Sprout,
  BriefcaseBusiness,
  Clock3,
  X,
  BookOpen,
} from "lucide-react";
import { copy } from "../lib/format";
import { readingSections } from "../lib/sections";
const interestIcons = [
  Globe2,
  ChartNoAxesColumnIncreasing,
  Sprout,
  BriefcaseBusiness,
];
export default function Sidebar({
  view,
  setView,
  category,
  setCategory,
  language,
  open,
  onClose,
  schedule,
  onOpenSection,
  sectionCounts,
  onOpenBackground,
}) {
  function navigate(id) {
    if (id === "background") {
      onOpenBackground();
      return;
    }
    setView(id);
    setCategory("all");
    onClose();
  }
  const nav = [
    ["briefing", FileText, "Daily briefing", "每日简报"],
    ["background", BookOpen, "Background library", "背景知识库"],
    ["stream", List, "News stream", "新闻动态"],
    ["saved", Bookmark, "Saved stories", "收藏报道"],
    ["sources", Database, "Sources & status", "来源与状态"],
  ];
  return (
    <aside
      className={`sidebar ${open ? "is-open" : ""}`}
      aria-label="Main navigation"
    >
      <div className="brand">
        <span className="brand-mark">M</span>
        <div>
          <strong>MERIDIAN</strong>
        </div>
        <button
          className="mobile-close icon-button"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X />
        </button>
      </div>
      <nav className="primary-nav">
        {nav.map(([id, Icon, en, zh]) => (
          <button
            key={id}
            onClick={() => navigate(id)}
            className={view === id && category === "all" ? "selected" : ""}
            aria-current={
              view === id && category === "all" ? "page" : undefined
            }
          >
            <Icon size={20} />
            <span className="nav-label">
              {copy(en, zh, language)}
            </span>
          </button>
        ))}
      </nav>
      <div className="interests">
        <h2>{copy("READING DESKS", "阅读栏目", language)}</h2>
        {readingSections.map((c, i) => {
          const Icon = interestIcons[i];
          return (
            <button
              key={c.id}
              className={view === "briefing" && category === c.id ? "selected" : ""}
              aria-current={view === "briefing" && category === c.id ? "page" : undefined}
              onClick={() => {
                onOpenSection(c.id);
                onClose();
              }}
            >
              <Icon size={21} />
              <span className="desk-nav-label">{copy(c.en, c.zh, language)}</span>
              <span className="desk-count" title={copy("Unread events", "未读事件", language)}>{sectionCounts?.[c.id] || 0}</span>
            </button>
          );
        })}
      </div>
      <div className="schedule">
        <Clock3 size={21} />
        <div>
          <h2>
            {copy("DAILY · EASTERN", "每日 · 美东", language)}
          </h2>
          <strong>{schedule?.time || "08:00"}</strong>
          <small>
            {schedule?.status === "active"
              ? copy("Scheduled", "已安排", language)
              : copy("Not scheduled", "未安排", language)}
          </small>
        </div>
      </div>
    </aside>
  );
}
