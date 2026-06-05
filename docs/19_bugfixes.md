# 19. バグ修正記録

> 3エージェントによるコードレビューで検出した実バグの修正記録。
> 各修正は分析結果・生成挙動を変えない「安全グループ」と、挙動が変わる「保留グループ」に分類。
> 依拠: [master-plan-v1.md](./master-plan-v1.md)

---

## 1. 安全グループ（2026-06-04 実施・分析結果/生成挙動を変えない）

### BUG-1: `buildInputs` の stale closure（最新の学習/分析が反映されないことがある）

- **症状**: scopes/details 等を変えずに「好み分析を更新」や自動学習で `preferenceProfile` が更新された直後に生成すると、古い `preferenceProfile` / `ratingBias` / `imageBias` が送信される（最新が反映されない）。
- **原因**: `buildInputs`(useCallback) が `preferenceProfile`/`ratingAnalysis`/`imageAnalysis` を参照するが、これらは buildInputs より後方宣言で依存配列に入れられず（TDZ）、クロージャが古い値を保持。
- **修正**: 既存の `skyveilProfileRef` と同じ ref 同期パターンを導入。
  - `preferenceProfileRef` / `ratingAnalysisRef` / `imageAnalysisRef` を buildInputs 直前に宣言。
  - buildInputs 内の参照を `*.current` に変更。
  - `useEffect` で各 state → ref を同期（[App.tsx]）。
- **挙動変更**: なし（送る値が「古い」→「最新」になるだけ。ゲート条件 favoriteLearnEnabled/skyveilOneShot/policyApplied は不変）。

### BUG-2: サーバ `bgDiversityBlock` が `details` 欠落で 500 クラッシュ

- **症状**: `scopes:["background"]` かつ `details`（または `details.background`）が undefined のとき HTTP 500。到達経路＝古い履歴の再生成・不正 API 入力。
- **原因**: [promptSystem.ts:3201] `const b = req.details.background;` が optional chaining なし（他は `safeDetails` 保護済み）。
- **修正**: `req.details?.background` ＋ `if (b && ...)` に変更。未指定時は早期 return せず通常の背景多様性ガイドへ（安全側の既定）。
- **検証**: tsx で details=undefined / {} とも例外なし（プロンプト生成成功・len=9505）。
- **挙動変更**: なし（正常な details 入力では従来と同一）。

### BUG-6: `useAnalysisLive` 戻り値の未メモ化 → effect 過剰再実行

- **症状**: 戻り値オブジェクトが毎レンダリング新参照になり、依存する `startImageAnalysis`/`runBiasAnalysis`/`runGenerate`/`handleGenerate` 等が毎回再生成。自動画像解析の debounce がスターブし得る。
- **原因**: [useAnalysisLive.ts] `return { ... }` を useMemo で包んでいなかった（各メソッドは useCallback で安定）。
- **修正**: 戻り値を `useMemo` で安定化（deps＝state＋各メソッド）。state 変化時のみ新参照になる。
- **挙動変更**: なし（アイドル時の不要な再生成を抑制するパフォーマンス改善のみ）。

### BUG-7: `analyze-preferences` の `createdAt` 範囲外で 500（RangeError）

- **症状**: サンプルに `createdAt: 1e22` 等（有効 JSON 数値）があると `new Date(x).toISOString()` が RangeError → 分析全体が 500。
- **原因**: [index.ts] `typeof s.createdAt === "number"` のみで範囲未検証。
- **修正**: `Number.isFinite` ＋ `0 <= x <= 8.64e15`（Date 有効範囲）を満たす数値のみ採用、他は `Date.now()`。
- **検証**: tsx で 1e22/NaN/Infinity/-1/範囲外 → Date.now() フォールバック、有効値は通過、`toISOString()` は常に成功。
- **挙動変更**: なし（正常な timestamp は従来通り）。

### BUG-8: IndexedDB `open` の `onblocked` 未処理 → 複数タブ更新時にハング

- **症状**: 別タブが旧バージョンの DB を開いたままだと `open` が blocked で永久保留し、全 DB 操作が固まる。
- **原因**: [idb.ts] `indexedDB.open` に `onblocked` ハンドラなし。
- **修正**:
  - `onblocked` → `dbPromise=null` ＋ 明示的 reject（永久ハング回避・他タブを閉じれば次回リトライ可）。
  - `onsuccess` で `db.onversionchange` → 自タブの接続を close（自分が他タブのアップグレードのブロック源にならない）。
- **挙動変更**: なし（単一タブの通常利用では影響なし。多タブ更新時のハングを回避）。

### 検証

