export type DecimalValidation = { ok: true; value: number } | { ok: false; message: string };

export function extractOrderCodeInput(input: string): { code: string; normalized: boolean } {
  const trimmed = input.trim();
  const code = (trimmed.match(/\d+/g) ?? []).join("");
  return {
    code,
    normalized: Boolean(code) && code !== trimmed,
  };
}

export function validatePositiveDecimal(input: string, label: string): DecimalValidation {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, message: `请填写${label}` };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, message: `${label}只能填写数字，最多两位小数` };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: `${label}必须大于 0` };
  }
  return { ok: true, value };
}

export function validatePercentInput(input: string, label: string, options: { required?: boolean } = {}): DecimalValidation {
  const trimmed = input.trim();
  if (!trimmed) {
    return options.required ? { ok: false, message: `请填写${label}` } : { ok: true, value: 0 };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, message: `${label}只能填写数字，最多两位小数` };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return { ok: false, message: `${label}必须在 0 到 100 之间` };
  }
  return { ok: true, value };
}
