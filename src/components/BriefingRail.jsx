import { ArrowRight } from "lucide-react";
import { copy, bilingual, dateTime } from "../lib/format";
import { articleForReview } from "../lib/attention";
const types = [
  ["newsroom", "Newsrooms", "新闻媒体"],
  ["official", "Official institutions", "官方机构"],
  ["research", "Policy & research", "政策与研究"],
  ["community", "Community discussions", "社区讨论"],
];
export default function BriefingRail({ data, language, onSources, onOpen }) {
  const brief = data.briefing;
  const healthy = data.sources.filter((s) => s.enabled && s.status === "ok");
  return (
    <aside className="briefing-rail">
      <div className="rail-label">
        <i />
        {copy("BRIEFING NOTES", "简报笔记", language)}
      </div>
      <h2>{copy("What matters", "综合关注", language)}</h2>
      {brief ? (
        <>
          <p>{bilingual(brief.overview, language)}</p>
          {language === "both" ? (
            <p className="chinese-text">{brief.overview.zh}</p>
          ) : null}
          <small className="rail-timestamp">
            {data.collection?.kind === "synthetic_demo"
              ? copy("Demo generated", "演示生成于", language)
              : copy("Analysis prepared", "分析生成于", language)}{" "}
            {dateTime(brief.generatedAt)}
          </small>
          {brief.isStale ? (
            <p className="inline-note">
              {copy(
                "This briefing was prepared for an earlier collection. Compare its evidence with the latest reporting and source status.",
                "此简报基于较早的收集结果，请结合最新报道与来源状态查看证据。",
                language,
              )}
            </p>
          ) : null}
        </>
      ) : (
        <p>
          {copy(
            "Your feeds are collected. The daily Codex briefing will add a balanced, bilingual analysis with traceable evidence. Until then, stories show publisher excerpts.",
            "新闻源已收集。每日 Codex 简报将添加附有可追溯证据的中英双语分析。在此之前，报道显示发布者摘要。",
            language,
          )}
        </p>
      )}
      <section className="watch-section">
        <h2>{copy("What to watch", "后续观察", language)}</h2>
        {brief?.items?.length ? (
          <ol>
            {brief.items.slice(0, 2).map((item, i) => (
              <li key={item.articleId}>
                <span>{i + 1}</span>
                <button
                  onClick={() => onOpen(articleForReview(data, item.articleId))}
                >
                  {bilingual(item.watch, language)}
                  {language === "both" && item.watch?.zh ? (
                    <span className="watch-chinese">{item.watch.zh}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p>
            {copy(
              "Indicators and open questions will appear with the next sourced briefing.",
              "有来源的简报生成后，这里将显示关键指标与待解问题。",
              language,
            )}
          </p>
        )}
      </section>
      <section className="coverage attention-rail">
        <div className="rail-label">
          <i />
          {copy("YOUR ATTENTION", "你的关注", language)}
        </div>
        <p>
          {data.attention?.unreadCount || 0}{" "}
          {copy("unread events", "个未读事件", language)} ·{" "}
          {data.attention?.items.filter((e) => e.heldUntilRead).length || 0}{" "}
          {copy("held until read", "个保留至已读", language)}
        </p>
        <small>
          {copy(
            "Read status acknowledges a version. A material development can bring the event back. Minor edits and a new day do not.",
            "已读确认的是某个版本。重大进展可让事件再次出现；轻微编辑或日期变化不会重置已读。",
            language,
          )}
        </small>
      </section>
      <section className="coverage">
        <div className="rail-label">
          <i />
          {copy("SOURCE COVERAGE", "来源覆盖", language)}
        </div>
        {types.map(([id, en, zh]) => {
          const total = data.sources.filter(
            (s) => s.enabled && s.type === id,
          ).length;
          const n = healthy.filter((s) => s.type === id).length;
          return (
            <div className="coverage-row" key={id}>
              <span>{copy(en, zh, language)}</span>
              <div
                className="coverage-bar"
                title={`${n} of ${total} sources responding`}
              >
                <div style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
              </div>
              <small>
                {n}/{total}
              </small>
            </div>
          );
        })}
        <button className="text-link" onClick={onSources}>
          {copy("View source ledger", "查看来源台账", language)}
          <ArrowRight size={17} />
        </button>
      </section>
      <p className="rail-footer">
        {copy(
          "Reporting and interpretation are labeled separately.",
          "报道与解读均有明确标注。",
          language,
        )}
      </p>
    </aside>
  );
}
