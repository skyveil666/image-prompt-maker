# 25. Compare Mode Phase C 設計（自動一致率＋ユーザー評価＋学習連携）

> 前提: [24_compare-mode-design.md](./24_compare-mode-design.md)（Phase A/B 実装済み）。原則 P1〜P7 厳守。
> 目的: 生成結果と参照の **一致率(match rate)** を自動採点し、**ユーザー評価（良かった/普通/違う）** を保存。
>       将来の **お気に入り分析 / 神引き分析 / 好み学習** に使える「ラベル付き教師データ」構造を作る。

## 0. 確定事項（2026-06-06 ユーザー承認）
- 評価粒度: **ハイブリッド** ＝ 全体「良/普/違」必須＋任意で6項目👍/👎＋⭐お気に入り。
- 採点方式: **案1（画像ベース1コール）** ＝ 生成結果画像＋参照6項目を Gemini に渡し0-100採点＋生成側抽出も返す。**算出ボタン押下時のみ**実行しキャッシュ（コスト制御）。
- 既存の評価/学習/分析・生成・抽出ロジックは **変更しない**（読むだけ＋軸別評価への**非破壊追記**）。

## 1. 比較項目（6軸）と既存軸との対応
| 比較項目 | referenceRecords キー | 既存 history 軸評価 | 学習連携 |
|---|---|---|---|
| 背景 | background | `resultBgRatings` ✅ | 即（ミラー） |
| 衣装 | outfit | `resultOutfitRatings` ✅ | 即（ミラー） |
| ポーズ | pose | `resultPoseRatings` ✅ | 即（ミラー） |
| 髪型 | hair | （無） | 参照レコードに新軸蓄積（将来） |
| 色味 | color | （無） | 同上 |
| 空気感 | mood | （無） | 同上 |

## 2. データモデル（`referenceRecords` 拡張・新ストアのため破壊なし）
Phase A 予約フィールドを正式化＋評価フィールド追加。`ReferenceRecord` に：
```
resultExtracted? : Record<string,string>   // 生成結果画像の再抽出13カテゴリ（中央表「生成側」列）
matchScores?     : Record<string,number>   // 6項目 0-100
matchComputedAt? : number
resultImageRef?  : { historyItemId: string; imageIndex: number }  // 採点・評価した生成結果の出所
userEvalOverall? : 5 | 3 | 1               // 良かった=5 / 普通=3 / 違う=1（既存スケール準拠）
userAxisEval?    : Record<string, 5 | 1>   // 任意・押した軸のみ（👍=5 / 👎=1）
favorite?        : boolean
evaluatedAt?     : number
```
→ 1レコード＝「参照スタイル → 生成結果 → 客観一致率(軸別) → 主観評価(全体＋軸別) → お気に入り」の教師データ。

## 3. 採点（案1・サーバ追加のみ）
### 3.1 新エンドポイント `POST /api/compare-reference`（`server/src/referenceCompare.ts` 新規）
**Request**
```
{ resultImageDataUrl: "data:image/...;base64,...",
  referenceItems: { background?, outfit?, pose?, hair?, color?, mood? } }  // applied優先・無ければextracted
```
**Response**
```
{ version: 1,
  scores: { <対象項目>: 0-100 },            // 渡された項目のみ採点
  reasons?: { <項目>: "短評" },
  resultExtracted: { 13カテゴリ },           // 生成側の再抽出（生成側列・将来比較用）
  model: string }
```
- 実装は `referenceExtract.ts` と同型（GoogleGenAI・systemInstruction・temperature 0.2・responseMimeType json・入力検証・SAFETY時メッセージ）。
- SYSTEM 指針：生成結果画像を観察し、各参照項目に**どれだけ一致するか0-100**で採点（100=ほぼ一致/70+=おおむね/40-69=部分/<40=不一致）。**顔・同一性・年齢・人物特定は採点も記述もしない**。併せて画像の13カテゴリを抽出。固有名詞・透かし・画像内文字は出さない。
- 既存 `gemini.ts`/`promptSystem.ts`/`referenceExtract.ts`/`scopeFilter.ts` は不変。`/api/extract-reference` も不変。

### 3.2 クライアント
- `src/lib/backendClient.ts`：`compareReferenceViaBackend(resultImageDataUrl, referenceItems)` 追加（BUG-11 同様 単一 text()→JSON.parse）。
- 採点は **「🎯 一致率を算出」ボタン押下時のみ**。結果を `updateReferenceRecord(id, {matchScores, resultExtracted, matchComputedAt, resultImageRef})` で保存しキャッシュ（再算出しない・コスト制御）。

