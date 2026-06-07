# 30. P3 発見層（discovery）設計（承認済み 2026-06-07）

> 目的: **未開拓発見・新ジャンル発見・神引き候補発見**（＝好み最適化ではない）。
> 監視外で頻出し始めた新しい語を発見→監視対象に取り込む。docs/28 §4 を具体化。

## 0. ユーザー決定（2026-06-07）
- トークン化: **区切り語＋英語 bi-gram**（"film noir" 等の句を捕捉。日本語自由文の塊ノイズは「無視」で減衰）。
- 神引き候補の定義: **頻度×新規性のみ・好み非依存**（お気に入り/評価は使わない＝目的に忠実・繰り返し最適化を避ける）。
- 昇格時カテゴリ: **昇格時に選択**（22カテゴリ＋その他から。既定「ジャンル」）。
- 実装: **P3a → P3b の段階**。

## 1. 構成（3機能＋新UI）
新UI＝分析ラボ **第3タブ「🔭 発見」**。

### A. `detectCandidateMotifs(texts, opts)` — 候補抽出（純粋関数・保存しない）
- `src/lib/discoveryMotifs.ts`（新規）。
- 手順:
  1. 各 `promptText` を正規化（小文字・NFC）→ 区切り（`、，,・/`・空白・改行・括弧・記号）でトークン化。
  2. **unigram** ＋ **英語 bi-gram**（隣接2語がともに ASCII 単語のときのみ連結。日本語連結はしない＝塊ノイズ抑制）。
  3. 各 term をフィルタ: 長さ2–40、純数字除外、**ストップワード**（the/and/with・image/photo/high quality 等）除外、**無視リスト**（`ipm_ignored_terms_v1`）除外。
  4. **監視済み除外**: 実効監視集合（`MONITORED_MOTIFS` ＋ userMotifs）の正規化トークンと **双方向部分一致**する term は除外（例: "neon" は "neon glow" に内包され既監視扱い）。
  5. 頻度集計 → `{ term, count, lastSeen, sampleContexts[] }`。ランキング＝頻度降順（＋直近性で微加点）→ top N（既定30）。
- カバレッジ判定は **unique term ごとに1回**メモ化（性能）。

### B. 昇格（promote）= P3b
- 候補 → `ipm_user_motifs_v1` に保存: `{ id, label, category(選択), tokens:[term], source:"user", createdAt }`。
- **実効監視集合 = [...MONITORED_MOTIFS, ...loadUserMotifs()]**。`getEffectiveMotifs()` を新設し、`historyAnalyzer`/`biasAnalyzer` の検出をこれ基準に（後方互換：userMotifs 空なら従来と同一）。
- 昇格後は通常モチーフと同等（頻度・未開拓度・ラボ表・レベル・タグ・候補からの自動除外）。

### C. 無視（ignore）= P3a
- 候補 → `ipm_ignored_terms_v1`（string[]）追加 → 以後 候補から除外。無視解除（リストから削除）も可。

## 2. UI（発見タブ・P3a）
- 候補一覧テーブル: 語 / 出現数 / 直近 / サンプル文脈（折りたたみ）。
- 行アクション: 🚫 無視（P3a）／ ⬆ 昇格（P3b・カテゴリ選択ポップ）。
- 件数（10/20/50/全件）・検索。空状態（候補なし）文言。

## 3. データフロー
- App.tsx: `ignoredTerms` state（`loadIgnoredTerms`）、`userMotifs` state（P3b）。
  `discoveryCandidates = useMemo(detectCandidateMotifs(historyTexts, {ignored, userMotifs}), [...])`。
  handlers: `onIgnoreTerm(term)`（addIgnoredTerm→state更新）/（P3b）`onPromote(term,category)`。
  AnalysisLabPanel へ `candidates` ＋ handlers を渡す（パネルは表示＋ハンドラ呼び出しのみ）。

## 4. 不変条件・リスク
- 検出方式（部分一致）・生成・抽出・履歴データ構造は不変。**localStorage 追加キーのみ**（`ipm_user_motifs_v1`/`ipm_ignored_terms_v1`）。学習は自動適用しない（昇格はユーザー操作）。
- 日本語自由文はノイズが出やすい→「無視」で減衰。形態素解析器（kuromoji 等）は重い依存のため非採用。
- 昇格は実効集合を変える→ P3b で `getEffectiveMotifs()` を単一の参照点にして後方互換を担保。
- ロールバック: 新ファイル＋新タブ＋localStorage 追加分を戻すだけ（既存に影響なし）。

## 5. 段階・検証
- **P3a**: discoveryMotifs.ts（detect＋ignore）＋発見タブ（表示＋無視）＋App配線。tsc/build＋Playwright隔離（合成履歴で候補が出る／無視で消える）。
- **P3b**: 昇格（userMotifs）＋ getEffectiveMotifs マージ。tsc/build＋Playwright（昇格で監視集合に入る／候補から消える）。

## 6. P3a 実装・検証済み（2026-06-07／未コミット）
**変更ファイル**
- `src/lib/discoveryMotifs.ts`（新規）: `detectCandidateMotifs`（区切り＋英語bi-gram・監視済み双方向部分一致除外・ストップワード・無視リスト除外・出現2回以上・頻度×直近でランキング・top30）／`loadIgnoredTerms`/`addIgnoredTerm`/`removeIgnoredTerm`（`ipm_ignored_terms_v1`）／`loadUserMotifs`/`getEffectiveMotifs`（P3b 受け皿・現状 curated と同一）。純粋関数・好み非依存。
- `src/App.tsx`: `ignoredTerms` state＋`discoveryCandidates` memo（`historyItemsForColor`から算出）＋`handleIgnoreTerm`。AnalysisLabPanel へ `candidates`/`onIgnoreTerm` を渡す。
- `src/components/AnalysisLabPanel.tsx`: 第3タブ「🔭 発見」（候補語/出現/サンプル文脈/🚫無視・件数・検索・空状態）。

**検証**（front `tsc -b` ✅／`vite build` ✅／Playwright隔離・合成履歴に監視外の新語を投入）
- 発見タブ「🔭 発見（24）」表示。新語（wibblecore/zandarpunk/blarnscape/liminal/florptech/quxnova）が候補化。
- 🚫無視 → タブ24→23・対象語消滅・`ipm_ignored_terms_v1=["wibblecore"]` 永続化。語単位で独立（"wibblecore aesthetic" は残存）。コンソール0エラー。

**既知の限界（P3b/将来の改善候補）**
- カバレッジは「監視token との双方向部分一致」のため、監視語句の**断片 bi-gram**（例 "glow particles"／"purple lighting"）が候補に混じることがある。実害は無く🚫無視で減衰可。将来は「プロンプト内で既に監視 token がマッチした区間の語を除外」する精緻化を検討。
- 日本語自由文は塊になりやすい（形態素解析器は非採用）→ 無視で対応。

**End of Doc 30（P3a 実装・検証済み・未コミット／P3b 未着手）**
