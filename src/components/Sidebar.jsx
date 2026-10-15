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
  UserRound,
  X,
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
}) {
  function navigate(id) {
    setView(id);
    setCategory("all");
    onClose();
  }
  const nav = [
    ["briefing", FileText, "Daily briefing", "每日简报"],
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
          <span>
            NEWS INTELLIGENCE
            <br />
            FOR A MORE CONNECTED WORLD
          </span>
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
              {id === "briefing" || id === "stream" ? (
                <small>
                  {id === "briefing"
                    ? copy(
                        "Ranked events · retained unread",
                        "重要事件 · 未读保留",
                        language,
                      )
                    : copy(
                        "All reporting · newest first",
                        "完整报道 · 按时间排列",
                        language,
                      )}
                </small>
              ) : null}
            </span>
          </button>
        ))}
      </nav>
      <div className="interests">
        <h2>{copy("READING DESKS", "阅读栏目", language)}</h2>
        <p className="desk-nav-hint">{copy("One event, one home. Counts show unread priorities.", "每个事件只归入一个栏目。数字为未读重点数。", language)}</p>
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
              <span className="desk-count">{sectionCounts?.[c.id] || 0}</span>
            </button>
          );
        })}
      </div>
      <div className="schedule">
        <Clock3 size={21} />
        <div>
          <h2>
            {copy("DAILY SCHEDULE", "每日更新", language)}
            <br />
            (US EASTERN)
          </h2>
          <strong>{schedule?.time || "08:00"}</strong>
          <span>
            {copy("Bilingual daily briefing", "中英双语简报", language)}
          </span>
          <small>
            {schedule?.status === "active"
              ? copy("Scheduled in Codex", "已在 Codex 中安排", language)
              : copy("Schedule setup pending", "更新计划待设置", language)}
          </small>
        </div>
      </div>
      <div className="workspace">
        <UserRound size={19} />
        <span>
          {copy("My workspace", "我的工作台", language)}
          <small>{copy("Personal · local", "个人 · 本地", language)}</small>
        </span>
      </div>
      <p className="sidebar-footer">
        A more informed you.
        <br />A more connected world.
      </p>
    </aside>
  );
}
