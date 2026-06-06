# 20. Phase 4 UI改善・App.tsx整理

> 目的：完成直前のUI調整。「表示を減らす / 必要な時だけ開く / 生成作業を邪魔しない」。
> **新機能追加ではない。** UI表示・配置・折りたたみ・責務分離のみ。
> 依拠: [master-plan-v1.md](./master-plan-v1.md), [18_phase3-ui-dedup-report.md](./18_phase3-ui-dedup-report.md)

---

## 0. 現状計測（2026-06-04）

| 指標 | 値 |
|---|---|
| App.tsx 行数 | 2994 |
| useState | ~88 / useMemo 17 / useEffect 23 / useCallback 52 / useRef 16 |
| 重複分析センター 初期 | `expanded=false`（既に折りたたみ済み） |
| SkyveilBar 初期 | collapsed（M-3 済み） |
| ReflectionStatusBar 初期 | `open=true`（展開）→ 圧縮対象 |
| DetailsCard 初期 | 全カテゴリ closed |
| 上部 sticky | GPB行＋Strip行の2段 |

---

## 1. P0 実装範囲（今回）

承認: P0 から着手。上部統合は **案B**。P3 dumb 抽出は Phase5 送り。状態移動・大規模分割・hooks 抽出は行わない。

### P0-1: 上部 sticky 1段統合（案B）

```
Before（2段）                         After（1段）
🛡 顔ON ⚠HIGH49 [詳細]               🛡 顔ON  Shield HIGH49 ｜ 🤖 分析 4件・最新 [詳細▼]
🤖 AI分析 📘4 🎨4 📸2/2 ⭐3 🧬 [詳細]
```

- 顔・同一性ON / Identity Shield レベルは**常時表示**。
- AI分析は**簡易表示（件数＋最新/分析中）**のみ。5項目は[詳細]展開時のみ。
- 実装: `GlobalProtectionBar` に `analysisSummary`（ヘッダ右）と `analysisDetail`（展開内）スロットを追加。`AnalysisStatusStrip` に `variant`（summary=1チップ / detail=5チップ / bar=従来）を追加して再利用。標準 Strip カードは sticky から撤去し GPB に内包。
- モバイル幅: 分析サマリは省略/横 flex-wrap。
- **高さ削減最優先**。

### P0-2: 現在の反映状態 初期コンパクト化

- ReflectionStatusBar 初期 `open=false`。
- 折りたたみ: `📡 現在の反映：🎯変更4 🔒守る3 ✨補助3 🧬好みOFF [全リセット] [▼]`
- 展開時は現在の詳細タグ表示を維持。全リセットは折りたたみ時も残す。実反映とズレない（既存 state から算出）。**表示のみ**。

### P0-3: 重複分析センター（確認・文言微調整）

- 既に初期折りたたみ済み。ヘッダ（危険度/重複度/新規性）維持。AIコメント・頻出要素・「提案を反映」は展開時のみ（現状どおり）。必要なら[詳細]明示の文言微調整のみ。

---

## 2. 最重要ルール（不変条件）

Prompt生成 / Identity Shield計算 / Scope Filter / skyveil学習 / Gemini / 分析スコア / 出力プロンプト本文 / 履歴データ形式 = **一切変更しない**。
App.tsx 大規模分割・hooks 抽出・状態移動は**行わない**。UI表示・配置・折りたたみ初期値・並び順・要約文字列のみ。

---

## 3. 変更ファイル予定（P0）

| ファイル | 変更 |
|---|---|
| `src/components/AnalysisStatusStrip.tsx` | `variant` prop（summary/detail/bar） |
| `src/components/GlobalProtectionBar.tsx` | `analysisSummary` / `analysisDetail` スロット |
| `src/App.tsx` | 上部 sticky の配置統合（標準 Strip 撤去→GPB へ内包）、ReflectionStatusBar 初期 open |
| `src/components/ReflectionStatusBar.tsx` | 初期 collapsed＋1行サマリ整形 |
| （任意）DuplicateAnalysisPanel.tsx | ヘッダ文言微調整 |

---

## 4. 優先順位

