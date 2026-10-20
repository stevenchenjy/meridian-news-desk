import { hasAnalysis } from './attention.js';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// A changed current excerpt cannot inherit an earlier editorial voice. A retained
// reviewed snapshot may keep that voice with its original review date and warning.
export function reviewedEditorial(article) {
  return hasAnalysis(article) && (!article.analysis.isStale || article.isReviewedSnapshot);
}

function editorialField(article, key) {
  if (!reviewedEditorial(article)) return null;
  const field = article.analysis[key];
  const en = cleanText(field?.en);
  if (!en) return null;
  const translated = cleanText(field?.zh);
  const zh = translated !== en && /[\u3400-\u9fff]/.test(translated) ? translated : '';
  return { en, ...(zh ? { zh } : {}) };
}

export function editorialHeadlines(article) {
  const headline = editorialField(article, 'headline');
  const original = typeof article?.title === 'string' ? { en: article.title } : article?.title || {};
  return headline || original;
}

export function editorialHeadline(article, language = 'en') {
  const headline = editorialHeadlines(article);
  if (language === 'zh') return headline.zh || (typeof article?.title === 'object' ? article.title.zh || article.title.en : article?.title) || headline.en || '';
  return headline.en || '';
}

// Only locales actually authored for this reading layer are returned. In "both"
// mode an English brief must never be presented twice under two language labels.
export function articleReaderBrief(article) {
  return editorialField(article, 'readerBrief');
}

export function firstParagraph(value) {
  if (typeof value === 'string') return value.trim().split(/\n\s*\n/)[0] || '';
  if (!value) return null;
  return Object.fromEntries(Object.entries(value).flatMap(([locale, text]) => {
    const paragraph = firstParagraph(text);
    return paragraph ? [[locale, paragraph]] : [];
  }));
}

export function firstSentence(value) {
  if (typeof value !== 'string') {
    if (!value) return null;
    return Object.fromEntries(Object.entries(value).flatMap(([locale, text]) => {
      const sentence = firstSentence(text);
      return sentence ? [[locale, sentence]] : [];
    }));
  }
  const paragraph = firstParagraph(value);
  for (let index = 0; index < paragraph.length; index++) {
    const mark = paragraph[index];
    if ('。！？'.includes(mark)) return paragraph.slice(0, index + 1);
    if (!'.!?'.includes(mark) || (index + 1 < paragraph.length && !/\s/.test(paragraph[index + 1]))) continue;
    const candidate = paragraph.slice(0, index + 1);
    if (mark === '.' && (/(?:\b[A-Za-z]\.){2,}$/.test(candidate) || /(?:^|\s)[A-Z]\.$/.test(candidate) || /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)\.$/i.test(candidate))) continue;
    return candidate;
  }
  return paragraph;
}

export function articleOpening(article) {
  return firstParagraph(articleReaderBrief(article) || article?.summary || article?.excerpt || '');
}

export function articleReviewDue(article) {
  return Boolean(article?.isReviewedSnapshot || article?.analysis?.isStale || article?.attention?.needsReview || article?.attention?.contentChanged);
}

export function readingMinutes(values) {
  const text = values.filter(Boolean).map(value => typeof value === 'string' ? value : value.en || '').join(' ');
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 220));
}
