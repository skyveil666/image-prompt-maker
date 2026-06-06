# 28. 監視要素 100–300 拡張 設計案（ハイブリッド・タクソノミー＋発見層）

> 目的: 好み学習だけでなく **未開拓ジャンル発見・多様性分析** を強化する。現状20要素では不足。
>       100–300 要素を扱い、分析センター専用画面で 検索/ソート/タグ/NG・注意・許可/未開拓度 まで見る。
> 前提: biasAnalyzer（MONITORED_MOTIFS=20・containsMotif）／historyAnalyzer（motifCounts・UNTAPPED_GENRE_DEFS）／
>       motifPolicy（level 0-5＝NG/抑制/注意/許可/優先）／AnalysisLabPanel（分析ラボ＝既存の専用画面）。

## 0. ユーザー決定（2026-06-06）
- ソース方式: **ハイブリッド**（curated タクソノミー ＋ 発見層）。
- 整備方法: **Claude が構造化データを作成**（categories別＋JP/ENトークン）。
- 目的の優先順位: **未開拓発見・意外性・将来の神引き/新軸探索 ＞ 好み最適化**。
- 配分: **発見ファースト**。A群（造形・既存頻出）は維持しつつ比率を下げ、B群（表現スタイル）を主役に。総数 **~284（250–300）**。

## 0.5 確定カテゴリ体系（承認済み・21カテゴリ＋その他）
**A群：造形・好み制御（~70・既存頻出は維持し比率縮小）**
衣装14 / 髪6 / ポーズ6 / 色10 / ライティング6 / カメラ6 / 演出12（ネオン/発光粒子/ホログラム/クリスタル等を維持・縮小）/ 背景10（サイバー都市/教会/暗背景を維持・縮小＋自然/海/森/室内）

**B群：表現スタイル・発見・意外性（~214・主役）**
芸術様式28 / 建築16◆ / 広告表現16 / 映画表現18 / 写真表現18◆ / 雑誌表現12◆ / 世界観20 / 文化圏14 / プロダクト12◆ / 素材14◆ / 感情トーン12◆ / ジャンル24（未開拓発見の主軸）/ 時代12
（◆＝新カテゴリ）

既存20要素のID/カテゴリは維持（後方互換：既存 levels/tags/分析が継続動作）。未開拓ジャンル発見＝B群の広い監視＋発見層(P3)。

## 1. 全体像（3層）
1. **curated タクソノミー**（確実な監視基盤）：`src/data/monitoredMotifs.ts`（新規）に 150–300 の `{id,label,category,tokens[]}`。現 `MONITORED_MOTIFS`(20) と `UNTAPPED_GENRE_DEFS` を統合・拡張。
2. **ユーザー昇格モチーフ**（発見層の受け皿）：discovery で見つけた語をユーザーが昇格 → localStorage `ipm_user_motifs_v1` に保存。実効監視集合＝`[...curated, ...userMotifs]`。
3. **発見層（discovery）**：履歴プロンプトから「**頻出だが未登録**の語/フレーズ」を抽出して候補提示 → 昇格/タグ/無視。＝未開拓ジャンル発見。

## 2. エンジン変更（検出ロジックは方式据え置き・規模対応）
- `MONITORED_MOTIFS` を data ファイル由来に（`biasAnalyzer`/`historyAnalyzer` は import 先を変えるだけ・`containsMotif` は不変）。実効集合に userMotifs をマージ。
- **未開拓度を全モチーフへ**：`untappedScore = clamp(100 - (totalCount/windowSize)×K)`（現 genre 専用を全要素へ一般化）。`MotifCount` に `untappedScore` を追加。
- **カテゴリ拡張**：現7 → 例 `衣装/背景/色/演出/小物/世界観/ポーズ/カメラ/ライティング/質感/時代/ジャンル/構図/その他`。`MotifCategory` 型＋`categoryColorClass` を拡張。

## 3. 性能（300要素 × 履歴最大1000）
- 現状は `motifs × history × tokens` 全走査（300×1000×~10 ≒ 数百万 includes／毎回）。
- 対策：**履歴アイテム単位の hit キャッシュ**。各 item に対し「含む motifId の Set」を1回だけ算出し item.id ＋ タクソノミー版数でメモ化（再分析時は未変更 item を再利用）。
- トークン正規化（小文字化）も item ごとに1回。実測で重ければ Web Worker / 分割実行を追加（段階）。

## 4. 発見層（discovery）
- `detectCandidateMotifs(history)`：プロンプトを区切り（「、」/カンマ/空白）→ 語・bi-gram を頻度集計 → **curated/userMotifs のいずれのトークンにもマッチしない**もののみ残す → 頻度降順 top N（例30）。
- 各候補：語・出現数・直近出現。アクション＝**昇格**（userMotifs へ：`{id, label, tokens:[label]}`、categoryは「その他」初期）/ **タグ** / **無視**（無視リストに保存）。
- これにより curated に無い新ジャンルを継続的に発見・取り込み（ハイブリッドの“発見”）。

