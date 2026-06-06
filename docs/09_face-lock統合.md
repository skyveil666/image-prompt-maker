# 09. faceLock / locks.face 統合設計書

> **目的**: `faceLock` と `locks.face` の二重定義を整理し、「顔保護の意図」を **単一の真実** で表現する。
> **対象**: フロント `App.tsx` / `types.ts` / 関連 lib・component、サーバ `scopeFilter.ts` / `promptSystem.ts`
> **依拠**: [master-plan-v1.md](./master-plan-v1.md) §6 顔・同一性保護フロー

---

## 1. 現状（v0）

### 1.1 値の流れ

```
[App.tsx state]
  faceLock: boolean                ← FaceLockSwitch から制御（初期 true）
  expression: Expression | null    ← faceLock = false の時のみ有効

         ↓ buildInputs() で組み立て

[PromptInputs]
  faceLock: boolean                ← App.tsx の値そのまま
  locks: {
    face: true,         ← ★常に true ハードコード
    identity: true,     ← 同上
    expression: true,   ← 同上
    body_shape: bodyPoseLock,
    color: colorMoodLock,
    camera: compositionLock,
    aspect_ratio: compositionLock,
  }
  expression: faceLock ? undefined : (expression ?? undefined)

         ↓ POST /api/generate

[server/scopeFilter.ts]
  protectedTargets.face = req.faceLock   ← faceLock を参照
  protectedTargets.identity = ...
  ...locks.face は実質未使用
```

### 1.2 問題点

| # | 問題 | 影響度 |
|---|---|---|
| A | `locks.face` は常に `true` ハードコードで、UIからの可変性がない | 中 |
| B | サーバ側は `req.faceLock` を見ており、`req.locks.face` は使われていない | 中（実害ないが死コード） |
| C | 「顔をロックする」概念が `faceLock` / `locks.face` / `faceLock ? undefined : expression` の3箇所に分散 | 高（保守性） |
| D | `LockKey` 型に `"face" | "identity" | "expression"` があるが、UIには3つの個別トグルが存在しない（ProtectionBar には表示されるが全て faceLock 連動） | 中 |
| E | 将来「顔は固定するが表情だけ自由」のような分離要望が来た場合、現構造では型と実装が乖離する | 低（現状要件にない） |

### 1.3 なぜこうなっているか（推定）

- 初期実装で `locks: Record<LockKey, boolean>` を **汎用的に** 設計した
- その後「顔ロックは特別扱い」になり、別 state `faceLock` が追加された
- サーバ側が `faceLock` を信頼するように移行したが、`locks.face` を消すと既存履歴の互換が壊れるため残された

→ **歴史的経緯による技術的負債**。バグではないが、明らかに整理すべき状態。

---

## 1.9 実装前バックアップ（Phase A・2026-06-04 記録）

> **目的**: ロールバック用に、変更前の Lock 関連構造・SCOPE_TO_LOCKS・faceLock 挙動を完全記録する。
> **ベースライン tsc**: フロント exit 0 / サーバ exit 0（型エラーなしの状態から着手）

### 1.9.1 変更前の Lock 関連構造（全箇所）

| ファイル:行 | 内容（変更前） |
|---|---|
| `src/types.ts:115-122` | `LockKey = "face" \| "body_shape" \| "expression" \| "identity" \| "color" \| "camera" \| "aspect_ratio"`（7値） |
| `src/types.ts:1118` | `PromptInputs.locks: Record<LockKey, boolean>` |
| `src/types.ts:1381` | `PromptHistoryItem.locks: Record<LockKey, boolean>` |
| `server/src/types.ts:72-79` | `LockKey`（同じ7値） |
| `server/src/types.ts:489` | `GenerateRequest.locks: Record<LockKey, boolean>` |
| `src/App.tsx:505-513` | `locks: { face: true, identity: true, expression: true, body_shape: bodyPoseLock, color: colorMoodLock, camera: compositionLock, aspect_ratio: compositionLock }` |
| `src/App.tsx:518-519` | `faceLock,` / `expression: faceLock ? undefined : (expression ?? undefined)` |
| `server/src/index.ts:55-63` | デフォルト `locks: raw.locks ?? { face:true, body_shape:true, expression:true, identity:true, color:true, camera:true, aspect_ratio:true }` |
| `src/components/LockToggles.tsx:8-16` | OPTIONS 7要素（face/body_shape/expression/identity/color/camera/aspect_ratio） |
| `src/components/ProtectionBar.tsx:6-14` | LOCK_OPTIONS 7要素（同上） |
| `server/src/promptSystem.ts:79-87` | `LOCK_JA` 7キー（face:"顔", body_shape:"体型", expression:"表情", identity:"人物の同一性", color:"色味", camera:"カメラ位置", aspect_ratio:"アスペクト比"） |
| `server/src/promptSystem.ts:1747-1763` | `lockLineJa(locks, scopes, pt)` — SCOPE_TO_LOCKS の和集合から locks[k]=true をフィルタして「入力画像の○○は完全に維持し、変更しない。」を生成 |
| `src/lib/history.ts:254` | `locks: inputs.locks`（透過コピー） |
| `src/lib/promptLockCheck.ts:33-86` | `ProtectedTargets` は **LockKey とは別の独立型**（face/identity/expression/bodyShape/aspectRatio/background/outfit）。`deriveLockState` は `args.faceLock` を直接参照（locks.face 不使用） |
| `src/lib/settingsPersist.ts:104` | `faceLock: true`（永続化対象は faceLock のみ。`locks` は永続化していない） |

