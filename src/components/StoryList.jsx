import {
  Bookmark,
  Search,
  ArrowUpRight,
  Check,
  RotateCcw,
  Clock3,
} from "lucide-react";
import {
  copy,
  relativeTime,
  dateTime,
} from "../lib/format";
import { priorityBand } from "../lib/attention";
import { readingSections, sectionName, sectionForArticle } from "../lib/sections";
import { articleOpening, editorialHeadline, editorialHeadlines, reviewedEditorial } from "../lib/editorial";

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
  assignments,
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
          aria-label="Filter stories by reading desk"
        >
          {[{ id: "all", shortEn: "All", shortZh: "全部" }, ...readingSections].map((c) => (
            <button
              key={c.id}
              className={category === c.id ? "active" : ""}
              onClick={() => {
                setCategory(c.id);
                setLimit(15);
              }}
              aria-pressed={category === c.id}
            >
              {copy(c.shortEn, c.shortZh, language)}
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
                  "No unread events.",
                  "暂无未读事件。",
                  language,
                )
              : copy("No stories found.", "暂无匹配报道。", language)}
          </h3>
        </div>
      ) : (
        <div>
          {articles.slice(0, limit).map((a, index) => {
            const saved = bookmarks.includes(a.id),
              attention = a.attention,
              band = priorityBand(attention?.importance ?? 0);
            const isRead = Boolean(a.isRead || attention?.isRead);
            const readId = attention?.eventId || a.id;
            const headlines = ranked ? editorialHeadlines(a) : null;
            const opening = ranked ? articleOpening(a) : a.summary;
            const openingText = language === 'zh' ? opening?.zh || a.summary?.zh : typeof opening === 'string' ? opening : opening?.en;
            return (
              <article
                className={`story-row ${isRead ? "is-read" : ""}`}
                key={ranked ? attention?.eventId || a.id : a.id}
                data-article-id={a.id}
                data-event-id={attention?.eventId}
              >
                <span className="story-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="story-content">
                  <div className="story-meta">
                    <span>{sectionName(sectionForArticle(a, assignments), language)}</span>
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
                    {ranked ? editorialHeadline(a, language) : a.title}
                  </button>
                  {ranked && language === 'both' && headlines?.zh && headlines.zh !== headlines.en ? <p className="story-title-zh" lang="zh-Hans">{headlines.zh}</p> : null}
                  <p className="story-excerpt">
                    {openingText
                      ? openingText
                      : language === "zh"
                        ? "中文摘要待生成，可查看原文。"
                        : a.excerpt ||
                          copy(
                            "Open the source to read the full report.",
                            "请打开原文阅读完整报道。",
                            language,
                          )}
                  </p>
                  {language === "both" && (!ranked || opening?.zh) ? (
                    <p
                      className={`chinese-text ${!opening?.zh ? "translation-pending" : ""}`}
                    >
                      {opening?.zh ||
                        "中文摘要待生成。"}
                    </p>
                  ) : null}
                  {a.isReviewedSnapshot ? (
                    <p className="snapshot-note">
                      {copy(
                        "Source changed · review due.",
                        "来源已变化 · 待复核。",
                        language,
                      )}
                    </p>
                  ) : null}
                  <div className="story-footer">
                    <div>
                      {a.sourceUnavailable || a.isStale ? (
                        <span className="cache-note">
                          {copy(
                            "Cached",
                            "缓存",
                            language,
                          )}{" "}
                          ·{" "}
                        </span>
                      ) : null}
                      <span
                        className={`provenance ${reviewedEditorial(a) ? "reviewed" : ""}`}
                      >
                        {demo
                          ? copy(
                              "Demo · fictional",
                              "虚构演示",
                              language,
                            )
                          : reviewedEditorial(a)
                            ? copy(
                                "Reviewed analysis",
                                "已核查分析",
                                language,
                              )
                            : a.summaryProvenance?.kind ===
                                "headline_translation"
                              ? copy(
                                  "Headline · unreviewed",
                                  "标题翻译 · 未分析",
                                  language,
                                )
                              : a.summary?.zh
                                ? copy(
                                    "Source summary · unreviewed",
                                    "来源摘要 · 未分析",
                                    language,
                                  )
                                : copy(
                                    "Translation pending",
                                    "待翻译",
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
