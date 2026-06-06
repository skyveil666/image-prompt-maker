# 15. Skyveil 学習システム 設計書

> **目的**: 「skyveil好みAI」の **3層構造** と **5入力 → 統合 → 採点** の流れを明示し、「学習結果は自動適用しない」原則（P7）が技術的にどう守られているかを示す。
> **依拠**: [master-plan-v1.md §2.P7](./master-plan-v1.md), [master-plan-v1.md §8](./master-plan-v1.md)

---

## 1. 3 層構造

```
┌──────────────────────────────────────────────────────────┐
│ Layer 1: 基礎分析（5系統並走）                              │
│                                                          │
│  favoriteProfile    ヒューリスティック                     │
│  preferenceProfile  実 Gemini Flash 分析                  │
│  ratingAnalysis     軸別👍👎統計                          │
│  imageAnalysis      視覚的重複・カテゴリ偏り                │
│  historyAnalysis    モチーフ頻度・コンボ                   │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Layer 2: 統合（skyveilProfile）                            │
│                                                          │
│  buildSkyveilProfile() が 5 つを束ねて 4 つに整理:         │
│    likes / overusedButLiked / avoid / underusedRecommended│
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Layer 3: 採点（skyveilScore）                              │
│                                                          │
│  calculateSkyveilScore() が個別案を 6 軸で採点              │
│    identitySafety / lockCompliance / originality /        │
│    trendBalance / aiBiasAvoidance / buzzPotential         │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Layer 1: 5 入力の詳細

### 2.1 favoriteProfile（ヒューリスティック集計）

| 項目 | 内容 |
|---|---|
| 実装 | [src/lib/favoriteProfile.ts](../src/lib/favoriteProfile.ts) |
| 入力 | `isFavorite = true` の `PromptHistoryItem[]` |
| 出力 | `FavoriteProfile { traitPhrases, topMoodLabels, viralRatio, ... }` |
| 計算 | 約 30 の `TraitDef` で tokens マッチ → カテゴリ別頻度集計 |
| 採用基準 | 出現率 ≥ 20% のトレイト + 神引き率 ≥ 40% なら「神引き志向」追加 |
| Gemini呼ぶか | ❌ 呼ばない |

### 2.2 preferenceProfile（実 AI 分析）

| 項目 | 内容 |
|---|---|
| 実装 | [src/lib/preferenceProfile.ts](../src/lib/preferenceProfile.ts) |
| 入力 | 評価付き画像サンプル（`collectSamples()` で抽出） |
| 出力 | `{ generatedAt, model, sampleSize, likes, dislikes, preferKeywords, avoidKeywords, summary }` |
| 計算 | Gemini Flash で軸別好み傾向を抽出（バックエンド経由） |
| 採用基準 | 評価 ≥ 1 件付きサンプル ≥ MIN_SAMPLES (5) |
| Gemini呼ぶか | ✅ サーバ側 `/api/analyze-preferences` |

### 2.3 ratingAnalysis（軸別👍👎統計）

| 項目 | 内容 |
|---|---|
| 実装 | [src/lib/ratingAnalyzer.ts](../src/lib/ratingAnalyzer.ts) |
| 入力 | 全 `PromptHistoryItem` の `resultRatings + resultBg/Outfit/PoseRatings` |
| 出力 | `RatingAnalysis { totalRatedImages, axes[], topRecommended, topAvoid, preferenceReport }` |
| 計算 | 軸別 score = (good×2 - bad×2) / total |
| 採用基準 | `preferenceReport.active = (totalRatedImages ≥ 30)` |
| Gemini呼ぶか | ❌ |

### 2.4 imageAnalysis（視覚分析）

| 項目 | 内容 |
|---|---|
| 実装 | [src/lib/imageAnalyzer.ts](../src/lib/imageAnalyzer.ts) |
| 入力 | 結果画像（dHash 64bit + ドミナント色 + 輝度） |
| 出力 | `ImageAnalysisResult { clusters, overusedCategories, underusedCategories, ... }` |
| 計算 | union-find クラスタリング (Hamming ≤ 10bit) + カテゴリ集計 |
| Gemini呼ぶか | ❌（dHash はローカル計算） |

### 2.5 historyAnalysis（モチーフ・コンボ）

| 項目 | 内容 |
|---|---|
| 実装 | [src/lib/historyAnalyzer.ts](../src/lib/historyAnalyzer.ts) |
| 入力 | 全履歴 + 直近 90 日窓 |
| 出力 | `FullHistoryAnalysis { topMotifs, topCombos, untappedGenres, radarData }` |
| 計算 | 20 モチーフ × 履歴件数 + 2-3 要素コンボ全列挙 |
| Gemini呼ぶか | ❌ |

---

## 3. Layer 2: buildSkyveilProfile アルゴリズム

[src/lib/skyveilProfile.ts:76-121](../src/lib/skyveilProfile.ts#L76)

### 3.1 入出力

```ts
function buildSkyveilProfile(input: {
  preferenceProfile: PreferenceProfile | null;
  favoriteProfile:   FavoriteProfile   | null;
  ratingAnalysis:    RatingAnalysis    | null;
  imageAnalysis:     ImageAnalysisResult | null;
  historyAnalysis:   FullHistoryAnalysis | null;
}): SkyveilProfile {
  if (!hasData) return EMPTY;
  // ...合成ロジック
}
```

### 3.2 出力 SkyveilProfile

| フィールド | 由来 | 内容 |
|---|---|---|
| `likes` | favoriteProfile.traitPhrases + preferenceProfile.preferKeywords + ratingAnalysis.topRecommended | 「好み」最大10件 |
| `overusedButLiked` | favoriteProfile ∩ historyAnalysis.topMotifs | 「好きだが出すぎ」 |
| `avoid` | preferenceProfile.avoidKeywords + ratingAnalysis.topAvoid | 「避けたい」 |
| `underusedRecommended` | imageAnalysis.underusedCategories + historyAnalysis.untappedGenres | 「未開拓おすすめ」 |

### 3.3 nullセーフ

5入力のいずれかが null でも EMPTY を返し fail しない。各入力は `??` で防御。

### 3.4 強度（SkyveilStrength）

[skyveilProfile.ts](../src/lib/skyveilProfile.ts) の `favoriteToStrength()`:

| favoriteStrength | SkyveilStrength | UI ラベル |
|---|---|---|
| 1 | `weak` | 弱 |
| 2 | `standard` | 標準 |
| 3 | `strong` | 強 |

`STRENGTH_TO_FAVORITE` で逆変換も可能。

---

## 4. Layer 3: calculateSkyveilScore

[src/lib/skyveilScore.ts:57-176](../src/lib/skyveilScore.ts#L57)

### 4.1 6 軸スコア

| 軸 | 重み | 検査内容 |
|---|---|---|
| identitySafety | 28% | faceLock + 肯定ワード + 危険語句なし |
| lockCompliance | 24% | 保護軸への干渉ワードなし |
| originality | 14% | AI_CLICHE（量産AI慣用句）が少ない |
| trendBalance | 12% | 流行寄りすぎず・古すぎず |
| aiBiasAvoidance | 12% | massAI 結果 + 具体語の量 |
| buzzPotential | 10% | SNS映えキーワード |

### 4.2 重要

> **このスコアは表示・参考用のみで、自動でプロンプトを変更しない**（P7 遵守）

---

## 5. 反映の3モード（P6 / P7）

### 5.1 OFF（既定で OFF→ON 切替）

| favoriteLearnEnabled | skyveilOneShot | 送信内容 |
|---|---|---|
| false | false | preferenceProfile / favoriteTraits / ratingBias を **送信しない** |
| true | false | 送信する（常時 ON） |
| false | true | **1 回だけ** 送信する → 生成後 false にリセット |

### 5.2 oneShot のクリア

[App.tsx:836-837](../src/App.tsx#L836):
```ts
// 今回だけ反映は1回使ったら解除
if (skyveilOneShot) setSkyveilOneShot(false);
```

→ **明示的に 1 回限定**。次回の生成では送られない。

---

## 6. 自動学習トリガー（P7 を破らない範囲で）

[src/lib/preferenceProfile.ts](../src/lib/preferenceProfile.ts) の自動学習:

| 定数 | 値 | 意味 |
|---|---|---|
| `MIN_SAMPLES` | 5 | 最低限の評価数。これ未満では分析しない |
| `AUTO_NEW_SAMPLE_THRESHOLD` | 5 | 新規評価が +5 増えるごとに自動分析 |
| `AUTO_COOLDOWN_MS` | 3 分 | 連続自動分析の禁止期間 |
| `AUTO_DEBOUNCE_MS` | 20 秒 | 評価変更後の待機時間 |

### 6.1 P7 との整合性

> 「自動学習」は **preferenceProfile の更新**であり、**生成への自動反映ではない**。

```
[評価 +5] → debounce 20s → cooldown 3min → analyzePreferencesViaBackend()
                                              ↓ Gemini Flash 呼出
                                              ↓
                                          preferenceProfile 更新（localStorage）
                                              ↓
                                          (favoriteLearnEnabled=true ならば次回送信)
                                              (favoriteLearnEnabled=false なら待機)
