# 24. Compare Mode 設計（Reference Picker 次段階）

> 目的: 参照画像と生成結果を並べて比較し、将来の一致率評価・学習エージェント連携につなげる。
> 前提: [23_reference-import-design.md](./23_reference-import-design.md)。原則 P1〜P7 厳守。

## 0. ユーザー決定（2026-06-06）
- 右ペイン「生成結果」: **A 参照レコードを永続化し batchId で紐付**（⑥学習連携の土台）。
- 一致率: **最初から自動一致率も含める**（生成結果画像を再抽出して項目別比較）。
- 画面配置: **全幅ビュー/モーダル**。

## 1. 3ペイン構成（全幅ビュー）
```
左：参照画像（大・クリック拡大） ｜ 中央：抽出/適用要素 ｜ 右：生成結果画像（＋再抽出要素・一致率）
比較項目（行）：背景 / 衣装 / ポーズ / 髪型 / 色味 / 空気感
各行：参照側テキスト ⇔ 生成側テキスト ＋ 項目別 一致率(%)
```

## 2. データモデル：新ストア `referenceRecords`（追加のみ・破壊なし）
idb.ts に **DB_VERSION 5→6**（`if (oldVersion < 6) createObjectStore("referenceRecords", {keyPath:"id"})` ＋ index: batchId/createdAt）。**v5(operationLog) と同じ加算的migration**。`clear`/`deleteDatabase` は使わない。
```
ReferenceRecord {
  id, createdAt,
  refThumb,             // 参照画像サムネ(dataURL・makeThumbnailで圧縮)
  extracted: {13cats},  // Gemini抽出結果
  applied:   {cat:text},// 実際に適用した軸タグ付き（referenceNote）
  batchId,              // 生成バッチへのリンク
  // 生成側は後追いで参照（history を batchId で引く）
  resultExtracted?: {13cats},  // 生成結果画像の再抽出（一致率用・任意）
  matchScores?: {cat:number},  // 項目別一致率(0-100)
}
```
新 lib `referenceRecords.ts`（save/list/get/getByBatch・operationLog.ts と同型）。

## 3. 連携フロー（生成ロジック本体は不変・記録のみ追加）
1. パネルで抽出→適用すると、App が **参照コンテキスト（reference画像＋extracted）** を保持。
2. `runGenerate` で referenceNote が非空なら、`saveBatch` 後に **ReferenceRecord を1件保存**（refThumb＝makeThumbnail(画像)、applied＝referenceNote、batchId）。※既存の履歴/お気に入り保存は不変、追加保存のみ。
3. 右ペイン生成結果＝その batchId を持つ history アイテムの `resultImageData`（ユーザーが貼り戻した生成画像）。

## 4. 一致率（自動・Phase C）
1. 生成結果画像に対し **既存 `/api/extract-reference` を再利用**して13カテゴリ抽出（`resultExtracted`）。
2. 項目別一致率：新 `/api/compare-reference`（Gemini）に「参照13cats ＋ 生成13cats」を渡し、**背景/衣装/ポーズ/髪型/色味/空気感 を 0-100 で採点**（曖昧な色味・空気感も意味比較できるため Gemini 採点を推奨）。`matchScores` 保存。
3. 将来：この `matchScores` × 評価/お気に入りを学習エージェントが集計（「この参照の背景が好き／高評価」）。

## 5. UI 配置
- 全幅ビュー or 大モーダル `CompareModeView.tsx`（新規）。Reference Picker の「Compare」ボタン、または参照レコード一覧から開く。
- 参照レコード一覧（サムネ＋日時＋適用カテゴリ）→ 選択で3ペイン。
- 生成結果未登録時は「生成結果を貼り戻すと比較できます」。

## 6. Phase 分割
- **Phase A（データ土台）**：`referenceRecords` ストア（DB v6・要承認）＋ `referenceRecords.ts` ＋ 生成時 record 保存（参照→batchId）＋参照画像のApp保持。
- **Phase B（Compare UI）**：`CompareModeView` 3ペイン＋6比較項目＋生成結果画像表示。
- **Phase C（一致率）**：生成結果再抽出（`/api/extract-reference`）＋ `/api/compare-reference`（Gemini採点）＋ `matchScores` 表示・保存。

