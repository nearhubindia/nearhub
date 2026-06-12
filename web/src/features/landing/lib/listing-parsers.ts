export type ParsedAttributeValue = string | number | boolean;

export type ParsedEmiPlan = {
  durationMonths: number;
  monthlyAmount: number;
};

export function parseMediaList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  } catch {
    // Fall through to plain string handling below.
  }

  return [trimmed];
}

export function parseTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    }
  } catch {
    // Fall through to newline/comma parsing below.
  }

  return trimmed
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseAttributeMap(value: unknown): Record<string, ParsedAttributeValue> {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, ParsedAttributeValue>>(
      (acc, [key, raw]) => {
        if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
          acc[key] = raw;
        } else if (raw != null) {
          acc[key] = String(raw);
        }
        return acc;
      },
      {}
    );
  }

  if (typeof value !== 'string') return {};

  const trimmed = value.trim();
  if (!trimmed) return {};

  try {
    return parseAttributeMap(JSON.parse(trimmed));
  } catch {
    return {};
  }
}

export function parseEmiPlanList(value: unknown): ParsedEmiPlan[] {
  const rawPlans = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return rawPlans
    .map((plan) => ({
      durationMonths: Number((plan as { durationMonths?: unknown }).durationMonths || 0),
      monthlyAmount: Number((plan as { monthlyAmount?: unknown }).monthlyAmount || 0),
    }))
    .filter(
      (plan) =>
        Number.isFinite(plan.durationMonths) &&
        plan.durationMonths > 0 &&
        Number.isFinite(plan.monthlyAmount) &&
        plan.monthlyAmount > 0
    );
}