| 検証 | 結果 |
|---|---|
| フロント `tsc -b --noEmit` | ✅ exit 0 |
| サーバ `tsc --noEmit` | ✅ exit 0 |
| `vite build` | ✅ exit 0 |
| サーバ tsx 動作確認（BUG-2 / BUG-7） | ✅ クラッシュ解消 |
| 起動回帰（ブラウザ） | ✅ コンソールエラー 0 件・主要UI（GPB/AI分析/skyveil/反映状態/生成）描画OK |

---

## 2. レビュー後グループ（2026-06-04 ユーザー判断で実施）

判断: BUG-3A 実施 / BUG-3B 見送り / BUG-4 は C案（ストップワード方式） / BUG-5 実施。

### BUG-3A: 自動学習ループ防止（分析結果は不変・不要な再分析のみ防止）

- **問題**: クライアントの `profileSampleCount`（無上限）と、サーバ `slice(0,100)` で頭打ちの `preferenceProfile.sampleSize` を比較して「新規評価数」を出していたため、評価100件超で `newSamples` が常に閾値超→自動分析が止まらない素地。
- **修正**: サーバ返却の sampleSize に依存せず、**クライアント側の「前回分析時サンプル数」を localStorage に永続**（`ipm_autolearn_last_count_v1`）して差分判定。
  - [preferenceProfile.ts] `loadAutoLastCount` / `saveAutoLastCount` を追加（localStorage ヘルパ）。`clearPreferenceProfile` でマーカーもリセット。
  - [App.tsx] 自動学習トリガーの基準を `loadAutoLastCount()` に変更。分析成功時（auto/manual）に `saveAutoLastCount(samples.length)`。
- **不変**: `collectSamples` / `analyzePreferences` / Gemini 分析・しきい値定数は無変更。**発火タイミングのみ是正**（分析結果は変わらない）。
- **見送り（BUG-3B）**: 「最新100件ソート」は分析対象が変わるため別タスク。

### BUG-4: 色分析の誤検出を C案（ストップワード方式）で除去

- **修正**: [colorAnalyzer.ts] 色マッチ直前に「誤検出元のホスト語」を除去。`COLOR_FALSE_POSITIVE_WORDS = [rosemary, instant, important, constant, distant]` を境界付きで除去してから `COLOR_REGEX` を適用。
- **方針**: 全面境界化（A）は不採用。`golden→gold` / `grayscale→gray` / `bluish→blue` 等の**正当な複合語マッチは温存**。
- **検証（実 colorAnalyzer 使用）**:
  - `rosemary`/`instant`/`important` を含む文 → **brown(茶)・pink(桃) の誤検出が消失** ✅
  - `golden`/`grayscale` を含む文 → **yellow(金)・gray(灰) は維持** ✅
  - `navy blue`/`黒` → 正常維持 ✅
- **拡張**: 誤検出語が増えたら配列に追加するだけ。

### BUG-5: 画像分析「反映中」バナーの日英軸不一致（表示のみ）

- **問題**: imageAnalyzer の `axis` は日本語（背景/衣装/髪型/カメラ/ライティング）、`activeScopes` は英語（background/...）で `scopeSet.has()` が常に false → スコープ内でも「未反映（変更対象外）」と誤表示。
- **修正**: [DuplicateAnalysisPanel.tsx] 日本語軸→英語scopeキーの `IMG_AXIS_TO_SCOPE` マップを追加し、`axisInScope` で変換して判定。
- **不変**: 表示専用。サーバ送信 imageBias は別経路（App.tsx buildInputs）で**不変**。分析・生成結果に影響なし。

### 検証（レビュー後グループ）

| 検証 | 結果 |
|---|---|
| フロント `tsc -b` / サーバ `tsc` / `vite build` | ✅ すべて exit 0 |
| BUG-4-C 実 colorAnalyzer 前後比較 | ✅ 誤検出除去・正当語温存 |
| 起動回帰（ブラウザ） | ✅ コンソールエラー 0 件 |
| 分析ロジック本体（collectSamples/analyzePreferences/colorAnalyzer のマッチ規則・imageAnalyzer） | ✅ 規則は不変（BUG-3A=発火タイミング / BUG-4=入力前処理 / BUG-5=表示のみ） |

---

## 3. 追加修正（Phase 4 以降）

### BUG-11: `generateViaBackend` のエラーパスで Response body 二重読み（"body stream already read"）

- **症状**: サーバが `!ok` を返した時、画面に `Failed to execute 'text' on 'Response': body stream already read` が表示され、本来のサーバエラー内容が完全に隠れる。
  - 典型ケース: API サーバ（:3001）が未起動 → Vite proxy が非 JSON エラー（HTML 等）を返す状況。