### 1.9.2 変更前の SCOPE_TO_LOCKS（promptSystem.ts:199-223 完全スナップショット）

```ts
const SCOPE_TO_LOCKS: Record<Scope, LockKey[]> = {
  background:   ["face", "body_shape", "expression", "identity", "camera", "aspect_ratio"],
  foreground:   ["face", "body_shape", "expression", "identity", "camera", "aspect_ratio"],
  pose:         ["face", "expression", "identity", "color", "camera", "aspect_ratio"],
  hair:         ["face", "body_shape", "expression", "identity", "camera", "aspect_ratio"],
  outfit:       ["face", "body_shape", "expression", "identity", "camera", "aspect_ratio"],
  cosplay:      ["face", "body_shape", "expression", "identity", "camera", "aspect_ratio"],
  cyber:        ["face", "body_shape", "expression", "identity", "camera", "aspect_ratio"],
  camera:       ["face", "body_shape", "expression", "identity", "color", "aspect_ratio"],
  props:        ["face", "body_shape", "expression", "identity", "camera", "aspect_ratio"],
  big_object:   ["face", "body_shape", "expression", "identity", "camera", "aspect_ratio"],
  vehicle:      ["face", "body_shape", "expression", "identity", "camera", "aspect_ratio"],
  myth:         ["face", "body_shape", "expression", "identity", "camera", "aspect_ratio"],
  lighting:     ["face", "body_shape", "expression", "identity", "camera", "aspect_ratio"],
  aspect_ratio: ["face", "body_shape", "expression", "identity", "color", "camera"],
};
```

注: `pose` だけ `body_shape` を含まず `color` を含む。`camera`/`aspect_ratio`/`lighting`/`pose` は `color` の有無に差がある。これらの差分は **face/identity/expression 削除後も保持** する。

### 1.9.3 変更前の faceLock 挙動

| 観点 | 変更前の挙動 |
|---|---|
| 初期値 | `faceLock = true`（settingsPersist:104 で永続化） |
| 送信ペイロード | `faceLock: true` **かつ** `locks.face/identity/expression: true`（二重送信） |
| 表情指定 | `expression: faceLock ? undefined : (expression ?? undefined)` |
| サーバ Scope Filter | `applyServerScopeFilter` は `req.faceLock` を参照（`locks.face` 不使用） |
| サーバ Identity Shield | `applyIdentityShield` は `req.faceLock=false` で +12 加算（`locks.face` 不使用） |
| faceLockBlock | scope/lock と無関係に **常時挿入**（顔絶対固定ロック文） |
| lockLineJa 出力 | SCOPE_TO_LOCKS が face/expression/identity を含むため「入力画像の顔・表情・人物の同一性…は完全に維持し、変更しない。」が **常に出力**（faceLockBlock と重複） |
| ⚠️ 潜在バグ | `faceLock=false`（表情変更モード）でも SCOPE_TO_LOCKS が `expression` を含み `locks.expression=true` ハードコードのため「表情は維持」が出力され、表情変更指示と矛盾する |

---

## 2. 目指す状態（v1）

### 2.1 設計原則

| # | 原則 |
|---|---|
| 1 | **顔・同一性・表情の保護状態を表す真実は1つだけ**: それは `faceLock` |
| 2 | `locks` 型からは `face / identity / expression` を撤去する |
| 3 | サーバ送信時は `faceLock` のみ送る。`locks` には faceLock 連動の派生値を入れない |
| 4 | 既存履歴の `locks.face` が `true/false` であっても、新コードは値を読まない（読まない=互換維持） |
| 5 | サーバ・フロント両側の `LockKey` 型を統一する |

