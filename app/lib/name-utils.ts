const NON_ALPHA_PATTERN = /[^A-Za-z ]+/g;
const MULTIPLE_SPACES_PATTERN = /\s{2,}/g;

export function sanitizeAlphabeticName(value: string): string {
  return value.replace(NON_ALPHA_PATTERN, '').replace(MULTIPLE_SPACES_PATTERN, ' ').trimStart();
}
