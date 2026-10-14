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
      <div className="attention-explanation">
        <p>
          {copy(
            "Important events stay in view until you mark them read. New headlines compete on significance, not age.",
            "重要事件会保留到你标记已读。新报道按重要性竞争关注位置，而非只看发布时间。",
            language,
          )}
        </p>
        {language === "both" ? (
          <p className="chinese-text">
            重要事件会保留到你标记已读。新报道按重要性竞争关注位置，而非只看发布时间。
          </p>
        ) : null}
      </div>
      <div className="attention-filter-row">
        <div className="read-filter" role="group" aria-label="Reading status">
          {[
            ["unread", "Unread priorities", "未读重点"],
            ["all", "All assessed", "全部已评估"],
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
          {copy("Order", "排序", language)}
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
