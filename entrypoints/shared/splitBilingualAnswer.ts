// AI回答テキストを日本語部分・英語部分に分割する。
// デフォルト定型文がAIに「■■English■■」区切りで日本語回答→英語回答の順に出力するよう指示しているため、
// この区切り文字列を境に前半をcf_4589（AIまとめ）、後半をcf_4720（AIまとめ英語）に振り分ける。
const SEPARATOR = '■■English■■';

export interface SplitBilingualAnswerResult {
  ja: string;
  en: string;
}

// 区切り文字列が見つからない場合（AIが指示に従わなかった等）は、全文をjaに入れてenは空文字にする。
// 古い英語回答をcf_4720に残したまま日本語回答だけ更新される事故を避けるため、enは常に明示的に上書きする。
export function splitBilingualAnswer(text: string): SplitBilingualAnswerResult {
  const index = text.indexOf(SEPARATOR);
  if (index === -1) return { ja: text.trim(), en: '' };

  const ja = text.slice(0, index).trim();
  const en = text.slice(index + SEPARATOR.length).trim();
  return { ja, en };
}
