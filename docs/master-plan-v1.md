# Master Plan v1 — Image Prompt Maker

> **本書の位置づけ**
> 本書は Image Prompt Maker の **唯一のマスター設計書（v1）** である。
> 個別機能の詳細は `docs/00`〜`docs/08` および以降の追補に委ねるが、
> 「**何のための・どの順序で動く・どこが最優先**」の判断はすべて本書を起点とする。
> 既存の docs と本書が矛盾した場合は **本書が優先** する。

---

## 0. 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-06-04 | 初版（実装済み機能の整理・最重要原則の明文化） |
| v1.1 | 2026-06-07 | UI統廃合 #1〜#4 を反映（§2.3 入口設計の恒久ルール追加・詳細は docs/32 §6） |
| v1.1 | 2026-06-04 | P7「学習結果は自動適用しない」を追加。関連 docs 12-16 を追補 |

---

## 1. システム概要

### 1.1 何をするツールか

1枚の元画像から、変更したい範囲だけを差し替えた **画像編集AI（ChatGPT Image / Gemini / Nano Banana）向けプロンプト** を、複数案・複数フォーマットで出力するワークベンチ。

### 1.2 アーキテクチャ

```
[Browser]                            [Express server]
 ┌────────────────┐                   ┌────────────────┐
 │ React + Vite   │ ──── POST ───────▶│ /api/generate  │
 │  UI / 状態     │                   │ バリデーション  │
 │  分析（軽量）  │                   │ プロンプト合成  │ ──▶ Gemini 2.5 Flash
 │  localStorage  │ ◀──── JSON ───────│ Identity Shield│
 │  IndexedDB     │                   │ Scope Filter   │
 └────────────────┘                   └────────────────┘
                                            │
                                            └─ server/.env（APIキー）
```

- **APIキーはサーバの `.env` だけに存在**。ブラウザは決して知らない。
- フロントは「**意図の表現と確認**」、サーバは「**プロンプトの合成と保護**」を担当。

### 1.3 主要技術

- フロント: Vite 6 / React 18 / TypeScript 5 / TailwindCSS 3
- サーバ: Express / Node.js 20+ / Gemini 2.5 Flash（temperature=0.95, topP=0.95）
- 永続化: localStorage（設定）+ IndexedDB（履歴・お気に入り・画像特徴）

---

## 2. 最重要原則（Code of Conduct）

本ツールが**何があっても守るべき**7箇条。すべての機能・改修・PR は本章に照らして判断する。

| # | 原則 | 意味 |
|---|---|---|
| **P1** | **顔・同一性維持最優先** | 顔・表情・同一性・体型は最優先で固定。他のすべての指示よりも優先される。 |
| **P2** | **変更対象だけ変更** | `scopes` に列挙された軸のみを変更する。列挙外軸は **1語でも追加しない**。 |
| **P3** | **背景固定ONなら背景変更禁止** | scopes に `background` を含まない場合、背景の言及は **削除** される。 |
| **P4** | **衣装OFFなら衣装変更禁止** | scopes に `outfit` を含まない場合、衣装の言及は **削除** される。 |
| **P5** | **保護対象最優先** | ロック中の軸への干渉は、いかなる学習結果・トレンド・ユーザー追加指示よりも優先して排除する。 |
| **P6** | **反映ボタンを押した時だけ適用** | 学習結果・分析結果は、ユーザーの明示的な反映操作（反映ボタン押下 or 今回だけ反映 or 学習トグル ON）によってのみ生成に効く。 |
| **P7** | **学習結果は自動適用しない** | 自動学習による preferenceProfile の更新・各種分析結果の計算は許容されるが、**それらが生成プロンプトに自動で流れ込む経路を絶対に設けない**。P6 が「いつ適用するか」を規定するのに対し、P7 は「自動適用を作るな」という設計時の絶対禁則。 |

### 2.1 P6 / P7 の関係

P6 と P7 は表裏一体だが、別の階層で機能する:

- **P6** は **ランタイム原則**: 実行時に「適用してよいタイミング」を判定する基準
- **P7** は **設計時禁則**: 新機能を追加するとき「自動適用するコードを書くこと自体を禁じる」基準

新しい分析エンジン・学習機能を追加する際は、P7 に従って「**結果が App.tsx の buildInputs() ゲートを経由せずに生成に流れる経路を作らない**」ことを確認する。

### 2.2 P6 / P7 の例外（合意済み）

唯一の例外は **色×軸 重み制御**（[colorPolicy.ts](../src/lib/colorPolicy.ts)）。
これは「明示的UI設定」とみなし、反映ボタンに依存せず常時送信する。
理由：色重みグリッドの編集は**それ自体が能動的な反映操作**であるため。

