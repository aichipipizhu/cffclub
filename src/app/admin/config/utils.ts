export function percentText(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value / 100);
}

export function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseAliases(value: string): string[] {
  return Array.from(new Set(value.split(/[,\s，]+/).map((alias) => alias.trim()).filter(Boolean)));
}