## 5. 分析センター専用画面（既存 AnalysisLabPanel を拡張＝専用画面）
- **頻出要素タブ**（100–300対応）：列＝☑/要素/カテゴリ/出現/直近/⭐/**未開拓度**/レベル(NG・注意・許可=0-5)/タグ。
  - ソート＝出現/直近/⭐/**未開拓度**/レベル/名前/カテゴリ。フィルタ＝カテゴリ/タグ/検索/リスク。件数 10/20/50/100/全件。
  - **大量行対策**：全件(=300)描画は**仮想化**（react-window 等）を導入、または既定はフィルタ＋ページングで縮小。
- **発見タブ**（新）：候補一覧（頻出未登録語）＋ 昇格/タグ/無視。
- **未開拓ビュー**：未開拓度ソートで「狙うべき低出現要素」を一覧（多様性提案の核）。
- NG/注意/許可は既存 level（0=NG,1/2抑制,3注意,4許可,5優先）を流用。タグは Lab-2 の motifTags を流用。

## 6. 学習・多様性への接続（既存を活かす・適用ロジック不変）
- 好み学習：拡張後の motifCounts は既存 skyveilProfile/historyAnalysis 経由でそのまま機能（要素が増える＝粒度向上）。
- 未開拓度＝多様性提案：`underusedRecommended`（skyveil）/「次に狙うべき方向」へ未開拓 top を供給（既存導線を一般化）。
- 生成への反映は従来どおり（level 直接適用／好みAIトグル／固定ルール最優先）。**学習は自動適用しない**。

## 7. 段階導入
- **P1（エンジン＋タクソノミー）**：`data/monitoredMotifs.ts`（Claude curated 150–200・段階拡張）＋カテゴリ拡張＋未開拓度の全要素化＋検出 hit キャッシュ。既存UIはそのまま行数増のみ。tsc/build＋性能実測。
- **P2（専用画面）**：未開拓度 列/ソート＋仮想化＋カテゴリ表示拡張＋未開拓ビュー。
- **P3（発見層）**：`detectCandidateMotifs`＋発見タブ＋昇格/無視（userMotifs/無視リスト localStorage）。
- 各Pで tsc/build＋隔離オリジン検証。

## 8. 不変条件・リスク
- 検出方式（containsMotif）・生成・保存・適用ロジックは不変。学習は自動適用しない。固定ルール最優先。
- localStorage は追加キーのみ（`ipm_user_motifs_v1`/無視リスト）。既存 levels/tags（motifId キー）は規模拡大でもそのまま。
- 性能：300×1000 はキャッシュ前提。重ければ Worker/分割（段階）。仮想化で大量行を担保。
- curated タクソノミーは段階拡充（まず 150–200 → 300）。トークン品質はレビューで担保。
- ロールバック：data ファイル・新カテゴリ・キャッシュ・発見層は加算的。import 先を戻せば現20要素に復帰。

## 9. 検証計画
- P1：要素数 150+ で motifCounts/未開拓度が算出され、性能が許容内（実測ms）であること。既存20要素時と同じ分析結果が壊れないこと。
- P2：専用画面で 全件(300相当)・検索・ソート(未開拓度含む)・タグ・レベルが動作（仮想化でスクロール軽快）。
- P3：頻出未登録語が候補に出る／昇格で監視集合に加わる／無視で出なくなる。

## 10. 実装状況 — ✅ P1 実装・検証済み（2026-06-06／未コミット）

**変更ファイル**
- `src/data/monitoredMotifs.ts`（新規）：curated タクソノミー **290要素 / 22カテゴリ（＋その他＝順序23）**。A群74（衣装14/髪6/ポーズ6/色10/ライティング6/カメラ6/演出12/小物4/背景10）＋B群216（芸術様式28/建築16/広告表現16/映画表現18/写真表現18/雑誌表現12/世界観20/文化圏14/プロダクト12/素材14/感情トーン12/ジャンル24/時代12）。**既存20IDを全保持**。型は biasAnalyzer から **type-only import**（実行時の循環なし）。export は `MONITORED_MOTIFS` / `MOTIF_CATEGORY_ORDER` のみ。
- `src/lib/biasAnalyzer.ts`：inline 20件配列を撤去し data ファイルから import＋再エクスポート（`historyAnalyzer` の import 先は不変）。`MotifCategory` union＋`categoryColorClass`（Partial<Record>＋フォールバック）を21カテゴリへ拡張。**検出最適化を追加**＝`detectMotifIds(text)`（テキスト/トークンの正規化を各1回）／`detectMotifIdsCached(id,text)`（promptText 不変前提で `version:id` メモ化）。`containsMotif` は不変（API互換）。
- `src/lib/historyAnalyzer.ts`：検出ループを `detectMotifIdsCached` 化、現バッチは `detectMotifIds`。`MotifCount.untappedScore`（0–100＝`100 - ratio×500`、windowSize 0→100）を**全モチーフへ一般化**（従来は genre 専用）。`containsMotif` import は不要化し除去。