- **P0（今回）**: 上部1段統合 / 反映状態コンパクト / 重複センター確認
- **P1（P0確認後）**: skyveil微圧縮 / 詳細設定の選択中カテゴリ優先展開
- **P2**: 生成ボタン周辺サマリ / 結果カード tooltip
- **P3（Phase5送り）**: App.tsx 分割（HeaderStickyArea / GenerationControlBar 等）・hooks 抽出

---

## 5. App.tsx 分割調査（Phase5 用・参考）

- 安全に切り出せる（状態を持たない dumb）: `HeaderStickyArea`, `GenerationControlBar`
- 延期（状態移動・リスク大）: `useBuildInputs` / `useGenerationFlow` / `useAnalysisOrchestration` / `useSkyveil` 等の hooks 抽出、`RightMainPanel` 分割

---

## 6. 実装記録（P0・2026-06-04 完了）

### 6.1 変更ファイル（今回 P0 = 4ファイル＋docs のみ）

| ファイル | 変更（UI/配置のみ） |
|---|---|
| `src/components/AnalysisStatusStrip.tsx` | `variant`（summary=1チップ / detail=5チップ）追加 |
| `src/components/GlobalProtectionBar.tsx` | `analysisSummary`（ヘッダ行）/ `analysisDetail`（展開内）スロット追加 |
| `src/App.tsx` | 上部 sticky を GPB 1段に統合（標準 Strip カード撤去→GPB へ内包）、AnalysisLiveView は GPB 展開内[ライブビュー]で開く |
| `src/components/ReflectionStatusBar.tsx` | 初期 `open=false`＋1行サマリ整形（🎯変更/🔒守る/✨補助/🧬好み） |

> 重複分析センターは既に初期折りたたみ済みのため変更なし（確認のみ）。

### 6.2 Before / After（実測）

| 領域 | Before | After | 削減 |
|---|---|---|---|
| 上部 sticky（保護＋分析） | 2段 88px | 1段 **45px** | **▲49%** |
| 現在の反映状態（初期） | 展開 171px | 折りたたみ **32px** | **▲81%** |
| 上部合計（両方折りたたみ時） | 259px | **77px** | **▲約70%** |

- After 上部1行: `🛡 顔・同一性 ON ⚠ Identity Shield HIGH 49 ｜ 🤖 分析 3件・最新 [詳細▼]`（案B）
- After 反映状態1行: `📡 現在の反映状態 🎯変更4 ・🔒守る4 ・✨補助1 ・🧬好みOFF [↺全リセット] [▼開く]`
- [詳細]展開時のみ: 🤖AI分析5項目（📘🎨🖼⭐🧬 件数・鮮度）＋ Identity Shield 採点理由＋安全提案＋[ライブビュー]

### 6.3 検証

| 項目 | 結果 |
|---|---|
| 顔・同一性ON 常時表示 | ✅ |
| Identity Shield レベル常時表示 | ✅ |
| AI分析 簡易表示のみ（詳細で5項目） | ✅ |
| ReflectionStatusBar 初期コンパクト＋全リセット残置 | ✅ |
| 重複分析センター 初期折りたたみ | ✅（既存） |
| フロント `tsc -b` / `vite build` | ✅ exit 0 |
| 起動時コンソールエラー | ✅ 0件 |
| プロンプト生成内容・分析結果 | **不変**（buildInputs/分析/サーバは無変更。表示の variant・初期開閉のみ） |

### 6.4 ロジック非変更の確認

今回 P0 で編集したのは presentation 4ファイル＋docs のみ。`buildInputs` / Identity Shield 計算 / Scope Filter / skyveil学習 / Gemini / 分析スコア / 出力プロンプト本文 / 履歴データ形式は**一切変更なし**。GPB/Strip/ReflectionStatus に渡すデータ（faceLock, risk, analysisLive, analysisCategories）は同一で、表示方法のみ変更。

---

## 7. 実装記録（P1 / P2 / P3・2026-06-04 完了）

段階実装（P1→build→P2→build→P3→build）。すべて UI 表示・整理のみ。

