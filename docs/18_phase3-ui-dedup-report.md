# 18. Phase 3 UI重複整理 — 調査レポート

> **本書は調査レポートのみ。** 機能追加・ロジック変更・削除実装は一切行っていない。
> Phase 2（GlobalProtectionBar / AnalysisStatusStrip 追加）後の最新状態を反映する。
> 旧 [11_UI重複一覧.md](./11_UI重複一覧.md)（Phase 2 以前）は本書で更新・上書きされる。
> **依拠**: [master-plan-v1.md §2](./master-plan-v1.md), [16_future-roadmap.md Phase 3](./16_future-roadmap.md)

---

## 0. 最重要発見：デッドコード（未使用コンポーネント）

grep の結果、以下は **どこからも import されておらず描画されていない**（孤立ファイル）:

| ファイル | 状態 | 本来の役割 | 実際に使われている代替 |
|---|---|---|---|
| `src/components/ProtectionBar.tsx` | ❌ 未使用 | 保護設定（faceLock+lock+安全モード+量産回避） | ControlPanel 内蔵「守るもの」 |
| `src/components/FaceLockSwitch.tsx` | ❌ 未使用 | 顔ロック大型バナー | ControlPanel 内蔵 faceLock ボタン |
| `src/components/LockToggles.tsx` | ❌ 未使用 | 体型/色味/構図 トグル | ControlPanel 内蔵チップ（後述 Toggle） |
| `src/components/SafetyToggle.tsx` | ❌ 未使用 | 安全モード（架空/実在） | なし（buildInputs で `"fictional_ai"` 固定） |
| `src/components/ScopeSelector.tsx` | ❌ 未使用 | 変更範囲セレクタ | ControlPanel 内蔵 SCOPE_OPTIONS |
| `src/components/MoodSelector.tsx` | ⚠ 半使用 | 雰囲気セレクタ（コンポーネント未使用） | 定数 `MOOD_GROUPS_*` のみ favoriteProfile が import |

確認コマンド: `<ProtectionBar` 等の JSX 使用箇所 0 件 / import 文も GlobalProtectionBar のみ。

> ⚠️ **doc 11 の前提との差異**: doc 11 #1 は「ProtectionBar が LockToggles/FaceLockSwitch を内包し三重化」と推定していたが、
> 実際には 3 つとも **未使用**で、唯一生きている操作面は ControlPanel 内蔵セクション。三重化しているのは「表示」側（後述）。

---

## 1. 表示重複（同じ情報を複数箇所で表示）

### D-1【最重要】変更対象（scopes）が3箇所

