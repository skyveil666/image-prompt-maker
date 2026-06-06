# 14. 分析エンジン群 設計書

> **目的**: 7 つの分析エンジン（biasAnalyzer / historyAnalyzer / imageAnalyzer / colorAnalyzer / ratingAnalyzer / massAIBias / aiAgent + analyzeProposal）の **責務境界** と **データフロー** を明示する。
> **依拠**: [master-plan-v1.md](./master-plan-v1.md) §7-§8

---

## 1. エンジン一覧と責務マトリックス

| エンジン | 入力 | 出力 | 計算粒度 | 起動タイミング |
|---|---|---|---|---|
| **biasAnalyzer** | 現バッチ + 直近20件 | duplicateScore (0-100), warnings | バッチ単位 | 生成後 |
| **historyAnalyzer** | 全履歴 + 直近90日窓 | topMotifs, topCombos, untappedGenres, radarData | 履歴全体 | 起動時 + 生成後 |
| **imageAnalyzer** | 結果画像（IndexedDB） | clusters, overusedCategories, itemScores | 画像単位 | タブ開いた時 |
| **colorAnalyzer** | 直近 50/100 件のテキスト | 12色 × 5軸 出現率, 偏り警告 | 履歴ウィンドウ | 履歴変化時 |
| **ratingAnalyzer** | 全履歴の resultRatings | 軸別👍👎統計, 推奨/回避リスト | 履歴全体 | 評価変化時 |
| **massAIBias** | 単一プロンプト | 5カテゴリ別テンプレ濃度 | 案単位 | 案表示時 |
| **aiAgent** | 上記すべての結果 + 設定 | trendSummary, problems, recommendations, actions | 全体統合 | 重複分析パネル展開時 |
| **analyzeProposal** | 案のプロンプト + lock + skyveilProfile | validation + identityRisk + massAI + skyveilScore | 案単位 | 案カード展開時 |

---

## 2. データ入力ソース

```
┌────────────────────────────────────────────────────┐
│ IndexedDB                                          │
│   ├── prompt-history (全 PromptHistoryItem)        │
│   ├── favorites (isFavorite フラグ付き)             │
│   ├── image-thumbs (サムネ画像)                    │
│   └── image-features (dHash + ドミナント色)          │
└────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────┐
│ App.tsx state                                      │
│   ├── historyItemsForColor (色分析の入力)            │
│   ├── recentItems (直近90日フィルタ済み)             │
│   ├── imageFeatureMap (Map<id, ImageFeature>)      │
│   ├── massProductionResult (biasAnalyzer 出力)      │
│   └── historyAnalysis (historyAnalyzer 出力)         │
└────────────────────────────────────────────────────┘
        │
        ▼
[各エンジン]
```

---

## 3. 各エンジンの詳細

### 3.1 biasAnalyzer

**入力**: `analyzeBias(currentTexts: string[], historyEntries: HistoryEntry[])` <br>
**出力**: `BiasAnalysisResult { duplicateScore, noveltyScore, risk, topMotifs, warnings, checkedCount }`

