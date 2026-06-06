# 29. 全体品質監査・安定化レポート（2026-06-06・自律実行）

> 依頼: プロジェクト全体の潜在不具合まで発見し、安全に修正（「動くコード」でなく「長期運用できる安定コード」）。
> 制約: 見た目維持・既存挙動維持・データ互換維持・中核(顔/同一性/永続化/生成/抽出)と破壊的変更は保留・push禁止。

## 0. 進め方
- 12次元の並列監査ワークフロー（サブエージェント58・指摘76件）→ 高/中・safe・非coreを敵対的に再検証 → 実在かつ安全な指摘のみ修正。
- スコア式・中核・破壊的・保存データ構造変更は**自動修正せず報告**（就寝中にランキング/評価基準が動くのを回避）。
- 検証: front `tsc -b` ✅ / `vite build` ✅ / Playwright（隔離プロファイル・合成履歴48件）で実UI回帰確認。

## 1. 修正一覧（実施・未コミット→2コミット・push無し）
### A. コンソールエラー/警告
1. **ReflectionStatusBar**: `<button>`入れ子(`validateDOMNesting`エラー)を解消。外側ヘッダを `div role=button` 化＋Enter/Space＋`aria-expanded`（見た目・挙動維持・a11y向上）。→ 実機で **0 error/0 warning** 確認。

### B. React key（状態取り違えの予防）
2. **PromptCard** 生成結果画像キー `index→url`（2箇所。`memoOpenIdx` 等のDOM取り違え予防）。
3. **HistoryItemRow** サムネキー `index→url`。
4. **FavoritesPanel** 画像キー `index→url`（2箇所）。
5. **GlobalProtectionBar** 理由/警告/提案リストキー `index→` `${i}-${内容}`（衝突安全）。

### C. 状態整合・選択
6. **AnalysisLabPanel** 構成タブ「全選択」を表示中(slice後)→**フィルタ全件**対象に（ページング時の選択不整合修正）。
7. **AnalysisLabPanel** フィルタ変更で表示外になった選択を**自動破棄**（要素/構成。UIの「選択N件」と実適用の乖離を解消）。実機で全選択290→「背景」絞り込みで**選択10件**に自動整理を確認。
8. **AnalysisLabPanel** 未開拓ビュー切替時に選択をリセット。
9. **MiniExplorer** フォルダ移動(`navigateTo`)時に選択(`selectedId/Name`)をリセット（`initRoot`と整合・別フォルダ同IDの誤選択を解消）。
10. **App.tsx** 復旧/再読込(`refreshFavoriteProfile`)時に重複分析センターの集計も同期（従来は色用 items のみ更新で分析が古いまま）。

### D. 性能・メモリ
11. **genreHistory / subStyleHistory** 重複除去 `includes`ループ O(n²) → `Set` O(n)。
12. **operationLog / referenceRecords** prune の逐次 `await remove` → `Promise.all`（上限超過時の数十件削除の遅延を解消）。
13. **backup** blob URL の `revokeObjectURL` を1秒後に遅延（ダウンロード開始前破棄によるリンク切れ防止）。

### E. 例外処理・堅牢化
14. **FavoritesPanel** 削除ボタンの未処理 Promise 拒否に `try/catch`。
15. **motifPolicy.loadComboPolicies** 破損データ（配列JSON）に対する `Array.isArray` ガード追加（挙動不変・防御）。

### （P2同梱）
- **biasAnalyzer.categoryColorClass** カテゴリ色被り4組を別色化（P2・見た目微変更のみ）。

## 2. 影響範囲
- すべて見た目・既存挙動・保存データ構造を変えない局所修正。localStorage キー追加なし。生成/抽出/同一性ロジックは不変。
- 検証済み: tsc/build 緑、実UIでコンソール0エラー・290要素描画・選択プルーン正常・既存パネル回帰なし。

## 3. 残課題（保留＝要ユーザー判断。自動修正していない）
### 3.1 中核（顔/同一性/永続化/生成/抽出）— 報告のみ（22件）
- **idb.ts** readonly tx が `tx.oncomplete` を待たず `req.onsuccess` で resolve（仕様上の結果未保証リスク）。永続化中核のため要レビュー。
- **CompareModeView / imageAnalyzer** の fire-and-forget IDB保存（`void updateReferenceRecord` / `void put`）→ unmount時の保存漏れリスク。await化＋失敗通知を検討。
- **App.tsx 二重送信**: `handleGenerate` が `generating` を見ず `canGenerate` のみ判定（Ctrl+Enter連打で多重 runGenerate の可能性）。
- **settingsPersist** QuotaExceeded をサイレント catch（ユーザー無通知でプリファレンス喪失）。
- **DetailsCard** `as any` 6箇所（detail各軸の型安全低下）、**server/gemini.ts** `as any`（SDKに `promptFeedback` 型が無い）。
- マルチタブ間の `storage` イベント同期なし（ipm_* キーがタブ間で不整合になり得る）。

### 3.2 評価ロジック（スコア）— ユーザー承認後に微調整候補
- **biasAnalyzer.noveltyScore** の 1.1x 乗数でスコア分布が非対称（高duplicateで負→0クランプ）。
- **untappedScore `100-ratio*500`** と **detectTopCombos risk閾値(≥0.10)** と **toMotifRisk(≥0.40)** の閾値不一致（小windowで過敏に danger 化）。
- ※ いずれも「実品質と整合する範囲の微調整」候補。ランキングが動くため就寝中は変更せず保留。

### 3.3 要注意（自動修正見送り）
- **DuplicateAnalysisPanel** index key 10+箇所（衝突回避の慎重なキー設計が必要）。
- **PromptList** 差分ビューの index key（重複行で衝突リスク・実害小）。**PromptGuardSection** index key 7箇所。
- **backup import** の逐次 `put`（復元というデータ機微経路・効果小のため保留）。

### 3.4 誤検出（18件・対応不要）
- PromptCard の FileReader は既に `onerror=reject` 済み／motifTags は既に `!Array.isArray` ガード済み／SimpleImageEditor の `shift()!` は直前に length ガードあり 等。

## 4. 今後の推奨
- 中核の非同期保存を `await` + 失敗時リトライ/通知へ（保存漏れ恒久対策）。
- スコア式の閾値統一（noveltyScore乗数・untapped係数・risk閾値）をユーザー確認のうえ調整。
- 大規模リスト(DuplicateAnalysisPanel)の key 統一、必要なら仮想化。
- `vite build` の 500kB 超チャンク警告 → `manualChunks` で分割（Camera3DPicker/three を別チャンク化）。
- server を `tsc --noEmit` で CI 型チェック対象に（現状 tsx 運用で型エラーが埋もれる）。

**End of Doc 29（P1/P2 とは別の安定化パス・実施分は未push）**
