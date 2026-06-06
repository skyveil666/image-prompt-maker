# 12. Scope Matrix

> **目的**: 全 14 種類の `Scope` が「どの設定」「どの保護」「どのブロック」「どの削除カテゴリ」「どのリスク加算」に対応するかを **1枚のマトリックスで明示** する。
> **依拠**: [master-plan-v1.md](./master-plan-v1.md) §2 最重要原則（P2: 変更対象だけ変更）

---

## 1. Scope 一覧（14種類）

[types.ts:1-15](../src/types.ts#L1):

| ID | 日本語 | カテゴリ | 必須詳細設定 | UI 出現順 |
|---|---|---|---|---|
| `background` | 背景 | 環境 | BackgroundSettings | 1 |
| `foreground` | 前景演出 | 環境 | ForegroundSettings | 2 |
| `pose` | ポーズ | 人物 | PoseSettings | 3 |
| `hair` | 髪 | 人物 | HairSettings | 4 |
| `outfit` | 衣装 | 人物 | OutfitSettings | 5 |
| `cosplay` | コスプレ | 衣装拡張 | CosplaySettings | 6 |
| `cyber` | サイバー化 | 改造 | CyberSettings | 7 |
| `camera` | カメラ | 撮影 | CameraSettings | 8 |
| `props` | 小物 | 物 | PropsSettings | 9 |
| `big_object` | 大物 | 物 | BigObjectSettings | 10 |
| `vehicle` | 乗物 | 物 | VehicleSettings | 11 |
| `myth` | 神話・伝説 | 演出 | MythSettings | 12 |
| `lighting` | ライティング | 撮影 | LightingSettings | 13 |
| `aspect_ratio` | アスペクト比 | 出力 | AspectRatioSettings | 14 |

---

## 2. Scope × 詳細設定の対応

`details: DetailSettings` の各セクションは Scope と 1:1 対応。

| Scope | DetailSettings 内のキー | 主な軸数 |
|---|---|---|
| background | `background` | 13軸 + 文字背景4軸 |
| foreground | `foreground` | 11軸 |
| pose | `pose` | 8軸 |
| hair | `hair` | 9軸 |
| outfit | `outfit` | 8軸 |
| cosplay | `cosplay` | 12軸 |
| cyber | `cyber` | 5軸 |
| camera | `camera` | 6軸 + 3Dカスタム |
| props | `props` | 7軸 |
| big_object | `bigObject` | 6軸 |
| vehicle | `vehicle` | 6軸 |
| myth | `myth` | 5軸 |
| lighting | `lighting` | 6軸 |
| aspect_ratio | `aspectRatio` | 1 preset + 2 custom |

---

## 3. Scope × Lock の相互作用

> **原則 P2 / P3 / P4**:
> Scope に含まれない軸は **保護対象** になる。さらに UI トグル系のロックは Scope 状態に上書きされない。

| UI トグル | 効果範囲 | Scope と独立に保護 |
|---|---|---|
| `faceLock` (state) | 顔・同一性・表情 | ✅ 常に独立 |
| `bodyPoseLock` | 体型 | ✅ 独立（pose Scope ON でも体型は保持） |
| `colorMoodLock` | 色味・雰囲気 | ✅ 独立（color/mood 軸への流入を抑制） |
| `compositionLock` | 構図・アスペクト比 | ✅ 独立（camera / aspect_ratio 両方ロック） |
| `avoidCliche` | 量産構図回避 | – Scope 非依存 |

→ **「Scope = 変更したい軸の選択」**, **「Lock = それを上書きしてでも守る軸」** の2層構造。

---

## 4. Scope × buildInputs ゲートの対応

[App.tsx:497-669](../src/App.tsx#L497) `buildInputs()` でフィルタされる項目。

| 項目 | Scope ゲート | 追加条件 |
|---|---|---|
| `details.background` | `background` ∈ scopes | – |
| `details.outfit` | `outfit` ∈ scopes | – |
| `zozoTrend` | `outfit` ∈ scopes | `zozoApplied != null` |
| `windLevel` | hair / outfit / foreground / pose / camera のいずれか ∈ scopes | `windLevel > 0` |
| `ratingBias` | activeScopes でフィルタ | `favoriteLearnEnabled || skyveilOneShot` |
| `imageBias` | – | `policyApplied` |
| `motifControls` | – | `policyApplied` |
| `comboControls` | – | `policyApplied` |
| `colorWeights` | – | 常時送信（P6 例外） |
| `preferenceProfile` | – | `favoriteLearnEnabled || skyveilOneShot` |
| `favoriteTraits` | – | 同上 |

---

## 5. Scope × promptSystem ブロックの対応

[server/src/promptSystem.ts](../server/src/promptSystem.ts) の挿入条件。

| ブロック | 挿入条件 | 行範囲（概算） |
|---|---|---|
| 【衣装生成ガイド】 | `outfit` ∈ scopes | L4071+ |
| 【衣装サブジャンル展開】 | `outfit` ∈ scopes | L4072+ |
| 【ZOZOトレンド】 | `outfit` ∈ scopes & zozoTrend あり | L4073+ |
| 【持ち物・小物ルール】 | `props` ∈ scopes | L4106+ |
| 【持ち物哲学】 | `props` ∈ scopes | L4107+ |
| 【ポーズダイナミクス】 | `pose` ∈ scopes | L4108+ |
| 【カメラ攻撃性】 | `camera` ∈ scopes | L4109+ |
| 【風の強さ】 | hair/outfit/foreground/pose/camera ∈ scopes & windLevel>0 | L4083+ |
| 【今回の変更対象】 | 常時、`scopes` 列挙 | L4044 |
| 【厳守ルール】 | 常時 | L4045-4048 |
| 【固定原則】 | 常時 | L4049+ |
| 【顔ロック】 | `faceLock = true` | L4115+ |
| 【表情解除】 | `faceLock = false` | L4116+ |

---

## 6. Scope × Scope Filter 削除カテゴリの対応

[server/src/scopeFilter.ts](../server/src/scopeFilter.ts) で、Scope に **含まれない** 場合に削除されるカテゴリ。

| Scope なし → 削除対象カテゴリ | 削除キーワード例 |
|---|---|
| `background` | 「背景」「ロケーション」「風景」「シーン」「background」「location」「scene」 |
| `outfit` | 「衣装」「ドレス」「ジャケット」「outfit」「clothing」「dress」 |
| `hair` | 「髪」「髪型」「hairstyle」「hair color」「bangs」 |
| `pose` | 「ポーズ」「姿勢」「pose」「posture」 |
| `camera` | 「アングル」「カメラ」「angle」「camera」「shot」 |
| `props` | 「小物」「持ち物」「props」「holding」 |
| `lighting` | 「ライティング」「lighting」「illumination」 |
| `foreground` | 「前景」「foreground」「particles」 |

**FACE_DANGER** は scope 設定と無関係に **常時削除**:
- 「別人」「顔を変える」「顔立ちを変える」「different face」「face transformation」

**PROTECTIVE_LINE_HINTS** に該当する文（「維持」「固定」宣言）は **削除しない**（誤検知防止）。

---

## 7. Scope × Identity Shield リスク加算の対応

[server/src/scopeFilter.ts:211-266](../server/src/scopeFilter.ts#L211) `applyIdentityShield()` の加算条件。

| Scope ON | リスク加算 |
|---|---|
| `hair` | +12 |
| `pose` | +16 |
| `camera` | +16 |
| `foreground` | +12 |
| `lighting` | +8 |
| `outfit` | +8 |
| `cosplay` | +8（outfit と同等） |
| `cyber` | +8（造形変化を伴う） |
| `props` | – |
| `big_object` | – |
| `vehicle` | – |
| `myth` | – |
| `aspect_ratio` | – |
| `background` | – |

加算なし条件:
- 4軸以上の変更: **+18**
- 強アングル指定（STRONG_ANGLE）: **+10**
- 顔の向き変更可能性: **+8**
- 顔危険語（FACE_DANGER）検出: **+30**
- faceLock OFF: **+12**

---

## 8. Scope × varietyEngine の対応

[server/src/varietyEngine.ts:138-141](../server/src/varietyEngine.ts#L138) `shouldApplyVariety()`:

| Scope | varietyEngine 起動 |
|---|---|
| `background` | ✅ |
| `foreground` | ✅ |
| `outfit` | ✅ |
| `cosplay` | ✅ |
| `big_object` | ✅ |
| `vehicle` | ✅ |
| `myth` | ✅ |
| `pose` | – |
| `hair` | – |
| `cyber` | – |
| `camera` | – |
| `props` | – |
| `lighting` | – |
| `aspect_ratio` | – |

加えて `viralMode = true` の時も常時起動。

---

## 9. Scope × 多様性メモリの対応

[src/lib/variationEngine.ts](../src/lib/variationEngine.ts) の `VariationMemory`:

| メモリキー | 対応 Scope | 連発防止対象 |
|---|---|---|
| `recentBgPlaces` | background | BackgroundPlace |
| `recentOutfits` | outfit | OutfitStyle |
| `recentMoods` | – (mood) | Mood |
| `recentFgEffects` | foreground | ForegroundEffect |
| `recentWorlds` | – (world preset) | WorldPreset |
| `recentCompositions` | camera | CameraComposition |
| `lastScopes` | 全 Scope | スコープ自体の繰返し |

各 MAX_RECENT=8 件保持。

---

## 10. 推奨 Scope 組合せ

| 目的 | 推奨 Scope | 備考 |
|---|---|---|
| 背景だけ差し替え | `background` のみ | 最も安全。Identity Shield: low |
| 衣装替え | `outfit` | + `lighting` で雰囲気統一 |
| ポーズだけ変える | `pose` | bodyPoseLock OFF が前提 |
| サムネ作成 | `aspect_ratio` のみ | 構図維持 |
| 神引き | 4〜5軸 | Identity Shield: high〜danger になりやすい |
| コスプレ撮影 | `outfit` + `cosplay` + `background` | Identity Shield: medium |

---

## 11. 競合・注意が必要な組合せ

| 組合せ | 問題 | 対処 |
|---|---|---|
| `aspect_ratio` + `compositionLock=true` | compositionLock が aspect_ratio をロックする矛盾 | compositionLock 優先（aspect_ratio Scope を実質無視） |
| `outfit` + `cosplay` 両方 OFF | コスプレ詳細設定が無効になる | UI で warning 表示推奨 |
| `cyber` のみ ON | 顔以外を機械化する → identity 危険語と類似判定の可能性 | Identity Shield が +8 加算 |
| 全 Scope OFF | 生成不可（`canGenerate = false`） | [App.tsx:370](../src/App.tsx#L370) |
| `pose` + `camera` 同時 ON | 顔の向きが両側から変わるリスク | Identity Shield: +16+16+12 = ≥44（medium 以上） |
| 6軸以上 ON + faceLock OFF | リスク採点 90+ | UI で「強警告」表示推奨 |

---

## 12. UI 上の Scope 表現

| コンポーネント | 表示形式 |
|---|---|
| [ScopeSelector.tsx](../src/components/ScopeSelector.tsx) | 横並びチップ（マルチセレクト） |
| [DetailsCard.tsx](../src/components/DetailsCard.tsx) | Scope ごとのアコーディオン |
| [ReflectionStatusBar.tsx](../src/components/ReflectionStatusBar.tsx) | 「🎯 変更対象」セクションのチップ |
| 新 ProtectionBar ([10_protection-bar常時表示.md](./10_protection-bar常時表示.md)) | 「Scope Filter（自動保護）」リストで含まれない軸を表示 |

---

## 13. 関連ドキュメント

- [master-plan-v1.md §2](./master-plan-v1.md)（P2-P5 の根拠）
- [master-plan-v1.md §13](./master-plan-v1.md)（機能間連携マトリックス）
- [13_identity-risk.md](./13_identity-risk.md)（採点ロジック詳細）
- [09_face-lock統合.md](./09_face-lock統合.md)（faceLock の特殊性）

---

**End of Doc 12**
