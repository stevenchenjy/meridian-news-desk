export const categories = [
  { id: "us", en: "US & politics", zh: "美国与政治" },
  { id: "world", en: "World & diplomacy", zh: "世界与外交" },
  { id: "economy", en: "Markets & economy", zh: "市场与经济" },
  { id: "crisis", en: "Crisis watch", zh: "危机观察" },
  { id: "sdg", en: "UN & SDGs", zh: "联合国与可持续发展" },
  { id: "industry", en: "Industry insights", zh: "行业洞察" },
];
export function copy(en, zh, language) {
  return language === "zh" ? zh : en;
}
export function categoryName(id, language = "en") {
  const c = categories.find((c) => c.id === id);
  return c ? copy(c.en, c.zh, language) : id;
}
export function dateTime(value) {
  if (!value) return "Not yet";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Unknown date"
    : d.toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }) + " ET";
}
export function relativeTime(value) {
  if (!value) return "Date unavailable";
  let hours = (Date.now() - new Date(value).getTime()) / 3600000;
  if (!Number.isFinite(hours)) return "Date unavailable";
  if (hours < 0) return "Future date · check source";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
export function bilingual(value, language) {
  if (typeof value === "string") return value;
  return value?.[language === "zh" ? "zh" : "en"] || value?.en || "";
}
export async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json();
  if (!response.ok)
    throw Error(body.error || `Request failed (${response.status})`);
  return body;
}
