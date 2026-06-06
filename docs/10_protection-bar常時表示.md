# 10. ProtectionBar 常時表示設計書

> **目的**: 「顔・同一性が今どの程度守られているか」をユーザーが常時把握できるようにし、
> 生成前に「何が固定・何が変更される」が一目で分かる UI を確立する。
> **対象**: `src/components/ProtectionBar.tsx` を中心とした保護表示系
> **依拠**: [master-plan-v1.md](./master-plan-v1.md) §4 Identity Shield, §6 顔・同一性保護フロー

---

## 1. 現状（v0）

### 1.1 現在の ProtectionBar

- 位置: `ControlPanel` 内の上部セクション（ScopeSelector のすぐ下）
- 構成:
  - 「守るもの」表示（顔/同一性は常時、bodyPoseLock 等はトグル状態）
  - 顔ロック (faceLock) トグル
  - 個別ロックトグル群（LockToggles 内包）
  - 安全モード選択ラジオ
- カウント表示: 「○件ON」バッジ

### 1.2 問題点

| # | 問題 | 重要度 |
|---|---|---|
| A | スクロールするとビューポート外に出てしまう。生成ボタン押下時に何が守られるか確認できない | 高 |
| B | Identity Shield のリスクレベルを表示していない（生成後の PromptGuardSection でしか見えない） | 高 |
| C | LockToggles / FaceLockSwitch / ProtectionBar で「守るもの」が3箇所に分散している | 中 |
| D | ReflectionStatusBar に類似情報が出ているが、両方表示すると重複感が強い | 中 |
| E | スコープに含まれない軸が自動的に「保護対象」になっていることが視覚的に分かりにくい | 中 |

---

## 2. 目指す状態（v1）

### 2.1 設計コンセプト

> **「画面のどこかに常に『今、何が守られているか』が見える」**
>
> Identity Shield のリスクレベルがリアルタイムに更新され、危険な設定を選んだ瞬間に色で警告する。

### 2.2 配置案（3つから選択）

#### 案 A: ヘッダ直下の細い帯（推奨）

```
┌────────────────────────────────────────────────────────────────┐
│ Header: タイトル / BackendStatus / 設定                         │
├────────────────────────────────────────────────────────────────┤
│ 🛡 守るもの: 顔・同一性 ✅ / 体型 ✅ / 構図 ⬜ / 色 ⬜             │
│    Identity Shield: ⚠ HIGH (リスク 65/100)  [詳細▾]            │ ← 常時表示
├────────────────────────────────────────────────────────────────┤
│ MiniExplorer │ メインエリア (ControlPanel + PromptList) │ 履歴 │
└────────────────────────────────────────────────────────────────┘
```

**長所**:
- スクロールしても常に見える（sticky / fixed）
- 1行で要約 + 詳細展開可能
- リスクレベルが色で即座に分かる（緑/黄/橙/赤）

**短所**:
- 縦領域を占有する（推定 32-48px）
- モバイルでさらに圧迫

#### 案 B: メインカラム上部の sticky 化

ControlPanel 内の ProtectionBar を `position: sticky; top: 0` にする。

**長所**: 既存構造を活かせる、影響範囲小
**短所**: メインカラムをスクロールした時のみ追従。サイドカラム閲覧時は隠れる

#### 案 C: フローティング小型バッジ（右下/右上固定）

```
                                              ┌──────────────┐
                                              │ 🛡 HIGH 65  │
                                              │ 4軸 保護中   │
                                              └──────────────┘
```

**長所**: 最小占有・常時可視
**短所**: 詳細表示にクリック必要、モバイルで指に隠れる

#### **推奨**: 案 A（ヘッダ直下の細い帯）

- 縦領域コスト 32-40px は許容範囲
- 「今、何を保護しているか」が常に見える価値が大きい
- 詳細展開でフルパネル化できる柔軟性

### 2.3 表示する情報（最小〜最大）

#### 最小表示（折りたたみ時、1行）

```
🛡 顔・同一性 ✅ / 体型 ✅ / 構図 ⬜ / 色 ⬜ │ Shield: ⚠ HIGH 65 │ [詳細▾]
```

| 要素 | 内容 |
|---|---|
| 🛡 アイコン | ProtectionBar のシンボル |
| 保護中軸の要約 | faceLock + bodyPoseLock + compositionLock + colorMoodLock の状態（ON=✅ / OFF=⬜） |
| Identity Shield リスク | low / medium / high / danger の4段階を色付きラベルで |
| リスクスコア | 0-100 の数値 |
| [詳細] ボタン | 展開してフル表示 |

#### 展開時（フル表示）