**MONITORED_MOTIFS** ([biasAnalyzer.ts:61-228](../src/lib/biasAnalyzer.ts#L61)): 20 モチーフ
- 衣装 6 / 背景 4 / 色 1 / 演出 6 / 小物 1 / 世界観 1 + その他

**重複スコア計算**:
```
freq_i = historyCount_i / historyTotal
duplicateScore = (1 - ∏(1 - freq_i)) × 100
```
3モチーフが各 freq=0.4 なら (1 - 0.6³)×100 ≈ 78%

**リスク判定**:
- danger: freq ≥ 0.40
- high: freq ≥ 0.25
- medium: freq ≥ 0.10

---

### 3.2 historyAnalyzer

**入力**: `analyzeFullHistory(allItems: PromptHistoryItem[], currentTexts?: string[])` <br>
**出力**: `FullHistoryAnalysis`

```ts
interface FullHistoryAnalysis {
  windowSize: number;
  windowDays: number;       // デフォルト 90
  topMotifs: Array<{ motif, totalCount, penaltyLevel }>;
  topCombos: Array<{ comboKey, motifLabels[], motifIds[], count, risk }>;
  radarData: { dark, cyber, fantasy, dress, weapon };
  untappedGenres: Array<{ id, label, score }>;
  autoNgTokens: string[];
  aiComment: string;
}
```

**コンボ検出**:
- 各履歴アイテムから最大 4 モチーフ抽出
- 2 つ組と 3 つ組を全組合せ生成
- 同 key が 2 回以上出現で集計
- subset-dedup（3つ組が選ばれたら含まれる2つ組は表示しない）

**ペナルティレベル**: ratio に基づき blocked / heavy / medium / light / none

---

### 3.3 imageAnalyzer

**入力**: 履歴アイテム + 特徴マップ <br>
**出力**: `ImageAnalysisResult`

```ts
interface ImageFeature {
  id: string;
  dHash: string;          // 64bit を 16 進 16 文字
  dominantColors: Array<{ r, g, b, ratio }>;
  brightness: number;     // 0-1
  batchId: string;
  analyzedAt: number;
}

interface ImageAnalysisResult {
  totalEligible / totalAnalyzed: number;
  clusters: Array<{ id, members, size }>;    // size≥2, TOP20
  uniqueCount: number;
  backgroundRates / outfitRates / hairRates / cameraRates / lightingRates;
  overusedCategories: Array<{ axis, label, ratio }>;
  underusedCategories: Array<{ axis, label }>;
  itemScores: Array<{ id, novelty, duplication, bias }>;
}
```

**クラスタリング**:
- dHash の Hamming 距離 ≤ 10bit で同クラスタ（union-find）
- 同 batchId は強制的に同クラスタ化

**overused 閾値**: ratio ≥ 0.40

---

### 3.4 colorAnalyzer

**入力**: 履歴アイテム + windowSize (50/100) <br>
**出力**: `ColorAnalysis`

**集計軸** (5): 衣装色 / 髪色 / ライティング色 / 背景色 / 差し色 <br>
**色 ID** (12): 黒 / 白 / 灰 / 茶 / 赤 / 桃 / 橙 / 黄 / 緑 / 青 / 紫 / 金属

**偏り判定**:
- 全体 top ≥ 70%: high warning
- 全体 top ≥ 50%: medium warning
- 軸別 ≥ 70%: 軸別警告

**推奨色**: 偏った色から `pickRecommendedColors()` で3色提案
- 例: 黒系偏り → 白・金・ベージュ

---

### 3.5 ratingAnalyzer

**入力**: 全履歴 (`resultRatings` を持つもの) <br>
**出力**: `RatingAnalysis`

```ts
interface RatingAnalysis {
  totalRatedImages: number;
  totalGood / totalBad: number;
  axes: RatingAxisStat[];        // 5軸（背景/衣装/髪/カメラ/ライティング）
  topRecommended: Array<{ axis, label, score }>;   // TOP5
  topAvoid: Array<{ axis, label, score }>;         // TOP5
  preferenceReport: {
    active: boolean;             // 30件以上で true
    axes: Array<{ axis, good, bad, goodRatio, badRatio }>;  // bg/outfit/pose
  };
}
```

**スコア計算**: `score = (good×2 - bad×2) / total`

**buildRatingBiasPayload**:
- `activeScopes` でフィルタ → 「変更範囲ONの軸のみ」を送る
- preferenceReport は scope フィルタなしで全軸送信（サーバ側で再フィルタ）

---

### 3.6 massAIBias

**入力**: 単一プロンプトテキスト <br>
**出力**: 5カテゴリの濃度スコア（0-100）

**BIAS_CATEGORIES** ([categoryKeywords.ts](../src/lib/categoryKeywords.ts)):
- 黒ゴシック
- 青ネオン
- サイバー背景
- クリスタル
- ドレス

**役割**: 「この案 1 つが量産AIっぽく見えるか」を判定。historyAnalyzer（長期傾向）・biasAnalyzer（バッチ比較）と独立。

---

### 3.7 aiAgent

**入力**: `AgentInput` { scopes, locks, historyAnalysis, colorAnalysis, imageAnalysis, ratingAnalysis, ... } <br>
**出力**: `AgentAnalysis`

```ts
interface AgentAnalysis {
  trendSummary: string;
  problems: Array<{ severity: "high" | "medium" | "low", text }>;
  recommendations: string[];
  actions: AgentAction[];   // 6種類
}
```

**6 アクション**:
| ID | 効果 |
|---|---|
| `apply` | 高頻度上位3件を抑制 + 未開拓推奨 |
| `see_alternative` | 別ジャンル化 ON |
| `avoid_overlap` | 被り回避ブースト ON |
| `favorite_bias` | お気に入り学習 ON |
| `simplify` | 神引き解除 |
| `go_bold` | カオス + バズ寄せ ON |

**ヒューリスティック観点 9 項目**:
- 同じ服/背景/色味の連発
- 頻出構成コンボ
- 神引き効きすぎ
- プリセット競合
- 顔固定遵守
- お気に入り寄せすぎ
- 量産検知未反映
- 画像未投入
- 色の偏り

---

### 3.8 analyzeProposal

**入力**: `analyzeProposal(promptText, lock, skyveilProfile?)` <br>
**出力**: `ProposalAnalysis`

```ts
interface ProposalAnalysis {
  validation: PromptValidationResult;  // 禁止ワード違反
  identityRisk: IdentityRiskResult;    // 同一性リスク（フロント版）
  massAI: MassAIResult;                // 量産AI濃度
  skyveilScore: SkyveilScore;          // 6軸スコア
  lockSummary: LockSummary;
}
```

**aiAgent との違い**:
- aiAgent: 全体の「次の一手提案」
- analyzeProposal: 個別案の「品質ゲート」

---

## 4. エンジン間の依存関係

```
┌─────────────┐
│  履歴データ  │
└──────┬──────┘
       │
       ├──→ historyAnalyzer ──┐
       ├──→ colorAnalyzer ────┤
       ├──→ ratingAnalyzer ───┼──→ aiAgent ──→ DuplicateAnalysisPanel
       └──→ imageAnalyzer ────┘
                              │
[現バッチ] ──→ biasAnalyzer ──┘
                              │
                       ┌──────┴──────┐
                       ▼             ▼
                 [統合]              ┌─────────────────┐
              skyveilProfile ──→     │ skyveilScore    │
                       ▼             │  ↑              │
                 [生成入力]           │ analyzeProposal │
                buildInputs           │  ↑              │
                                     │ massAIBias      │
                                     └─────────────────┘
                                              ▲
                                     [個別プロンプト]
```

---

## 5. AI 分析ライブビューでの登場順序

[analysisLiveTypes.ts:42-57](../src/lib/analysisLiveTypes.ts#L42) 13 ステップ:

| 順 | ステップ | エンジン |
|---|---|---|
| 1 | loadHistory | （I/O） |
| 2 | loadImages | （I/O） |
| 3 | loadFavorites | （I/O） |
| 4 | loadRatings | （I/O） |
| 5 | loadFailureMemos | （I/O） |
| 6 | duplicateAnalysis | biasAnalyzer + historyAnalyzer |
| 7 | colorAnalysis | colorAnalyzer |
| 8 | imageAnalysis | imageAnalyzer |
| 9 | favoriteAnalysis | favoriteProfile |
| 10 | massAiBiasAnalysis | massAIBias |
| 11 | identityRiskAnalysis | identityRisk |
| 12 | skyveilPreferenceAnalysis | preferenceProfile (Gemini) |
| 13 | suggestionGeneration | aiAgent |
| 14 | complete | – |

---

## 6. policyApplied / favoriteLearnEnabled ゲートの整理

**P6**: 反映ボタンを押した時だけ適用 / **P7**: 学習結果は自動適用しない

| エンジンの出力 | ゲート | 行 |
|---|---|---|
| `historyAnalysis.autoNgTokens` | `policyApplied` | App.tsx:528-546 |
| `historyAnalysis.topCombos` 制御 | `policyApplied` | App.tsx:551-558 |
| `imageAnalysis` → `imageBias` | `policyApplied` | App.tsx:576-588 |
| `preferenceProfile` | `favoriteLearnEnabled || skyveilOneShot` | App.tsx:564-565 |
| `favoriteProfile.traitPhrases` | 同上 | App.tsx:603-611 |
| `ratingAnalysis` → `ratingBias` | 同上 + activeScopes フィルタ | App.tsx:567-573 |
| `colorAnalysis` → colorWeights | **常時送信**（P6 例外） | App.tsx:559 |

→ **P6/P7 を破る経路は現状なし**。各エンジンは「分析」のみで、適用は App.tsx の `buildInputs()` がゲートしている。

---

## 7. 重複していないことの確認

| エンジン | 計算対象 | 計算方法 | 出力性質 |
|---|---|---|---|
| biasAnalyzer | 現バッチ vs 直近20件 | 複合確率式 | スコア（0-100） |
| historyAnalyzer | 全履歴 90 日窓 | 出現率 + ペナルティ + クラスタ | 構造化（topMotifs / topCombos） |
| imageAnalyzer | 結果画像 | dHash クラスタリング + カテゴリ率 | 視覚的構造 |
| colorAnalyzer | 履歴の色 token | 軸別 × 12色集計 | 色分布 |
| ratingAnalyzer | resultRatings | 軸別👍👎集計 | 推奨/回避 |
| massAIBias | 単一プロンプト | カテゴリ検出 | 濃度（0-100） |

→ **異なるディメンション** で見ているため重複なし。

---

## 8. パフォーマンス特性

| エンジン | 想定計算量 | 実装 | キャッシュ |
|---|---|---|---|
| biasAnalyzer | O(motifs × currentTexts + motifs × history) | 同期 | なし |
| historyAnalyzer | O(items × motifs × combo_size) | 同期 | useMemo |
| imageAnalyzer | O(items) で I/O 重 | 非同期（progressiveAnalysis） | IndexedDB |
| colorAnalyzer | O(items × colors × axes) | 同期 | useMemo |
| ratingAnalyzer | O(items × axes) | 同期 | useMemo |
| massAIBias | O(categories × keywords) per prompt | 同期 | なし |
| aiAgent | O(1) on summary inputs | 同期 | useMemo |

**Web Worker 化候補**:
- imageAnalyzer の dHash 計算（既に非同期だが、大量履歴で重い）
- historyAnalyzer のコンボ検出（n² 〜 n³）

→ 1万件超で遅延が出る既知課題（[08_今後の実装案.md](./08_今後の実装案.md)）。

---

## 9. 拡張性: 新エンジンを追加するときの指針

新たに分析エンジンを増やす場合の指針:

| Step | 内容 |
|---|---|
| 1 | 入出力型を `analysisLiveTypes.ts` に追加 |
| 2 | エンジン本体を `lib/<engineName>.ts` に作成 |
| 3 | App.tsx で `useMemo` ベースでメモ化 |
| 4 | `buildInputs()` で生成入力に渡す場合は **P6/P7 ゲート** を必ず通す |
| 5 | サーバ送信時は `index.ts` でバリデーション追加 |
| 6 | promptSystem.ts でブロック化（ブロック名を本書に追記） |
| 7 | analysisLive のステップに追加 |
| 8 | aiAgent のヒューリスティック観点に統合 |

---

## 10. 関連ドキュメント

- [master-plan-v1.md §7-8](./master-plan-v1.md)
- [04_重複分析センター.md](./04_重複分析センター.md)
- [15_skyveil-learning.md](./15_skyveil-learning.md)
- [13_identity-risk.md](./13_identity-risk.md)

---

**End of Doc 14**
