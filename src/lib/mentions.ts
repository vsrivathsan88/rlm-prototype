export function normalizeMentionToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseMentionTokens(input: string): string[] {
  const tokens: string[] = [];
  const mentionRegex = /@(?:\{([^}]+)\}|([a-zA-Z0-9_-]+))/g;
  for (const match of input.matchAll(mentionRegex)) {
    const raw = match[1] || match[2] || "";
    if (!raw.trim()) continue;
    tokens.push(raw);
  }
  return tokens;
}

export function stripMentionTokens(input: string): string {
  return input
    .replace(/@(?:\{[^}]+\}|[a-zA-Z0-9_-]+)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildMentionKeys(id: string, name: string): string[] {
  const keys = new Set<string>();
  const normalizedId = normalizeMentionToken(id);
  const normalizedName = normalizeMentionToken(name);
  if (normalizedId) keys.add(normalizedId);
  if (normalizedName) keys.add(normalizedName);
  return Array.from(keys);
}

export function toDisplayNameMention(name: string): string {
  return `@{${name}}`;
}