- **原因**: [backendClient.ts:64-72] のエラーハンドラが、`res.json()` 失敗時の catch 内で再度 `res.text()` を呼んでいた。Fetch 仕様上 `res.json()` は parse 失敗でも body stream を消費しロックするため、続く `res.text()` は必ず DOMException を投げる。
- **修正**: body を 1 回だけ読む方式に変更。先に `res.text()` で生本文を取り、JSON ならパースして `error` フィールドを取り出す。JSON でなければ生テキストをそのまま `detail` として使う。
- **影響範囲**: `src/lib/backendClient.ts` の `generateViaBackend` のエラーパスのみ。正常系（`res.ok=true`）は無変更。
- **同類バグの調査**: 同ファイル内の `checkBackendHealth`（成功パスのみ）・`analyzePreferencesViaBackend`（catch が noop）には二重読みなし。他の fetch サイトでも未発見。
- **修正後に表面化する効果**: 真のサーバエラー（status code + 本文）が表示されるようになる。例: `Backend error (502): <html>...</html>`（サーバ未起動時）、`Backend error (500): {"error":"..."}`（Gemini エラー時）。
- **挙動変更**: なし（正常系不変・エラー表示の正確性向上のみ）。

### 検証（BUG-11）

| 検証 | 結果 |
|---|---|
| フロント `tsc -b --noEmit` | ✅ exit 0 |
| `vite build` | ✅ exit 0（既存のチャンクサイズ警告のみ） |
| API サーバ `/api/health` 起動後到達 | ✅ `{"ok":true,"model":"gemini-2.5-flash"}` |
| 実機（生成リトライ） | （ユーザー確認待ち） |

---

## 4. リリース前監査の修正（P1・安全分のみ／2026-06-05）

> 9領域・15エージェントのバグ総点検（読み取り専用）で検出した P1 のうち、**非破壊で安全な4件のみ**実施。
> 保留: P1-4（ScopeFilter の cosplay/cyber 過剰削除）・P1-5（oneShot 解除漏れ）は未着手（ユーザー指示）。

### BUG-12: `selectionHistory`（選択範囲プロンプト履歴）がバックアップ対象外（P1-1）

- **症状**: `exportBackup` が selectionHistory ストアを含まず、書き出しても復元手段がない＝ブラウザデータ消去・origin変更・DB破損で完全消失。
- **修正**: `AppBackup` を version:2 に拡張し `selectionHistory?` を追加。export で `listSelectionHistory()` を含め、import で `mergeSelectionHistory()`（id重複スキップの非破壊マージ）を呼ぶ。
- **影響範囲**: [backup.ts](../src/lib/backup.ts) / [selectionHistory.ts](../src/lib/selectionHistory.ts) に `mergeSelectionHistory` 追加。

### BUG-13: Explorer お気に入り画像（miniExplorerDB.exFavs）がバックアップ対象外（P1-2）

- **症状**: 別DB miniExplorerDB の exFavs が export 対象外。RecoveryPanel は件数表示するのに守られない不整合。
- **修正**: `AppBackup` に `explorerFavorites?` を追加。export で `listExplorerFavorites()`、import で `mergeExplorerFavorites()`（id重複スキップ・既存上書きなし）を呼ぶ。
- **影響範囲**: [backup.ts](../src/lib/backup.ts) / [miniExplorer.ts](../src/lib/miniExplorer.ts) に `mergeExplorerFavorites` 追加。

### BUG-14: `settings` がエクスポートに含まれるのにインポートで復元されない（P1-3）

- **症状**: export は localStorage 全キーを書き出すが import で書き戻さない＝PC移行・障害復旧で設定が戻らない。
- **修正**: `importBackup(file, { restoreSettings })` を追加。**opt-in（既定 false）時のみ** localStorage を復元（無断上書き回避）。RecoveryPanel に「設定も復元する（上書き・要再読み込み）」チェックボックスを追加。HistoryView 側の import は従来どおり設定に触れない（安全側）。
- **P7配慮**: 復元は明示同意（チェックボックス）が前提。自動適用経路は作らない。
- **影響範囲**: [backup.ts](../src/lib/backup.ts) / [RecoveryPanel.tsx](../src/components/RecoveryPanel.tsx)。

### BUG-15: MiniExplorer の検索・お気に入りフィルタが効かない（useMemo 依存配列欠落／P1-6）