| 箇所 | 種別 | 参照 |
|---|---|---|
| ControlPanel「変更範囲」 | 操作（本体） | [ControlPanel.tsx:28-42](../src/components/ControlPanel.tsx#L28) |
| GlobalProtectionBar「🎯 変更対象」 | 表示 | [GlobalProtectionBar.tsx](../src/components/GlobalProtectionBar.tsx) |
| ReflectionStatusBar「🎯 変更対象」 | 表示 | [ReflectionStatusBar.tsx:239-245](../src/components/ReflectionStatusBar.tsx#L239) |

→ スクショで「衣装・髪・ライティング・背景・カメラ・前景演出」が GPB と 反映状態 の両方に出ている。

### D-2【最重要】守るもの / 顔・同一性 が3箇所（表示）＋1（操作）

| 箇所 | 種別 |
|---|---|
| ControlPanel「守るもの」 | 操作（本体） [ControlPanel.tsx:285-370](../src/components/ControlPanel.tsx#L285) |
| GlobalProtectionBar「🛡 顔・同一性」＋展開「🔒 守るもの」 | 表示 |
| ReflectionStatusBar「🔒 守るもの」 | 表示 [ReflectionStatusBar.tsx:247-253](../src/components/ReflectionStatusBar.tsx#L247) |

### D-3【最重要】AI分析の状態が2箇所

| 箇所 | 内容 |
|---|---|
| AnalysisStatusStrip | 5分析の件数+鮮度（サマリ） |
| AnalysisLiveView「🤖 AI分析ライブビュー」 | 13ステップ/ログ/根拠/進捗（詳細） |

→ どちらも「🤖 AI分析」の旗を立てており、上部に2つの AI分析ウィジェットが並ぶ。

### D-4 skyveil好み の状態が5箇所

| 箇所 | 内容 |
|---|---|
| SkyveilBar | 操作＋プロファイル＋成功プロンプト（本体） |
| AnalysisStatusStrip「🧬 skyveil好み」 | 件数+鮮度 |
| AnalysisLiveView「skyveil自動学習」＋根拠 | 進捗・根拠 |
| DuplicateAnalysisPanel「💡 好み分析レポート」(RealAnalysisCard) | プロファイル再掲 |
| ReflectionStatusBar「💖 好み反映」 | ON/OFF・ZOZO |

### D-5 反映状態の表示が複数

| 箇所 | 内容 |
|---|---|
| ReflectionStatusBar「📡 現在の反映状態」 | 専用（変更/守る/補助/好み/見た目/重複） |
| GlobalProtectionBar | 変更対象・守るもの（D-1/D-2 と重複） |
| DuplicateAnalysisPanel ヘッダ | policyApplied（重複制御の反映） |
| SkyveilBar「現在の反映：OFF」 | skyveil の反映状態 |

### D-6 Identity Shield（住み分け済・重複ではない）

| 箇所 | タイミング |
|---|---|
| GlobalProtectionBar | 生成「前」ライブリスク |
| PromptGuardSection（カード内） | 生成「後」結果 |

→ 前後で役割が異なるため**重複ではない**（維持）。

---

## 2. 操作重複（同じ意味の操作・同じ設定を変更するUI）

### O-1 「全リセット」系

| 箇所 | 範囲 |
|---|---|
| ReflectionStatusBar「↺ 全リセット」 | 変更対象・設定・プレビュー初期化（集約済） [ReflectionStatusBar.tsx:197-206](../src/components/ReflectionStatusBar.tsx#L197) |
| ControlPanel「↺ プリセット解除 / 変更だけ / 選択解除」 | 部分リセット [ControlPanel.tsx:123](../src/components/ControlPanel.tsx#L123) |

→ 完全な重複ではないが「リセット」の意味が分散。文言整理候補。

### O-2 「反映」ボタンの分散（doc 11 #9 継続）

| 箇所 | 影響範囲 |
|---|---|
| DuplicateAnalysisPanel「✓ 提案を反映」 | motifControls/comboControls |
| SkyveilBar「今回だけ反映 / 反映OFF」 | preferenceProfile/favoriteTraits |
| ColorWeightGrid「✨ 提案を反映」 | colorWeights |
| 成功プロンプト「この型を反映」 | scopes |

→ 「反映」の語が文脈で意味が異なる。影響範囲チップ等の整理候補（実装は Phase 後段）。

### O-3 好み分析の起動が2箇所

| 箇所 | 操作 |
|---|---|
| SkyveilBar「🔄 好み分析を更新」 | handleRunPreferenceAnalysis |
| DuplicateAnalysisPanel RealAnalysisCard「分析実行」 | 同じ handleRunPreferenceAnalysis |

→ **同一関数を2箇所のボタンが呼ぶ**＝操作重複。

---

## 3. 概念重複（名前は違うが役割が同じ）

| グループ | コンポーネント | 役割 | 重複度 |
|---|---|---|---|
| 保護表示 | GlobalProtectionBar / ReflectionStatusBar（守る部） | 顔・同一性・守るものの状態表示 | 高 |
| 変更対象表示 | GlobalProtectionBar（変更対象部）/ ReflectionStatusBar（変更対象部） | scopes の表示 | 高 |
| AI分析表示 | AnalysisStatusStrip / AnalysisLiveView | 分析の進捗・鮮度表示 | 中（サマリ vs 詳細） |
| 好みプロファイル | favoriteProfile / preferenceProfile / skyveilProfile | 好み分析（3層） | 低（実装層・doc15で整理済） |
| 好み表示UI | SkyveilBar / DuplicateAnalysisPanel(RealAnalysisCard) | preferenceProfile の表示 | 中 |
| 保護操作（死） | ProtectionBar / FaceLockSwitch / LockToggles vs ControlPanel守るもの | 同一操作（死side） | デッド |

---

## 4. 統合候補

### 4.1 残す候補（本体・操作の単一ソース）

| コンポーネント | 理由 |
|---|---|
| **ControlPanel** | 唯一の生きた「変更範囲＋守るもの＋強度」操作面。単一ソースとして維持 |
| **SkyveilBar** | skyveil 操作の本体（ON/OFF/強度/プロファイル/成功パターン） |
| **DuplicateAnalysisPanel** | 重複/色/画像の制御本体 |
| **PromptGuardSection** | 生成後の結果確認（前後の住み分け） |
| **ReflectionStatusBar** | 「効いている設定」の網羅表示（生成補助/好み/見た目/重複は唯一ここ） |

### 4.2 統合候補（表示の集約）

| # | 統合案 | 対象 |
|---|---|---|
| M-1 | **上部ステータスを1スタックに集約** — GlobalProtectionBar と ReflectionStatusBar の重複（変更対象・守るもの）を解消。GPB＝最小常時バー、ReflectionStatusBar＝展開詳細、として「変更対象・守るもの」は片方のみが保持 | GlobalProtectionBar / ReflectionStatusBar |
| M-2 | **AI分析を1ウィジェットに** — AnalysisStatusStrip（サマリ）の [詳細] 展開で AnalysisLiveView（ステップ/ログ/根拠）を出す。上部の AI分析を1つに | AnalysisStatusStrip / AnalysisLiveView |
| M-3 | **好み分析の表示を SkyveilBar に一本化** — DuplicateAnalysisPanel 内 RealAnalysisCard は「SkyveilBar を開く」リンク＋読み取り専用サマリに縮小 | SkyveilBar / DuplicateAnalysisPanel |

### 4.3 削除候補（**今回は削除しない・記録のみ**）

| ファイル | 削除可否 | 注意 |
|---|---|---|
| `ProtectionBar.tsx` | 削除可（未使用） | 安全モード機能ごと消える点を確認 |
| `FaceLockSwitch.tsx` | 削除可（未使用） | — |
| `LockToggles.tsx` | 削除可（未使用） | — |
| `SafetyToggle.tsx` | 削除可（未使用） | 安全モードUIの最後の残骸 |
| `ScopeSelector.tsx` | 削除可（未使用） | — |
| `MoodSelector.tsx` | **部分** | コンポーネントは未使用だが `MOOD_GROUPS_BASIC/DETAIL` を favoriteProfile が import。定数を別ファイルへ移してからでないと削除不可 |

> ⚠️ 削除は Phase 3 の後続ステップ（別途承認）。本レポートでは候補提示のみ。

---

## 5. 優先順位分類

### P0（最優先・効果大）

- **D-1 / D-2 の解消（M-1）**: 上部に「変更対象」「守るもの」が GPB と 反映状態 で二重表示。最も目につく重複。
- **デッドコードの明示**（ProtectionBar/FaceLockSwitch/LockToggles/SafetyToggle/ScopeSelector）。削除は後続だが、ドキュメント上「使われていない」ことを確定させる（混乱・誤編集の防止）。

### P1（次点）

- **D-3 の解消（M-2）**: AI分析ウィジェット2つ（Strip / LiveView）を「サマリ→展開で詳細」の1系統に。
- **D-4 / O-3 の解消（M-3）**: skyveil好みの表示・起動を SkyveilBar に一本化、DuplicateAnalysisPanel 側は縮小。

### P2（整理・余裕があれば）

- **O-1**: リセット文言の整理（全リセット vs 部分リセット）。
- **O-2**: 「反映」ボタンへの影響範囲チップ付与。
- **MoodSelector 定数の分離**（削除準備）。

---

## 6. 統合後の画面構成図（案）

### 6.1 現状（Before・重複あり）

```
═══ sticky 上部 ═══
🛡 GlobalProtectionBar     [顔・同一性] [Identity Shield] [変更対象 ←重複]
🤖 AnalysisStatusStrip     [重複][色][画像][お気に入り][skyveil] 件数+鮮度
═══ 中央カラム（スクロール）═══
📡 ReflectionStatusBar     [変更対象 ←重複][守るもの ←重複][生成補助][好み][見た目][重複制御]
🤖 AnalysisLiveView        [13ステップ/ログ/根拠 ←Stripと別ウィジェット]
🧬 SkyveilBar              [操作＋プロファイル＋成功パターン]
⚡ QuickActions
🔬 DuplicateAnalysisPanel  [重複/色/画像/💡好み分析 ←SkyveilBarと重複]
🎛 ControlPanel            [変更範囲（操作）／守るもの（操作）／強度]
📋 DetailsCard
```

### 6.2 統合後（After・案）

```
═══ sticky 上部：単一ステータスヘッダー ═══
┌─────────────────────────────────────────────────────────────┐
│ 🛡 保護     顔・同一性 ON / Identity Shield HIGH 51          │ ← GPB（保護に専念。変更対象は出さない）
│ 🤖 AI分析   [重複][色][画像][お気に入り][skyveil] 件数+鮮度  │ ← Strip（[詳細]で LiveView を展開）
└─────────────────────────────────────────────────────────────┘
═══ 中央カラム（スクロール）═══
📡 現在の反映状態  [変更対象][守るもの][生成補助][好み][見た目][重複制御] ← 変更対象/守るものの“唯一の表示”
🧬 SkyveilBar       [操作＋プロファイル＋成功パターン]  ← 好み表示の単一ソース
⚡ QuickActions
🔬 DuplicateAnalysisPanel  [重複/色/画像]（好み分析は SkyveilBar へのリンクに縮小）
🎛 ControlPanel     [変更範囲（操作）／守るもの（操作）／強度]  ← 操作の単一ソース
📋 DetailsCard

（AnalysisLiveView は AnalysisStatusStrip [詳細] 展開に内包）
（ProtectionBar / FaceLockSwitch / LockToggles / SafetyToggle / ScopeSelector は削除予定＝未使用）
```

### 6.3 統合の原則（情報の単一ソース化）

| 情報 | 単一ソース（After） |
|---|---|
| 変更対象（scopes）表示 | ReflectionStatusBar（GPB からは外す or 折りたたみのみ） |
| 守るもの 表示 | ReflectionStatusBar（GPB は「顔・同一性＋Shield」に専念） |
| 守るもの 操作 | ControlPanel（唯一） |
| AI分析 進捗/鮮度 | AnalysisStatusStrip（サマリ）→展開で AnalysisLiveView（詳細） |
| 好み分析 表示・操作 | SkyveilBar（唯一）。他はリンク/サマリ |

---

## 7. 制約の再確認

本 Phase 3 は **調査と分類のみ**。以下は禁止（後続ステップで個別承認）:
- 機能追加 ❌
- ロジック変更 ❌
- 削除実装 ❌

[01_UI構成.md レイアウト制約](./01_UI構成.md)（ボタンサイズ/余白/配置/テーマカラー/構造の変更禁止）も継続遵守。統合（M-1〜M-3）はコンポーネント構造に触れるため、各実装前に承認を得る。

---

## 8. 関連ドキュメント

- [11_UI重複一覧.md](./11_UI重複一覧.md)（Phase 2 以前・本書が更新）
- [10_protection-bar常時表示.md](./10_protection-bar常時表示.md)
- [17_analysis-live-view.md](./17_analysis-live-view.md)
- [16_future-roadmap.md](./16_future-roadmap.md)

---

## 9. P0 実装完了記録（2026-06-04）

### 9.1 M-1：変更対象・守るものの二重表示解消（GlobalProtectionBar 専念化）

- **方針**: GlobalProtectionBar を **「顔・同一性状態」＋「Identity Shield」に専念**。変更対象・守るものの表示は **ReflectionStatusBar（📡 現在の反映状態）に一本化（単一ソース）**。
- **GlobalProtectionBar.tsx の変更**:
  - 折りたたみ行から「🎯 変更対象」チップを削除
  - 展開部から「🔒 守るもの（体型/色味/構図）」チップと「🧱 Scope Filter（自動保護）」を削除
  - 残置：折りたたみ＝[🛡 顔・同一性][⚠ Identity Shield]、展開＝顔・同一性ステータス＋Identity Shield 採点理由／注意／安全提案
  - 未使用化した props（`scopes` / `bodyPoseLock` / `colorMoodLock` / `compositionLock`）と `LockChip` ヘルパ・`Scope` import を除去（`noUnusedParameters: true` 対応）
- **App.tsx の変更**: `<GlobalProtectionBar>` の呼び出しを `faceLock` / `risk` の2 props のみに更新（配置・ロジックは不変）。
- **ReflectionStatusBar / ControlPanel は無変更**（変更対象＝表示の単一ソース、守るもの＝操作の単一ソース）。

### 9.2 デッドコード削除（最終確認のうえ実施）

| 確認 | 結果 |
|---|---|
| 最終参照確認（JSX 使用） | 0 件（自ファイル定義のみ） |
| 依存確認（import 文） | 0 件（GlobalProtectionBar のみ import 済み） |
| `git grep -nw`（word boundary） | コード参照ゼロ。docs/01（記述）と promptSystem.ts:222（コメント）のみ |
| 各ファイルの export | 単一コンポーネントのみ（他で使う named export なし） |

削除（`git rm -f`）したファイル:
- `src/components/ProtectionBar.tsx`
- `src/components/FaceLockSwitch.tsx`
- `src/components/LockToggles.tsx`
- `src/components/SafetyToggle.tsx`
- `src/components/ScopeSelector.tsx`

> `MoodSelector.tsx` は定数 `MOOD_GROUPS_*` を favoriteProfile が使用するため **削除対象外**（P2：定数分離後に再検討）。

付随（コメントのみ・ロジック不変）:
- `server/src/promptSystem.ts:222` の「LockToggles」言及を「色味ロック(ControlPanel)」に修正（dangling 参照の解消）。
- `docs/01_UI構成.md` の削除済みコンポーネント参照を実態（ControlPanel 内蔵）に更新。

### 9.3 検証結果

| 検証 | 結果 |
|---|---|
| フロント `tsc -b --noEmit` | ✅ exit 0 |
| サーバ `tsc --noEmit` | ✅ exit 0 |
| `vite build` | ✅ exit 0 |
| Before（実機） | GPB に「🎯 変更対象 衣装・髪・ライティング・背景・カメラ・前景演出」が表示（反映状態と二重） |
| After（実機） | GPB＝「🛡 顔・同一性 ON / ⚠ Identity Shield HIGH 51」のみ。変更対象・守るものは「📡 現在の反映状態」に単一化 |
| git status | 5ファイル `D`（削除ステージ済）。コミットはユーザー管理のため未実施 |

### 9.4 残り

- ✅ P1 / M-2（AI分析を1ウィジェットに）完了（下記 §10）
- P2 / M-3（skyveil 表示を SkyveilBar に一本化）未着手
- P3 / デッドコード削除：主要5ファイルは P0 で削除済。残り＝MoodSelector（定数分離後）

---

## 10. P1 / M-2 実装完了記録（2026-06-04）

### 10.1 内容：AI分析を1ウィジェットに統合

- **Before**: 「🤖 AI分析」(AnalysisStatusStrip・上部 sticky) と「🤖 AI分析ライブビュー」(AnalysisLiveView・中央カラム常時表示) の **2ウィジェット**が併存（D-3）。
- **After**: AnalysisStatusStrip（コンパクト1行）の **[詳細] で AnalysisLiveView を直下にインライン展開**（既定は閉。中央カラムの独立ウィジェットは撤去）。AI分析は **1ウィジェット**に。
- 詳細を開いた時はパネルを視界へ `scrollIntoView`。[詳細] は ▼/▲ で開閉状態を表示。

### 10.2 変更ファイル（AnalysisLiveView は無変更）

| ファイル | 変更 |
|---|---|
| `src/App.tsx` | `analysisDetailOpen` state + トグル + 開時スクロール effect。AnalysisLiveView を「Strip 直下・`analysisDetailOpen` でゲート」して描画し、中央カラムの常時描画を撤去。Strip に `detailOpen`/`onDetail` を配線 |
| `src/components/AnalysisStatusStrip.tsx` | `detailOpen` prop 追加（[詳細] の ▼/▲ 表示） |

**無変更**: `AnalysisLiveView.tsx`（描画位置とゲートのみ変更・本体不変）/ `useAnalysisLive` / `analysisLiveTypes` / 全 `lib/*Analyzer`。

### 10.3 検証

| 検証 | 結果 |
|---|---|
| tsc -b / vite build | ✅ exit 0 |
| 既定（未クリック） | 中央の独立「AI分析ライブビュー」ヘッダー数 = **0**（統合により撤去） |
| [詳細] クリック後 | ヘッダー数 = **1**（Strip 直下にインライン展開） |
| 実機 | 上部 sticky（GPB + 1行 Strip）→ [詳細▲] で直下に LiveView 展開を確認 |

---

## 11. P2 / M-3 実装完了記録（2026-06-04）

### 11.1 内容：skyveil 関連表示・操作の一本化

- **SkyveilBar = skyveil の唯一のハブ**に集約。DuplicateAnalysisPanel「💡 好み分析」タブの skyveil プロファイル表示・分析実行・自動学習・削除を撤去（D-4 / O-3 解消）。
- **追加要望対応**：SkyveilBar は通常時（折りたたみ）に **反映ON/OFF・強度・今回だけ反映** のみ表示。`好み分析を更新 / 自動学習 / 反映リセット / プロファイル削除` は **折りたたみ「▼ 設定・プロファイル」内**へ格納。
- **pref タブ**は「📊 評価サンプル統計＋軸別👍👎集計（実数値）」に役割特化し、冒頭に「分析・反映・自動学習・削除は skyveil好みAI へ」誘導文を追加。
- **ReflectionStatusBar の 💖好み反映 は現状維持**。

### 11.2 操作責務（反映ボタン方式・自動反映なしを維持）

| 操作 | 置き場所 | 意味 |
|---|---|---|
| 反映 ON/OFF・強度・今回だけ反映 | SkyveilBar 上段（常時） | 反映状態 |
| 好み分析を更新 / 自動学習 / 反映リセット / プロファイル削除 | SkyveilBar 折りたたみ | 詳細操作（反映リセット=状態解除、削除=学習データ削除） |
| 評価サンプル統計 / 軸別👍👎集計 | DuplicateAnalysisPanel pref タブ | 画像評価の実数集計 |
| 💖好み反映（⭐傾向 / ZOZO） | ReflectionStatusBar | 効いているかの状態 |

### 11.3 変更ファイル（ロジック変更なし・既存ハンドラ再利用のみ）

| ファイル | 変更 |
|---|---|
| `src/components/SkyveilBar.tsx` | 上段＝ON/OFF・強度・今回だけ反映 のみ。折りたたみに 好み分析を更新・自動学習・反映リセット・プロファイル削除＋エラー＋プロファイル＋成功プロンプト＋現在の反映。props 追加（profileError / autoLearnEnabled / onToggleAutoLearn / onClearProfile） |
| `src/components/DuplicateAnalysisPanel.tsx` | RealAnalysisCard 撤去。PreferenceReportSection を評価集計＋誘導に縮小。Props から analyzingProfile / profileError / onRunPreferenceAnalysis / onClearPreferenceProfile / autoLearnEnabled / onToggleAutoLearn を削除。import から profileSummaryLines / MIN_SAMPLES を削除 |
| `src/App.tsx` | 既存ハンドラ（onToggleAutoLearn=handleToggleAutoLearn / onClearProfile=handleClearPreferenceProfile / profileError / autoLearnEnabled）を DuplicateAnalysisPanel → SkyveilBar へ配線付替え |

**無変更**: preferenceProfile.ts / skyveilProfile.ts / skyveilScore.ts / favoriteProfile.ts / ratingAnalyzer.ts ほか学習・分析ロジック、ReflectionStatusBar.tsx。

### 11.4 検証結果

| 検証 | 結果 |
|---|---|
| tsc -b（front）/ vite build | ✅ exit 0（`noUnusedLocals/Parameters: true` 下で通過＝撤去要素は確実に未参照） |
| SkyveilBar 折りたたみ時 | ✅「反映OFF・弱/標準/強・✨今回だけ反映・▼設定・プロファイル」のみ。更新/自動学習/リセット/削除は非表示 |
| SkyveilBar 展開時 | ✅ 好み分析を更新・🔁自動学習・反映リセット・🗑プロファイル削除・プロファイル・成功プロンプト・現在の反映 |
| pref タブ（実機 DOM 全体） | ✅「使用モデル」「AI 好み分析（実 Gemini」「AI分析を実行」が DOM 全体から消失（RealAnalysisCard 撤去）。誘導文＋評価集計に縮小 |

### 11.5 Phase 3 総括（中間）

- P0 ✅ M-1（変更対象・守るもの二重表示解消）＋デッドコード5ファイル削除
- P1 ✅ M-2（AI分析を1ウィジェット化）
- P2 ✅ M-3（skyveil 表示・操作の一本化）
- P3 残：MoodSelector（定数分離後に削除可）

## 12. UI整理フェーズ 仕上げ（2026-06-04）

ユーザー指示「SkyveilBar一本化 / DuplicateAnalysisPanel整理 / ReflectionStatus整理」を照合した結果、
実質作業は M-1〜M-3 で達成済みと確認。残差として **表記のみ** を整合（選択肢A）:

- DuplicateAnalysisPanel タブ名 `💡 好み分析` → **`💡 評価集計`**（好み「分析」は SkyveilBar へ移管済のため役割を明確化）
- 旧コメント `好み分析タブ（軸別👍👎集計 + 実 AI 分析）` → `評価集計タブ（軸別👍👎集計）…SkyveilBar に集約済` に修正

**ロジック・分析・送信内容は不変（UI表記のみ）**。tsc・vite build exit 0。

### 役割分担（確定）

| コンポーネント | 役割 |
|---|---|
| SkyveilBar | skyveil好みAI の操作・反映・学習・プロファイル管理（唯一の操作起点） |
| DuplicateAnalysisPanel | 重複分析・色分析・画像分析・評価集計（タブ: 出現制御/AI分析/色分析/画像分析/評価集計） |
| ReflectionStatusBar | 現在反映されている設定の確認（読み取り専用） |
| AnalysisStatusStrip | 分析の鮮度・件数・状態の簡易表示 |

---

**End of Doc 18**
