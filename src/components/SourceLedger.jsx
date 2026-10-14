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
      <p className="ledger-intro">
        {copy(
          "A transparent view of what was collected. Failed feeds keep their last successful reporting. Community posts and official statements carry different evidence limits.",
          "透明查看已收集的内容。新闻源失效时会保留最近一次成功获取的报道。社区帖子与官方声明各有不同的证据局限。",
          language,
        )}
      </p>
      <div className="ledger-table">
        <div className="ledger-head">
          <span>{copy("Source / coverage", "来源 / 领域", language)}</span>
          <span>{copy("Collection status", "收集状态", language)}</span>
          <span>{copy("Last success", "最近成功", language)}</span>
        </div>
        {data.sources.map((s) => {
          const good = s.status === "ok";
          const disabled = !s.enabled;
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
                {s.enabled && s.note ? (
                  <small className="source-note">{s.note}</small>
                ) : null}
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
                            "Collected · older content",
                            "已收集 · 内容较旧",
                            language,
                          )
                        : copy("Collected", "已收集", language)
                      : copy("Collection failed", "收集失败", language)}
                </span>
                <small>
                  {disabled
                    ? s.note ||
                      s.description ||
                      copy(
                        "Optional source adapter",
                        "可选来源适配器",
                        language,
                      )
                    : good
                      ? `${s.itemCount || 0} ${copy("cached items", "条缓存内容", language)}`
                      : s.error || "Feed unavailable"}
                </small>
              </div>
              <div>
                <span>{dateTime(s.lastSuccess)}</span>
                <small>
                  {copy("Newest article: ", "最新报道：", language)}
                  {dateTime(s.latestItemAt)}
                </small>
                {s.url ? (
                  <a
                    className="feed-link"
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy("Feed URL", "新闻源地址", language)}
                    <ArrowUpRight size={12} />
                  </a>
                ) : (
                  <small>
                    {copy("No feed configured", "尚未配置新闻源", language)}
                  </small>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="methodology">
        <h3>{copy("How to read this desk", "如何阅读此工作台", language)}</h3>
        <p>
          {copy(
            "RSS supplies reporting excerpts. Codex prepares the daily English + Chinese analysis with source links. “Official” identifies the institution that issued a statement; it does not guarantee independent confirmation. News volume and source counts do not measure truth. Industry coverage uses public publications and community feeds; personalized LinkedIn content is not connected.",
            "RSS 提供报道摘要。Codex 生成附带来源链接的中英双语每日分析。“官方”表示声明的发布机构，并不代表已获得独立证实。新闻数量与来源数不能衡量真实性。行业内容来自公开出版物与社区新闻源；尚未连接个性化 LinkedIn 内容。",
            language,
          )}
        </p>
        <p>
          {copy(
            "Edit config/sources.json to add or adjust feeds. Collection attempts and successful timestamps are separate. Daily automation needs your Mac and Codex available.",
            "可编辑 config/sources.json 添加或调整新闻源。收集尝试时间与成功时间分别记录。每日自动更新需要 Mac 和 Codex 可用。",
            language,
          )}
        </p>
      </div>
    </section>
  );
}
