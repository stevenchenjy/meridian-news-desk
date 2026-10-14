import {
  Bookmark,
  Search,
  ArrowUpRight,
  Check,
  RotateCcw,
  Clock3,
} from "lucide-react";
import {
  categoryName,
  copy,
  bilingual,
  relativeTime,
  categories,
  dateTime,
} from "../lib/format";
import { priorityBand } from "../lib/attention";

export default function StoryList({
  articles,
  bookmarks,
  toggleBookmark,
  pendingBookmarks,
  onOpen,
  language,
  category,
  setCategory,
  search,
  setSearch,
  limit,
  setLimit,
  heading,
  ranked = false,
  demo = false,
  onRead,
  pendingReads = new Set(),
  readMode = "unread",
}) {
  return (
    <section
      className="reporting"
      aria-label={ranked ? "Priority events" : "News stories"}
    >
      <div className="section-heading">
        <h2>{heading || copy("Latest reporting", "最新报道", language)}</h2>
        <span>
          {articles.length}{" "}
          {copy(
            ranked
              ? articles.length === 1
                ? "event"
                : "events"
              : articles.length === 1
                ? "story"
                : "stories",
            ranked ? "个事件" : "篇报道",
            language,
          )}
        </span>
      </div>
      <div className="list-toolbar">
        <div
          className="category-tabs"
          role="group"
          aria-label="Filter stories by category"
        >
          {[{ id: "all", en: "All", zh: "全部" }, ...categories].map((c) => (
            <button
              key={c.id}
              className={category === c.id ? "active" : ""}
              onClick={() => {
                setCategory(c.id);
                setLimit(15);
              }}
              aria-pressed={category === c.id}
            >
              {c.id === "world"
                ? copy("World", "世界", language)
                : c.id === "economy"
                  ? copy("Economy", "经济", language)
                  : c.id === "us"
                    ? copy("US", "美国", language)
                    : c.id === "crisis"
                      ? copy("Crisis", "危机", language)
                      : c.id === "industry"
                        ? copy("Industry", "行业", language)
                        : copy(c.en, c.zh, language)}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={17} />
          <input
            type="search"
            placeholder={copy(
              "Search news, topics or sources…",
              "搜索新闻、话题或来源…",
              language,
            )}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(15);
            }}
            aria-label="Search news"
          />
        </label>
      </div>
      {articles.length === 0 ? (
        <div className="empty-state">
          <Check size={30} />
          <h3>
            {ranked && readMode === "unread"
              ? copy(
                  "No unread priorities here.",
                  "此处暂无未读重点。",
                  language,
                )
              : copy("No stories here yet.", "暂时没有报道。", language)}
          </h3>
          <p>
            {ranked
              ? copy(
                  "Read events remain in All assessed. New reporting is available in News stream.",
                  "已读事件仍保留在“全部已评估”中。新报道可在新闻动态中查看。",
                  language,
                )
              : copy(
                  "Try another topic or search, or refresh your feeds.",
                  "请尝试其他主题或搜索词，或刷新新闻源。",
                  language,
                )}
          </p>
        </div>
      ) : (
        <div>
          {articles.slice(0, limit).map((a, index) => {
            const saved = bookmarks.includes(a.id),
              attention = a.attention,
              band = priorityBand(attention?.importance ?? 0);
            const isRead = Boolean(a.isRead || attention?.isRead);
            const readId = attention?.eventId || a.id;
            return (
              <article
                className={`story-row ${isRead ? "is-read" : ""}`}
                key={attention?.eventId || a.id}
                data-article-id={a.id}
                data-event-id={attention?.eventId}
              >
                <span className="story-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="story-content">
                  <div className="story-meta">
                    <span>{categoryName(a.category, language)}</span>
                    <i />
                    <span>{a.sourceName}</span>
                    <span
                      className="story-age"
                      title={a.publishedAt || "No publication date supplied"}
                    >
                      {relativeTime(a.publishedAt)}
                    </span>
                  </div>
                  {ranked && attention ? (
                    <div className="priority-meta">
                      <strong
                        title={copy(
                          "Editorial importance estimate, not a probability or truth score.",
                          "编辑重要性估计，并非概率或真实性评分。",
                          language,
                        )}
                      >
                        {copy(band.en, band.zh, language)} ·{" "}
                        {attention.importance}/100
                      </strong>
                      <span>
                        {isRead
                          ? copy("Read", "已读", language)
                          : attention.heldUntilRead
                            ? copy("Held until read", "保留至已读", language)
                            : `${copy("Review by", "复核日期", language)} ${dateTime(attention.relevanceUntil)}`}
                      </span>
                      {attention.needsReview ? (
                        <span className="review-due">
                          <Clock3 size={12} />
                          {copy("Review due", "待复核", language)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <button className="story-title" onClick={() => onOpen(a)}>
                    {a.title}
                  </button>
                  <p className="story-excerpt">
                    {a.summary
                      ? bilingual(a.summary, language)
                      : language === "zh"
                        ? "中文摘要待生成，可查看原文。"
                        : a.excerpt ||
                          copy(
                            "Open the source to read the full report.",
                            "请打开原文阅读完整报道。",
                            language,
                          )}
                  </p>
                  {language === "both" ? (
                    <p
                      className={`chinese-text ${!a.summary?.zh ? "translation-pending" : ""}`}
                    >
                      {a.summary?.zh ||
                        "中文摘要待生成 · 已进入收集后的双语处理待办。"}
                    </p>
                  ) : null}
                  {ranked && attention?.reason ? (
                    <div className="ranking-reason">
                      <span>
                        {copy("Why it stays: ", "关注理由：", language)}
                      </span>
                      {bilingual(attention.reason, language)}
                      {language === "both" ? (
                        <p className="chinese-text">{attention.reason.zh}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {a.isReviewedSnapshot ? (
                    <p className="snapshot-note">
                      {copy(
                        "Last reviewed version. Source content has changed; a new review is needed.",
                        "显示上次已核验版本。来源内容已变化，需要重新复核。",
                        language,
                      )}
                    </p>
                  ) : null}
                  <div className="story-footer">
                    <div>
                      {a.sourceUnavailable || a.isStale ? (
                        <span className="cache-note">
                          {copy(
                            "Cached · check source status",
                            "缓存内容 · 请查看来源状态",
                            language,
                          )}{" "}
                          ·{" "}
                        </span>
                      ) : null}
                      <span
                        className={`provenance ${a.analysis ? "reviewed" : ""}`}
                      >
                        {demo
                          ? copy(
                              "Sample bilingual analysis · fictional",
                              "双语示例分析 · 虚构",
                              language,
                            )
                          : a.analysis
                            ? copy(
                                "Sourced bilingual analysis",
                                "有来源的双语分析",
                                language,
                              )
                            : a.summaryProvenance?.kind ===
                                "headline_translation"
                              ? copy(
                                  "Publisher headline translated · not analyzed",
                                  "发布者标题翻译 · 尚未分析",
                                  language,
                                )
                              : a.summary?.zh
                                ? copy(
                                    "Publisher excerpt translated · not analyzed",
                                    "发布者摘要翻译 · 尚未分析",
                                    language,
                                  )
                                : copy(
                                    "Source excerpt · translation pending",
                                    "来源摘要 · 翻译待处理",
                                    language,
                                  )}
                      </span>
                    </div>
                    <div className="story-reading-actions">
                      <a href={a.url} target="_blank" rel="noreferrer">
                        {demo
                          ? copy("Example reference", "示例链接", language)
                          : copy("Read source", "阅读原文", language)}
                        <ArrowUpRight size={13} />
                      </a>
                      {onRead ? (
                        <button
                          className={`mark-read ${isRead ? "is-read" : ""}`}
                          disabled={pendingReads.has(readId)}
                          onClick={() => onRead(a, !isRead)}
                          aria-label={`${isRead ? "Mark unread" : "Mark read"} ${a.title}`}
                        >
                          {isRead ? (
                            <RotateCcw size={13} />
                          ) : (
                            <Check size={13} />
                          )}{" "}
                          {isRead
                            ? copy("Mark unread", "标为未读", language)
                            : copy("Mark read", "标为已读", language)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  className={`icon-button bookmark ${saved ? "saved" : ""}`}
                  onClick={() => toggleBookmark(a.id)}
                  disabled={pendingBookmarks.has(a.id)}
                  aria-label={`${saved ? "Unsave" : "Save"} ${a.title}`}
                  aria-pressed={saved}
                >
                  <Bookmark size={20} fill={saved ? "currentColor" : "none"} />
                </button>
              </article>
            );
          })}
        </div>
      )}
      {articles.length > limit ? (
        <button className="load-more" onClick={() => setLimit((n) => n + 15)}>
          {copy("Load more reporting", "加载更多报道", language)} <span>↓</span>
        </button>
      ) : null}
    </section>
  );
}
