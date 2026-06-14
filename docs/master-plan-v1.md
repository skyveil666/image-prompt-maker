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
