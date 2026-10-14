import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, RefreshCw, Menu, ArrowRight, AlertCircle } from "lucide-react";
import Sidebar from "./components/Sidebar";
import StoryList from "./components/StoryList";
import BriefingRail from "./components/BriefingRail";
import SourceLedger from "./components/SourceLedger";
import AttentionControls from "./components/AttentionControls";
import PipelineCoverage from "./components/PipelineCoverage";
import { attentionArticles } from "./lib/attention";
import WorldMap from "./components/WorldMap";
import { ArticleDialog, BriefingDialog } from "./components/Dialogs";
import { copy, bilingual, dateTime, categoryName, request } from "./lib/format";
export default function App() {
  const mutationVersion = useRef(0),
    bookmarkPending = useRef(new Set());
  const [pendingBookmarks, setPendingBookmarks] = useState(new Set());
  const readPending = useRef(new Set()),
    requestPending = useRef(new Set());
  const [pendingReads, setPendingReads] = useState(new Set()),
    [pendingRequests, setPendingRequests] = useState(new Set());
  const [readMode, setReadMode] = useState("unread"),
    [prioritySort, setPrioritySort] = useState("importance");
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [refreshing, setRefreshing] = useState(false),
    [notice, setNotice] = useState("");
  const [view, setView] = useState("briefing"),
    [category, setCategory] = useState("all"),
    [search, setSearch] = useState(""),
    [limit, setLimit] = useState(15),
    [selected, setSelected] = useState(null),
    [showBrief, setShowBrief] = useState(false),
    [menu, setMenu] = useState(false);
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem("meridian-language") || "both";
    } catch {
      return "both";
    }
  });
  const load = useCallback(async () => {
    try {
      const version = mutationVersion.current;
      const d = await request("/api/dashboard");
      setData((previous) =>
        version === mutationVersion.current
          ? d
          : {
              ...d,
              bookmarks: previous?.bookmarks || d.bookmarks,
              attention: previous?.attention || d.attention,
              readStates: previous?.readStates || d.readStates,
              analysisQueue: previous?.analysisQueue || d.analysisQueue,
            },
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    localStorage.setItem("meridian-language", language);
    document.documentElement.lang = language === "zh" ? "zh-Hans" : "en";
  }, [language]);
  const closeArticle = useCallback(() => setSelected(null), []),
    closeBrief = useCallback(() => setShowBrief(false), []);
  async function refresh() {
    setRefreshing(true);
    setNotice("");
    try {
      const result = await request("/api/refresh", {
        method: "POST",
        body: "{}",
      });
      let outcome = result.collection;
      if (result.articles) setData(result);
      else if (result.jobId) {
        let completed = false;
        for (let i = 0; i < 90; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const job = await request(`/api/jobs/${result.jobId}`);
          if (job.status === "error")
            throw Error(job.error || "Collection failed");
          if (job.status === "completed") {
            completed = true;
            outcome = job.collection;
            break;
          }
        }
        if (!completed)
          throw Error(
            "Collection is still running. The dashboard will update when it completes.",
          );
        await load();
      } else throw Error("Unexpected collection response");
      setNotice(
        outcome?.failed
          ? `${outcome.succeeded}/${outcome.requestedSources} ${copy("feeds collected. Failed feeds retain cached reporting; check Sources & status.", "个新闻源成功收集。失败来源保留缓存报道，请查看来源与状态。", language)}`
          : copy(
              "Feeds refreshed. Daily analysis has its own timestamp.",
              "新闻源已刷新。每日分析有独立的生成时间。",
              language,
            ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }
  async function toggleBookmark(id) {
    if (bookmarkPending.current.has(id)) return;
    bookmarkPending.current.add(id);
    setPendingBookmarks(new Set(bookmarkPending.current));
    mutationVersion.current++;
    try {
      const saved = !data.bookmarks.includes(id);
      const result = await request("/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ id, saved }),
      });
      mutationVersion.current++;
      setData((d) => ({ ...d, bookmarks: result.bookmarks }));
    } catch (e) {
      setError(e.message);
    } finally {
      bookmarkPending.current.delete(id);
      setPendingBookmarks(new Set(bookmarkPending.current));
    }
  }
  async function markRead(article, read) {
    const id = article.attention?.eventId || article.id;
    if (readPending.current.has(id)) return;
    readPending.current.add(id);
    setPendingReads(new Set(readPending.current));
    mutationVersion.current++;
    try {
      await request("/api/read", {
        method: "POST",
        body: JSON.stringify({
          id,
          read,
          updateKey: article.attention?.updateKey,
        }),
      });
      mutationVersion.current++;
      await load();
    } catch (e) {
      await load();
      setError(e.message);
    } finally {
      readPending.current.delete(id);
      setPendingReads(new Set(readPending.current));
    }
  }
  async function queueAnalysis(article) {
    if (requestPending.current.has(article.id)) return;
    requestPending.current.add(article.id);
    setPendingRequests(new Set(requestPending.current));
    mutationVersion.current++;
    try {
      const response = await request("/api/analysis-requests", {
        method: "POST",
        body: JSON.stringify({ id: article.id }),
      });
      mutationVersion.current++;
      setData((d) => ({ ...d, analysisQueue: response.analysisQueue }));
    } catch (e) {
      setError(e.message);
    } finally {
      requestPending.current.delete(article.id);
      setPendingRequests(new Set(requestPending.current));
    }
  }
  const rankedArticles = useMemo(
    () => (data ? attentionArticles(data) : []),
    [data],
  );
  const isDemo = data?.collection?.kind === "synthetic_demo";
  const articles = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    let list = (view === "briefing" ? rankedArticles : data.articles).filter(
      (a) =>
        (category === "all" ||
          a.category === category ||
          a.relatedCategories?.includes(category)) &&
        (view !== "saved" || data.bookmarks.includes(a.id)) &&
        (view !== "briefing" ||
          readMode === "all" ||
          (readMode === "read" && a.isRead) ||
          (readMode === "unread" && !a.isRead && a.attention?.active)) &&
        (!q ||
          [
            a.title,
            a.excerpt,
            a.sourceName,
            a.summary?.en,
            a.summary?.zh,
            a.attention?.reason?.en,
            a.attention?.reason?.zh,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
    if (view === "briefing")
      list = list
        .slice()
        .sort((a, b) =>
          prioritySort === "newest"
            ? (b.publishedAt || "").localeCompare(a.publishedAt || "")
            : (b.attention?.priority ?? 0) - (a.attention?.priority ?? 0),
        );
    return list;
  }, [data, rankedArticles, view, category, search, readMode, prioritySort]);
  const currentSelected =
    selected && data?.articles.find((a) => a.id === selected.id);
  const selectedEvent =
    selected?.attention?.eventId &&
    data?.attention?.items.find(
      (e) => e.eventId === selected.attention.eventId,
    );
  const selectedArticle = selected
    ? selected.isReviewedSnapshot
      ? {
          ...selected,
          attention: selectedEvent || selected.attention,
          isRead: selectedEvent?.isRead ?? selected.isRead,
        }
      : currentSelected || selected
    : null;
  const title =
    view === "sources"
      ? copy("Know your sources.", "了解你的新闻来源。", language)
      : view === "saved"
        ? copy(
            "Keep the stories that matter.",
            "收藏值得关注的报道。",
            language,
          )
        : view === "stream"
          ? category !== "all"
            ? categoryName(category, language)
            : copy("The world, as it unfolds.", "世界，正在发生。", language)
          : copy(
              "A wider view of the world.",
              "以更宽广的视角看世界。",
              language,
            );
  const viewName = {
    briefing: copy("Daily briefing", "每日简报", language),
    stream: copy("News stream", "新闻动态", language),
    saved: copy("Saved stories", "收藏报道", language),
    sources: copy("Sources & status", "来源与状态", language),
  }[view];
  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        setView={setView}
        category={category}
        setCategory={setCategory}
        language={language}
        open={menu}
        onClose={() => setMenu(false)}
        schedule={data?.schedule}
      />
      {menu ? (
        <button
          className="nav-backdrop"
          onClick={() => setMenu(false)}
          aria-label="Dismiss navigation backdrop"
        />
      ) : null}
      <main className="main-workspace" data-view={view}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(true)}
              aria-expanded={menu}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <Home size={17} />
            <span>/</span>
            <span>{viewName}</span>
          </div>
          <div className="header-actions">
            <div
              className="language-switch"
              role="group"
              aria-label="Briefing language"
            >
              {[
                ["en", "English"],
                ["both", "双语"],
                ["zh", "中文"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={language === id ? "active" : ""}
                  onClick={() => setLanguage(id)}
                  aria-pressed={language === id}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="refresh-button"
              aria-label={refreshing ? "Collecting feeds" : "Refresh feeds"}
              onClick={refresh}
              disabled={refreshing || !data}
            >
              <RefreshCw size={17} className={refreshing ? "spinning" : ""} />
              <span>
                {refreshing
                  ? copy("Collecting…", "收集中…", language)
                  : copy("Refresh feeds", "刷新新闻源", language)}
              </span>
            </button>
          </div>
        </header>
        <div
          className={`workspace-grid ${view === "sources" ? "ledger-grid" : ""}`}
        >
          <div className="primary-content">
            <section className="page-intro">
              <h1>{title}</h1>
              <p>
                {view === "briefing"
                  ? copy(
                      "Important events, researched and kept in view.",
                      "重要事件，深入分析，持续关注。",
                      language,
                    )
                  : view === "sources"
                    ? copy(
                        "Coverage, collection health, and the limits of the evidence.",
                        "来源覆盖、收集状态与证据的局限。",
                        language,
                      )
                    : copy(
                        "All collected reporting, newest first. Translations and analysis are labeled.",
                        "完整报道流，按时间排列。翻译与独立分析分别标注。",
                        language,
                      )}
              </p>
            </section>
            <div className="freshness">
              <span>
                {new Date().toLocaleDateString(
                  language === "zh" ? "zh-CN" : "en-US",
                  {
                    timeZone: "America/New_York",
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  },
                )}
              </span>
              <i />
              <span>
                {data
                  ? `${isDemo ? copy("Demo loaded", "演示载入于", language) : copy("Feeds collected", "新闻收集于", language)} ${dateTime(data.generatedAt)}`
                  : copy(
                      "Connecting to your local news desk…",
                      "正在连接本地新闻工作台…",
                      language,
                    )}
              </span>
            </div>
            {isDemo ? (
              <div className="demo-banner" role="status">
                <strong>
                  {copy("Demonstration workspace", "演示工作台", language)}
                </strong>
                <p>
                  {copy(
                    "Fictional reports and sample analysis. Refresh feeds to replace the demo with live reporting.",
                    "这里显示虚构报道与示例分析。刷新新闻源可将演示替换为真实报道。",
                    language,
                  )}
                </p>
                {language === "both" ? (
                  <p className="chinese-text">
                    这里显示虚构报道与示例分析。刷新新闻源可将演示替换为真实报道。
                  </p>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <div className="error-banner" role="alert">
                <AlertCircle size={18} />
                <span>
                  {copy(
                    "Unable to complete request: ",
                    "请求未能完成：",
                    language,
                  )}
                  {error}
                </span>
                <button onClick={load}>
                  {copy("Retry", "重试", language)}
                </button>
              </div>
            ) : null}
            {notice ? (
              <div className="notice" role="status">
                {notice}
                <button
                  onClick={() => setNotice("")}
                  aria-label="Dismiss notice"
                >
                  ×
                </button>
              </div>
            ) : null}
            {!data ? (
              <div className="loading-state">
                <RefreshCw className="spinning" />
                <p>
                  {copy(
                    "Opening your news desk…",
                    "正在打开新闻工作台…",
                    language,
                  )}
                </p>
                <small>
                  {copy(
                    "If this continues, start the local server with npm start.",
                    "如持续等待，请使用 npm start 启动本地服务。",
                    language,
                  )}
                </small>
              </div>
            ) : (
              <>
                {view === "sources" ? (
                  <SourceLedger data={data} language={language} />
                ) : (
                  <>
                    {view === "briefing" ? (
                      <section className="lead">
                        <div className="lead-copy">
                          <span className="lead-label">
                            {copy("THE BRIEFING", "综合简报", language)}
                          </span>
                          <h2>
                            {data.briefing
                              ? bilingual(data.briefing.title, language)
                              : copy(
                                  "The stories shaping today",
                                  "塑造今日世界的报道",
                                  language,
                                )}
                          </h2>
                          <p>
                            {copy(
                              "Reporting, context, and the questions still open.",
                              "报道、背景与仍待解答的问题。",
                              language,
                            )}
                          </p>
                          <button
                            className="primary-button"
                            onClick={() => {
                              if (data.briefing) setShowBrief(true);
                              else if (articles[0]) setSelected(articles[0]);
                            }}
                            disabled={!data.briefing}
                          >
                            {data.briefing
                              ? copy("Read the briefing", "阅读简报", language)
                              : copy(
                                  "Explore the reporting",
                                  "浏览报道",
                                  language,
                                )}
                            <ArrowRight size={17} />
                          </button>
                        </div>
                        <WorldMap />
                      </section>
                    ) : null}
                    <PipelineCoverage data={data} language={language} />
                    {view === "briefing" ? (
                      <AttentionControls
                        mode={readMode}
                        setMode={setReadMode}
                        sort={prioritySort}
                        setSort={setPrioritySort}
                        language={language}
                        attention={data.attention}
                      />
                    ) : null}
                    <StoryList
                      articles={articles}
                      bookmarks={data.bookmarks || []}
                      toggleBookmark={toggleBookmark}
                      pendingBookmarks={pendingBookmarks}
                      onOpen={setSelected}
                      ranked={view === "briefing"}
                      demo={isDemo}
                      readMode={readMode}
                      onRead={markRead}
                      pendingReads={pendingReads}
                      language={language}
                      category={category}
                      setCategory={setCategory}
                      search={search}
                      setSearch={setSearch}
                      limit={limit}
                      setLimit={setLimit}
                      heading={
                        view === "saved"
                          ? copy("Your reading list", "你的阅读清单", language)
                          : view === "briefing"
                            ? copy("Priority events", "重点事件", language)
                            : undefined
                      }
                    />
                  </>
                )}
              </>
            )}
          </div>
          {data && view !== "sources" ? (
            <BriefingRail
              data={data}
              language={language}
              onSources={() => {
                setView("sources");
                setCategory("all");
              }}
              onOpen={(a) => a && setSelected(a)}
            />
          ) : null}
        </div>
        <footer className="main-footer">
          MERIDIAN <span>·</span>{" "}
          {copy(
            "Built on TrendRadar · Local workspace",
            "基于 TrendRadar · 本地工作台",
            language,
          )}
          <span>·</span>
          {copy(
            "Source excerpts are not independent verification.",
            "来源摘要不代表独立核验。",
            language,
          )}
        </footer>
      </main>
      {selectedArticle ? (
        <ArticleDialog
          article={selectedArticle}
          demo={isDemo}
          language={language}
          onClose={closeArticle}
          saved={data.bookmarks.includes(selectedArticle.id)}
          pending={pendingBookmarks.has(selectedArticle.id)}
          onSave={() => toggleBookmark(selectedArticle.id)}
          onRead={() => markRead(selectedArticle, !selectedArticle.isRead)}
          readPending={pendingReads.has(
            selectedArticle.attention?.eventId || selectedArticle.id,
          )}
          onRequestAnalysis={() => queueAnalysis(selectedArticle)}
          requestPending={pendingRequests.has(selectedArticle.id)}
          requested={data.analysisQueue?.items.some(
            (item) =>
              item.articleId === selectedArticle.id &&
              item.status === "pending",
          )}
        />
      ) : null}
      {showBrief && data?.briefing ? (
        <BriefingDialog
          data={data}
          language={language}
          onClose={closeBrief}
          onOpen={(a) => {
            setShowBrief(false);
            setSelected(a);
          }}
        />
      ) : null}
    </div>
  );
}