```

→ **学習結果が更新されても、`favoriteLearnEnabled = false` の限り生成に反映されない**。P7 遵守。

### 6.2 自動学習 ON/OFF

[preferenceProfile.ts](../src/lib/preferenceProfile.ts) の `loadAutoLearn / saveAutoLearn`。
ユーザーが UI から ON/OFF 可能。**自動学習 OFF にすれば一切走らない**。

---

## 7. UI 上の操作

### 7.1 SkyveilBar.tsx

| UI 要素 | 操作 |
|---|---|
| ON/OFF トグル | `favoriteLearnEnabled` を切り替え |
| 強度ボタン（弱/標準/強） | `favoriteStrength` を 1/2/3 |
| 今回だけ反映ボタン | `skyveilOneShot = true` |
| プロファイルを見るボタン | 詳細展開 |
| 好み分析を更新ボタン | `handleRunPreferenceAnalysis(false)` （手動実行） |
| 反映リセットボタン | `clearPreferenceProfile()` |

### 7.2 成功パターン展開

SkyveilBar 内に `extractSuccessPromptPatterns()` の結果を表示し、「この型を現在設定に反映」ボタンを提供。
反映は **2 段階**:
1. `handleApplyPattern()` でプレビュー作成
2. `handleConfirmPattern()` で確定（背景固定 ON / 衣装 OFF などはブロック）

---

## 8. 操作ログとの関係

[src/lib/operationLog.ts](../src/lib/operationLog.ts):

| イベント | 記録内容 |
|---|---|
| `generate` | scopes, count, outputType, skyveil（off/weak/standard/strong）, viral |
| `policy_apply` | （重複分析の反映ボタン押下） |
| `favorite` | お気に入り変化 |
| `rate` | 評価変更 |
| `fail_memo` | 失敗理由記録（severity） |

→ **すべてローカル**（IndexedDB / localStorage）。API 送信しない。

---

## 9. プライバシー（ローカル完結）

- 評価データ・お気に入り・失敗メモはすべて **ブラウザ内のみ** に保存
- 自動学習で Gemini に送るのは「**現在分析中のサンプル**」のみ
- 送信されたサンプルは Gemini のレスポンスを受け取った後、サーバ側で保持しない
- API キーはサーバ `.env` のみ

参照: [00_概要.md](./00_概要.md) §安全方針

---

## 10. 「学習結果を無視したい」場合の操作手順

ユーザーが学習結果を **完全に無視** したいとき:

| 目的 | 操作 |
|---|---|
| 一時的に学習を無視 | SkyveilBar の ON/OFF を OFF |
| 学習データを削除 | SkyveilBar の「反映リセット」ボタン → `clearPreferenceProfile()` |
| 自動学習を止める | SkyveilBar の自動学習トグルを OFF |
| 重複分析の反映を解除 | DuplicateAnalysisPanel ヘッダの「反映解除」 |
| 全部リセット | 上記すべて |

---

## 11. 関連ドキュメント

- [master-plan-v1.md §2 P7](./master-plan-v1.md)
- [master-plan-v1.md §8 skyveil好みAI](./master-plan-v1.md)
- [06_お気に入り学習.md](./06_お気に入り学習.md)
- [14_analysis-engine.md](./14_analysis-engine.md)
- [11_UI重複一覧.md #3, #8](./11_UI重複一覧.md)

---

## 12. 未決事項

| # | 論点 | 推奨 |
|---|---|---|
| Q1 | favoriteProfile を完全に廃止して preferenceProfile + ratingAnalysis のみにするか | **維持**（Gemini 不要のフォールバック価値あり） |
| Q2 | skyveilProfile の入力5系統をユーザーが個別に有効/無効にできるようにするか | **将来課題**（現状は all-or-nothing） |
| Q3 | 自動学習のクールダウン3分・新規5件は適切か | **A/Bテスト後に調整** |
| Q4 | preferenceProfile を IndexedDB に移行するか | **localStorage 維持**（軽量・移行コスト > 利益） |

---

**End of Doc 15**
