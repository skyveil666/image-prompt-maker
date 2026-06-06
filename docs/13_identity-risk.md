# 13. Identity Risk 採点仕様

> **目的**: 「顔・同一性が崩れるリスク」を採点する2つの実装（フロント / サーバ）の **採点ルール** と **乖離リスク** を明示する。
> **依拠**: [master-plan-v1.md §4 Identity Shield](./master-plan-v1.md)

---

## 1. 二重実装の構造

「同一性リスク採点」は現在 2 箇所で実装されている:

| 実装 | ファイル | 目的 | 起動タイミング |
|---|---|---|---|
| **フロント** | [src/lib/identityRisk.ts](../src/lib/identityRisk.ts) `analyzeIdentityRisk()` | UI ライブ表示・提案 | 設定変更のたびに `useMemo` で再計算 |
| **サーバ** | [server/src/scopeFilter.ts:211-266](../server/src/scopeFilter.ts#L211) `applyIdentityShield()` | 実プロンプトへの保護文注入 | 生成時、Scope Filter の直前 |

⚠️ **重要**: 同じ概念だが **採点重みが完全には同期していない**。これは [11_UI重複一覧.md #4](./11_UI重複一覧.md) で「P2 共通モジュール化検討」として整理対象。

---

## 2. サーバ側採点（applyIdentityShield）

### 2.1 加算ルール一覧

| カテゴリ | 条件 | 加算 |
|---|---|---|
| 軸別変更 | `hair` ∈ scopes | +12 |
| 軸別変更 | `pose` ∈ scopes | +16 |
| 軸別変更 | `camera` ∈ scopes | +16 |
| 軸別変更 | `foreground` ∈ scopes | +12 |
| 軸別変更 | `lighting` ∈ scopes | +8 |
| 軸別変更 | `outfit` ∈ scopes | +8 |
| 範囲規模 | 変更対象 ≥ 4軸 | +18 |
| 指定強度 | 強アングル指定（STRONG_ANGLE） | +10 |
| 構図 | 顔の向き変更可能性 | +8 |
| 危険語 | FACE_DANGER 検出 | +30 |
| トグル | faceLock = false | +12 |

### 2.2 レベル判定

```
risk = max(0, min(100, sum))

danger  : risk ≥ 80
high    : risk ≥ 60
medium  : risk ≥ 30
low     : risk < 30
```

### 2.3 注入される固定文

| レベル | 追加注入 |
|---|---|
| low | （注入なし） |
| medium | CLAUSE_PROTECT |
| high | CLAUSE_PROTECT + CLAUSE_ANTIBREAK |
| danger | CLAUSE_PROTECT + CLAUSE_ANTIBREAK + CLAUSE_FORCE |

文言全文は [master-plan-v1.md §4.3](./master-plan-v1.md) を参照。

---

## 3. フロント側採点（analyzeIdentityRisk）

### 3.1 加算ルール一覧

[src/lib/identityRisk.ts:41-101](../src/lib/identityRisk.ts#L41):

| カテゴリ | 条件 | 加算 |
|---|---|---|
| 範囲規模 | 変更対象 5軸 | +28 |
| 範囲規模 | 変更対象 4軸 | +16 |
| 軸別変更 | 髪 | +8 〜 +12 |
| 軸別変更 | ポーズ | +8 〜 +12 |
| 軸別変更 | カメラ | +8 〜 +12 |
| 危険な同時変更 | ポーズ + カメラ | +12 |
| 危険な同時変更 | 3軸同時 | +8 |
| 指定強度 | STRONG_ANGLE | +12 |
| 危険語 | FACE_DANGER | +40 |
| トグル | faceLock = false | +15 |
| トグル | faceLock = true | -8（緩和） |

### 3.2 レベル判定

```
danger : risk ≥ 70
high   : risk ≥ 45
medium : risk ≥ 22
low    : risk < 22
```

---

## 4. ⚠️ サーバ vs フロントの差異

| 項目 | サーバ | フロント | 差 |
|---|---|---|---|
| 5軸変更 | +18 (≥4軸) | +28 | 10 |
| 4軸変更 | +18 | +16 | -2 |
| 髪変更 | +12 | +8〜+12 | 0〜-4 |
| ポーズ変更 | +16 | +8〜+12 | -4〜-8 |
| カメラ変更 | +16 | +8〜+12 | -4〜-8 |
| ポーズ+カメラ同時 | (+16+16=32) | +12 ボーナス | サーバの方が厳しい |
| 危険語 | +30 | +40 | フロント厳しい |
| faceLock OFF | +12 | +15 | フロント厳しい |
| faceLock ON | – | -8 緩和 | フロントのみ緩和 |
| danger 閾値 | 80 | 70 | フロント先に danger 表示 |
| high 閾値 | 60 | 45 | フロント先に high 表示 |
| medium 閾値 | 30 | 22 | フロント先に medium 表示 |

**結論**: フロントの方が **早めに高リスク判定** が出る。UIで「警告」を見たユーザーが生成した時、サーバ側は **より緩い判定** で済む可能性がある。これは UX 的には「表示は厳しめ・実際は緩め」の安全側設計だが、乖離は技術的負債。

---

## 5. FACE_DANGER 危険語一覧

サーバ・フロント共通で削除対象（**確認必要 = grep 推奨**）:

| 種別 | 例 |
|---|---|
| 日本語 | 「別人」「別人化」「顔を変える」「顔立ちを変える」「若返り」「大人化」 |
| 英語 | "different face", "face transformation", "face swap", "different person" |
| 表情系 | 「顔の輪郭変える」（表情変化と区別が難しいので注意） |

これら危険語は **scope や lock 設定と無関係に常時削除**。

---

## 6. PROTECTIVE_LINE_HINTS（誤検知防止）

「維持」「固定」「保持」の宣言文は **削除しない**。例:

- 「顔の特徴は元画像から維持してください」 → 削除しない
- 「人物の同一性を固定」 → 削除しない
- 「表情を保持」 → 削除しない

これらは Identity Shield が自分で挿入する文なので削除されては困る。

---

## 7. リスク低減アクション（提案候補）

リスクレベル別の推奨ユーザー操作:

### medium 時
- 「faceLock ON にすると -8 緩和される」を表示
- 軸数を 1 つ減らす提案

### high 時
- 「ポーズ + カメラ同時変更は避けると -12〜-32」を表示
- 「強アングル指定を解除すると -10」を表示

### danger 時
- 「変更対象を 2 軸以下にすると -18」を表示
- 「FACE_DANGER 危険語を NG リストに入れてください」を表示
- 「faceLock を ON にしてください」を強調表示

これらはコード化されておらず、現状 UI で示唆のみ。将来の改善候補（[16_future-roadmap.md](./16_future-roadmap.md)）。

---

## 8. UI 表示位置

| 表示 | コンポーネント |
|---|---|
| 生成前のライブリスク | 新 ProtectionBar（未実装、[10](./10_protection-bar常時表示.md)） |
| 生成後の Identity Shield 結果 | [PromptGuardSection.tsx:168-186](../src/components/PromptGuardSection.tsx#L168) |
| 同一性リスク詳細パネル | [PromptGuardSection.tsx:257-280](../src/components/PromptGuardSection.tsx#L257) |
| skyveilScore 内の identitySafety | [skyveilScore.ts](../src/lib/skyveilScore.ts) → SkyveilBar |

---

## 9. 採点の入力サニタイズ

「危険語の検出」で問題になりがちなパターン:

| パターン | 期待 | 現状 |
|---|---|---|
| 「顔を変えない」 | 削除しない（否定文） | ⚠️ 「顔を変える」とサブストリングマッチして削除する可能性 |
| 「別人にならないように」 | 削除しない | ⚠️ 同上 |
| 「different face is forbidden」 | 削除しない | ⚠️ 同上 |
| 大文字小文字混在 | 検出する | ✅ toLowerCase 済み |
| 漢字異体字 | 検出 | ⚠️ 旧字体未対応 |

→ 否定文判定は将来課題。現状は **PROTECTIVE_LINE_HINTS で「維持・固定」宣言文だけ救済** している。

---

## 10. 中期改善案: 共通モジュール化

**現状の問題**:
- フロントとサーバで採点重みが乖離
- ロジックを更新する時、両方を手動で同期する必要がある

**提案**:

### Option A: 共通 TypeScript モジュール
```
src/lib/identityRiskCore.ts   ← 共通実装
src/lib/identityRisk.ts       ← Core を import（UI 用ラッパー）
server/src/identityRiskCore.ts ← 同じファイルをコピー or symlink
```

### Option B: サーバが採点 → フロントは表示専用
- 生成前にサーバ `/api/preflight-risk` を叩いて採点結果を取得
- フロントは表示のみ
- ネットワーク往復が増えるが、乖離リスクゼロ

### Option C: 採点ルールを JSON データに分離
```
shared/identityRiskRules.json
```
両側がこれを読み込んでスコア計算。

→ **推奨**: Option A（同期コストは低く、責務分離も保てる）

---

## 11. 関連ドキュメント

- [master-plan-v1.md §4](./master-plan-v1.md)
- [09_face-lock統合.md](./09_face-lock統合.md)
- [10_protection-bar常時表示.md](./10_protection-bar常時表示.md)
- [11_UI重複一覧.md #4](./11_UI重複一覧.md)
- [16_future-roadmap.md](./16_future-roadmap.md)

---

## 12. 未決事項

| # | 論点 | 推奨 |
|---|---|---|
| Q1 | サーバ vs フロントの採点重みを揃えるか | **揃える**（共通モジュール化） |
| Q2 | 否定文判定（「顔を変えない」）を実装するか | **将来課題**（現状は PROTECTIVE_LINE_HINTS で部分対応） |
| Q3 | リスク低減アクション提案を UI 化するか | **Yes**（ProtectionBar 展開時に表示推奨） |
| Q4 | 採点履歴（時系列の risk 変化）を保存するか | **No**（現状の `identityShield` フィールドで十分） |

---

**End of Doc 13**