```
┌──────────────────────────────────────────────────────────────┐
│ 🛡 保護状態                                          [折畳▴] │
├──────────────────────────────────────────────────────────────┤
│ 顔・同一性: ✅ ロック中（faceLock = ON）                       │
│   ▸ 顔の造形・表情・印象を完全固定                              │
│                                                              │
│ 軸別ロック:                                                  │
│   ✅ 体型・ポーズ           ⬜ 色味・雰囲気                    │
│   ⬜ 構図・アスペクト比     – 安全モード: 架空キャラ            │
│                                                              │
│ Scope Filter（自動保護）:                                    │
│   背景 / 髪 / 衣装 / カメラ ← scope に含まれないため自動保護中  │
│                                                              │
│ Identity Shield 採点（リアルタイム）:                         │
│   レベル: ⚠ HIGH (65/100)                                    │
│   主な加算理由:                                              │
│     • ポーズ変更ON (+16)                                     │
│     • カメラ変更ON (+16)                                     │
│     • 変更4軸 (+18)                                          │
│   → 生成時に CLAUSE_PROTECT + CLAUSE_ANTIBREAK が追加される    │
└──────────────────────────────────────────────────────────────┘
```

### 2.4 リスクレベルの視覚化

| レベル | 色 | アイコン | ラベル |
|---|---|---|---|
| low (0-29) | emerald-500 | 🛡 | LOW |
| medium (30-59) | sky-500 | 🛡 | MEDIUM |
| high (60-79) | amber-500 | ⚠ | HIGH |
| danger (80-100) | rose-500 | 🚨 | DANGER |

帯全体の背景色も同色系で薄く着色する（low=薄緑 / danger=薄赤）。

### 2.5 リアルタイム更新の仕組み

