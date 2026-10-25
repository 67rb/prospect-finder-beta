export function normalizeLinkedInUrl(value) {
  const input = String(value ?? "").trim();
  if (!input) return "";
  if (/\s/.test(input)) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (!/[.]linkedin[.]com$/.test(hostname) && hostname !== "linkedin.com") return null;
  if (!/^\/(?:in|company|school|showcase|pub)\//i.test(url.pathname)) return null;
  if (url.username || url.password || (url.port && url.port !== "443")) return null;
  return `https://www.linkedin.com${url.pathname.replace(/\/+$/, "")}`;
}

export function contactPhoneHref(value) {
  const input = String(value ?? "").trim();
  const match = input.match(/^\s*(\+?[\d\s().-]+?)(?:\s*(?:ext\.?|x|#)\s*(\d+))?\s*$/i);
  if (!match) return "";
  const main = match[1].trim();
  const digits = main.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return `tel:${main.startsWith("+") ? "+" : ""}${digits}${match[2] ? `;ext=${match[2]}` : ""}`;
}
