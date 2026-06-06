# 26. 分析ラボ設計（重複分析センターのダッシュボード／ラボ分離）

> 目的: 重複分析センターを「ダッシュボード（概要・TOP10）」と「分析ラボ（詳細探索）」に分離。
> 制約: **分析ロジックは一切変更しない**（biasAnalyzer / historyAnalyzer / motifPolicy / colorPolicy）。UIのみ拡張。

## 0. ユーザー決定（2026-06-06）
- ラボ対象: **頻出要素＋頻出構成の両方**（ラボ内2タブ）。
- タグ: **自由ラベルを Lab-2 で追加**（新 localStorage。まず Lab-1 を実装・検証）。
- ダッシュボード: **現状維持＋「🔬 分析ラボ」入口ボタン**。

## 1. 構成
- **ダッシュボード**＝現行 `重複分析` タブ（ComboRanking TOP10 / FrequencyRanking TOP12 / 未開拓 / サマリー）。**変更なし**＋入口ボタン追加。
- **分析ラボ**＝新規・全幅ビュー `AnalysisLabPanel.tsx`（Compare Mode と同方式。fixed inset・モーダル）。`App` の state `analysisLabOpen` で開閉。
  - **同じデータ・同じハンドラを再利用**（props で受け渡し。新規ハンドラ不要・ロジック不変）。

## 2. データ／ハンドラ（既存・再利用）
- 頻出要素: `historyAnalysis.motifCounts: MotifCount[]`（全20・`motif{id,label,category,tokens}`, totalCount, recentCount, favoriteCount, penaltyLevel）。
- 頻出構成: `historyAnalysis.topCombos: MotifCombo[]`（comboKey, motifIds, motifLabels, count, risk）。
- レベル: `levels`（motifId→0-5・既定4）。`onLevelChange(id, level)` / `onBulkLevel(ids[], level)`（=NG一括の土台）。
- 構成ポリシー: `comboPolicies`（comboKey→block/alt/allow）。`onComboPolicyChange(key, policy)`。
- カテゴリ: `motif.category`（衣装/背景/色/演出/小物/世界観/その他）。

## 3. 分析ラボ UI（Lab-1）
**全幅ビュー** ヘッダ「🔬 分析ラボ」＋閉じる。タブ: **頻出要素 / 頻出構成**。

### 3.1 共通ツールバー（各タブ）
- **表示件数**: 10 / 20 / 50 / 100 / 全件（クライアント側 slice のみ）。
- **検索**: ラベル＋トークン部分一致。
- **ソート**: 出現回数 / 直近 / お気に入り / レベル / 名前 / カテゴリ（要素）、出現回数 / リスク / 名前（構成）。

### 3.2 頻出要素タブ
- フィルタ: **カテゴリ**（衣装/背景/色/演出/小物/世界観/その他）。
- テーブル: ☑選択 / 要素 / カテゴリ / 出現 / 直近 / ⭐ / **レベル(NG・0-5)**（行ごと `onLevelChange`）。
- **NG一括**: 選択行 → 「NG(0)/強抑制(1)/抑制(2)/注意(3)/許可(4)/積極(5)」一括（`onBulkLevel(selectedIds, level)`）。
- 現行 `FrequencyRanking` の LevelControl と同等の操作を流用（ロジック不変）。

### 3.3 頻出構成タブ
- フィルタ: **リスク**（危険/高/中/低）。
- テーブル: ☑選択 / 構成（motifLabels を ＋ 連結）/ 出現 / リスク / **ポリシー(今後出さない/別ジャンル化/許可)**（行ごと `onComboPolicyChange`）。
- **一括ポリシー**: 選択行 → block/alt/allow 一括（各 `onComboPolicyChange`）。

## 4. ダッシュボード入口
- `DuplicateAnalysisPanel` の `dup` タブ上部に「🔬 分析ラボを開く」ボタン → `props.onOpenLab?.()` → `App` が `analysisLabOpen=true`。
- `App` で `<AnalysisLabPanel open={analysisLabOpen} onClose ... data/handlers />` を描画。