`analyzeIdentityRisk()`（[src/lib/identityRisk.ts:41-101](../src/lib/identityRisk.ts#L41)）が既にローカルで動作可能。
これを App.tsx の `useMemo` でリアクティブに計算:

```ts
const liveIdentityRisk = useMemo(
  () => analyzeIdentityRisk({
    changeTargets: scopes,
    locks: currentLock,
    faceLock,
    // 神引き・viralMode・FACE_DANGER 検出語の有無等も入力
  }),
  [scopes, currentLock, faceLock, viralMode, /* ... */],
);
```

`liveIdentityRisk.riskScore` と `.riskLevel` を ProtectionBar に渡す。

### 2.6 既存コンポーネントとの関係

| コンポーネント | 新 ProtectionBar との関係 |
|---|---|
| `FaceLockSwitch.tsx` | ProtectionBar 展開時の中に統合（独立配置を廃止） |
| `LockToggles.tsx` | ProtectionBar 展開時の中に統合（独立配置を廃止） |
| `SafetyToggle.tsx` | ProtectionBar 展開時の中に統合 |
| `ReflectionStatusBar.tsx` | 「反映状態」の表示は維持。ProtectionBar は「保護状態」専門に分離 |
| `PromptGuardSection.tsx`（PromptCard内） | 生成「後」の確認用として維持。ProtectionBar は生成「前」のライブ表示 |

→ **ProtectionBar = 生成前のライブビュー / PromptGuardSection = 生成後の結果確認** で住み分け。

---

## 3. 実装フェーズの分割案

> 本書は設計のみ。実装着手時の参考。

### Phase A: ProtectionBar の再配置（最小変更）

1. `App.tsx` のヘッダ直下に新セクション `<ProtectionBar />` を追加
2. 既存の ProtectionBar インスタンス（ControlPanel 内）を一旦両立させる
3. CSS で sticky 化＋背景色設定

### Phase B: ライブリスク表示の追加

4. `App.tsx` で `liveIdentityRisk` を `useMemo` 計算
5. ProtectionBar の props に渡す
6. リスクレベルに応じた色分け実装

### Phase C: 統合（重複解消）

7. ControlPanel 内の旧 ProtectionBar / FaceLockSwitch / LockToggles を削除
8. 新 ProtectionBar 展開時パネルに統合

### Phase D: モバイル対応

9. モバイル時は最小表示のみ、タップで全画面オーバーレイ展開

---

## 4. レスポンシブ設計

### 4.1 デスクトップ (>= 1024px)

```
🛡 [顔ON][体型ON][構図OFF][色OFF] │ Shield: HIGH 65 │ [詳細▾]
```

### 4.2 タブレット (640-1023px)

```
🛡 4軸保護中 │ ⚠ HIGH 65 │ [▾]
```

### 4.3 モバイル (< 640px)

```
🛡 ⚠ 65 [▾]
```

タップ展開時は **全画面オーバーレイ** で表示（縦領域節約）。

---

## 5. アクセシビリティ

- 色だけに依存しない（必ずアイコン＋テキストラベル併用）
- リスクレベルを `aria-live="polite"` で読み上げ対応
- キーボード Tab で「保護バー → 詳細展開 → 各トグル」と巡回可能に
- 色覚特性に配慮（赤緑だけでなく形状も変える）

---

## 6. 非ゴール

- Identity Shield 採点ロジックの変更（既存ロジックをそのまま表示するだけ）
- 保護対象を増やす機能追加
- 詳細展開パネルから生成プロセスを起動する機能（既存の生成ボタンに任せる）

---

## 7. レイアウト制約の遵守

既存ルール（[01_UI構成.md](./01_UI構成.md) §レイアウト制約）:

- 変更可: 文字サイズ / 色 / ウェイト / placeholder色
- 変更禁止: ボタンサイズ / カードサイズ / 余白 / 配置 / レイアウト / 枠線 / テーマカラー / コンポーネント構造

→ 新 ProtectionBar は「**新規追加要素**」なので追加可能だが、既存コンポーネントを統合する Phase C は要承認。

---

## 8. 未決事項

| # | 論点 | 推奨案 |
|---|---|---|
| Q1 | ヘッダ直下 vs ControlPanel sticky のどちら | **ヘッダ直下（案A）** |
| Q2 | リスクレベル「LOW」のとき表示するか | **表示する**（保護中の安心感も重要） |
| Q3 | クリック展開 vs ホバー展開 | **クリック**（モバイル対応のため） |
| Q4 | 既存 ProtectionBar コンポーネントを再利用するか新規作成か | **新規 `GlobalProtectionBar.tsx`** を作成、旧 ProtectionBar は廃止予定 |
| Q5 | リスク採点を 1秒デバウンス するか即座に再計算するか | **即座**（useMemo で十分軽量） |

---

## 9. 関連ドキュメント

- [master-plan-v1.md §4 Identity Shield](./master-plan-v1.md)
- [master-plan-v1.md §6 顔・同一性保護フロー](./master-plan-v1.md)
- [09_face-lock統合.md](./09_face-lock統合.md)
- [11_UI重複一覧.md](./11_UI重複一覧.md)

---

## 10. 実装完了記録（2026-06-04・Phase 2-①）

### 10.1 実装範囲

「常時表示バー」の**新規追加のみ**を実装。既存 ProtectionBar / FaceLockSwitch / LockToggles の**統合（Phase C）は未実施**（UI重複整理は別フェーズのため）。

### 10.2 設計判断（当初案からの調整）

- **表示位置**: このアプリに `<header>` が存在しないため、案A「ヘッダ直下」を **「メインビュー最上部・全幅 sticky 帯」** に読み替えて実装（[App.tsx](../src/App.tsx) のメインビュー分岐を fragment 化し、3カラムグリッドの直前に配置）。
- **読み取り専用**: 操作系（faceLock トグル等）は載せず、状態表示に専念。操作は既存 ProtectionBar に残す。
- **折りたたみ時の常時表示3項目**（ユーザー要件）:
  1. 🛡 顔・同一性 ON/OFF
  2. 🛡/⚠/🚨 Identity Shield LOW/MEDIUM/HIGH/DANGER + スコア
  3. 🎯 変更対象（scopes ラベル）
- **展開時のみ**: 🔒守るもの（軸別ロック chip）/ 🧱Scope Filter自動保護 / Identity Shield採点理由 / ⚠注意 / 💡安全提案。

### 10.3 リスク採点ソース

[identityRisk.ts](../src/lib/identityRisk.ts) `analyzeIdentityRisk("", currentLock)` を流用（生成前は空プロンプトで設定ベース採点）。App.tsx で `liveIdentityRisk = useMemo(..., [currentLock])`。デバウンスなし（Q5 通り即時）。

### 10.4 影響ファイル

| ファイル | 変更 |
|---|---|
| `src/components/GlobalProtectionBar.tsx` | 新規作成（読み取り専用バー） |
| `src/App.tsx` | import 2行追加 / `liveIdentityRisk` useMemo 追加 / メインビュー分岐を fragment 化し `<GlobalProtectionBar/>` を1つ追加 |

**変更なし**: ProtectionBar / FaceLockSwitch / LockToggles / ReflectionStatusBar / ControlPanel（住み分け維持）。

### 10.5 検証結果

| 検証 | 結果 |
|---|---|
| フロント `tsc -b --noEmit` | ✅ exit 0 |
| `vite build` | ✅ exit 0 |
| ブラウザ表示（背景のみ・faceLock ON） | ✅ 🛡顔・同一性 ON / 🛡 Identity Shield LOW 0 / 🎯 変更対象 背景 |
| 詳細展開 | ✅ 守るもの・Scope Filter自動保護・採点理由・注記を表示 |
| ライブ更新（背景+ポーズ+カメラ に変更） | ✅ Identity Shield LOW 0 → **MEDIUM 28**、変更対象「背景・ポーズ・カメラ」、自動保護「衣装/髪/ライティング/前景演出/小物」に即時更新 |
| ReflectionStatusBar との共存 | ✅ 「📡 現在の反映状態」は別途残存（保護=GlobalProtectionBar / 反映=ReflectionStatusBar の住み分け） |

### 10.6 残課題（本タスク範囲外）

- doc §3 Phase C「既存 ProtectionBar/FaceLockSwitch/LockToggles の統合」→ Phase 3 UI重複整理（[11_UI重複一覧.md #1](./11_UI重複一覧.md)）
- doc §4 モバイル全画面オーバーレイ展開 → 現状は折りたたみ帯が flex-wrap で折り返す簡易対応
- doc §5 アクセシビリティ（aria-live 等）→ 未対応（将来）

---

**End of Doc 10**