**検証**（front `tsc -b` ✅／`vite build` ✅・715 modules・既存と同様／esbuild 束ね Node 実測）
- タクソノミー：count=290・unique=290・dupes=0・既存20ID 欠落0・空トークン/ラベル0・未知カテゴリ0。
- **検出の正しさ**：`detectMotifIds == containsMotif`（複数サンプルで完全一致）＝最適化で結果が変わらないことを確認。
- **性能**（290要素 × 合成履歴1000件）：cold **61ms** / warm（キャッシュ）**20ms**。on-demand 分析として許容内。cold==warm で結果同一（キャッシュは結果不変）。
- 未開拓度：全要素 0–100 妥当。TOP出現（ドレス全般 c300/U0 …）と最未開拓（ストリート系/和装/制服… U100/c0）が想定どおり。`topMotifs`/`untappedGenres`/`aiComment` も健全。

**不変条件の遵守**：検出方式（小文字化＋部分一致）・生成・抽出・保存・適用ロジックは不変。学習は自動適用しない／固定ルール最優先。localStorage 追加なし（P3 で `ipm_user_motifs_v1`）。ロールバックは import 先を戻すだけ。

**残（承認後）**：P2＝分析ラボに 未開拓度 列/ソート＋カテゴリ表示拡張＋仮想化＋未開拓ビュー。P3＝発見層 `detectCandidateMotifs`＋昇格/タグ/無視（userMotifs／無視リスト localStorage）。

## 11. P2 仕様（承認済み 2026-06-06・分析ラボ「未開拓発見」強化）

**ユーザー決定**: 仮想化＝**依存なし・ページング維持**／未開拓ビュー＝**プリセットボタン**／カテゴリ表示＝**色チップ＋順序フィルタ**。

対象は `src/components/AnalysisLabPanel.tsx`（頻出要素タブ）。`untappedScore` は既に `motifCounts`（MotifCount直下）で届いており **prop/配線変更なし**。

1. **未開拓度 列＋ソート**：行に未開拓度バー＋数値（≥80緑＝狙い目／40–79琥珀／<40淡）。`ElemSort` に `'untapped'`、ソートに「未開拓度（高い順）」、比較 `b.untappedScore - a.untappedScore`。
2. **未開拓ビュー（プリセット）**：「🔭 未開拓ビュー」トグル＝ソート未開拓↓＋`untappedOnly`(≥80)フィルタを一発適用（再押下で解除）。有効時、上部に**カテゴリ別「未出現(totalCount=0)」集計チップ**（MOTIF_CATEGORY_ORDER順・多い順）＝新軸探索の入口。
3. **カテゴリ表示**：カテゴリフィルタを **MOTIF_CATEGORY_ORDER 順**に整列（現状 Set 順不同）。カテゴリ列を `categoryColorClass` の**色チップ**化。色被り4組（芸術様式/世界観・色/感情トーン・衣装/ジャンル・小物/時代）の第2要素を未使用色（green/gray/zinc/neutral）へ振替えて完全被りを解消（チップは文字ラベルも持つため軽微）。
4. **一括操作のスケール対応**：「全選択」を `shownElements`(slice後)→`filteredElements`(フィルタ全件)へ。290規模で意図どおり一括NG/タグ可能に（選択件数は表示済みで透明）。
5. **仮想化なし**：`COUNT_OPTIONS=[10,20,50,100,∞]`＋`slice`＋overflow-auto を維持。実測で重ければ段階的に手動windowing（将来）。

**不変条件**: 検出/生成/抽出/保存/適用ロジック不変。localStorage は既存キー流用（追加なし）。学習は自動適用しない／固定ルール最優先。ロールバックは当コンポーネントの追加分を戻すだけ。

### 11.1 P2 実装・検証済み（2026-06-06／未コミット）
**変更**: `AnalysisLabPanel.tsx`（未開拓度列＋バー＋`untapped`ソート、🔭未開拓ビュー＝`untappedOnly`(≥80)＋未開拓↓、カテゴリを `MOTIF_CATEGORY_ORDER` 順＋色チップ、全選択を `filteredElements` 対象化、空表示colSpan/フッタ注記更新）。`biasAnalyzer.categoryColorClass` 色被り4組を未使用色（zinc/gray/green/neutral）へ振替。`historyAnalyzer` は P1 のままで変更なし（`untappedScore` は既存流通）。

**検証**: `tsc -b` ✅／`vite build` ✅。Playwright（隔離プロファイル・合成履歴48件シード→リロード）で実UI確認＝
- 頻出要素タブ「**290**」、ヘッダに**未開拓度**列、🔭未開拓ビュー・未開拓度ソート・カテゴリ順（MOTIF_CATEGORY_ORDER通り）・色チップ（衣装=violet/演出=cyan…）を確認。
- 件数=全件で **290行を描画（クラッシュなし）**。未開拓度はシード頻度に応じ **0/58/69/100** とばらつき（列が実値を反映）。
- 🔭未開拓ビュー＝290→**279行**（≥80のみ）・降順・ボタンactive・「未踏の表現領域」サマリ表示。エラー境界なし。

**End of Doc 28（P1・P2 実装/検証済み・未コミット／P3 未着手）**
