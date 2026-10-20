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
        <span>
          {copy("Bilingual", "双语摘要", language)}{" "}
          <b>
            {translated}/{total}
          </b>
        </span>
        <span>
          {demo
            ? copy("Demo analyses", "示例分析", language)
            : copy("Reviewed", "已分析", language)}{" "}
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
      {demo || missing > 0 ? <p>{demo
        ? copy("Fictional demo", "虚构演示", language)
        : copy(`${missing} translations pending`, `${missing}篇待翻译`, language)}</p> : null}
      {onStream ? (
        <button className="text-link" onClick={onStream}>
          {copy("News stream →", "新闻动态 →", language)}
        </button>
      ) : null}
    </div>
  );
}