参照: [App.tsx:559](../src/App.tsx#L559)

### 2.3 UI入口・統廃合の恒久ルール（2026-06-07・#1〜#4 / 詳細 docs/32 §6）

増殖した入口・重複ボタン・専門用語を整理した結果の**恒久ルール**。新規UIは本節に照らして判断する。

1. **生成画面＝「作る場所」 / 分析センター＝「確認する場所」**。
2. **好みAI（あなたの好み skyveil）は生成画面側で操作・分析センター側は読み取り専用**。
3. 分析結果・好み結果・トレンド結果は**自動反映しない**（P6/P7）。反映は**ユーザーがボタンを押した時だけ**（反映ON／今回だけ反映／提案を反映）。
4. **似た意味のボタンを増やさない** — 既存カテゴリ（生成補助＝映え／変化／回避）へ統合する。
5. QuickActions に新ボタンを足す前に、**既存ポップオーバー／詳細タブ（DetailsCard）に入れられないか先に確認**する。
6. **旧入口（例：分析ラボ）を復活させない**。孤立した入口・state・props は撤去する。

実体：QuickActions＝映え／変化／回避＋ポップオーバー。好み＝「あなたの好み（skyveil）」1本。分析＝分析センター1本（生成画面の「AIっぽさ確認」は分析センターへの誘導）。

---

## 3. 多層防御アーキテクチャ

最重要原則を守るための **3層** の防衛線。上から順に「意図 → 抑制 → 検閲」。

```
┌──────────────────────────────────────────────────────────┐
│ Layer 1: 意図の表現（フロント buildInputs）              │
│   - scopes に該当しない軸は undefined で送らない         │
│   - policyApplied / favoriteLearnEnabled / oneShot で gate│
│   File: src/App.tsx:497-669 buildInputs()                │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ Layer 2: LLM への抑制指示（promptSystem）                │
│   - 【厳守ルール】列挙外軸を1語でも追加するな             │
│   - 【固定原則】顔・同一性・表情を最優先固定              │
│   - 【今回の変更対象】scope該当軸のみ記述                 │
│   File: server/src/promptSystem.ts buildSystemPrompt()   │
│   ※4138行・43ブロック。詳細は §11 で索引化               │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ Layer 3: 機械的検閲（Identity Shield + Scope Filter）    │
│   - applyIdentityShield: リスク採点+保護文挿入            │
│   - applyServerScopeFilter: 保護軸の語彙を機械削除        │
│   - safetySanitizePrompt: 安全フィルタ                    │
│   File: server/src/scopeFilter.ts + gemini.ts:301-310    │
└──────────────────────────────────────────────────────────┘
                          ↓
                  最終プロンプト（Gemini 出力）
```

**Gemini が逸脱しても Layer 3 が削除する。Layer 3 が判定漏れしても Layer 2 が抑制している。** これが本ツールの安全性の根拠。

---

## 4. Identity Shield 仕様

### 4.1 実装位置

- 本体: [server/src/scopeFilter.ts:211-266](../server/src/scopeFilter.ts#L211) `applyIdentityShield()`
- 注入位置: [server/src/gemini.ts:301-310](../server/src/gemini.ts#L301)（Scope Filter より先に実行）
- UI表示: [src/components/PromptGuardSection.tsx:168-186](../src/components/PromptGuardSection.tsx#L168)
- 履歴保存: `IdentityShieldSummary`（[types.ts:1299-1305](../src/types.ts#L1299)）
- フロント並走表示: [src/lib/identityRisk.ts](../src/lib/identityRisk.ts) `analyzeIdentityRisk()`

### 4.2 リスク採点（0-100）

| 加算条件 | スコア |
|---|---|
| 髪型変更ON | +12 |
| ポーズ変更ON | +16 |
| カメラ変更ON | +16 |
| 前景演出ON | +12 |
| ライティング変更ON | +8 |
| 衣装変更ON | +8 |
| 変更対象 ≥4軸 | +18 |
| 強いアングル指定 | +10 |
| 顔の向き変更可能性 | +8 |
| 顔危険語（FACE_DANGER） | +30 |
| faceLock OFF | +12 |

### 4.3 レベル判定と注入文

| レベル | 閾値 | 追加注入する固定文 |
|---|---|---|
| low | < 30 | （なし） |
| medium | 30-59 | `CLAUSE_PROTECT` |
| high | 60-79 | `CLAUSE_PROTECT` + `CLAUSE_ANTIBREAK` |
| danger | ≥ 80 | `CLAUSE_PROTECT` + `CLAUSE_ANTIBREAK` + `CLAUSE_FORCE` |

**CLAUSE_PROTECT**:
> 「【同一性保護】顔の特徴、人物の同一性、表情、顔の輪郭、目・鼻・口の配置、肌の質感、キャラクターの外観スタイルは元画像から完全維持してください。」

**CLAUSE_ANTIBREAK**:
> 「【顔崩れ防止】髪型・衣装・カメラ・ポーズ・前景演出を変更する場合でも、顔の造形、表情、雰囲気、人物の印象は変更しないでください。別人化、若返り、大人化、顔立ちの変更は禁止です。」

**CLAUSE_FORCE**:
> 「【強制固定】顔、同一性、表情、体型、アスペクト比は最優先で固定してください。演出やトレンド表現よりも、元画像の人物一致を優先してください。」

### 4.4 出力

```ts
interface IdentityShieldSummary {
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "danger";
  addedIdentityClauses: string[];   // 実際に挿入された文
  reasons: string[];                 // 加算理由
  warnings: string[];
}
```

すべての生成案に必ず付与され、`PromptHistoryItem.identityShield` に永続化される。

---

## 5. Scope Filter 仕様

### 5.1 実装位置

- 本体: [server/src/scopeFilter.ts:164-209](../server/src/scopeFilter.ts#L164) `applyServerScopeFilter()`
- 補助辞書: 同ファイル `CATEGORY_KEYWORDS`, `FACE_DANGER`, `PROTECTIVE_LINE_HINTS`
- 呼び出し: [server/src/gemini.ts:301-310](../server/src/gemini.ts#L301)（Identity Shield の直後）
- UI表示: [src/components/PromptGuardSection.tsx:189-207](../src/components/PromptGuardSection.tsx#L189)
- 履歴保存: `ServerScopeFilterSummary`（[types.ts:1293-1297](../src/types.ts#L1293)）

### 5.2 動作

1. `deriveServerLocks(req)` で **protectedTargets** を導出
   - scopes に含まれない軸はすべて保護対象
   - faceLock=true なら face/identity/expression を保護対象に追加
2. プロンプト本文を `。/ 、/ ・` で分割
3. 各断片を CATEGORY_KEYWORDS と照合
   - 保護対象カテゴリのキーワードを含む断片 → **削除**
   - PROTECTIVE_LINE_HINTS（「維持・固定」宣言文）に該当 → **削除しない**（誤検知防止）
4. FACE_DANGER（「別人」「顔を変える」「different face」等）は常時削除
5. 削除した断片を `removedItems[]` に蓄積（UI表示用）

### 5.3 出力

```ts
interface ServerScopeFilterSummary {
  removedItems: {
    category: string;   // "background" | "outfit" | "face" 等
    text: string;       // 削除された文断片
    reason: string;     // "背景固定ONのため削除" 等
    severity: "high" | "medium" | "low";
  }[];
  warnings: string[];
}
```

### 5.4 設計思想

> Identity Shield と Scope Filter は **責務が異なる**:
> - **Identity Shield** = リスクが高い時、追加で保護文を「**注入**」する（攻め）
> - **Scope Filter** = 保護対象を侵害する文を「**削除**」する（守り）
>
> 攻めと守りの両方が常に走る。

---

## 6. 顔・同一性保護フロー

### 6.1 ロック関連の概念（v1 整理）

| 概念 | 型 | 場所 | 役割 |
|---|---|---|---|
| `faceLock` | `boolean` | App.tsx state | UI トグル（初期ON）。OFF で表情変更モード |
| `expression` | `Expression \| null` | App.tsx state | faceLock=false の時のみ有効 |
| `locks` | `Record<LockKey,boolean>` | PromptInputs | サーバ送信用ロック束（face/identity/expression/body_shape/color/camera/aspect_ratio） |
| `bodyPoseLock` | `boolean` | App.tsx state | 体型・ポーズロック |
| `colorMoodLock` | `boolean` | App.tsx state | 色味・雰囲気ロック |
| `compositionLock` | `boolean` | App.tsx state | 構図・アスペクト比ロック |

⚠️ **既知の整理対象**: `faceLock` と `locks.face` の二重定義。
詳細と統合方針は **[09_face-lock統合.md](./09_face-lock統合.md)** を参照。

### 6.2 フロー全体

```
ユーザー操作                buildInputs()              サーバー処理
─────────                  ────────────              ──────────────
[faceLock = ON]           faceLock: true           applyIdentityShield
                          locks.face: true          ↓ 顔保護文を3段階で注入
[ScopeSelector]           scopes: [...]            promptSystem.buildSystemPrompt
  ↓ pose 追加              ↓                        ↓ 【厳守ルール】挿入
[LockToggles]             bodyPoseLock: true       Gemini 呼び出し
  ↓ ポーズロックON         ↓                        ↓
                          → サーバ送信              applyServerScopeFilter
                                                    ↓ 背景・衣装の語彙削除
                                                  safetySanitizePrompt
                                                    ↓
                                                  最終プロンプト
```

---

## 7. 重複分析センター

### 7.1 概要

過去の生成傾向を可視化・制御する大型パネル。
- 本体: [src/components/DuplicateAnalysisPanel.tsx](../src/components/DuplicateAnalysisPanel.tsx)
- データ集計: [src/lib/historyAnalyzer.ts](../src/lib/historyAnalyzer.ts) `analyzeFullHistory()`
- 偏り検知: [src/lib/biasAnalyzer.ts](../src/lib/biasAnalyzer.ts) `analyzeBias()`
- 量産AI判定: [src/lib/massAIBias.ts](../src/lib/massAIBias.ts)
- AI提案: [src/lib/aiAgent.ts](../src/lib/aiAgent.ts) `analyzeAgent()`

### 7.2 内包セクション

| セクション | 責務 |
|---|---|
| 💡 好み分析レポート | 実 Gemini 分析（preferenceProfile） |
| 📸 画像分析 | 視覚的クラスタTOP10・カテゴリ偏り |
| 🎨 色生成制御 | 色×軸 重み・偏り警告 |
| 🤖 AI分析エージェント | 6アクション提案（apply/see_alternative/avoid_overlap/favorite_bias/simplify/go_bold） |
| 出現制御 | モチーフ 0-5 レベル制御 |
| コンボポリシー | 頻出構成 block/alt/allow |

### 7.3 0-5 レベル

| Lv | 意味 | UI色 |
|---|---|---|
| 0 | 一発NG（完全禁止） | rose |
| 1 | 強く抑制 | amber |
| 2 | 抑制 | yellow |
| 3 | 普通 | slate |
| 4 | 既定（出やすい） | sky |
| 5 | 強く促進 | violet |

### 7.4 反映フロー（P6 遵守）

```
ユーザーがレベル変更
  ↓ 即座に localStorage 保存（policyApplied は変えない）
[✓ 提案を反映] ボタンクリック
  ↓ handleApplyPolicies()
policyApplied = true
  ↓ buildInputs() が motifControls/comboControls/imageBias を送信開始
```

参照: [04_重複分析センター.md](./04_重複分析センター.md)

---

## 8. skyveil 好み AI

### 8.1 構造（3層）

```
[分析入力 5系統]              [統合 1系統]            [採点 1系統]
─────────────                ───────────              ───────────
preferenceProfile  ─┐
favoriteProfile    ─┤
ratingAnalysis     ─┼──→ buildSkyveilProfile() ──→ calculateSkyveilScore()
imageAnalysis      ─┤        (skyveilProfile.ts)        (skyveilScore.ts)
historyAnalysis    ─┘
```

### 8.2 出力 SkyveilProfile

| フィールド | 内容 |
|---|---|
| `likes` | 好み傾向＋好みキーワード（最大10件） |
| `overusedButLiked` | お気に入り多数かつ直近で頻出 |
| `avoid` | Gemini回避キーワード＋低評価軸 |
| `underusedRecommended` | 未開拓カテゴリ＋ジャンル |

### 8.3 6軸スコア（calculateSkyveilScore）

| 軸 | 重み |
|---|---|
| identitySafety | 28% |
| lockCompliance | 24% |
| originality | 14% |
| trendBalance | 12% |
| aiBiasAvoidance | 12% |
| buzzPotential | 10% |

### 8.4 反映フロー（P6 遵守）

```
[SkyveilBar] ON/OFF + 強度（弱/標準/強）
  ↓
[今回だけ反映] ボタン → skyveilOneShot = true（1回で自動クリア）

buildInputs():
  if (favoriteLearnEnabled || skyveilOneShot) {
    preferenceProfile / favoriteTraits / ratingBias を送信
  }
```

参照: [src/components/SkyveilBar.tsx](../src/components/SkyveilBar.tsx), [App.tsx:565-573, 603-611](../src/App.tsx#L565)

---

## 9. 成功プロンプト抽出

### 9.1 実装

- 抽出: [src/lib/successPatterns.ts:64-128](../src/lib/successPatterns.ts#L64) `extractSuccessPromptPatterns()`
- プレビュー: [src/lib/learningPreview.ts:50-100](../src/lib/learningPreview.ts#L50) `previewSuccessPattern()`
- 反映: 同上 `applyPreviewedScopes()`
- UI: [SkyveilBar.tsx:166-214](../src/components/SkyveilBar.tsx#L166)

### 9.2 「成功」の定義

```
successWeight =
  + 3 if isFavorite
  + 2 if 評価5 を含む
  + 1 if 評価3 を含む
  - 2 if 評価1 を含む
  - severity if failureMemo あり

→ 重み ≥ 2 のみ採用
```

スコープ組合せでグループ化し、上位5パターンを返す。

### 9.3 反映の2段階（P6 + P5 遵守）

```
1. handleApplyPattern(pattern)
     ↓ previewSuccessPattern() で差分プレビュー作成
     ↓ 背景固定ON / 衣装OFF などの保護違反は blockedDiffs に分離
     ↓ state はまだ変えない
     ↓
2. handleConfirmPattern()
     ↓ applyPreviewedScopes() で blockedDiffs を除外して反映
     ↓ ここで初めて scopes が更新される
```

参照: [App.tsx:983-999](../src/App.tsx#L983)

---

## 10. 逆プロンプト生成

### 10.1 実装

- 本体: [src/lib/reversePrompt.ts:48-136](../src/lib/reversePrompt.ts#L48) `generateReversePrompt()`
- UI表示: [PromptGuardSection.tsx:482-540](../src/components/PromptGuardSection.tsx#L482)

### 10.2 動作（誤解されやすいので明文化）

> **「画像から逆算してプロンプトを再構築する」のではない。**
> **「失敗・違反から改善案を再構築する」** ツールである。

入力:
- `promptLockCheck` の violation（禁止ワード違反）
- `failureMemo` のユーザー記録
- massAI / identity 提案

出力:
- 禁止語を除去 + 同一性最優先文 + 軸別ロック確認文 + 改善プロンプト本体

### 10.3 P5 遵守

`REASON_HINTS` マップで「背景が変わった」→「背景固定」を提案するが、
**現在の changeTargets に背景が含まれていれば固定文を付けない**（[reversePrompt.ts:80-85](../src/lib/reversePrompt.ts#L80)）。
→ ユーザーが意図的に変更したい軸まで保護してしまうのを防ぐ。

---

## 11. AI 分析ライブビュー

### 11.1 実装

- 型: [src/lib/analysisLiveTypes.ts](../src/lib/analysisLiveTypes.ts)
- Hook: [src/lib/useAnalysisLive.ts](../src/lib/useAnalysisLive.ts)
- UI: [src/components/AnalysisLiveView.tsx](../src/components/AnalysisLiveView.tsx)

### 11.2 13 ステップ

```
loadHistory → loadImages → loadFavorites → loadRatings → loadFailureMemos
  → duplicateAnalysis → colorAnalysis → imageAnalysis → favoriteAnalysis
  → massAiBiasAnalysis → identityRiskAnalysis → skyveilPreferenceAnalysis
  → suggestionGeneration → complete
```

### 11.3 API シグネチャ（概略）

```ts
const live = useAnalysisLive();
live.start(label, counts);
live.startStep(id, message?, sourceCount?);
live.setStepProgress(id, percent);
live.completeStep(id, message?);
live.addEvidence({ title, conclusion, sources });
live.error(message);
live.complete(message);
```

### 11.4 3つの表示モード

| モード | 内容 |
|---|---|
| compact | 進捗バーのみ |
| detail | 各ステップの状態一覧 |
| log | ターミナル風タイムスタンプ付きログ |

---

## 12. データフロー全体図

```
[元画像]
  │
  ▼
[ImageUploader]──→ imageDataUrl ──┐
                                  │
[ScopeSelector]──→ scopes ────────┤
[FaceLockSwitch]→ faceLock ───────┤
[LockToggles]──→ bodyPoseLock 等 ─┤
[DetailsCard]──→ details ─────────┤
[NgInput]──→ ngList ──────────────┤
                                  │
[履歴/IndexedDB]                   │
  │                               │
  ▼                               │
[historyAnalyzer]                  │
[biasAnalyzer]                     │
[colorAnalyzer]                    │
[imageAnalyzer]──→ 分析結果 ──┐    │
[ratingAnalyzer]              │    │
[favoriteProfile]             │    │
[preferenceProfile]           │    │
                              ▼    ▼
                          [buildInputs] ←  policyApplied / favoriteLearnEnabled / skyveilOneShot
                              │
                              ▼
                          [backendClient.generateViaBackend]
                              │
                              ▼ POST /api/generate
                          ┌────────────────────────┐
                          │ Express validation     │
                          │ promptSystem 43ブロック│
                          │ varietyEngine          │
                          │ Gemini 2.5 Flash 呼出 │
                          │ applyIdentityShield    │
                          │ applyServerScopeFilter │
                          │ safetySanitizePrompt   │
                          └────────────────────────┘
                              │
                              ▼ proposals[]
                          [PromptCard × N]
                              │
                              ▼
                          [IndexedDB: PromptHistoryItem]
                              │
                              ▼ ⭐お気に入り / 評価 / failureMemo
                          [次回の分析入力に戻る]
```

---

## 13. 機能間の連携マトリックス

「**この機能が ON のとき、どの機能が反応するか**」の早見表。

| 起動元 \ 影響先 | promptSystem | Identity Shield | Scope Filter | varietyEngine |
|---|---|---|---|---|
| scopes 選択 | ✅ 該当ブロック挿入 | ✅ リスク採点に影響 | ✅ 非選択軸を削除 | ✅ 該当軸でジャンル抽選 |
| faceLock | ✅ 顔ロックブロック挿入 | ✅ OFFで +12 | ✅ FACE_DANGER 削除 | – |
| bodyPoseLock | ✅ locks.body_shape | ✅ リスク採点 | ✅ 体型語彙保護 | – |
| compositionLock | ✅ locks.camera/aspect | ✅ リスク採点 | ✅ 構図語彙保護 | – |
| policyApplied | ✅ motif/combo ブロック | – | – | – |
| favoriteLearnEnabled | ✅ preferenceProfile 等 | – | – | – |
| skyveilOneShot | ✅ 同上（1回） | – | – | – |
| colorWeights | ✅ 常時送信 | – | – | – |
| viralMode | ✅ 神引きブロック | ✅ +0（変動なし） | – | ✅ 別ファミリー融合 |
| windLevel > 0 | ✅ 風ブロック（該当軸ON時） | – | – | – |

---

## 14. 関連ドキュメント

| # | ファイル | 役割 |
|---|---|---|
| 00 | [00_概要.md](./00_概要.md) | 旧概要（本書 §1 で代替） |
| 01 | [01_UI構成.md](./01_UI構成.md) | UI レイアウト |
| 02 | [02_神引き.md](./02_神引き.md) | 神引きブースト + 風 |
| 04 | [04_重複分析センター.md](./04_重複分析センター.md) | 重複制御の詳細 |
| 05 | [05_ZOZOトレンド.md](./05_ZOZOトレンド.md) | 年代別トレンド |
| 06 | [06_お気に入り学習.md](./06_お気に入り学習.md) | お気に入り分析 |
| 07 | [07_履歴カレンダー.md](./07_履歴カレンダー.md) | カレンダー |
| 08 | [08_今後の実装案.md](./08_今後の実装案.md) | 機能アイデアの蓄積場（→ 16 に取り込まれる） |
| 09 | [09_face-lock統合.md](./09_face-lock統合.md) | locks.face と faceLock 統合設計 |
| 10 | [10_protection-bar常時表示.md](./10_protection-bar常時表示.md) | ProtectionBar 常時表示設計 |
| 11 | [11_UI重複一覧.md](./11_UI重複一覧.md) | UI 重複の現状と整理候補 |
| 12 | [12_scope-matrix.md](./12_scope-matrix.md) | 14 Scope の関連設定・保護・ブロック対応マトリックス |
| 13 | [13_identity-risk.md](./13_identity-risk.md) | Identity Risk 採点仕様（フロント / サーバの乖離整理） |
| 14 | [14_analysis-engine.md](./14_analysis-engine.md) | 7 分析エンジンの責務境界とデータフロー |
| 15 | [15_skyveil-learning.md](./15_skyveil-learning.md) | skyveil 学習システム（3層構造と P7 遵守） |
| 16 | [16_future-roadmap.md](./16_future-roadmap.md) | 上位ロードマップ（Phase 単位） |
| 17 | [17_analysis-live-view.md](./17_analysis-live-view.md) | AI分析ライブビュー（5分析の件数+鮮度の常時表示） |
| 18 | [18_phase3-ui-dedup-report.md](./18_phase3-ui-dedup-report.md) | Phase 3 UI重複整理 調査レポート（11 を更新） |
| 19 | [19_bugfixes.md](./19_bugfixes.md) | バグ修正記録（安全グループ5件実施 / 保留3件） |
| 20 | [20_phase4-ui改善.md](./20_phase4-ui改善.md) | Phase 4 UI改善（上部1段統合・反映状態圧縮ほか） |
| 21 | [21_recovery-panel.md](./21_recovery-panel.md) | 履歴・お気に入り復旧パネル（緊急対応・読み取り＋非破壊） |

---

## 15. 設計判断ログ

本書を起点に行う設計判断は、以下フォーマットで本章末尾に追記する。

```
### YYYY-MM-DD: 判断のタイトル
- **背景**: なぜ判断が必要になったか
- **選択肢**: A / B / C
- **採用**: B
- **理由**: ...
- **影響範囲**: ファイル・機能
```

### 2026-06-04: マスター設計書を v1 として独立化

- **背景**: Identity Shield / Scope Filter / 6原則がコード化されているが docs に明文化されていなかった
- **選択肢**: A) 既存 docs を拡張 / B) 新規マスター文書を作成
- **採用**: B
- **理由**: 既存 docs/00 は概要止まりで、原則の優先順位や多層防御の構造を表現するのに不足
- **影響範囲**: 本書 + docs/09, 10, 11 の追加。既存 docs と矛盾時は本書優先

### 2026-06-04 (v1.1): P7「学習結果は自動適用しない」を追加

- **背景**: P6（反映ボタンを押した時だけ適用）はランタイム原則であり、「新機能を追加するときに自動適用コードを書いてしまう」設計時の禁則が不足していた
- **選択肢**: A) P6 を強化 / B) P7 として独立化
- **採用**: B
- **理由**: P6 は「いつ」、P7 は「設計するな」という階層が異なる原則。1 行に混ぜると新機能追加時にレビューしづらい
- **影響範囲**: 本書 §2 + 全 docs の参照、特に [15_skyveil-learning.md](./15_skyveil-learning.md) で P7 遵守を技術的に説明

### 2026-06-04 (v1.1): 設計書を 9 本に拡張

- **背景**: Phase 2 (UI 可視化) と Phase 4 (状態管理整理) の着手前に、scope / identity-risk / analysis / skyveil の各領域の仕様を文書化しておく必要があった
- **採用**: docs/12〜16 を追加
- **影響範囲**:
  - docs/12: Phase 4 の scope 関連変更時の参照仕様
  - docs/13: Phase 5.1 (identityRiskCore 共通化) の仕様起点
  - docs/14: Phase 6 (フォルダ再編) で `lib/analysis/` 分類の根拠
  - docs/15: P7 の技術的説明
  - docs/16: Phase 0-8 の上位ロードマップ（docs/08 を機能アイデア蓄積場に降格）

### 2026-06-04: Phase 2-P0「faceLock 統合」実装完了

- **背景**: `faceLock` と `locks.face/identity/expression` の二重定義（[09_face-lock統合.md](./09_face-lock統合.md)）
- **採用**: `LockKey` から face/identity/expression を削除。顔・同一性・表情は `faceLock` + Identity Shield の単一系統で保護
- **副次効果**: SCOPE_TO_LOCKS の顔系削除により、lockLineJa（軽い維持文）と Identity Shield（強い保護文）の役割重複を解消。faceLock=OFF 時に「表情維持」が出てしまう潜在バグも解消
- **検証**: フロント/サーバ tsc・vite build すべて exit 0。Identity Shield / Scope Filter への悪影響なし（両者は元から faceLock を直接参照）
- **影響範囲**: src/types.ts, server/src/types.ts, src/App.tsx, LockToggles.tsx, ProtectionBar.tsx, server/src/promptSystem.ts, server/src/index.ts
- **詳細記録**: [09_face-lock統合.md §9 実装完了記録](./09_face-lock統合.md)

### 2026-06-04: Phase 2-①「ProtectionBar 常時表示」実装完了

- **背景**: Identity Shield のリスクが生成後（PromptCard内）でしか見えず、生成前に保護状態を常時把握できなかった（[10_protection-bar常時表示.md](./10_protection-bar常時表示.md)）
- **選択肢**: A) ヘッダ直下帯 / B) ControlPanel sticky / C) フローティングバッジ
- **採用**: A の読み替え版 = **メインビュー最上部の全幅 sticky 帯**（このアプリに `<header>` が存在しないため）
- **実装**: 新規 `GlobalProtectionBar.tsx`（読み取り専用）。折りたたみ時も「🛡顔・同一性 / Identity Shield level / 🎯変更対象」を常時表示、詳細は展開時のみ。`analyzeIdentityRisk("", currentLock)` で設定ベースのライブ採点
- **重要**: 既存 ProtectionBar / FaceLockSwitch / LockToggles は**統合せず残置**（UI重複整理は Phase 3）。保護=GlobalProtectionBar / 反映=ReflectionStatusBar の住み分け
- **検証**: tsc・vite build exit 0。実機で LOW0→MEDIUM28 のライブ更新・詳細展開・住み分けを確認
- **影響範囲**: src/components/GlobalProtectionBar.tsx（新規）, src/App.tsx（追加のみ）
- **詳細記録**: [10_protection-bar常時表示.md §10 実装完了記録](./10_protection-bar常時表示.md)

### 2026-06-04: Phase 2-②「AI分析ライブビュー強化」実装完了

- **背景**: 5分析は analysisLive 配線済みだったが、詳細パネルがスクロールで隠れ「今何を分析中か・各分析の鮮度」を常時把握できなかった（[17_analysis-live-view.md](./17_analysis-live-view.md)）
- **採用**: 新規 `AnalysisStatusStrip.tsx`（読み取り専用）を GlobalProtectionBar 直下の sticky スタックに配置。5分析（重複/色/画像/お気に入り/skyveil）を **件数 + 鮮度（相対時刻）+ 生存ドット** で常時一覧化
- **鮮度ソース**: 重複=`historyAnalysis.analyzedAt` / 画像=`max(ImageFeature.analyzedAt)` / skyveil=`preferenceProfile.generatedAt`（いずれも既存フィールド）。色・お気に入りのみ App 側で再計算検知スタンプ
- **重要**: 分析ロジック（lib/*Analyzer 等）・既存 AnalysisLiveView・useAnalysisLive・GlobalProtectionBar は**すべて無変更**。住み分け（常時=Strip / 詳細=LiveView）維持
- **衝突**: 案①（現状維持）。複数同時表示は Phase 5 候補（分析キュー化）として [16 §4.3](./16_future-roadmap.md) に追記
- **検証**: tsc・vite build exit 0。空DB＝全「未実行」、履歴1件注入→重複/色/お気に入りが「1件/たった今」、画像/skyveil「未実行」の混在を実機確認
- **影響範囲**: src/components/AnalysisStatusStrip.tsx（新規）, src/App.tsx（追加のみ）

### 2026-06-04: Phase 3-P0「UI重複整理（M-1 + デッドコード削除）」実装完了

- **背景**: Phase 2 で上部に保護バー・分析ストリップを追加した結果、「変更対象・守るもの」が GlobalProtectionBar と ReflectionStatusBar で二重表示。また保護系の旧コンポーネント5つが未使用のまま残存（[18_phase3-ui-dedup-report.md](./18_phase3-ui-dedup-report.md)）
- **採用（情報の単一ソース化）**:
  - GlobalProtectionBar を **顔・同一性＋Identity Shield に専念**（変更対象・守るもの・Scope Filter自動保護の表示を除去）
  - 変更対象＝ReflectionStatusBar、守るもの操作＝ControlPanel に一本化
  - 未使用5ファイル（ProtectionBar/FaceLockSwitch/LockToggles/SafetyToggle/ScopeSelector）を最終参照確認のうえ `git rm`
- **検証**: tsc・vite build exit 0。Before/After 実機比較で GPB から変更対象が消え、反映状態に単一化されたことを確認
- **影響範囲**: GlobalProtectionBar.tsx（縮小）, App.tsx（呼び出し更新）, 5ファイル削除, docs/01・promptSystem コメント整合
- **詳細記録**: [18_phase3-ui-dedup-report.md §9](./18_phase3-ui-dedup-report.md)

### 2026-06-04: Phase 3「AnalysisStatusStrip コンパクト化」実装完了

- **背景**: 5大型カードの占有面積が大きく、生成作業中に注視されない（実運用フィードバック）
- **採用**: 1行コンパクトチップ（`dot+絵文字+件数・鮮度 ×5 + [詳細]`）。高さ 約110px → **31px（約72%削減）**
- **状態表現**: 実行中🔵パルス / 完了🟢+相対時刻 / 未実行⚪。鮮度（・N分前）維持。説明文は tooltip 化
- **[詳細]**: AnalysisLiveView へスクロール委譲（詳細は LiveView に一本化）
- **不変条件**: useAnalysisLive / analysisLiveTypes / AnalysisLiveView / 全分析ロジックは無変更。変更は AnalysisStatusStrip.tsx と App.tsx のみ
- **検証**: tsc・vite build exit 0。実機で高さ31px・5分析の状態/鮮度・スクロール連携を確認
- **詳細記録**: [17_analysis-live-view.md §4.6](./17_analysis-live-view.md)

### 2026-06-04: Phase 3 P1 / M-2「AI分析を1ウィジェットに統合」実装完了

- **背景**: 「AI分析」(Strip・上部) と「AI分析ライブビュー」(中央カラム) の2ウィジェット併存（D-3）
- **採用**: AnalysisStatusStrip の [詳細] で AnalysisLiveView を直下にインライン展開（既定閉）。中央カラムの独立描画を撤去 → AI分析を1ウィジェット化
- **不変条件**: AnalysisLiveView.tsx 本体・useAnalysisLive・分析ロジックは無変更（描画位置とゲートのみ）。変更は App.tsx と AnalysisStatusStrip.tsx
- **検証**: tsc・vite build exit 0。既定でライブビュー非表示（ヘッダー0）、[詳細]で展開（1）を実機確認
- **詳細記録**: [18_phase3-ui-dedup-report.md §10](./18_phase3-ui-dedup-report.md)

### 2026-06-04: Phase 3 P2 / M-3「skyveil 表示・操作の一本化」実装完了

- **背景**: skyveil好みが SkyveilBar と DuplicateAnalysisPanel pref タブで二重（D-4）、好み分析実行が両方から起動（O-3）
- **採用**: SkyveilBar を skyveil の唯一のハブに集約。pref タブは「評価サンプル統計＋軸別👍👎集計」に役割特化＋誘導文。ReflectionStatusBar は現状維持
- **UI 要望対応**: SkyveilBar 通常時は 反映ON/OFF・強度・今回だけ反映 のみ。更新/自動学習/反映リセット/プロファイル削除は折りたたみ「設定・プロファイル」内へ
- **不変条件**: 学習・分析ロジックは無変更（既存ハンドラを別コンポーネントへ配線し直すのみ）。反映ボタン方式・自動反映禁止を維持
- **検証**: tsc・vite build exit 0。折りたたみ/展開の表示分離・pref タブからの RealAnalysisCard 消失を実機確認
- **詳細記録**: [18_phase3-ui-dedup-report.md §11](./18_phase3-ui-dedup-report.md)

### 2026-06-04: バグ修正（安全グループ5件）

- **背景**: 3エージェントのコードレビューで実バグを検出（[19_bugfixes.md](./19_bugfixes.md)）
- **実施**: BUG-1（buildInputs stale closure→ref同期）/ BUG-2（details欠落500→optional chaining）/ BUG-6（useAnalysisLive useMemo化）/ BUG-7（createdAt範囲検証）/ BUG-8（IndexedDB onblocked/onversionchange）
- **不変条件**: いずれも分析結果・生成挙動を変えない（correctness/クラッシュ耐性/パフォーマンスの改善）
- **検証**: tsc・vite build exit 0、サーバ tsx 動作確認、起動回帰（コンソールエラー0・主要UI描画OK）
- **保留**: BUG-3（自動学習ループ）/ BUG-4（色regex境界）/ BUG-5（バナー軸不一致）は挙動・分析出力が変わるため要レビュー
- **詳細記録**: [19_bugfixes.md](./19_bugfixes.md)

### 2026-06-04: バグ修正（レビュー後グループ：BUG-3A / BUG-4-C / BUG-5）

- **BUG-3A**: 自動学習ループ防止。クライアント側の前回分析サンプル数を localStorage 永続化し差分判定（サーバの 100 件頭打ち sampleSize に依存しない）。発火タイミングのみ是正・分析結果は不変。BUG-3B（最新100件ソート）は見送り
- **BUG-4-C**: 色分析の誤検出をストップワード方式で除去（rosemary/instant/important 等を色マッチ前に除去）。golden/grayscale 等の正当な複合語は温存。実 colorAnalyzer で前後比較確認
- **BUG-5**: 画像分析「反映中」バナーの日英軸不一致を解消（IMG_AXIS_TO_SCOPE マップ）。表示のみ・サーバ送信は不変
- **不変条件**: 分析ロジック本体（collectSamples/analyzePreferences/colorAnalyzer のマッチ規則/imageAnalyzer）は無変更
- **検証**: tsc・vite build exit 0、実コード前後比較、起動回帰（コンソールエラー0）
- **詳細記録**: [19_bugfixes.md §2](./19_bugfixes.md)

### 2026-06-04: Phase 4 P0（上部1段統合・反映状態圧縮・重複センター確認）実装完了

- **上部 sticky 1段統合（案B）**: GlobalProtectionBar に `analysisSummary`/`analysisDetail` スロットを追加し、AnalysisStatusStrip を variant 化（summary=1チップ/detail=5チップ）。標準 Strip カードを撤去し GPB に内包。Before 88px → After **45px**
- **現在の反映状態 圧縮**: ReflectionStatusBar 初期 `open=false`＋1行サマリ（🎯変更/🔒守る/✨補助/🧬好み）。171px → **32px**。全リセットは残置
- **重複分析センター**: 既に初期折りたたみ済み（変更なし）
- **不変条件**: presentation 4ファイル＋docs のみ変更。buildInputs/Identity Shield/Scope Filter/skyveil/Gemini/分析スコア/出力プロンプト/履歴形式は無変更（表示の variant・初期開閉のみ）
- **検証**: tsc・vite build exit 0、起動コンソールエラー0、上部合計 259px→77px（約70%削減）、詳細展開で5分析表示を実機確認
- **詳細記録**: [20_phase4-ui改善.md §6](./20_phase4-ui改善.md)。P1（skyveil微圧縮/詳細設定の選択中優先）は P0 確認後に判断

### 2026-06-04: Phase 4 P1/P2/P3 実装完了（Phase 4 完了）

- **P1**: SkyveilBar 微圧縮（パディング/ラベル）。DetailsCard 選択中（件数>0）カテゴリを初期展開＋上に安定ソート。操作位置・おまかせ挙動は不変
- **P2**: 設定サマリ＋進捗に出力先ラベル（ChatGPT/Gemini/Nano Banana/両対応）を表示。PromptGuardSection の投稿前スコア/サブスコア、コピー/お気に入りに tooltip 追加。スコア計算・本文は不変
- **P3**: MoodSelector の未使用コンポーネント関数のみ削除（git grep で確認）。定数 MOOD_GROUPS_*・型・MoodGroupRow・hasDetailSelection は使用中のため存続（共有モジュール）。定数分離は不要と判断（favoriteProfile 無変更）
- **不変条件**: 生成/Identity Shield/Scope Filter/skyveil学習/Gemini/分析スコア/出力プロンプト本文/履歴形式 すべて無変更。App.tsx 大規模分割・hooks 抽出は未実施（Phase 5）
- **検証**: 段階実装ごとに tsc・vite build exit 0、起動コンソールエラー0、主要UI描画OK
- **詳細記録**: [20_phase4-ui改善.md §7-8](./20_phase4-ui改善.md)

### 2026-06-14: リファクタ監査🔥B「軸キー bg/background 統一」は見送り（保留）

- **背景**: 監査で「3軸系（per-image👍👎/好みAI）の軸キーが `bg`、5軸系（details）や Scope は `background` で不統一」「`scopeOf`(ratingAnalyzer) が恒等写像」と指摘された
- **選択肢**: A) 全面 bg→background 統一 / B) 安全な micro クリーンアップのみ / C) 見送り
- **採用**: C（見送り）
- **理由**: 機能バグは無く、得られるのは命名一貫のみ。一方 `bg` は (1) PreferenceProfile の **localStorage 永続キー**（likes/dislikes.bg）、(2) フロント↔サーバの **ワイヤ形式**（preferenceProfile / ratingBias.axes / samples）、(3) **Gemini の出力契約**（gemini.ts がモデルに `"bg"` を出力させ parse）であり、統一には §4 untouchable を6ファイル（history / preferenceProfile / ratingAnalyzer / skyveilProfile / gemini / promptSystem）＋ localStorage migration ＋ Gemini 契約変更が必要。費用対効果が著しく悪く、Gemini契約・永続データ・保護コアを巻き込むリスクが高い
- **補足（既知の命名ワート）**: per-image 評価の保存フィールド名 `resultBgRatings` 等は別物で不変・安全。`scopeOf`（5軸系 RatingAxis）は既に恒等写像で `bg/background` とは無関係に削除可能（低優先・別タスク）。今後 `bg` を触るのは「永続形式やプロンプト契約を別目的で改訂する時」に同梱するのが妥当
- **影響範囲**: コード変更なし（本ログのみ）。`bg` 命名は現状維持

### 2026-06-14: 衣装スタイルラベルの front/server 二重定義は見送り（保留）

- **背景**: `OUTFIT_STYLES`（src/data/presets.ts・UI表示ラベル）と `LARGE_CATEGORY_LABEL`（server/src/outfitSubStyles.ts・生成プロンプトに注入する styleLabel）が同じ id 空間で5件ドリフト（lolita=ロリータ↔ドール系 / uniform=制服風↔制服 / idol=アイドル風↔アイドル衣装 / runway=ランウェイ風↔ランウェイ / future_dress=近未来ドレス↔未来ドレス）
- **選択肢**: A) サーバ→フロント表記に統一 / B) フロント→サーバ表記に統一 / C) 見送り
- **採用**: C（見送り）
- **理由**: フロントとサーバは**別ビルドで import 共用が不可能**（フロント presets をサーバから参照できない）。値を揃えるには手で同期するしかなく、(A) はプロンプト出力が変わり（特に lolita「ドール系」→「ロリータ」は生成傾向が変わり得る）、(B) は UI 表示が変わる。両者は用途が異なる（UI ラベル vs プロンプト語）ため意図的差分とみなし現状維持。実害は小さい
- **影響範囲**: コード変更なし（本ログのみ）。将来サーバ側ラベルを単一ソース化するなら server 内で完結させる方針

### 2026-06-14: 評価ボタン行の共通コンポーネント化は見送り（保留）

- **背景**: PromptCard と ArrangePreviewPanel の評価ボタン行を共通コンポーネント化する監査提案
- **選択肢**: A) variant コンポーネント化 / B) 色セマンティクスだけ軽量共通化 / C) 見送り
- **採用**: C（見送り）
- **理由**: 2箇所は値セット（PromptCard=[6,5,3,2,1] 神6あり / Arrange=[5,3,2,1] 神なし）・サイズ（大/小）・装飾（shadow有/無）・付随機能（PromptCardのみ AI分析）が**すべて異なり**、共通なのは色の意味（5=emerald/3=sky/2=amber/1=rose/6=yellow）だけ。コア評価UIに variant コンポーネントを無理に作るとリスクが dedup 益を上回る
- **影響範囲**: コード変更なし（本ログのみ）

### 2026-06-14: 命名統一の一部（notif/Notification・バー系トグル）は見送り

- **背景**: 監査で「notificationSettings の notif/Notification 混在」「バー系のstate名・トグル絵文字不統一」の統一提案
- **採用**: 両方 C（見送り）
- **理由（notif/Notification）**: lib の export は既に全て `Notif*` で統一済み。残る不一致はファイル名/コンポーネント名（完全形）のみで、完全形へ寄せると型 `NotificationSettings` がコンポーネント名と衝突して不可。略称へ寄せる＝ファイル名の可読性低下。クリーンな統一方向が存在しないため現状維持
- **理由（バー系）**: state 名は GlobalProtectionBar/ZozoTrendBar/SkyveilBar とも既に `open` で統一済み。差は SkyveilBar のトグルが「▼ 設定／▲ 閉じる」とラベル付き（他は ▼/▲ のみ）だが、これは有用な説明ラベルで、揃えると UX 低下＋レイアウト制約（ボタン文言変更禁止）に抵触
- **影響範囲**: コード変更なし（本ログのみ）

### 2026-06-14: 型ミラー解消①「スカラー spine を shared/promptScalars.ts へ集約」実装完了（案A）

- **背景**: front `src/types.ts` と server `server/src/types.ts` が手動同期ミラー。完全一致するスカラー型（Scope/OutputTarget/Mood/LockKey/SafetyMode/PromptTarget/Count/Expression/ColorStrategy/ArtStyle/AutoOr の11種・約150行）が二重定義で、enum 値追加時に二重編集が必要だった
- **選択肢**: A=スカラー spine だけ中立ファイルへ集約し両 types.ts は import＋re-export ／ B=現状維持＋記録 ／ C=設定 interface まで含む完全共通化
- **採用**: A
- **理由**: 設定 interface（HairSettings 等）はサーバが意図的に loosening（AutoOrStr=string・union インライン化・一部フィールド省略）しており、完全共通化は設計と衝突（案C却下）。また front types.ts はフロント専用型（PromptHistoryItem 等）内で poseLib/zozoTrend/promptDiff を参照するため全体共有は不可。依存ゼロかつ完全一致のスカラー spine のみが安全に共通化できる
- **実装**: `shared/promptScalars.ts`（純 type・依存ゼロ・約229行）を新設。両 types.ts は当該定義を削除し `import type {…} from "(../|../../)shared/promptScalars"` ＋ `export type {…}` で再エクスポート。**既存 consumer は無改修**（untouchable の promptSystem.ts / scopeFilter.ts も無改修＝`import { Scope } from "./types"` が継続動作）。これがフロント↔サーバ間で初の越境 import になるが、純 type ファイルのため runtime 連れ込みは無し
- **影響範囲**: front −174行 / server −121行 / shared +229行。挙動は完全不変（型レベルのみ・ランタイムコード0）。front tsc / server tsc / vite build すべて exit 0
- **副次発見（本件対象外・別途）**: server `BackgroundSettings` は textType/textMood/textLayout/textTexture を持たず promptSystem も未読（文字背景はサーバ未実装の機能ギャップ）。`Camera3DState.pose` 欠落・`DetailSettings.bigObject?` optional は promptSystem 側ガード済で良性
- **保留**: 設定 interface の共通化（案C・非推奨）。型ミラーの残りはサーバの permissive 設計として意図的に維持

### 2026-06-14: App.tsx 分割 Phase 1a/1b 実装完了（useLatestRef フック化＋referenceNoteText 抽出）

- **背景**: App.tsx は約2890行の god component。§3「無計画な大規模分割禁止」に従い、副作用の薄い純 move から段階分割する方針（①型ミラーに続く②の Phase 1）
- **Phase 1a（useLatestRef）**: `const xRef = useRef(x); useEffect(() => { xRef.current = x; }, [x]);` の定番を `src/lib/useLatestRef.ts` に集約
  - **正直な調査結果**: 当初「7本」と見積もったが、安全変換できたのは **2本のみ**（`referenceNoteRef` / `itemsRef`＝state が ref より前に宣言）。残り5本（`preferenceProfileRef` / `ratingAnalysisRef` / `imageAnalysisRef` / `skyveilProfileRef` / `skyveilStrengthRef`）は `buildInputs`(600) / `handleGenerate`(914) が TDZ を避けて最新値を読むための**意図的な前方宣言**（state は1084行以降）。`useLatestRef(state)` は宣言地点で state を渡すため適用不可 → 現状維持。フック JSDoc に除外理由を明記
- **Phase 1b（referenceNoteText）**: 「【参照画像から強制適用】」ブロックの整形 useMemo（App 内インライン）を `src/lib/referenceNote.ts` の `buildReferenceNoteText(note, categories)` 純関数へ抽出。lib をコンポーネント層へ依存させないため categories は引数で受ける。**出力文字列は従来と完全一致**（verbatim 抽出）
- **影響範囲**: App.tsx −約20行＋import2行。挙動不変（フックは元の useRef+useEffect と同型・更新タイミング厳守／純関数は同一出力）。front tsc / vite build exit 0
- **保留（Phase 4・5）**: 生成設定 state 群の useGenerationSettings 化（buildInputs 隣接で中〜高リスク）、JSX 800行のセクション別分割（§3 該当）。別途設計・承認を前提に保留

### 2026-06-14: App.tsx 分割 Phase 2/3（useColorWeights / usePolicyControls）は見送り

- **背景**: 監査②の Phase 2（色×軸 重み）・Phase 3（モチーフlv／コンボ／反映フラグ）を「自己完結クラスタ → カスタムフック化」する計画だったが、実装前調査で**クリーン分離不可**と判明
- **根本原因（宣言順序の分断）**: 状態（`colorWeights`/`levels`/`comboPolicies`/`policyApplied`）は `buildInputs`(586行・P7中核ゲート) が読むため **586行より前**に宣言必須。一方 auto-adjust／undo／toastラッパ群（1452–1585）は `showPresetToast`(985) と `colorAnalysis`(1000) に依存するため **遅い**位置に必須。1つのフックはこの 586 ↔ 985/1000 の分断を跨げない（早く呼べば auto-adjust が TDZ、遅く呼べば buildInputs が TDZ）。**Phase 1a で5本（preferenceProfileRef 等）を変換できなかったのと同一の構造的制約**
- **選択肢**: A=見送り＋記録 ／ B=「状態フック＋遅延 auto-adjust 用に setter を返す escape-hatch」版で実装
- **採用**: A（見送り）
- **理由**: 案B は挙動同一で App.tsx を約100行減らせるが、(1) フックが setter 数本を漏らす薄い「状態バッグ」で真の抽象化にならない、(2) buildInputs の変数源・JSX props・auto-adjust 尾部を広く配線変更、(3) §5 生成ペイロードに効くため Playwright 検証必須。クリーン版に必要な「buildInputs を 1000行以降へ移すリオーダー」は P7・§3 抵触。リスク／churn に見合う利得がない
- **影響範囲**: コード変更なし（本ログのみ）。Phase 1a/1b（commit `2360ecd`）までで②は一旦完了とする
- **再挑戦の前提**: もし将来やるなら、まず `buildInputs` の入力組み立てを別 lib（純関数）へ切り出して「状態を読む位置」と「組み立てロジック」を分離する設計（＝Phase 4 系）を先に承認・実施し、ゲートの前後関係を解いてから

### 2026-06-14: 【人体補正】に【脚部補正】を追加（bodyFixBlock・全プロンプト常時出力）

- **背景**: ユーザー要望。AI生成で頻出する脚アーティファクト（過度に長い脚・膝下の破綻・余分な輪郭線・3本目の脚＝ghost leg）を抑制するため、既存【人体補正】に脚部補正の文例を追加
- **変更**: `server/src/promptSystem.ts` `bodyFixBlock()`（§4 untouchable・**ユーザー明示承認のうえ実施**）の文例末尾、英文「…wide-angle distortion.」の**直後に2行を追加のみ**（既存文は一切不変）:
  - 「【脚部補正】脚は左右2本のみ。膝下〜足首の長さを自然に保ち、過度に長い脚・膝下の破綻・余分な輪郭線を排除。」
  - 「Legs: exactly two legs, natural lower-leg length, no elongated or distorted limbs below knee, no ghost legs, no extra outlines.」
- **全出力反映**: bodyFixBlock() は buildSystemPrompt 内で**無条件挿入**（4186・コメント「常時挿入」）。runtime 検証で scopes=[]/background/pose/hair+outfit+camera の全ケースで「distortion 直後」に出力を実証
- **P8整合**: 解剖学的な「補正・中立化」（脚の本数・長さ・破綻の抑制）であり主役導線を支配するスタイル注入ではない。既存 bodyFixBlock（手指・等身補正）と同性質
- **検証**: server tsc exit0／runtime ALL_OK（temp script 実行・削除済）。front は無関係（サーバのみ）

### 2026-06-14: 詳細設定にオプション単位 NG（ダブルクリック除外・A案）を実装

- **背景**: ユーザー要望。詳細設定の全カテゴリのボタンに「ダブルクリックでNG（赤字＋取消線）→生成で完全スキップ・ネガティブ不使用（単純に無視）」を追加。あわせて複数選択(最大3)を調査した結果、既に `MultiFieldSection`(maxSelect=3・FIFO) で23フィールド実装済みと判明（②はカテゴリ単位で「組合せ可能フィールドのみ」拡張する別タスク）
- **設計判断（ユーザー承認）**: NG は A案=クライアント側除外のみ。理由＝サーバの auto モードは候補プールを列挙しないため「auto抑制」には§4＋ソフトネガティブが必要で「ネガティブ不使用」要件と矛盾。A案では NG 項目を選択不可＋選択中なら解除＝選択値に乗らないため出力に出ない。**サーバ無改修(§4不要)**
- **実装**: ①`DetailSettings.ngOptions?: Record<string,string[]>`（"scope.field"→NG id配列）追加 ②settingsPersist mergeDetails で ngOptions 永続保持（multiOverrides は従来通り非永続） ③GridCell に `ng`/`onDoubleClick`（赤字＋line-through＋select-none、active/✓抑制） ④FieldSection/MultiFieldSection が NgContext＋`fieldKey` で NG 描画・onClick ガード・onDoubleClick トグル。**全100 call site(77+23)に fieldKey を機械注入**（value=`d.scope.field` / multiOverrides キーから導出） ⑤DetailsCard 本体に `toggleNg`（NG化時は単一/複数選択から当該 id を解除）＋ NgContext.Provider ⑥フッターに「ダブルクリック＝NG（除外）」ヒント
- **検証**: front tsc / vite build exit0。**Playwright隔離(4330)で実証** — 単一(背景色): 選択→NG(取消線)＋非active→NG中クリック無視→再ダブルクリックで解除→再選択可（全6ステップ合格）。複数(場所/最大3): 3選択→1つNGで2に減・他は active 維持→NG中クリック無視→解除。`/api/generate` body: NG項目(inherit)は選択値に乗らず `background.color="blue"`・`ngOptions={"background.color":["inherit"]}` 送信。**server grep: ngOptions 参照0件＝単純に無視**。console 実エラー0(route.abort のみ)。後片付け済(4330停止・一時削除・5173/3001不可侵)
- **適用範囲**: GridCell ベースの全 FieldSection/MultiFieldSection（背景/髪/衣装/ポーズ/カメラ/小物/大物/乗り物/神話/照明/前景/コスプレ）。bespoke UI のタブ(mood/artStyle/colorStrategy/ng/aspectRatio/camera3D)は GridCell 非使用のため対象外
- **次**: ②複数選択のカテゴリ単位拡張（組合せ可能フィールドのみ・各フィールド client＋§4 結合・カテゴリごとに検証）

### 2026-06-14: 複数選択(最大3)拡張② — 背景カテゴリ（スタイル/色/空間効果）

- **対象**: 詳細設定②の複数選択を「組合せ可能フィールドのみ・カテゴリ単位」で拡張。第1カテゴリ＝背景
- **変換した3フィールド**: 背景スタイル(style)/色(color)/空間効果(effect) を FieldSection→MultiFieldSection(maxSelect=3)。client は makeMultiChanger を "background" 他へ拡張して配線。server promptSystem(§4) に getMultiVals 結合分岐を **additive** 追加（2個以上選択時のみ融合表現／単一・auto・skip 時は既存 else-if を温存＝出力不変）
- **除外（精査で判明）**: 文字背景4種(種類/雰囲気/配置/質感)＝**サーバが完全に未処理**(textType 等 grep 0)で multi 化しても生成無効果のため据え置き。時間帯/天候＝準排他(1画像1つ)。密度/奥行き/情報量＝スカラー
- **検証**: front/server tsc・vite build exit0。runtime: multi「水彩画風×コラージュ（複数スタイルを自然に融合）／青系×ピンク系の配色／霧と光の粒子（複数効果を重ねる）」・single「水彩画風（固定）／青系（固定）／霧（固定）」＝**非multi出力不変**を実証。Playwright隔離: 背景スタイルで2選択→2/3・4つ目で FIFO→3/3・NG(機能①)併用で除外も動作。console0。後片付け済(4330停止・5173/3001不可侵)
- **次カテゴリ候補**: 前景演出(エフェクト/回転渦/HUD/アート/位置/動き/色方向)→ポーズ(印象/手/足/動き)→小物/大物/乗り物/神話/コスプレ等

### 2026-06-14: 複数選択(最大3)拡張② — 前景演出カテゴリ（7軸）

- **変換7フィールド**: エフェクト種類/回転・渦/HUD・デジタル/アート表現/位置/動き/色方向 を MultiFieldSection(最大3)化。ForegroundContent に chg を配線し makeMultiChanger("foreground") 使用。server promptSystem に getMultiVals 結合分岐を additive 追加
- **据え置き**: preset(他フィールド一括上書きの特殊)・密度/奥行き(スカラー)・視認性(顔保護・準排他)
- **検証**: front/server tsc・vite build exit0。runtime: multi「花びら・雪（複数を重ねる）／青白×ゴールド（複数色を併用）」・single「花びら（固定）／青白（固定）」＝非multi出力不変を実証

### 2026-06-14: 複数選択(最大3)拡張② — ポーズカテゴリ（印象/手/足/動き）

- **変換4フィールド**: 印象/手の位置/足の位置/動き を MultiFieldSection(最大3)化（PoseContent に chg 配線）。server に additive 結合分岐（手足は「左右で異なる配置」表現）
- **据え置き**: 種類(基本姿勢1つ)・重心(1つ)・視線(1方向)・体の向き(1つ)＝排他
- **検証**: tsc(both)/build exit0。runtime「印象：クール・謎めいた…（複数の印象を融合）／手：片手を腰・片手を顔の近く（左右の手で異なる配置）」・single「クール（固定）」＝非multi不変

### 2026-06-14: 複数選択(最大3)拡張② — 髪カテゴリ（質感/毛先/アクセサリー）

- **変換3フィールド**: 質感/毛先/アクセサリー を MultiFieldSection 化（形/髪色は既存 multi）。server additive 結合分岐
- **据え置き**: 長さ/ボリューム(スカラー)・カラーモード(ポリシー)・前髪(1スタイル排他)
- **検証**: tsc(both)/build exit0。runtime「質感：さらさら・濡れ髪（複数の質感を融合）／アクセサリー：リボン・花…（複数を併用）」・single「（固定）」不変

### 2026-06-14: 複数選択(最大3)拡張② — 照明カテゴリ（空気感）

- **変換1フィールド**: 空気感 を MultiFieldSection 化（光源方向/強さ/色温度/影/反射は既存 multi）。server に additive 結合分岐
- **検証**: tsc(both)/build exit0（additive＝非multi時は出力不変・既存4カテゴリで runtime 実証済の同一パターン）

### 2026-06-14: 複数選択(最大3)拡張② — 神話カテゴリ（配置・関わり方/描写スタイル）

- 配置・関わり方/描写スタイル を MultiFieldSection 化（神話地域/幻獣種別は既存 multi・サイズ感は据え置き）。server additive 結合分岐。tsc(both)/build exit0（非multi出力不変）

### 2026-06-14: 複数選択(最大3)拡張② — 小物/大物/乗り物/コスプレ ＋ ②完了サマリ

- **小物**: 持たせ方/雰囲気/配置（カテゴリは既存 multi・サイズ/光り方/個数据え置き）
- **大物**: 状態/雰囲気（系統は既存 multi・種類/配置/サイズ据え置き）
- **乗り物**: 素材感/雰囲気（ジャンル/種類/関わり方＝どの乗り物かの指定・時代感据え置き）
- **コスプレ**: ジャンル系統/持ち物・小物/カラー方向（7サブ系統＝特定コスチューム identity・装飾レベル/露出は据え置き）
- 各 client は MultiFieldSection＋makeMultiChanger、server promptSystem は getMultiVals 結合分岐を **additive** 追加（非multi時は出力不変）。runtime で cosplay「かわいい系×ダーク系（複数ジャンルを融合）／魔法のステッキ・王冠（複数を併用）」等の融合出力＋single「（固定）」不変を実証。全カテゴリ front/server tsc・vite build exit0
- **②完了**: 詳細設定の「組合せ可能フィールド」は全カテゴリで複数選択(最大3)対応完了。内訳＝既存multi(camera角度/距離/レンズ/構図・cyber4軸・outfit系統/色/素材/シルエット・背景place・lighting5軸・myth地域/種別・props/bigObjectカテゴリ＝計24軸)＋今回追加(背景スタイル/色/効果・前景7軸・ポーズ4軸・髪3軸・照明空気感・神話2軸・小物3軸・大物2軸・乗り物2軸・コスプレ3軸)。**据え置き**＝排他スカラー(長さ/密度/奥行き/情報量/サイズ/個数/露出/装飾量/季節感/高級感/比率/カラーモード/変化量/画角/視点高さ/コスプレ7サブ系統)・特殊(preset一括上書き/視認性/custom3D)・サーバ未処理(文字背景4種)

### 2026-06-14: App.tsx 分割 Phase 5a/5c/4a/4b/5b 実装完了（バナー/アクション/エラー抽出＋永続設定フック化）

- **背景**: App.tsx 2876行の god component を §3「無計画な大規模分割禁止」に従い、副作用の薄い純 move から段階分割（Phase 1a/1b に続く Phase 4/5）。ユーザー承認の実装順＝リスク順 **5a→5c→4a→4b→5b**。フック名は `usePersistedSettings`（`avoidRealBackground` は非永続のため除外）
- **不変の鉄則（全段共通・実証済）**: `buildInputs`(586) / `runGenerate` / `handleGenerate` / `runBiasAnalysis` は一切編集せず。フックは戻り値を **App 側で同名分割代入** して受け取り、buildInputs/JSX/全ハンドラのクロージャは同一識別子を解決＝本体無変更。生成ペイロード不変・サーバ無変更・新規「見えない支配」設定なし
- **5a（commit `deff7f4`）**: 表示専用バナー5個を `src/components/main/` へ純移設（RestoredItemBanner / PatternPreviewBanner / ArrangeSourceBanner / GenerationSummary / NanoBananaWarning）。条件ゲート・onClickクロージャは App 温存。GenerationProgress import は GenerationSummary 内へ移動
- **5c（commit `e2c8593`）**: GlobalProtectionBar の actions スロットの案数セレクタ＋生成ボタンを `GenerationActionBar` へ抽出（PromptTargetSelector は App 温存・handleGenerate は onGenerate 参照渡し）
- **4a（commit `a710f66`）**: 永続30state＋`loadSettings()` を `src/lib/usePersistedSettings.ts` へ移設（state宣言のみ・effect 3本は App 残置）。`s0` が初期化子のみで line237 以降未使用＝クリーン境界。`dimensionLevel` は値のみ返却（buildInputs 互換）。移設で未使用化した型 import 6種（ColorStrategy/Expression/DetailSettings/Mood/PromptTarget/ZozoTrend）を整理
- **4b（commit `e018844`）**: 保存 / 別タブstorage同期 / アスペクト比自動記憶 の3 effect をフックへ移管しオーナー化。App から settingsPersist import 全廃。`defaultAspectRatio` はフック内専用化につき App 分割代入から除外
- **5b（commit `7299798`）**: エラー IIFE を解体。表示シェルを `GenerationErrorPanel`（props: error/onSafeRetry）へ抽出、`handleSafeRetry` を App の return 直前へ引き上げ（buildInputs呼び出し・setter群・pendingRunRef を使うため App 保持）。ロジックは逐語移設で同一
- **成果**: App.tsx **2876 → 2286 行（−590行・約20%減）**。新規 `src/components/main/`（6ファイル）＋`src/lib/usePersistedSettings.ts`
- **検証（各段 §6）**: 全段で front tsc / vite build exit0。Playwright隔離(4330・空DB)＝5a/5c: 常時描画＋案数4→3切替＋console0／4a・4b: マウント復元・保存(localStorage 30キー)・リロード復元・別タブstorage同期・console0／5b: fetch横取り400 PROHIBITED_CONTENT で isBlocked分岐＋safe-retryボタン描画・クリックで再試行トースト発火・console error0。後片付け済（4330のみ停止・5173/3001不可侵）
- **保留（§3該当・別途承認前提）**: 分析センターModalラッパ（~45 props パススルー・低利得）／ControlPanel boostArea（showPresetToast クロージャ密結合）／メイン列・左レール全体の分割。当初 Phase4系で構想した「buildInputs の入力組み立てを純lib化」は今回 buildInputs 不可触の制約により未実施（将来の再挑戦余地）

### 2026-06-14: App.tsx 分割 #2 — boostArea を BoostArea へ抽出（見送り項目の安全分に着手）

- **背景**: Phase 5a/5c/4a/4b/5b 完了後、§15 見送り4項目（分析センターModalラッパ／ControlPanel boostArea／メイン列・左レール全体分割／buildInputs純lib化）をリスク/作業量/効果で再評価。**boostArea が「安全×価値」の最良**と判断し着手（buildInputs純lib化は出力感度が高く要厳密diff＋承認で保留、全体分割は §3 のため incremental 継続、Modalラッパは低利得）
- **commit `045356d`**: ControlPanel の `boostArea` スロット（SkyveilBar＋BoostControls＋トグル/トーストのクロージャ9本・約80行）を **`src/components/main/BoostArea.tsx`** へ集約（アプローチB＝カプセル化）。App は値・setter・showPresetToast の **24 props** を渡すのみ
- **設計**: 9クロージャ（onToggle/onStrength/onOneShot/onReset/onZozoApply/onZozoSetPriority/onZozoClear）＋ outfitConflict/windApplicable 判定を BoostArea 内へ逐語移送（5b の handleSafeRetry 引き上げと同手法）。`MIN_SAMPLES`/`STRENGTH_TO_FAVORITE` はコンポーネントで import。App から未使用化した `BoostControls`/`STRENGTH_TO_FAVORITE` import を除去。**ControlPanel/SkyveilBar/BoostControls 本体は無変更**（boostArea は ReactNode のまま受け渡し）
- **成果**: App.tsx 2286→2235行（−51）。新規 BoostArea.tsx
- **不変条件**: buildInputs/runGenerate/handleGenerate/runBiasAnalysis 無変更・生成ペイロード不変・サーバ無変更・新規「見えない支配」設定なし
- **検証**: front tsc / vite build exit0。Playwright隔離(4330): 好み/ZOZO/風の3セクション描画・skyveilトグルON→favoriteLearnEnabled＋トースト「あなたの好み（skyveil）反映 ON」・**風=3 が /api/generate body.windLevel=3 に反映（抽出後も buildInputs を正しく駆動）**・console error 0。後片付け済(4330のみ停止・5173/3001不可侵)
- **残りの見送り**: buildInputs純lib化（高価値・要 payload-diff 厳密検証＋承認）／メイン列・左レール全体分割（§3・incremental 継続）／分析センターModalラッパ（低利得・やるなら汎用 ModalShell 化が高ROI）

### 2026-06-14: 履歴/お気に入りカードにプロンプトコピーボタン追加（HistoryItemRow・commit `c6f368c`）

- **要望**: 履歴・お気に入りの各カードに ① プロンプト全文コピーボタン（アレンジ/再生成の並び・「コピーしました」トースト）② 削除確認ダイアログ。
- **調査結果（重要）**: 「お気に入り画面」の実体は **HistoryView の favorites フィルタ**で、履歴もお気に入りも同じ **HistoryItemRow** カードを使用。`FavoritesPanel.tsx` は**未使用 dead code**（JSX/import 参照ゼロ・コメント言及のみ）。**② 削除確認は HistoryItemRow に既存実装済み**（インライン「削除しますか？」→「削除する/キャンセル」・キャンセルで no-op）＝**変更不要**。よって実作業は ① のみ。
- **① 実装**: HistoryItemRow に「📋 コピー」ボタン追加（アレンジ/再生成の並び）。`item.promptText` 全文を `navigator.clipboard.writeText` へ。承認済み方針＝(a) 通知は App 汎用トースト `showPresetToast` を HistoryView 経由で再利用（HistoryView に `onToast` prop・App から配線・「✓ コピーしました」）(b) コピー成功時に `item.copied=true` を `onUpdate` で永続し既存「📋 コピー済み」フィルタと整合（PromptCard と同挙動）。
- **不変条件**: ControlPanel系/生成/サーバ無関係。既存の削除確認・各ボタン・レイアウト不変。IDB は既存 updateItem 経由（copied のみ・非破壊）。PC専用。
- **検証**: front tsc / vite build exit0。Playwright隔離(4330・合成履歴 seed): コピー→`writeText` 引数が当該カードの promptText 全文と完全一致・「コピーしました」トースト・copied=true 永続・既存削除確認(キャンセルで残存)無傷・console error0。seed に dateKey 欠落で CalendarView が `startsWith` で落ちる事象を発見したが、実データは buildHistoryItems が必ず dateKey 付与のため再現せず＝実装非該当（seed を dateKey/最近日時付きに修正して解消）。
- **付随メモ**: `FavoritesPanel.tsx`（FavCard 含む）は未使用 dead code → 後続 commit `5930e94` で削除済（847行・stale コメント5箇所も整合）。

### 2026-06-15: 詳細設定UI再構成（全体スタイル最上部固定／詳細オプション常時表示／退廃的除去・commit `2666a10`）

- **背景**: ユーザー要望で DetailsCard（「雰囲気・スタイル」＝アコーディオン）のUI構成を見直し。調査で各定義場所を特定（絵柄=`ART_STYLE_OPTIONS`/`ArtStyleTabContent`・色戦略=`COLOR_STRATEGY_OPTIONS`@EraColorSelector/`ColorStrategyTabContent`・詳細オプション=`MOOD_GROUPS_DETAIL`@MoodSelector・その他=`MOOD_GROUPS_BASIC[2]`@MoodSelector）。
- **設計の核心（要判断→承認済）**: 絵柄・色戦略は**グローバル設定**（scope非依存・全案適用）、背景スタイル/背景の色は**背景scope専用**。→ 背景内にネストすると背景未選択時に操作不能になるため、**ネストせず「上部固定の専用セクション」へ集約**する方針をユーザーが選択。
- **実装（DetailsCard.tsx / MoodSelector.tsx・UIのみ）**:
  - 新 EXTRA `globalStyle`「🎨 全体スタイル」を新設し `GlobalStyleTabContent`（絵柄＋色戦略を縦積み）に集約。`EXTRA_TAB_IDS=["globalStyle","mood","ng"]`、accordion sort を rank制（globalStyle=2 最上部／選択済=1／未選択=0）にして**常時最上部にピン留め**。旧 EXTRA `artStyle`/`colorStrategy` を globalStyle へ統合（countTab/renderTabContent/EXTRA_TAB_META 整合）。
  - `MoodTabContent`：「詳細オプション（反射・空気感・色調・空間）」の折りたたみ（detailOpen/hasDetailSelection）を廃止し `MOOD_GROUPS_DETAIL` を基本群に続けて**常時表示**。
  - `MOOD_GROUPS_BASIC`「その他」から `decadent`（退廃的）をピッカー除去（ChatGPT画像ブロック誘発語・P8/#69）。**mood ID は types/server・保存データに温存（非破壊）**。
  - **文字背景/書・背景の色(background.color)・NG指定・各scope content・サーバ・生成ロジックは無変更**（色戦略は全体スタイルへ・背景の色とはレイヤーが異なるため背景の色は不変＝色語彙の重複は役割分離で併存）。
- **不変条件**: 絵柄/色戦略の選択肢・解除・生成反映は不変。§4=新規セクション追加のみ。§5=新規グローバル設定の追加なし（既存移設）。
- **検証**: front tsc / vite build exit0。Playwright隔離(4330): 全体スタイルが最上部＋絵柄/色戦略内包・**絵柄フォトリアル選択→/api/generate body.artStyle="photo" 反映**・雰囲気に反射/空気感/色調/空間が折りたたみなしで常時表示・その他に退廃的なし・console error0。
- **未実施（任意）**: 背景の色(BG_COLORS)からの色戦略重複ラベル除去は保存データ表示の副作用があるため見送り。

### 2026-06-15: カメラ3D指定をカメラ専用アングルピッカーへ刷新（A+B+C・§4無改修）

- **背景/調査（read-only）**: 3D指定ツール(Camera3DPicker)の扱いを「カメラ専用ピッカー化」か「ボタン一本化」かで検討。最終運用は GPT Image（テキスト・度数の精密制御は不要）。コード読取で判明＝① ポーズ部(`custom3D.pose`)は payload に入るが server `describeCustom3D` が一切参照せず**死に機能**、② custom3D 設定中もボタンの lens/fov/composition が server で「カメラ補助：…」として併出する**部分二重出力**（フルの二重は if/else 排他で無し）、③ カメラtabは `allTabs=[...scopes,...]` で **camera ∈ scopes のときだけ表示**＝「操作したのに無反映」は構造上ほぼ起きず、真の穴は **camera 解除後の custom3D 残留 → 再選択時のボタン上書き**（§5「見えない支配」の芽）。→ ユーザー判断で**カメラ専用ピッカー化**を採用。決定＝(B)解除時に自動クリア／被写体は静的シルエット／**§4(promptSystem)改修は見送り**（度数削除D・サーバ版C＝補助行削除は不採用）。
- **S1（A＝撤去拡大版・commit `57404ba`）**: Camera3DPicker を**「3Dビュー＋出力プレビュー文」のみ**へ刷新。撤去＝ポーズボタン群／カメラ角度プリセット／フレーミング／腕脚の関節スライダー／カメラ調整スライダー(水平回転・仰角・ダッチ・距離)／構図ボタン。**マウスへ集約**＝yaw/pitch=ドラッグ・distance=ホイール→`compositionFromDistance` で構図語を自動化。被写体は**静的シルエット**(頭＋胴カプセル・関節なし)＋接地リング（旧 `DynamicSkeleton` 撤去）。roll/preset は固定(roll=0/preset=null)。**デッドコード掃除**＝`src/lib/poseLib.ts` 全削除・`Camera3DState.pose` 削除(types.ts/cameraAngle.ts)・cameraAngle.ts の未使用 `CAMERA_PRESETS`/`CameraPreset`・drei `Line`・`VIOLET` 撤去。server型 `Camera3DState` は元から pose 無し＝**サーバ無変更**。
- **S2（C＝部分二重出力をクライアント側で解消・commit `f3c22c4`）**: DetailsCard `CameraContent` で custom3D 設定時に **`camera.lens/fov/composition` を skip 強制**（server `describeCustom3D` 後の「カメラ補助：…」漏れを源で遮断＝**promptSystem 無改修**）。3D指定中はカメラ6行(角度/距離/レンズ/構図/画角/視点高さ)を `opacity-40 pointer-events-none`＋注記で無効表示（解除はプリセット「設定なし／おまかせ」）。
- **S3（B＝scope連動の残留対策・commit `6fc96fb`）**: App に invariant ガード effect＝`!scopes.includes("camera") && details.camera.custom3D` の時 custom3D を null へ。手動解除／全リセット／履歴復元／アレンジ等の**全経路を一括カバー**（個別 setScopes 改修不要・他scopeは不変）。
- **不変条件（実証済）**: CameraContent ボタンパネルの選択肢・`/api/generate` ペイロード構造・サーバ(promptSystem §4 / gemini / scopeFilter)は無変更。出力の「N度」は従来どおり残存（度数削除Dは見送り）。新規「見えない支配」設定なし（§5）。
- **検証（各段 §6・Playwright隔離4330・空DB）**: S1＝front/server tsc 0・build 0／ピッカー DOM が canvas=1・button=0・range=0・出力文のみ／マウスで `正面構図,ほぼ水平`→`右斜め125度,極端なローアングル`、ホイールで `バストアップ構図→腰までの構図`／console0。S2＝lens=portrait/fov=vertical_sns/composition=rule_of_thirds を seed→3D設定後に**全て skip 化＆custom3D非null**(leakKilled=true)・6行無効化=true・console0。S3＝scopes=[camera,outfit]+custom3D 設定→**camera 外し後 scopes=[outfit]（outfit保全）・custom3D=null**・console error0。後片付け済(4330のみ停止・5173/3001不可侵)。
- **見送り（§4該当・別途明示承認が前提）**: D＝度数(N度)削除（client `describeCameraAngle`＋server `describeCustom3D` のペア改修）／サーバ版C＝promptSystem 1527-1533「カメラ補助」補助行の削除（client版Cで二重解消済のため不要だが恒久化したい場合の候補）。