## 4. ユーザー評価（ハイブリッド）と保存
- UI：全体「良かった/普通/違う」（必須・3ボタン）＋折りたたみで6項目👍/👎＋⭐お気に入り。
- 保存：`updateReferenceRecord(id, {userEvalOverall, userAxisEval, favorite, evaluatedAt, resultImageRef})`。
- スケールは既存（5=良/1=悪/3=中）に統一。

## 5. 学習連携（既存ロジック不変・読むだけ＋非破壊追記）
1. **好み学習(skyveil)** — 即反映：
   - 6項目のうち **背景/衣装/ポーズ** の👍/👎を、`resultImageRef` が指す `PromptHistoryItem` の `resultBgRatings/resultOutfitRatings/resultPoseRatings[imageIndex]` に**追記**。
   - **非破壊**：既存が `null`（未評価）の時だけ書く。履歴側の手動評価は上書きしない。
   - 既存 `ratingAnalyzer.analyzeRatings()` → `buildSkyveilProfile()` が自動消費（**新しい分析コード不要**）。
   - 髪型/色味/空気感は history に軸が無いため参照レコードに蓄積（将来 ratingAnalyzer 拡張で取り込み）。
2. **お気に入り分析** — `favorite` を既存 `isFavorite` と整合：Compare の⭐ON時、`resultImageRef` の history item を `isFavorite=true` に**追記同期**（OFFは参照レコード側のみ更新＝履歴を勝手に外さない）。将来 `favoriteProfile` が参照レコードの `extracted/applied` も材料化できる構造。
3. **神引き分析** — 構造のみ：`matchScores × userEvalOverall × viralMode` を将来集計する素地（保存のみ）。
4. **操作ログ** — `logOperation("compare_eval", { refId, batchId, overall, axisEval, avgMatch })`（append-only・既存は未知 detail を無視）。

> 将来 Phase D：専用集計 `referenceLearning.ts` で「どの参照スタイルが高評価/高一致だったか」「一致が高い/低い時に満足したか（＝参照追従が好みか・逸脱が好みか）」を分析。今回はその土台（保存＋既存軸への橋渡し）まで。

## 6. UI（`CompareModeView` への追加のみ・他は不変）
- 右ペイン各生成結果に「🎯 一致率を算出」ボタン → 中央表の「一致率」列に色分け%、「生成側(抽出)」列に `resultExtracted` を表示。
- 評価バー：良かった/普通/違う＋折りたたみ6項目👍/👎＋⭐。保存状態を表示。
- 生成結果のロード時に **出所（historyItemId, imageIndex）を保持**（評価ミラー先を特定するため）。Phase B の表示構造は維持。

## 7. 段階導入（各独立検証）
- **C1（一致率）**：`referenceCompare.ts`＋`/api/compare-reference`＋`compareReferenceViaBackend`＋算出ボタン＋`matchScores/resultExtracted` 保存＋中央表の一致率/生成側表示。
- **C2（評価・学習）**：ハイブリッド評価UI＋`userEvalOverall/userAxisEval/favorite` 保存＋背景/衣装/ポーズの軸別評価ミラー（非破壊）＋⭐同期＋`logOperation`。

## 8. 不変条件・リスク・ロールバック
- 顔/同一性は採点も記述もしない。保護設定は上書きしない。
- 既存の `ratingAnalyzer/favoriteProfile/skyveilProfile/preferenceProfile/historyAnalyzer/imageAnalyzer`・サーバ `promptSystem`・`referenceExtract` は**不変**。Compare からは**読む＋非破壊追記**のみ。
- 一致率は **on-demand**（ボタン）でコスト制御・1回算出でキャッシュ。
- 軸別評価ミラー＝**null の時だけ書く**。⭐同期＝**true追記のみ**（false は履歴に伝播しない）。
- ロールバック：サーバ新ファイル/新エンドポイント・クライアント追加分・参照レコードの追加フィールドを revert すれば既存に影響なし（履歴の追記分は残るが既存スキーマ互換）。

## 9. 検証計画
- front/server `tsc`・`vite build`。
- 隔離オリジン：参照レコード＋history(batchId, 結果画像)をシード → 算出ボタンで `/api/compare-reference`（実Gemini）→ `matchScores` 表示・保存、評価保存、背景/衣装/ポーズが history 軸に**null時のみ**ミラーされること、`logOperation` 記録を確認。
- 実機(5173)：実画像で「参照適用→生成→結果貼り戻し→算出→評価」一連と、好み学習への反映をユーザー確認。

