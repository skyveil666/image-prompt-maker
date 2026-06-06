# 17. AI分析ライブビュー（Phase 2.2）

> **目的**: ユーザーが「今何を分析しているか」と「各分析がいつ実行され、生きているか」を、
> スクロール位置に関わらず常時確認できるようにする。
> **依拠**: [master-plan-v1.md §11 AI分析ライブビュー](./master-plan-v1.md), [16_future-roadmap.md §1.3](./16_future-roadmap.md)
> **制約**: 既存分析ロジック（lib/*Analyzer 等）は一切変更しない。

---

## 1. 現状整理（実装前）

5つの分析はすでに `analysisLive`（[useAnalysisLive.ts](../src/lib/useAnalysisLive.ts)）に配線済みだった:

| 対象分析 | 発火元（App.tsx） | analysisLive ステップ |
|---|---|---|
| 重複分析 | `runBiasAnalysis` | `duplicateAnalysis` |
| 色分析 | `runBiasAnalysis` | `colorAnalysis` |
| 画像分析 | `startImageAnalysis` | `imageAnalysis` |
| お気に入り分析 | `refreshFavoriteProfile` / `runBiasAnalysis` | `favoriteAnalysis` |
| skyveil好みAI | `handleRunPreferenceAnalysis` | `skyveilPreferenceAnalysis` |

ギャップ:
- **G1**: 詳細パネル `AnalysisLiveView` が中央スクロールカラム内にあり常時表示でない。
- **G2**: 5分析の「件数・鮮度」を俯瞰できない。
- **G3**: 単一 `analysisLive` のため複数分析が衝突すると後勝ち（→ Phase 5 候補 [16 §4.3](./16_future-roadmap.md)）。

---

## 2. 表示仕様

### 2.1 常時表示（折りたたみ時）

```
🤖 AI分析  [● 色傾向を分析中… 60%]            ← running 時：現在ステップ + 進捗
🔁重複 1件/2分前  🎨色 50件/3日前  📸画像 28/40/10秒前  ⭐お気に入り 12件/5日前  🧬skyveil 30件/1時間前
```

各カードは **アイコン / 生存ドット / ラベル / 件数 / 鮮度（相対時刻）** を縦に表示。

### 2.2 生存ドット（「分析が生きている」可視化）

| 状態 | 表示 |
|---|---|
| 実行中（該当カテゴリ） | 🔵 シアン・パルス + 鮮度欄「分析中」 |
| データあり | 🟢 エメラルド + 鮮度（例「2分前」） |
| 未実行 | ⚪ グレー + 「未実行」・件数「—」 |

### 2.3 件数の定義（既存 state から算出）

| カテゴリ | 件数 | 鮮度ソース |
|---|---|---|
| 重複分析 | `historyAnalysis.windowSize`件 | `historyAnalysis.analyzedAt`（既存・実値） |
| 色分析 | `colorAnalysis.windowSize`件 | App側スタンプ（再計算検知） |
| 画像分析 | `totalAnalyzed`/`totalEligible` | `max(ImageFeature.analyzedAt)`（既存・永続） |
| お気に入り | `favoriteProfile.favoriteCount`件 | App側スタンプ（再計算検知） |
| skyveil好み | `preferenceProfile.sampleSize`件 | `preferenceProfile.generatedAt`（既存・永続） |

> 永続タイムスタンプ（画像・skyveil・重複の一部）はリロード後も真の経過時間を表示。
> 色・お気に入りはタイムスタンプを持たないため、再計算（≒セッション内の最終実行）を App 側でスタンプ。

### 2.4 相対時刻フォーマット

`未実行 / たった今(<10s) / N秒前(<60s) / N分前(<60m) / N時間前(<24h) / N日前`
30秒ティッカー（表示専用）でラベルを更新し「生きている」感を出す。

### 2.5 展開時（補足のみ）

実行中なら現在分析名＋進捗、完了なら所要秒数＋根拠数、待機中なら更新タイミングの説明。
詳細な 13 ステップ / ログ / 根拠は既存 `AnalysisLiveView` が担当（住み分け）。

---

## 3. コンポーネント構成

```
[新規] AnalysisStatusStrip.tsx        ← 常時表示・読み取り専用（件数+鮮度+生存ドット）
[既存・無変更] AnalysisLiveView.tsx     ← 詳細（13ステップ/ログ/根拠）。中央カラムに残置
[既存・無変更] useAnalysisLive.ts       ← 状態コンテナ
[既存・無変更] analysisLiveTypes.ts
[無変更] lib/colorAnalyzer / imageAnalyzer / historyAnalyzer / favoriteProfile / preferenceProfile
```

**表示位置**: GlobalProtectionBar（Phase 2.1）と同じ sticky スタック内、その直下。

```
┌─ sticky top-0 z-40（App.tsx のラッパー）
│   🛡 GlobalProtectionBar     （無変更）
│   🤖 AnalysisStatusStrip     （新規・今回）
└─ 3カラムグリッド（スクロール領域）
      └ 🤖 AnalysisLiveView（詳細・無変更）
```

GlobalProtectionBar を編集せずに済むよう、App.tsx で両者を1つの sticky ラッパーで囲む。

---

## 4. 実装完了記録（2026-06-04）

### 4.1 影響ファイル（最小変更）

| ファイル | 変更 |
|---|---|
| `src/components/AnalysisStatusStrip.tsx` | 新規作成（読み取り専用） |
| `src/App.tsx` | import 1行 / 色・お気に入りのスタンプ state + effect 2本 / `imageAnalyzedAt` useMemo / `analysisCategories` useMemo / GPB+Strip を sticky ラッパーで囲み Strip を1つ追加 |

**変更なし**: `AnalysisLiveView.tsx` / `useAnalysisLive.ts` / `analysisLiveTypes.ts` / 全 `lib/*Analyzer.ts` / `GlobalProtectionBar.tsx`。

### 4.2 リアルタイム更新方式

- 既存 `analysisLive` state 変化による React 再描画（新規ポーリングなし）。
- 相対時刻ラベルのみ 30秒ティッカーで更新（Strip 内・表示専用）。
- 件数・鮮度は `useMemo` で既存 state から算出。

### 4.3 衝突対応

案①（現状維持・最小）。複数同時表示は Phase 5 候補（[16 §4.3 分析キュー化](./16_future-roadmap.md)）。

### 4.4 検証結果

| 検証 | 結果 |
|---|---|
| フロント `tsc -b --noEmit` | ✅ exit 0 |
| `vite build` | ✅ exit 0 |
| 空DB（履歴なし） | ✅ 5カードすべて「— / 未実行」 |
| 履歴1件（お気に入り）注入 → リロード | ✅ 重複「1件/たった今」・色「1件/たった今」・お気に入り「1件/たった今」、画像「—/未実行」・skyveil「—/未実行」（混在状態を正しく区別） |
| sticky スタック | ✅ GlobalProtectionBar 直下に常時表示 |
| 既存 AnalysisLiveView との共存 | ✅ 中央カラムに残置・住み分け |

### 4.5 既知の制限（範囲外）

- 色・お気に入りの鮮度はセッション内の最終再計算時刻（永続タイムスタンプを持たないため）。
- 複数分析同時の個別パルス表示は未対応（Phase 5 候補）。
- モバイル全画面オーバーレイ展開は未対応（grid-cols が 3→5 へ折返す簡易対応）。

---

## 4.6 追補：コンパクト化（2026-06-04・Phase 3 P1 縦スペース削減）

実運用で AnalysisStatusStrip の占有面積が大きく注視されないと判明したため、**1行コンパクトチップ**へ圧縮。

- **Before**: ヘッダ行 + 5大型カード（縦積み・件数ラベル・カテゴリ名・未実行テキスト）≈ 110px
- **After**: 1行（`🤖 AI分析  dot+絵文字+件数・鮮度 ×5  [詳細]`）≈ **31px（約72%削減**・目標50%超）
- **チップ状態**: 実行中=🔵シアン・パルス+「分析中…」/ 完了=🟢緑ドット+件数・相対時刻 / 未実行=⚪グレードット+絵文字のみ
- **絵文字**: 📘重複 / 🎨色 / 🖼画像 / ⭐お気に入り / 🧬skyveil
- **削除**: 大型カード・「未実行」テキスト・件数の「件」表記・カテゴリ名の縦配置・「待機中（…）」説明文（→ tooltip 化）
- **[詳細]**: AnalysisLiveView へスクロール委譲（App.tsx で `analysisLiveRef` を AnalysisLiveView ラッパーに付与し `onDetail` で `scrollIntoView`）
- **変更ファイル**: `AnalysisStatusStrip.tsx`（書き換え）/ `App.tsx`（icon・count文字列・ref/onDetail のみ）
- **無変更**: useAnalysisLive / analysisLiveTypes / AnalysisLiveView / 全 `lib/*Analyzer`
- **検証**: tsc・vite build exit 0。実機で高さ31px・5分析の状態/鮮度・[詳細]スクロール連携を確認

---

## 5. 関連ドキュメント

- [master-plan-v1.md §11](./master-plan-v1.md)
- [14_analysis-engine.md](./14_analysis-engine.md)（7エンジンの責務）
- [15_skyveil-learning.md](./15_skyveil-learning.md)
- [10_protection-bar常時表示.md](./10_protection-bar常時表示.md)（sticky スタックの先行実装）
- [16_future-roadmap.md §4.3](./16_future-roadmap.md)（分析キュー化）

---

**End of Doc 17**
