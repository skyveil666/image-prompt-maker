/**
 * カテゴリ値の集計除外集合。"auto"/"skip"/空文字/null/undefined は
 * 「未設定・自動」として分析の集計から除外する。
 * imageAnalyzer / ratingAnalyzer が共有（旧: 各ファイルに同一定義が重複していた）。
 */
export const SKIP_VALUES = new Set<string | null | undefined>(["auto", "skip", "", null, undefined]);
