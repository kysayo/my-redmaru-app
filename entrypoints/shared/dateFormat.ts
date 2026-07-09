/**
 * cf_4588（AI更新日時）用のフォーマットを生成する。
 * ブラウザのローカルタイム（JST前提）をそのまま使う。UTC変換（toISOString）はしない。
 */
export function formatDateTimeJst(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
