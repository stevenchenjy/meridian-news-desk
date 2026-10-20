import {
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
} from "lucide-react";
import { copy, categoryName, dateTime } from "../lib/format";
export default function SourceLedger({ data, language }) {
  const enabled = data.sources.filter((s) => s.enabled);
  return (
    <section className="source-ledger">
      <div className="section-heading">
        <h2>{copy("Source ledger", "来源台账", language)}</h2>
        <span>
          {enabled.filter((s) => s.status === "ok").length} / {enabled.length}{" "}
          {copy("responding", "正常", language)}
        </span>
      </div>
      <div className="ledger-table">
        <div className="ledger-head">
          <span>{copy("Source", "来源", language)}</span>
          <span>{copy("Status", "状态", language)}</span>
          <span>{copy("Last success", "最近成功", language)}</span>
        </div>
        {data.sources.map((s) => {
          const good = s.status === "ok";
          const disabled = !s.enabled;
          const detail = disabled
            ? s.note || s.description
            : good
              ? s.note
              : s.error || s.note || copy("Feed unavailable", "新闻源不可用", language);
          const Icon = disabled
            ? PauseCircle
            : good
              ? CheckCircle2
              : AlertCircle;
          return (
            <div className="ledger-row" key={s.id}>
              <div>
                <a href={s.siteUrl || s.url} target="_blank" rel="noreferrer">
                  {s.name}
                  <ArrowUpRight size={14} />
                </a>
                <small>
                  {categoryName(s.category, language)} · {s.type}
                </small>
              </div>
              <div
                className={`source-state ${disabled ? "disabled" : good ? "healthy" : "failed"}`}
              >
                <span>
                  <Icon size={15} />
                  {disabled
                    ? copy("Not connected", "未连接", language)
                    : good
                      ? s.stale
                        ? copy(
                            "Older reporting",
                            "内容较旧",
                            language,
                          )
                        : copy("Collected", "已收集", language)
                      : copy("Failed", "收集失败", language)}
                </span>
                {good && !disabled ? <small>{s.itemCount || 0} {copy("reports", "篇报道", language)}</small> : null}
                {detail ? <details className="source-details">
                  <summary>{copy("Details", "详情", language)}</summary>
                  <p>{detail}</p>
                </details> : null}
              </div>
              <div>
                <span>{dateTime(s.lastSuccess)}</span>
                <small>
                  {copy("Latest: ", "最新：", language)}
                  {dateTime(s.latestItemAt)}
                </small>
                {s.url ? (
                  <a
                    className="feed-link"
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy("Feed", "新闻源", language)}
                    <ArrowUpRight size={12} />
                  </a>
                ) : (
                  <small>
                    {copy("No feed", "未配置新闻源", language)}
                  </small>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <details className="methodology">
        <summary>{copy("About sources", "关于来源", language)}</summary>
        <p>
          {copy(
            "Feed excerpts and reviewed analysis are labelled separately. Statements and discussions retain their attribution; source type alone does not verify a claim.",
            "来源摘要与已核查分析分别标注。声明与讨论保留归属；来源类型不能独立证实内容。",
            language,
          )}
        </p>
        <p>
          {copy(
            "Failed feeds retain their last successful collection. A responding feed may contain older reporting.",
            "收集失败时保留上次成功内容。来源响应正常，也可能只有较旧报道。",
            language,
          )}
        </p>
      </details>
    </section>
  );
}