## 10. 実装状況
### C1（一致率）— ✅ 実装・検証済み（2026-06-06／未コミット）
**変更ファイル**
- `server/src/referenceCompare.ts`（新規）：`compareReference(resultImageDataUrl, referenceItems)` ＝ 案1（生成画像＋参照6項目を Gemini が0-100採点＋生成側13カテゴリ抽出）。`referenceExtract.ts` と同型。採点プロンプトは「合っていれば高く・明確に違えば低く／表面的共通点で高得点にしない」のバランス版。
- `server/src/index.ts`：`/api/compare-reference`（入力検証・各値160字制限・500ハンドリング）。既存 `/api/extract-reference`・`gemini.ts`・`promptSystem.ts`・`referenceExtract.ts` 不変。
- `src/lib/backendClient.ts`：`compareReferenceViaBackend`（BUG-11方式の単一読み）。
- `src/lib/referenceRecords.ts`：`ReferenceRecord` 型拡張（matchComputedAt / resultImageRef / userEvalOverall / userAxisEval / evaluatedAt）。`rating?` を `userEvalOverall?` に整理。
- `src/components/CompareModeView.tsx`：生成結果の出所(historyItemId/imageIndex)保持、各結果に「🎯 一致率を算出」、中央表を4列（項目/参照(抽出)/生成側(抽出)/一致率）＋色分け%に。算出は on-demand・結果は `updateReferenceRecord` でキャッシュ。

**検証**
- front `tsc -b --noEmit` ✅／server `tsc --noEmit` ✅／`vite build` ✅（4.80s）。
- 実 Gemini 採点（API3001）— 識別力テスト：青画像Aを抽出→Aの項目で採点。
  - 自己一致（A画像×A記述）＝ background100/color100/mood70（**avg 90**）、別画像（B緑画像×A記述）＝ 30/30/30（**avg 30**）。**一致は高・不一致は低**を確認。
  - ※ tsx watch のリロード直後は採点が一時的に振れる（編集直後の実行は避け、収束後に検証）。
- UI e2e（隔離 dev 5198・/api→3001 プロキシ・別IDB）：参照レコード＋実PNG結果をシード →「🎯 一致率を算出」クリック →
  - `/api/compare-reference` 実コール → 中央表に色分け%＋「生成側」列表示 ✅
  - `referenceRecords` に matchScores / resultExtracted(13) / resultImageRef{h_c1,0} / matchComputedAt 永続化 ✅、UIエラーなし ✅。
  - 検証シードは単一キー削除で後片付け。
- 別件（スコープ外）：`ReflectionStatusBar.tsx:153` の button-in-button DOMネスト警告を発見 → 別タスクに切り出し（task_343000e6）。

### C2（評価・学習連携）— ✅ 実装・検証済み（2026-06-06／未コミット）
**変更ファイル**
- `src/components/CompareModeView.tsx`：評価バー（全体 良=5/普=3/違=1 ＋任意6項目👍=5/👎=1 ＋⭐）。保存先＝`referenceRecords`（userEvalOverall/userAxisEval/favorite/evaluatedAt/resultImageRef）。
  - 学習連携：背景/衣装/ポーズの👍👎を、評価対象生成結果(resultImageRef→無ければ先頭)の `history.resultBg/Outfit/PoseRatings[idx]` へ **null時のみ非破壊ミラー**（既存 `ratingAnalyzer→buildSkyveilProfile` が自動消費）。髪型/色味/空気感は参照レコードのみ蓄積。⭐は `history.isFavorite=true` 追記同期。
  - `logOperation("rate", { kind:"compare_eval", refId, batchId, overall })`（operationLog の型は不変＝既存"rate"＋detailで記録）。
- 既存 `history.updateItem` / `buildAxisRatingPatch` / `getAxisRatingAt` を再利用（評価/学習/分析ロジックは不変）。

**検証**（front tsc/build ✅、隔離 preview 4330）
- 良かった→`userEvalOverall:5`、⭐→`favorite:true`＋`history.isFavorite:true`、背景👍→`userAxisEval.background:5`＋`history.resultBgRatings:[5]`（null→5）、髪型👎→参照レコードのみ（履歴軸なし）、operationLog compare_eval 1件 ✅。
- **非破壊保証**：履歴が[5]の状態で背景👎→参照側は1に更新・`history.resultBgRatings:[5]` のまま（**既存評価を上書きしない**）✅。
- 検証シードは後片付け（isolated origin）。

→ Compare Mode A/B/C1/C2 完了（一致率＋ハイブリッド評価＋好み学習連携）。

**End of Doc 25**