### P1
- **skyveil好みAI 微圧縮**: SkyveilBar 上段のパディング縮小（py-2.5→py-1.5）、トグル文言 `▼ 設定・プロファイル`→`▼ 設定`。操作（更新/自動学習/反映リセット/プロファイル削除/好き/出すぎ/避けたい/未開拓/成功プロンプト）は展開側のまま（M-3 維持）。DuplicateAnalysisPanel へ戻さず・自動反映なし。
- **DetailsCard 選択中カテゴリ優先**: 初期 openTabs = 件数>0 のカテゴリ（選択あり=初期展開 / 未選択=初期クローズ）。描画は件数>0 を上に安定ソート（元順序保持）。選択数バッジ・すべて開く/閉じる/おまかせ・おまかせ意味は不変。
- 変更ファイル: `SkyveilBar.tsx` / `DetailsCard.tsx`

### P2
- **生成ボタン周辺サマリ**: 設定サマリーに `・出力先：{ChatGPT/Gemini/Nano Banana/両対応}` を追加。`GenerationProgress` に `info` prop（表示のみ）を追加し、生成中の進捗行に `{出力先}向け / 統一プロンプト` を表示。案数・出力先処理は不変。
- **生成結果カード tooltip**: PostReadyScore（投稿前スコア）各項目・判定バッジ、skyveil好みスコアのサブスコア（同一性安全度ほか）に意味の tooltip。コピーボタン・FavoriteButton の title を補強。スコア計算・本文は不変。
- 変更ファイル: `App.tsx`（出力先ラベル）/ `GenerationProgress.tsx`（info）/ `PromptGuardSection.tsx`（tooltip）/ `PromptCard.tsx`・`FavoriteButton.tsx`（title）

### P3 — MoodSelector 整理
- **git grep 参照確認結果**: `MoodSelector.tsx` は**死ファイルではない**。`MOOD_GROUPS_BASIC/DETAIL`・型 `MoodGroup`・`MoodGroupRow`・`hasDetailSelection` は DetailsCard / favoriteProfile が使用中。未使用は **`MoodSelector` コンポーネント関数のみ**（`<MoodSelector` の使用箇所なし）。
- **削除したもの**: 未使用の `MoodSelector` コンポーネント関数、専用の `Props` interface、専用の `useState` import。
- **残した定数/エクスポート**: `MOOD_GROUPS_BASIC` / `MOOD_GROUPS_DETAIL` / `MoodGroup` / `MoodGroupRow` / `hasDetailSelection`（すべて使用中のため存続）。
- **定数の別ファイル分離は不採用**: ファイル自体が共有モジュールとして存続するため分離は不要（favoriteProfile / DetailsCard の import パスも不変＝動作影響なし）。
- 変更ファイル: `MoodSelector.tsx` のみ

### 検証
| 項目 | 結果 |
|---|---|
| P1後 / P2後 / P3後 各 `tsc -b` ＋ `vite build` | ✅ すべて exit 0 |
| サーバ `tsc` | ✅ exit 0 |
| 起動回帰（ブラウザ・コンソールエラー） | ✅ 0件、主要UI（GPB統合/skyveil/反映/生成/出力先）描画OK |
| 生成プロンプト本文 | **不変**（buildInputs/promptSystem/scopeFilter 無編集） |
| 分析結果 | **不変**（分析・スコア計算 無編集。表示のみ） |
| skyveil学習ロジック | **不変**（操作位置・表示のみ） |

---

## 8. Phase 4 総括（完了）

| | 内容 | 状態 |
|---|---|---|
| P0 | 上部 sticky 1段統合（案B）／反映状態コンパクト／重複センター確認 | ✅ |
| P1 | skyveil微圧縮／詳細設定 選択中優先展開 | ✅ |
| P2 | 生成ボタン周辺サマリ（出力先）／結果カード tooltip | ✅ |
| P3 | MoodSelector 未使用関数削除（共有モジュールは存続） | ✅ |

**Phase 4 完了。** 残: App.tsx 大規模分割・hooks 抽出は Phase 5（本フェーズでは未実施＝禁止事項遵守）。

---

**End of Doc 20**