### 2.2 新しい型定義（提案）

**Before**（[types.ts:115-122](../src/types.ts#L115)）:
```ts
export type LockKey =
  | "face"
  | "body_shape"
  | "expression"
  | "identity"
  | "color"
  | "camera"
  | "aspect_ratio";
```

**After**:
```ts
/**
 * 軸別ロック。顔・同一性・表情は faceLock で一元管理するため、ここには含めない。
 */
export type LockKey =
  | "body_shape"
  | "color"
  | "camera"
  | "aspect_ratio";

/**
 * 顔・同一性・表情の保護状態は単一の真実（faceLock）で表す。
 * faceLock = true → 顔・同一性・表情すべて固定
 * faceLock = false → 表情のみ expression で任意指定可能（顔の造形は保持）
 */
```

### 2.3 PromptInputs の変更

**Before**:
```ts
locks: Record<LockKey, boolean>  // face / identity / expression を含む
```

**After**:
```ts
locks: Record<LockKey, boolean>  // body_shape / color / camera / aspect_ratio のみ
faceLock: boolean                // 顔・同一性・表情の単一トグル（変更なし）
expression?: Expression | null   // faceLock = false の時のみ有効（変更なし）
```

### 2.4 buildInputs() の変更

**Before**（[App.tsx:505-513](../src/App.tsx#L505)）:
```ts
locks: {
  face:         true,
  identity:     true,
  expression:   true,
  body_shape:   bodyPoseLock,
  color:        colorMoodLock,
  camera:       compositionLock,
  aspect_ratio: compositionLock,
},
```

**After**:
```ts
locks: {
  body_shape:   bodyPoseLock,
  color:        colorMoodLock,
  camera:       compositionLock,
  aspect_ratio: compositionLock,
},
faceLock,
expression: faceLock ? undefined : (expression ?? undefined),
```

### 2.5 サーバ側の変更

[server/src/scopeFilter.ts](../server/src/scopeFilter.ts) `deriveServerLocks()` で、もはや `req.locks.face` を参照しない（既に実質そうなっている）。型からも除去する。

[server/src/promptSystem.ts](../server/src/promptSystem.ts) で `locks.face` を参照している箇所があれば、すべて `faceLock` に置換。

---

## 3. 移行ステップ（実装時の順序）

> **本書は設計書のみ。実装はまだ行わない。** 以下は実装フェーズ用の手順案。

### Phase A: 型の準備（破壊なし）

1. `LockKey` から `"face"/"identity"/"expression"` を削除する **新型** `LockKey_v2` を追加（既存 `LockKey` は @deprecated で残す）
2. `PromptInputs.locks` の型は変更せず、buildInputs() で **両方の値** を送る（旧クライアント・新サーバ互換）

### Phase B: サーバ側の `locks.face` 除去

3. `server/src/types.ts` の `Locks` 型から face/identity/expression を削除
4. `server/src/scopeFilter.ts:111-112` で `req.faceLock` を直接参照（既存コード確認後、`req.locks.face` のフォールバックを残すか判断）
5. `server/src/promptSystem.ts` 内で `locks.face` を参照している全箇所を `faceLock` に置換

### Phase C: フロント側の buildInputs 整理

6. `App.tsx:505-513` の `locks` リテラルから face/identity/expression を削除
7. `types.ts` の `LockKey` を v2 に切替（旧型を deprecated コメント付きで残置 or 完全削除）

### Phase D: コンポーネント整理

8. `ProtectionBar.tsx` で `locks` を表示している箇所が、新 `LockKey` に対応しているか確認
9. `LockToggles.tsx` の対象キーが新 `LockKey` のみになっているか確認
10. `FaceLockSwitch.tsx` は変更不要（既に faceLock のみを扱う）

### Phase E: 検証

11. 既存履歴の `PromptHistoryItem.locks` を含むレコードを読み込んでも UI が落ちないこと
12. サーバへの送信ペイロードに `locks.face` が含まれなくなっていること
13. Identity Shield のリスク採点が同じ条件で同じ値を返すこと（回帰テスト）

---

## 4. 互換性とリスク

### 4.1 既存履歴（IndexedDB）への影響

- `PromptHistoryItem.locks` は `Record<LockKey, boolean>` で保存されている
- 読み込み時に `face/identity/expression` キーがあっても、新コードは **無視するだけ** で実害なし
- TypeScript 的には型不整合になるが、JS 実行時は問題ない
- 必要なら `migrateHistoryItem(item)` で旧 keys を削除するワンタイム移行を追加

### 4.2 サーバ受信時の挙動

- 旧クライアントが `locks: {face: true, ...}` を送ってきた場合、新サーバは **face キーを無視するだけ**
- バリデーション層 ([server/src/index.ts:31-241](../server/src/index.ts#L31)) で「未知キーを reject する」厳格モードにしていないか確認必要

### 4.3 移行中の二重送信期間

Phase A〜B の間は、`locks.face` を送信し続けてサーバ側で無視する形でよい。
完全に消すのは Phase C 以降。

---

## 5. 影響範囲一覧

実装フェーズで触る可能性のあるファイル:

| ファイル | 変更内容 |
|---|---|
| `src/types.ts` | `LockKey` 縮小 |
| `src/App.tsx` | `buildInputs()` の `locks` リテラル整理 |
| `src/components/ProtectionBar.tsx` | locks 表示部の型整合 |
| `src/components/LockToggles.tsx` | 対象キーから face/identity/expression を除外確認 |
| `src/components/PromptCard.tsx` | `locks` 表示の整合 |
| `src/components/PromptGuardSection.tsx` | 「変更しない項目」「固定ルール」表示の整合 |
| `src/lib/promptLockCheck.ts` | `deriveLockState` の引数・返り値の整理 |
| `src/lib/history.ts` | `PromptHistoryItem` 保存時の locks 整合 |
| `server/src/types.ts` | `Locks` 型から face/identity/expression 削除 |
| `server/src/scopeFilter.ts` | `deriveServerLocks` の整理 |
| `server/src/promptSystem.ts` | 旧 locks.face 参照を全置換（要 grep） |
| `server/src/index.ts` | バリデーションの整合 |

---

## 6. 非ゴール（やらないこと）

- 「顔は固定するが表情だけ自由」の細分化UI（要件外）
- `locks` 型そのものの廃止（body_shape/color/camera/aspect_ratio は引き続き必要）
- 既存履歴の locks を一括削除（読み捨てで十分）

---

## 7. 関連する原則

- [master-plan-v1.md](./master-plan-v1.md) §2.P1 「顔・同一性維持最優先」
- [master-plan-v1.md](./master-plan-v1.md) §6.1 「ロック関連の概念」

---

## 8. 未決事項（実装フェーズで判断）

| # | 論点 | 推奨案 |
|---|---|---|
| Q1 | `LockKey` の旧型を残すか完全削除するか | **削除推奨**（型エラーで漏れを検出できる） |
| Q2 | 履歴の旧 locks 値を migrate するか | **migrate せず無視**（保存時に上書きされていくのを待つ） |
| Q3 | サーバの厳格バリデーションを有効にするか | **無効のまま**（旧クライアント互換のため） |
| Q4 | `locks` を `Record<LockKey, boolean>` から名前付きの interface に変えるか | **任意**（型安全性向上だが影響範囲が広い） |

### 8.1 実装時の確定事項（2026-06-04）

ユーザー承認に基づき確定:

| # | 決定 |
|---|---|
| Q1 | **採用 A**: SCOPE_TO_LOCKS から face/identity/expression を削除（潜在バグ R8 も解消） |
| Q2 | **NO**: 旧履歴の locks は migrate せず読み捨て |
| Q3 | **NO**: サーバの厳格バリデーションは導入しない（旧クライアント互換） |
| Q4 | **YES**: ProtectionBar に「顔・同一性は faceLock で常時保護中」の注記を追加 |

---

## 9. 実装完了記録（2026-06-04・Phase A→E）

### 9.1 削除された項目

| 対象 | 削除内容 |
|---|---|
| `src/types.ts` `LockKey` | `"face"` / `"identity"` / `"expression"` の3値 |
| `server/src/types.ts` `LockKey` | 同上3値 |
| `src/App.tsx:505-513` buildInputs locks | `face: true` / `identity: true` / `expression: true` の3行 |
| `src/App.tsx:1176-1179` analyzeAgent locks | 同上3キー |
| `src/components/LockToggles.tsx` OPTIONS | 顔 / 表情 / 人物の同一性 の3チップ |
| `src/components/ProtectionBar.tsx` LOCK_OPTIONS | 顔 / 表情 / 同一性 の3チップ |
| `server/src/promptSystem.ts:79-87` LOCK_JA | face / expression / identity の3キー |
| `server/src/promptSystem.ts:199-223` SCOPE_TO_LOCKS | 全14エントリから face / expression / identity を除去 |
| `server/src/index.ts:55-63` デフォルト locks | face / expression / identity の3キー |

### 9.2 統合後の型定義

```ts
// src/types.ts / server/src/types.ts（同期）
export type LockKey =
  | "body_shape"
  | "color"
  | "camera"
  | "aspect_ratio";
```

顔・同一性・表情は `faceLock: boolean`（単一の真実）+ Identity Shield が保護する。
`PromptInputs.locks` / `PromptHistoryItem.locks` / `GenerateRequest.locks` の `Record<LockKey, boolean>` は型シグネチャ変更なし（中身のキーが4つに縮小されただけ）。

### 9.3 SCOPE_TO_LOCKS 変更点

`color` の有無（pose / camera / aspect_ratio に color あり、他は camera のみ）の差分は **維持**。各エントリは以下に縮小:

| Scope | 変更後 |
|---|---|
| background / foreground / hair / outfit / cosplay / cyber / props / big_object / vehicle / myth / lighting | `["body_shape", "camera", "aspect_ratio"]` |
| pose | `["color", "camera", "aspect_ratio"]` |
| camera | `["body_shape", "color", "aspect_ratio"]` |
| aspect_ratio | `["body_shape", "color", "camera"]` |

### 9.4 追加した UI 注記（Q4）

`ProtectionBar.tsx` 展開パネルに以下を追加:
> 「顔・表情・人物の同一性は『顔ロック』で常時保護中。下の項目は追加で固定する軸です。」
> （faceLock=OFF 時は「顔ロックOFF（変わる可能性あり）」と表示）

### 9.5 影響ファイル一覧（実変更）

| ファイル | 変更 |
|---|---|
| `src/types.ts` | LockKey 縮小 + コメント |
| `server/src/types.ts` | LockKey 縮小 + コメント |
| `src/App.tsx` | buildInputs locks リテラル / analyzeAgent locks リテラル縮小 |
| `src/components/LockToggles.tsx` | OPTIONS 4要素化 |
| `src/components/ProtectionBar.tsx` | LOCK_OPTIONS 4要素化 + 注記追加 |
| `server/src/promptSystem.ts` | LOCK_JA / SCOPE_TO_LOCKS 縮小 |
| `server/src/index.ts` | デフォルト locks 縮小 + コメント |

> 注: `src/lib/history.ts:254`（`locks: inputs.locks` 透過）、`src/lib/promptLockCheck.ts`（`ProtectedTargets` は LockKey とは別の独立型）、`src/lib/settingsPersist.ts`（locks 非永続化）は **変更不要**だった。

### 9.6 テスト結果

| 検証 | 結果 |
|---|---|
| フロント `tsc -b --noEmit` | ✅ exit 0 |
| サーバ `tsc --noEmit` | ✅ exit 0 |
| フロント `vite build` | ✅ exit 0（705 modules） |
| 残存参照 grep（src/server の locks.face 等） | ✅ なし（promptLockCheck の ProtectedTargets.identity のみ＝別型で正） |
| Sample1 lockLineJa（背景・faceLock ON） | ✅「体型・カメラ位置・アスペクト比」のみ（顔/表情/同一性 消滅） |
| Sample1 faceLockBlock | ✅「顔絶対固定ロック」あり |
| Sample1 Identity Shield | ✅ risk=30 / medium / clause 1 |
| Sample1 Scope Filter | ✅ 顔危険語「別人のように顔立ちを変える」を削除 |
| Sample2 表情変更モード（faceLock OFF） | ✅ lockLine から「表情維持」消滅（潜在バグ解消） |
| Sample2 顔・同一性保護 | ✅ expressionUnlockBlock が「人物の同一性は完全に維持」「別人化は絶対禁止」を出力 |
| Sample2 Identity Shield | ✅ risk=44 / medium（faceLock OFF +12 反映） |

### 9.7 Identity Shield への影響

**影響なし（むしろ役割が明確化）**。
- `applyIdentityShield` は元から `req.faceLock` を直接参照しており、`locks.face` を使っていなかった。
- SCOPE_TO_LOCKS から顔系を削除したことで、lockLineJa（軽い維持文）と Identity Shield（リスクベースの強い保護文）の役割重複が解消。
- Sample1=30/medium, Sample2=44/medium と従来通りの採点。

### 9.8 Scope Filter への影響

**影響なし**。
- `applyServerScopeFilter` / `deriveServerLocks` は元から `req.faceLock` を参照（`locks.face` 不使用）。
- `deriveServerLocks` の出力 `protectedTargets.identity` は常に `true`、`face` は faceLock 連動で従来通り。
- 顔危険語（FACE_DANGER）の常時削除も従来通り動作（Sample1 で確認）。

---

**End of Doc 09**
