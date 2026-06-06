# 27. Phase D 設計（Compare評価 → skyveil好みAI 統合・referenceLearning）

> 目的: Compare評価（referenceRecords）を学習データとして skyveil好みAI に統合し、**限定重みの方向性**として
>       生成へ供給する。お気に入り・重複分析は既に統合済み（favoriteProfile / historyAnalysis）。
> 前提: docs/24・25。原則「学習結果は自動適用しない（好みAIトグルON時のみ）／固定ルール最優先」を厳守。

## 0. ユーザー決定（2026-06-06）
- 変換: ⭐ or 全体「良かった(5)」or 項目別👍 → 参照の**適用テキスト**を **likes**。項目別👎 → **avoid**。全体「違う(1)」は match品質の話なので avoid にしない。背景/衣装/ポーズは C2 で履歴ミラー済み＝重複抑制、**髪型/色味/空気感を主に補強**。
- 分析ラボ結果: skyveil へ**追加供給しない**（重複分析の頻出/未開拓は既に historyAnalysis 経由・モチーフlevelは生成へ直接適用済み＝二重回避）。
- 生成供給: **する。ただし likes はそのまま反映せず「参考傾向（方向性）」として限定重み**。新規性・未開拓度・多様性を優先し、同傾向の繰り返しを避ける。未使用ジャンル/低出現要素を積極提案できる設計を保つ。

## 1. 現状の供給構造（確認済み）
- 生成へ効く経路: `buildInputs.favoriteTraits`（＝`favoriteProfile.traitPhrases`・**コピーでなく方向性**・好みAI ON時のみ送信）＋ `preferenceProfile` ＋ `ratingBias`（ratingAnalysis）。
- `skyveilProfile`（buildSkyveilProfile）は **表示用の統合ビュー**（likes/overusedButLiked/avoid/underusedRecommended/summary）。
- C2 で背景/衣装/ポーズの👍👎は history 軸別評価へミラー → ratingAnalysis 経由で既に生成へ効く。⭐は isFavorite 同期 → favoriteProfile。

## 2. 設計（既存「統合ビュー」方式を踏襲・適用ロジック不変）
### 2.1 新規 `src/lib/referenceLearning.ts`
```
buildReferenceLearning(records: ReferenceRecord[]): ReferenceLearning
ReferenceLearning { likes: string[]; avoid: string[]; sampleCount: number; hasData: boolean }
```
- **likes**: 各レコードで
  - `favorite === true` または `userEvalOverall === 5` → その参照の **applied 各軸テキスト**（applied優先・無ければ extracted）。
  - `userAxisEval[cat] === 5`（👍）→ その軸テキスト。**髪型/色味/空気感を優先**、背景/衣装/ポーズは履歴ミラー済みのため重複抑制（重み低・後置）。
  - 出現頻度で集計・dedupe・**上限 8**。
- **avoid**: `userAxisEval[cat] === 1`（👎）→ その軸テキスト。dedupe・上限 8。
- 純粋関数（保存しない）。テキストは「方向性」素材（句）。

### 2.2 `src/lib/skyveilProfile.ts`（表示ビューに統合）
- `buildSkyveilProfile` に入力 `referenceLearning?: ReferenceLearning | null` を追加。
- `likes ← dedupe([...既存, ...referenceLearning.likes], 10)` / `avoid ← dedupe([...既存, ...referenceLearning.avoid], 10)`。
- overusedButLiked / underusedRecommended（新規性・未開拓）は**不変**＝多様性を維持。

### 2.3 `src/App.tsx`（生成供給・限定重み）
- `referenceLearning` state ＋ 非同期 refresh（`getReferenceRecords()`→`buildReferenceLearning`）。マウント時＋評価/生成後に更新（既存 refreshFavoriteProfile 同様）。TDZ回避のため buildInputs からは ref 参照。
- `buildSkyveilProfile` 呼出に `referenceLearning` を追加（ビュー反映）。
- **生成供給（方向性・限定重み・好みAI ON時のみ）**:
  - `favoriteTraits = dedupe([ ...favoriteProfile.traitPhrases, ...referenceLearning.likes.slice(0, 4) ], 上限)`（好みAI ON または今回だけ反映 のゲートは既存と同一）。
  - referenceLearning は **後置＋ slice(0,4) で重みを制限**（favoriteProfile を主、Compare likes は補助）。`favoriteStrength`（弱/標準/強）で強度調整は既存どおり。
  - **avoid は当面ビューのみ**（背景/衣装/ポーズの👎は履歴ミラーで既に ratingBias へ。髪型/色味/空気感の生成回避は将来課題）。
- **不変**: 好みAIトグル/scope限定/固定ルール最優先/サーバ厳守。新規性・未開拓・多様性エンジン（variationEngine・avoidCliche・被り回避・underusedRecommended）は不変＝繰り返し抑制を維持。

## 3. 不変条件・リスク
- 学習は**自動適用しない**（好みAIトグル ON 時のみ供給）。固定ルール（顔・同一性等）最優先。
- 既存の各分析・生成・抽出・保存ロジックは不変（referenceLearning は referenceRecords を**読むだけ**）。
- likes はコピーでなく方向性・**slice(0,4) で限定重み**・favoriteProfile を主とし、Compare likes が支配しない。多様性機構は不変。
- ロールバック: 新ファイル＋入力1つ＋buildInputs の1行マージを revert すれば既存に影響なし。

## 4. 検証計画
- front/server tsc・vite build。
- 隔離オリジン：評価付き referenceRecords をシード → `buildReferenceLearning` が likes/avoid を生成 → `skyveilProfile` に反映、好みAI ON時の `favoriteTraits` に限定数だけ統合される（OFF時は供給されない）ことを確認。

## 5. 実装状況 — ✅ 実装・検証済み（2026-06-06／未コミット）
**変更ファイル**
- `src/lib/referenceLearning.ts`（新規）：`buildReferenceLearning(records)` / `loadReferenceLearning()`。⭐or全体5or項目別👍→likes（髪型/色味/空気感は重み2で補強）、項目別👎→avoid。出現頻度集計・上限8・各句80字。referenceRecords を読むだけ。
- `src/lib/skyveilProfile.ts`：`buildSkyveilProfile` に `referenceLearning?` 入力追加 → likes/avoid にマージ（既存 dedupe・上限10）。overusedButLiked/underusedRecommended は不変＝多様性維持。
- `src/App.tsx`：`referenceLearning` state＋再読込effect（マウント＋Compareクローズ＝評価後）。`skyveilFavoriteTraits` memo（お気に入り傾向 ＋ likes を **slice(0,4) 限定重み・後置**・dedupe・上限12）。`buildInputs.favoriteTraits` は好みAI ON時のみこれを送信（コピーでなく方向性）。`buildSkyveilProfile` 呼出に referenceLearning 追加。

**検証**（front tsc・vite build ✅、隔離 dev で実モジュール import）
- `loadReferenceLearning`：シード3件（⭐/全体5/項目別👍👎）→ likes=[ショートボブ(髪型👍・先頭)/静かで緊張感/赤い映画館/濡れ感ミディアム/低彩度シネマトーン]、avoid=[白い壁]。
- `buildSkyveilProfile({referenceLearning})` が likes/avoid に統合（profileLikesIncludesRL=true）／入力無し→空（sanity）。
- 限定重み・好みAI ON時のみ供給・多様性機構不変は設計どおり（App配線 tsc＋レビュー）。

**不変条件の遵守**: 学習は自動適用しない（トグルON時のみ）／固定ルール最優先／既存分析・生成・抽出・保存は不変。

**End of Doc 27**
