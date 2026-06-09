export function parseJsonArrayField(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value !== 'string') return [];

  const raw = value.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed == null) return [];
    return [parsed];
  } catch {
    if (raw.startsWith('{') && raw.endsWith('}')) {
      const inner = raw.slice(1, -1).trim();
      if (!inner) return [];
      return inner
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((item) =>
          item
            .trim()
            .replace(/^"(.*)"$/, '$1')
            .replace(/\\"/g, '"')
        )
        .filter(Boolean);
    }

    return [raw];
  }
}

export function parseStringArrayField(value: unknown): string[] {
  return parseJsonArrayField(value)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

export function firstStringField(value: unknown): string {
  return parseStringArrayField(value)[0] || '';
}
