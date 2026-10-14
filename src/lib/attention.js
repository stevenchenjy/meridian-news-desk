export function hasAnalysis(article) {
  const analysis = article?.analysis;
  return Boolean(
    analysis &&
    article.summary?.en &&
    article.summary?.zh &&
    ["context", "implications", "uncertainty", "watch"].every(
      (key) => analysis[key]?.en && analysis[key]?.zh,
    ) &&
    analysis.evidence?.length,
  );
}

export function attentionArticles(data) {
  return (data?.attention?.items || [])
    .map((event) => {
      const current = data.articles.find(
        (article) => article.id === event.articleId,
      );
      const article =
        hasAnalysis(current) && !event.contentChanged
          ? current
          : event.articleSnapshot;
      if (!hasAnalysis(article)) return null;
      return {
        ...article,
        attention: event,
        isRead: event.isRead,
        isReviewedSnapshot: Boolean(
          event.contentChanged || article.isReviewedSnapshot,
        ),
      };
    })
    .filter(Boolean);
}

export function articleForReview(data, articleId) {
  const current = data?.articles?.find((article) => article.id === articleId);
  if (hasAnalysis(current) && !current.analysis.isStale) return current;
  const event = data?.attention?.items?.find(
    (item) =>
      item.articleId === articleId ||
      item.memberArticleIds?.includes(articleId),
  );
  return hasAnalysis(event?.articleSnapshot)
    ? { ...event.articleSnapshot, attention: event, isRead: event.isRead }
    : current;
}

export function priorityBand(score) {
  if (score >= 85) return { en: "Major", zh: "重大" };
  if (score >= 75) return { en: "High", zh: "重点" };
  if (score >= 60) return { en: "Context", zh: "背景" };
  return { en: "Lower priority", zh: "较低优先级" };
}