## 5. 段階導入
- **Lab-1**: 上記（件数/フィルタ/検索/ソート/NG一括/ポリシー一括）。**全て既存ハンドラ再利用・ロジック不変**。
- **Lab-2**: タグ（新 `motifTags.ts`＝localStorage `ipm_motif_tags_v1`: Record<motifId,string[]>）＋タグ列/タグ一括/タグフィルタ。要素中心（必要なら構成にも）。

## 6. 不変条件・リスク
- 分析ロジック・既存ハンドラ・保存形式（`ipm_motif_levels_v1`/`ipm_combo_policies_v1`）は不変。ラボは**読む＋既存ハンドラ呼び出し**のみ。
- ダッシュボードは現状維持（入口ボタン追加の数行のみ）。
- `DuplicateAnalysisPanel` は React.memo 済み（BUG-18）。入口ボタン追加・onOpenLab prop 追加が memo 安定性を壊さないよう、ハンドラは useCallback 安定で渡す。
- ロールバック: 新コンポーネント・新 state・入口ボタンの追加分を revert すれば既存に影響なし。

## 7. 実装状況
### Lab-1 — ✅ 実装・検証済み（2026-06-06／未コミット）
**変更ファイル**
- `src/components/AnalysisLabPanel.tsx`（新規）：全幅ビュー・2タブ（頻出要素／頻出構成）。件数(10/20/50/100/全件)・カテゴリ/リスクフィルタ・検索・ソート・行選択・NG一括(`onBulkLevel`)・一括ポリシー(`onComboPolicyChange`)。既存データ/ハンドラを再利用、分析ロジック不変。
- `src/App.tsx`：`analysisLabOpen` state、`<AnalysisLabPanel/>` 描画、`DuplicateAnalysisPanel` に `onOpenLab` 配線。
- `src/components/DuplicateAnalysisPanel.tsx`：`onOpenLab?` prop ＋ dup タブ上部に「🔬 分析ラボを開く」入口ボタン（数行・概要は現状維持）。

**検証**（front tsc/build ✅、隔離 preview 4330・履歴あり）
- ダッシュボードに入口ボタン表示 → クリックでラボ起動。タブ＝頻出要素(20)/頻出構成(0)。
- 件数=10→10行、検索「ドレス」→2件（先頭ドレス全般）、ソート/カテゴリ select 動作。
- NG一括：先頭3件選択→一括バー「強抑制」→ `ipm_motif_levels_v1` に3件 level1 永続化（oneDelta=3）。行内レベル変更も永続化。
- 検証で書いた level は後片付け（isolated origin）。

### Lab-2（タグ）— ✅ 実装・検証済み（2026-06-06／未コミット）
**変更ファイル**
- `src/lib/motifTags.ts`（新規）：localStorage `ipm_motif_tags_v1`（motifId→tags[]）。load/save/add/remove/all（純粋helper＋保存）。**生成には不使用**（ラボ内整理メタデータ）。
- `src/components/AnalysisLabPanel.tsx`：頻出要素タブに タグ列（チップ＋×削除）／タグフィルタ／一括タグ（入力＋＋付与/－削除）。タグは**ラボ内で自己管理**（App 改変なし）。

**検証**（front tsc/build ✅、隔離 preview 4330）
- 2件選択→「実験中」＋付与 → `ipm_motif_tags_v1` に2件保存・チップ表示・フィルタ選択肢追加 ✅。
- タグチップ × で1件削除（2→1）✅。
- タグフィルタ「お気に入り」→該当2件のみ表示 ✅（※当初フィルタが効かない不具合＝`filteredElements` の useMemo 依存に `elemTag`/`motifTags` 欠落を発見・修正）。
- テストタグは後片付け（isolated origin）。

**End of Doc 26**
