import { copy } from "../lib/format";

export default function PipelineCoverage({ data, language, onStream }) {
  const stats = data.stats || {};
  const total = stats.articleCount ?? data.articles.length;
  const translated =
    stats.bilingualSummaryCount ??
    data.articles.filter((a) => a.summary?.en && a.summary?.zh).length;
  const analyzed =
    stats.readyAnalysisCount ?? data.articles.filter((a) => a.analysis).length;
  const missing = total - translated;
  const demo = data.collection?.kind === "synthetic_demo";
  return (
    <div className="pipeline-coverage" aria-label="Pipeline coverage">
      <div>
        <strong>{copy("Processing coverage", "处理覆盖", language)}</strong>
        <span>
          {copy("EN + 中文", "中英摘要", language)}{" "}
          <b>
            {translated}/{total}
          </b>
        </span>
        <span>
          {demo
            ? copy("Example analyses", "示例分析", language)
            : copy("Researched analysis", "独立分析", language)}{" "}
          <b>
            {analyzed}/{total}
          </b>
        </span>
        {data.analysisQueue?.pendingCount ? (
          <span>
            {data.analysisQueue.pendingCount}{" "}
            {copy("requested", "篇待处理请求", language)}
          </span>
        ) : null}
      </div>
      <p>
        {demo
          ? copy(
              "These bilingual samples are fictional. They demonstrate the workflow and do not report real events.",
              "这些双语示例均为虚构，用于展示工作流程，并非真实事件报道。",
              language,
            )
          : missing > 0
            ? copy(
                `${missing} reports await a Chinese summary. Unanalyzed reports can be queued for the next Codex run.`,
                `${missing}篇报道仍待生成中文摘要。尚未分析的报道可排入下一次 Codex 处理。`,
                language,
              )
            : copy(
                "All collected reports have a bilingual summary. Publisher-excerpt translations and researched analysis are labeled separately.",
                "全部已收集报道均有中英摘要。发布者摘要的翻译与独立分析分别标注。",
                language,
              )}
      </p>
      {onStream ? (
        <button className="text-link" onClick={onStream}>
          {copy("Browse all reporting →", "浏览完整报道流 →", language)}
        </button>
      ) : null}
    </div>
  );
}
