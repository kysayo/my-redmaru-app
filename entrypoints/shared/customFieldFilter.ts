// 設定ページの「除外するカスタムフィールド」テキストから cf_XXXX のID部分を抽出する。
// 改行・カンマ・空白のいずれで区切って書いても良いように緩めにパースする。
export function parseExcludedCustomFieldIds(text: string): Set<number> {
  const ids = new Set<number>();
  for (const token of text.split(/[\s,]+/)) {
    const match = token.match(/(\d+)/);
    if (match) ids.add(Number(match[1]));
  }
  return ids;
}