## 7. 不変条件・リスク
- 生成ロジック・抽出ロジック・**既存の履歴/お気に入り保存は不変**。`referenceRecords` は**新ストア追加のみ**（破壊的migration無し）。
- **DB_VERSION 変更は idb.ts の保護対象**＝明示承認が必要（バンプは加算的・安全だが要サインオフ）。
- 顔/同一性は扱わない。保護設定を上書きしない。一致率の Gemini 採点はコスト増。
- ロールバック：新ストア・新ファイル・新ビューの追加なので、追加分を revert すれば既存に影響なし（v6→既存データは保持）。

## 8. 実装状況
### Phase A（データ土台）— ✅ 実装・検証済み（2026-06-06／未コミット）
**変更ファイル**
- `src/lib/idb.ts`：DB_VERSION 5→6、`STORE_REFERENCE_RECORDS` 追加、`if (oldVersion < 6) createObjectStore("referenceRecords", {keyPath:"id"})` ＋ index `batchId`/`createdAt`（v5(operationLog) と同じ加算的migration。既存ストア・既存データは不変）。
- `src/lib/referenceRecords.ts`（新規）：`ReferenceRecord` 型＋`saveReferenceRecord`/`getReferenceRecords`/`getReferenceRecord`/`getReferenceRecordsByBatch`/`updateReferenceRecord`/`removeReferenceRecord`＋上限500件prune。operationLog.ts と同型・保存はベストエフォート（失敗握りつぶし）。
- `src/App.tsx`：`referenceContextRef`（参照画像＋抽出）／`referenceNoteRef`（適用軸）を ref 化。`runGenerate` の `saveBatch` 後に **参照レコードを1件保存**（参照画像あり＋適用軸1つ以上の時のみ・fire-and-forget・失敗しても生成を妨げない）。生成/抽出/既存保存ロジックは不変、追加のみ。
- `src/components/ReferenceImportPanel.tsx`：`onContextChange?` prop 追加。`image`/`fields` 変化時に `{image, extracted}` を親へ通知（抽出・適用ロジックは不変）。

**検証**
- front `tsc -b --noEmit` ✅／server `tsc --noEmit` ✅／`vite build` ✅（710 modules・既存のchunkサイズ警告のみ）。
- 隔離オリジン（preview 4330・別IDB／実データ非接触）で実機確認：
  - DB `version=6`、ストア＝history/imageFeatures/operationLog/recentImages/selectionHistory/**referenceRecords**（既存欠落なし）、referenceRecords は keyPath`id`・index`batchId`/`createdAt`。
  - put→`batchId` index 取得＝1件・batchId一致・applied/extracted 保持、getAll整合、テストデータは単一キー削除で後片付け（clear/deleteは不使用）。

### Phase B（Compare UI）— ✅ 実装・検証済み（2026-06-06／未コミット）
**変更ファイル**
- `src/components/CompareModeView.tsx`（新規）：全幅モーダル。参照レコード一覧（左レール・新しい順）→3ペイン（左=参照画像/中央=抽出・適用6項目表/右=生成結果画像）。生成結果は `getByIndex(STORE_HISTORY,"batchId")`＋`getResultImages` で取得。lightbox・Escape・空状態（レコードなし／結果なし）。一致率列は `matchScores` があれば表示・無ければ「—」（Phase C）。**読み取り専用**（保存ロジック不変）。
- `src/components/ReferenceImportPanel.tsx`：ヘッダに「🆚 比較」ボタン（`onOpenCompare`・任意）。
- `src/App.tsx`：`compareOpen` state、パネルへ `onOpenCompare`、`<CompareModeView/>` 描画。

**検証**
- front `tsc -b --noEmit` ✅／`vite build` ✅（5.76s。server 変更なし）。
- 隔離オリジン（preview 4330・別IDB）で実機確認：参照レコード2件をシード → 「🆚 比較」起動 →
  - 3ペイン描画・左レール**新しい順**・選択切替 ✅
  - 6項目表（背景/衣装=「適用」バッジ、ポーズ/髪型/色味/空気感=「抽出のみ」）＋一致率「—」placeholder ✅
  - レコードA：batchId から生成結果画像2枚表示 ✅／レコードB：結果なし→空状態文言 ✅
  - 検証後シードは単一キー削除で後片付け（clear/deleteDatabase 不使用）。

### Phase C（一致率）— 未着手（承認待ち）
生成結果画像を `/api/extract-reference` で再抽出 → 新 `/api/compare-reference`（Gemini採点）で6項目を0-100化 → `updateReferenceRecord` で `resultExtracted`/`matchScores` を保存 → 中央表の「—」を実値表示。

**End of Doc 24**