- **症状**: `displayImages` の useMemo 依存配列に `query`/`favOnly`/`favNames` が無く、検索入力や「★お気に入りのみ」がグリッドに反映されない。
- **修正**: 依存配列に `query, favOnly, favNames` を追加。表示ロジックのみ・分析/永続化/保護ルールへの影響なし。
- **影響範囲**: [MiniExplorer.tsx](../src/components/MiniExplorer.tsx)。

### 検証（BUG-12〜15）

| 検証 | 結果 |
|---|---|
| フロント `tsc -b --noEmit` | ✅ exit 0 |
| サーバ `tsc --noEmit` | ✅ exit 0 |
| `vite build` | ✅ exit 0（既存のチャンクサイズ警告のみ） |
| 実機 復元テスト（隔離オリジン:5199・実コード・実IndexedDB） | ✅ **19/19 全パス** |

実機テスト内容（実データ:5173 には非接触）: v2新規追加＋重複スキップ／isFavorite保持／settings復元はopt-in時のみ（既定では localStorage 不変）／v1後方互換／不正ファイル拒否／既存データ非破壊（上書きなし）。

- **絶対禁止コード不使用**: deleteDatabase / localStorage.clear / store.clear は追加していない。全経路 id重複スキップの追加マージ。settings復元のみ opt-in 上書き。

### BUG-16: 「今回だけ反映」(oneShot) が handleGenerate 以外の生成経路で解除されない（P1-5）

- **症状**: `skyveilOneShot` を消費する処理が handleGenerate の1箇所([App.tsx:859]旧)にしか無く、`runGenerate` を直接/`pendingRun` 経由で呼ぶ他経路（バリアント/アレンジ/復元再生成/リロール/安全寄り再生成）では解除されず、好みプロファイルが意図せず後続生成に反映され続けた。P7（自動適用禁止）非該当・P6契約（1回で消費）違反。
- **修正**: oneShot の消費を**全生成経路の単一の出口 `runGenerate` の冒頭**に集約（`setSkyveilOneShot(false)`）。`inputs` は呼び出し側で `buildInputs()` により確定済みのため、当該生成への適用は維持され、次回以降だけ OFF になる。handleGenerate の重複解除を削除し依存配列を整理。
- **影響範囲**: `src/App.tsx` のみ（runGenerate 冒頭1行追加＋handleGenerate 1行削除・deps整理）。scopeFilter/promptSystem/分析系は不可触。
- **条件遵守**: buildInputs() 完了後に解除／buildInputs() 前では解除しない。

### 検証（BUG-16）

| 検証 | 結果 |
|---|---|
| フロント `tsc -b --noEmit` | ✅ exit 0 |
| サーバ `tsc --noEmit` | ✅ exit 0 |
| `vite build` | ✅ exit 0 |
| 実機 MAIN 経路（直接 runGenerate） | ✅ 武装→生成でボディに preferenceProfile 送信、生成直後に「予約中」バッジ消滅＝1回で消費 |
| 実機 VARIANT 経路（pendingRun→runGenerate） | ✅ 武装なし生成は profile 非送信／武装→別案生成で profile 送信＋バッジ消滅＝1回で消費 |
| 他4経路（復元・リロール=直接 / アレンジ・安全再生成=pendingRun） | ✅ 上記2機構と同一の runGenerate シンクに到達（コード確認）。consumption は経路非依存 |

実機テストはユーザー実データ(5173)に非接触の隔離オリジン(5200・空DB)で実施。生成は fetch スタブ（Gemini非依存）。生成経路の網羅は grep で全 `runGenerate`/`pendingRun` 起点を確認済み。

### BUG-17: ScopeFilter が cosplay/cyber の衣装変更を「衣装OFF」として誤削除（P1-4 系統A）

- **症状**: `outfit` を選ばず `cosplay` または `cyber`(機械化) のみ選択した生成で、`deriveServerLocks` が cosplay/cyber を変更カテゴリに写像していないため `protectedTargets.outfit=true` となり、cosplay の衣装語彙（メイド服/ドレス/鎧 等）・cyber の「衣装の一部」が `applyServerScopeFilter` で「衣装OFFのため削除」され、ユーザー指定の中核変更が最終出力から消えていた。
- **修正（系統Aのみ・段階導入）**: `deriveServerLocks`（[scopeFilter.ts](../server/src/scopeFilter.ts)）に `outfitChange = has("outfit") || has("cosplay") || has("cyber")` を導入し `changeTargets.outfit`/`protectedTargets.outfit` に適用。front [promptLockCheck.ts](../src/lib/promptLockCheck.ts) の `deriveLockState` も同ロジックで同期（PromptGuard表示一致／監査P3-2も解消）。
- **不変（重要）**: 背景・顔・同一性・表情・体型・他軸の保護判定は**一切変更していない**。背景保護ロジックには触れていない。
- **保留（Phase-B）**: myth/vehicle/big_object の配置記述が「背景」を含み背景OFF時に削られる件（系統B）は**未実装・仕様検討へ**。背景ロックとの意味的衝突のため別途方針決定。

