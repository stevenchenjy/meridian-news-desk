import { copy } from "../lib/format";

export default function AttentionControls({
  mode,
  setMode,
  sort,
  setSort,
  language,
  attention,
}) {
  return (
    <div className="attention-controls">
      <div className="attention-filter-row">
        <div className="read-filter" role="group" aria-label="Reading status" title={copy("Important unread events stay in view.", "重要未读事件持续保留。", language)}>
          {[
            ["unread", "Unread", "未读"],
            ["all", "All", "全部"],
            ["read", "Read", "已读"],
          ].map(([id, en, zh]) => (
            <button
              key={id}
              className={mode === id ? "active" : ""}
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
            >
              {copy(en, zh, language)}
              {id === "unread" && attention
                ? ` (${attention.unreadCount})`
                : ""}
            </button>
          ))}
        </div>
        <label>
          <select
            aria-label="Priority order"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="importance">
              {copy("Importance", "重要性", language)}
            </option>
            <option value="newest">
              {copy("Newest update", "最新进展", language)}
            </option>
          </select>
        </label>
      </div>
    </div>
  );
}
