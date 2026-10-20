import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, RefreshCw, Menu, ArrowRight, AlertCircle } from "lucide-react";
import Sidebar from "./components/Sidebar";
import StoryList from "./components/StoryList";
import BriefingRail from "./components/BriefingRail";
import BriefingNotes, { ReadingText } from "./components/BriefingNotes";
import SourceLedger from "./components/SourceLedger";
import AttentionControls from "./components/AttentionControls";
import PipelineCoverage from "./components/PipelineCoverage";
import { attentionArticles, retainDisplayedVersion } from "./lib/attention";
import { buildBriefingContext, backgroundForArticle } from "./lib/briefing";
import { buildSectionAssignments, matchesSection, readingSections, sectionCounts, sectionForArticle, sectionName } from "./lib/sections";
import WorldMap from "./components/WorldMap";
import { ArticleDialog, BriefingDialog } from "./components/Dialogs";
import { copy, bilingual, dateTime, request } from "./lib/format";
import BackgroundLibrary, { BackgroundLinks } from "./components/BackgroundLibrary";
import { loadBundledBackgroundGuides } from "./lib/background-guides";
import { matchingBackgroundGuides, relatedBackgroundGuides } from "./lib/background";
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
  const [bundledBackgroundGuides, setBundledBackgroundGuides] = useState([]);
  const backgroundGuides = data?.background?.guides || bundledBackgroundGuides;
  const [backgroundId, setBackgroundId] = useState(null);
  const readingLocation = useRef({ view: "briefing", category: "all", scrollY: 0 });
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem("meridian-reading-language-v2");
      if (["en", "both", "zh"].includes(saved)) return saved;
      return localStorage.getItem("meridian-language") === "zh" ? "zh" : "en";
    } catch {
      return "en";
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
    if (view !== "background" || data?.background?.guides || bundledBackgroundGuides.length) return;
    let cancelled = false;
    loadBundledBackgroundGuides().then(guides => {
      if (!cancelled) setBundledBackgroundGuides(guides);
    }).catch(() => {
      if (!cancelled) setError("Background unavailable. Reload to retry.");
    });
    return () => { cancelled = true; };
  }, [view, data?.background?.guides, bundledBackgroundGuides.length]);
  useEffect(() => {
    try {
      localStorage.setItem("meridian-reading-language-v2", language);
    } catch {
      // Reading remains available when browser storage is disabled.
    }
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
            "Collection is still running. Check back shortly.",
          );
        await load();
      } else throw Error("Unexpected collection response");
      setNotice(
        outcome?.failed
          ? `${outcome.succeeded}/${outcome.requestedSources} ${copy("feeds updated · see Sources", "个新闻源已更新 · 查看来源", language)}`
          : copy(
              "Feeds updated.",
              "新闻源已更新。",
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
  const sectionAssignments = useMemo(() => data ? buildSectionAssignments(data) : new Map(), [data]);
  const unreadBySection = useMemo(() => sectionCounts(rankedArticles, sectionAssignments), [rankedArticles, sectionAssignments]);
  function changeCategory(id) {
    setCategory(id);
    setSearch("");
    setLimit(15);
  }
  function openSection(id) {
    changeCategory(id);
    setView("briefing");
    setReadMode("unread");
  }
  function openBackground(id) {
    if (view !== "background") readingLocation.current = { view, category, scrollY: window.scrollY };
    if (id) setBackgroundId(id);
    setSelected(null);
    setShowBrief(false);
    setView("background");
    setCategory("all");
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function returnToReading() {
    setView(readingLocation.current.view);
    setCategory(readingLocation.current.category);
    requestAnimationFrame(() => window.scrollTo({ top: readingLocation.current.scrollY, behavior: "instant" }));
  }
  const activeSection = readingSections.find(section => section.id === category);
  const isDemo = data?.collection?.kind === "synthetic_demo";
  const articles = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    let list = (view === "briefing" ? rankedArticles : data.articles).filter(
      (a) =>
        matchesSection(a, category, sectionAssignments) &&
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
            a.analysis?.headline?.en,
            a.analysis?.headline?.zh,
            a.analysis?.readerBrief?.en,
            a.analysis?.readerBrief?.zh,
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
  }, [data, rankedArticles, view, category, search, readMode, prioritySort, sectionAssignments]);
  const relatedGuides = useMemo(() => relatedBackgroundGuides(articles, backgroundGuides), [articles, backgroundGuides]);
  const briefingContext = useMemo(
    () => data ? buildBriefingContext(data, { view, category, articles, search, assignments: sectionAssignments }) : null,
    [data, view, category, articles, search, sectionAssignments],
  );
  const showDailyEdition = Boolean(
    data && view === "briefing" && readMode !== "read" &&
    !search.trim() && briefingContext?.notes.length,
  );
  const editionMinutes = useMemo(() => {
    if (!briefingContext) return 1;
    const text = briefingContext.notes.map(note =>
      bilingual(note.narrative || note.summary, language),
    ).join(" ");
    return Math.max(1, Math.ceil(language === "zh"
      ? text.length / 380
      : text.split(/\s+/).filter(Boolean).length / 220));
  }, [briefingContext, language]);
  const currentSelected =
    selected && data?.articles.find((a) => a.id === selected.id);
  const selectedEvent =
    selected?.attention?.eventId &&
    data?.attention?.items.find(
      (e) => e.eventId === selected.attention.eventId,
    );
  const selectedArticle = selected
    ? selected.isReviewedSnapshot
      ? retainDisplayedVersion(selected, selectedEvent)
      : currentSelected || selected
    : null;
  const title =
    view === "background"
      ? copy("Background library", "背景知识库", language)
      : view === "sources"
      ? copy("Sources", "来源", language)
      : view === "saved"
        ? copy(
            "Saved stories",
            "收藏报道",
            language,
          )
        : activeSection
          ? sectionName(category, language)
          : view === "stream"
            ? copy("News stream", "新闻动态", language)
          : copy(
              "Daily briefing",
              "每日简报",
              language,
            );
  const viewName = {
    briefing: copy("Daily briefing", "每日简报", language),
    stream: copy("News stream", "新闻动态", language),
    saved: copy("Saved stories", "收藏报道", language),
    sources: copy("Sources & status", "来源与状态", language),
    background: copy("Background library", "背景知识库", language),
  }[view];
  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        setView={setView}
        category={category}
        setCategory={changeCategory}
        onOpenSection={openSection}
        onOpenBackground={() => openBackground()}
        sectionCounts={unreadBySection}
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
          className={`workspace-grid ${view === "sources" || view === "background" ? "ledger-grid" : ""}`}
        >
          <div className="primary-content">
            <section className="page-intro">
              <h1>{title}</h1>
              {view === "briefing" && category === "all" ? <p className="reader-promise">
                {copy("US and world news, with the background and consequences explained.", "读懂美国与世界新闻，理解背景及其影响。", language)}
              </p> : null}
            </section>
            {view !== "background" ? <div className="freshness">
              <span>
                {data
                  ? `${isDemo ? copy("Demo", "演示", language) : copy("Collected", "收集于", language)} ${dateTime(data.generatedAt)}`
                  : copy(
                      "Connecting…",
                      "连接中…",
                      language,
                    )}
              </span>
            </div> : null}
            {isDemo ? (
              <div className="demo-banner" role="status">
                <strong>
                  {copy("Fictional demo", "虚构演示", language)}
                </strong>
                <p>
                  {copy(
                    "Refresh feeds for live reporting.",
                    "刷新新闻源以获取真实报道。",
                    language,
                  )}
                </p>
              </div>
            ) : null}
            {error ? (
              <div className="error-banner" role="alert">
                <AlertCircle size={18} />
                <span>
                  {copy(
                    "Request failed: ",
                    "请求失败：",
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
            {view === "background" ? (
              <BackgroundLibrary
                guides={backgroundGuides}
                selectedId={backgroundId}
                onSelect={setBackgroundId}
                data={data}
                language={language}
                onReturn={returnToReading}
                onOpenArticle={setSelected}
              />
            ) : !data ? (
              <div className="loading-state">
                <RefreshCw className="spinning" />
                <p>
                  {copy(
                    "Loading…",
                    "载入中…",
                    language,
                  )}
                </p>
              </div>
            ) : (
              <>
                {view === "sources" ? (
                  <><PipelineCoverage data={data} language={language} /><SourceLedger data={data} language={language} /></>
                ) : (
                  <>
                    {showDailyEdition && category === "all" ? (
                      <section className="lead">
                        <div className="lead-copy">
                          <span className="lead-label">
                            {copy("THE DAILY READ", "今日精读", language)}
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
                          {briefingContext.overview ? <ReadingText
                            value={Object.fromEntries(Object.entries(briefingContext.overview).map(([lang, text]) => [lang, text.split(/\n\s*\n/)[0]]))}
                            language={language}
                            className="edition-opener"
                          /> : null}
                          <p className="edition-caption">{copy(`About ${editionMinutes} min for the lead stories`, `重点约需 ${editionMinutes} 分钟`, language)}{data.briefing?.isStale ? ` · ${copy("Edition awaiting review", "本期有待更新", language)}` : ""}</p>
                          <button
                            className="primary-button"
                            onClick={() => {
                              if (data.briefing) setShowBrief(true);
                              else if (articles[0]) setSelected(articles[0]);
                            }}
                            disabled={!data.briefing}
                          >
                            {data.briefing
                              ? copy("Read the full edition", "阅读完整简报", language)
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
                    {showDailyEdition ? <section className="daily-edition" aria-label={copy("The daily read", "今日精读", language)}>
                      <div className="edition-section-heading">
                        <h2>{category === "all" ? copy("Start here", "从这里读起", language) : copy("The desk read", "本栏精读", language)}</h2>
                        <span>{copy("Reported facts. A clear reading of what they mean.", "基于报道事实，解释变化的意义。", language)}</span>
                      </div>
                      <BriefingNotes context={briefingContext} data={data} language={language} onOpen={setSelected} />
                    </section> : null}
                    <BackgroundLinks guides={relatedGuides} language={language} onOpen={openBackground} />
                    {view === "briefing" && activeSection ? <div className="desk-intro">
                      <button className="text-link" onClick={() => setShowBrief(true)} disabled={!data.briefing || !articles.length}>{copy("Read this desk’s notes", "阅读本栏简报", language)}<ArrowRight size={15}/></button>
                    </div> : null}
                    {view === "briefing" ? (
                      <AttentionControls
                        mode={readMode}
                        setMode={setReadMode}
                        sort={prioritySort}
                        setSort={setPrioritySort}
                        language={language}
                        attention={{ unreadCount: category === "all" ? data.attention?.unreadCount : unreadBySection[category] || 0 }}
                      />
                    ) : null}
                    {view === "briefing" ? <p className="agenda-intro">
                      {copy("Your full reading agenda. Earlier important events stay here until you mark them read; each report keeps its factual review date.", "完整阅读议程。较早的重要事件会保留至标为已读，每篇仍显示原事实核查日期。", language)}
                    </p> : null}
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
                      setCategory={changeCategory}
                      assignments={sectionAssignments}
                      search={search}
                      setSearch={setSearch}
                      limit={limit}
                      setLimit={setLimit}
                      heading={
                        view === "saved"
                          ? copy("Your reading list", "你的阅读清单", language)
                          : view === "briefing"
                            ? copy("Keep following", "持续关注", language)
                            : undefined
                      }
                    />
                  </>
                )}
              </>
            )}
          </div>
          {data && view !== "sources" && view !== "background" ? (
            <BriefingRail
              data={data}
              context={briefingContext}
              language={language}
              onSources={() => {
                setView("sources");
                setCategory("all");
              }}
              onOpen={(a) => a && setSelected(a)}
              showNotes={!showDailyEdition}
            />
          ) : null}
        </div>
        <footer className="main-footer">
          MERIDIAN <span>·</span>{" "}
          {copy(
            "Local · TrendRadar",
            "本地 · TrendRadar",
            language,
          )}
        </footer>
      </main>
      {selectedArticle ? (
        <ArticleDialog
          article={selectedArticle}
          readingSection={sectionForArticle(selectedArticle, sectionAssignments)}
          background={backgroundForArticle(data, selectedArticle.id, category)}
          backgroundGuides={matchingBackgroundGuides(selectedArticle, backgroundGuides)}
          onOpenBackground={openBackground}
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
          context={briefingContext}
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