### 検証（BUG-17）

| 検証 | 結果 |
|---|---|
| 純関数ユニット T1〜T6＋D1〜D4（`applyServerScopeFilter`/`deriveServerLocks`） | ✅ **10/10 PASS** |
| フロント `tsc -b --noEmit` / サーバ `tsc --noEmit` / `vite build` | ✅ すべて exit 0 |

T1 cosplay衣装残る／T2 cyber衣装残る／T3 無選択は衣装削除（退行なし）／T4 cosplay時も背景削除（背景保護維持）／T5 顔削除（顔保護不変）／T6 hairのみ時は衣装削除（退行なし）。テストは一時ファイルで実施し検証後に削除。

### 重複分析センター フリーズ対策（F1/F2/F4 + BUG-18）

リリース前監査の延長で「重複分析センターのタブ押下でフリーズ」を実測調査。**2系統**を確認し対処した。

**F1/F2/F4（解析中の再レンダー負荷削減・スケジューリング/描画のみ・分析結果不変）**:
- F1: 画像解析の進捗 setState を10枚ごとに間引き（136回→14回・90%削減）。[App.tsx](../src/App.tsx) `startImageAnalysis` の onProgress。
- F2: `DuplicateAnalysisPanel` を `React.memo` 化＋props安定化（インラインλを useCallback 化）。
- F4: 解析中UI（`AnalyzingBar`＝進捗バー・キャンセル・タブ非ブロック）。`onCancelImageAnalysis`/`cancelImageAnalysis` 追加。

**BUG-18: 画像分析タブの useEffect 無限ループ（フリーズの主因）**:
- **症状**: 画像分析タブを開くとフリーズ。隣の評価集計も巻き添えで無反応（メインスレッド飽和の二次症状）。色分析等は正常。
- **原因**: `useAnalysisLive` の戻り値が `useMemo([state, …])` で **state 更新ごとに identity が変化**（[useAnalysisLive.ts:189](../src/lib/useAnalysisLive.ts:189)）→ `startImageAnalysis`（dep に `analysisLive`）も不安定化 → 画像タブ effect が `onStartImageAnalysis` を dep に持つ（[DuplicateAnalysisPanel.tsx:1481]旧）→ effect が `analysisLive.start()` を呼ぶ→state更新→identity変化→**effect再発火**の無限ループ。
- **修正（effect の発火条件のみ）**: latest-ref パターン。画像タブ effect の dep を `[tab, expanded]` に縮小し `onStartImageAnalysis` は ref 経由に。App の自動画像解析 effect も同様に `startImageAnalysis` を ref 経由化（dep を `[recentItems, imageFeatureMap]` に）。
- **不変**: 分析ロジック・重複率・好み分析・神引き・学習エージェント・保存データ・`useAnalysisLive` 本体・`startImageAnalysis` 本体は一切変更なし。
- **影響範囲**: [DuplicateAnalysisPanel.tsx](../src/components/DuplicateAnalysisPanel.tsx)（主）/ [App.tsx](../src/App.tsx)（補助）の effect 依存配列のみ。

### 検証（F1/F2/F4 + BUG-18）

| 検証 | 結果 |
|---|---|
| フロント `tsc -b --noEmit` / サーバ `tsc --noEmit` / `vite build` | ✅ すべて exit 0 |
| F1 進捗 setState 回数（136枚・実測） | 136回 → **14回**（90%削減） |
| BUG-18 ループ遮断（React依存比較セマンティクス・50回churnシミュレーション） | 修正前 **50回** → 修正後 **1回**（`loop_broken: true`） |
| タブ切替（dup→image→pref→color→image） | image を開いた2回のみ発火・他タブは正常切替 |

実機の最終確認（画像タブ→他タブ即切替）はユーザー環境（実データ）で実施。

---

## 5. 検証して「問題なし」だった主な誤検知（誤修正防止）

analysisStamps の無限ループ／30秒ticker のクリーンアップ／M-2スクロールeffect／settingsPersist の保存漏れ／各種ゼロ除算（ガード済み）／pref タブ縮小後の null 参照／localStorage の JSON.parse（try-catch）／JSX 構造／lockLineJa（空配列 early return）／applyIdentityShield のクランプ／varietyEngine の循環埋め — いずれもバグなし。

---

**End of Doc 19**
