# 23. 参照画像 / 要素抽出パネル 設計（Phase1）

> 目的: 他人の生成画像・参考画像を取り込み、その「良い要素だけ」を抽出して既存のプロンプト生成UIに反映する。
> 方式は [master-plan-v1.md](./master-plan-v1.md) の原則 P1〜P7 に従う（顔・同一性は絶対不変・反映ボタン時のみ適用・未選択は触らない）。

## 0. 決定事項（ユーザー承認済み 2026-06-05）
- 反映方式: **scope ON + 軸タグ付き自由文**（enum詳細欄には自動反映しない）。
- 段階: **Phase1 = UI＋反映配線（抽出は手動入力/スタブ）／Phase2 = Gemini Vision 抽出**。
- 背景/衣装の専用固定トグルは**新設しない**。「適用＝その軸を明示的にONにする操作」とする。ただし**既存の保護ON・未選択保護は必ず優先**。

## 1. アーキテクチャ
```
[新] components/ReferenceImportPanel.tsx（右側 fixed パネル・新規要素）
   入力: DnD / Ctrl+V貼付 / スクショ貼付 / ファイル選択 → サムネ表示
   「画像から要素抽出」: Phase1=手動入力欄を編集（AIはPhase2）
   13カテゴリの編集カード（各 [○○に適用]＋チェック）
   一括: [背景だけ][衣装だけ][ポーズだけ][構図だけ][光だけ][色味だけ][選択項目だけ適用][全解除]
        │ onApplyReference(catKey, text)
        ▼
[既存] App.tsx
   新 state referenceNote: Record<catKey,string>（軸タグ付き自由文）
   生成時マージ（worldCombinedNote と同じ既存パターン・line 538）:
     extraInstructions = [worldCombinedNote, referenceNoteText, extraInstructions].filter(Boolean).join("\n\n")
   適用時: 保護ゲート通過なら setScopes(該当軸 追加) + referenceNote[catKey]=text
```
抽出自由文は **enum 詳細欄には入れない**。scope を ON にし、自由文は軸タグ付きで専用ノート→生成時統合。

## 2. カテゴリ → 反映先マップ（13カテゴリ・顔系は作らない）
| カテゴリ | scope ON | ノート軸タグ | 保護ゲート（適用不可） |
|---|---|---|---|
| 背景 | background | 【背景】 | （専用ロック無し） |
| 衣装 | outfit | 【衣装】 | （専用ロック無し） |
| 髪型 | hair | 【髪型】 | — |
| ポーズ | pose | 【ポーズ】 | bodyPoseLock ON |
| 構図 | camera | 【構図】 | compositionLock ON |
| カメラアングル | camera | 【カメラ】 | compositionLock ON |
| ライティング | lighting | 【ライティング】 | — |
| 色味 | （無） | 【色味】 | colorMoodLock ON |
| 小物 | props | 【小物】 | — |
| 前景演出 | foreground | 【前景】 | — |
| 世界観 | （無） | 【世界観】 | — |
| 質感 | （無） | 【質感】 | — |
| 雰囲気 | （無） | 【雰囲気】 | colorMoodLock ON |
| 顔/同一性/表情/体型 | — | **カテゴリを作らない** | **常に不可（絶対）** |

色味/世界観/質感/雰囲気は対応 scope が無い（enum/moods）ため**自由文ノートのみ**。colorStrategy 等 enum は手動のまま。

## 3. 保護ゲート（既存 state にマップ・App が source of truth）
- 顔・同一性・表情・体型: **カテゴリ自体を作らない**＝適用不能。参照画像の人物コピーもしない。
- bodyPoseLock / compositionLock / colorMoodLock が ON のカテゴリは **[適用] を無効化**（UI disable＋App側でも no-op）。
- 未選択カテゴリは一切変更しない（[適用] を押した軸のみ）。**自動適用なし**。
- 神引き/バズり/好み分析/ZOZO は本機能の反映を上書きしない（別経路・既存のまま）。

## 4. 入力方法（Phase1）
- ドラッグ&ドロップ（onDrop で image File→dataURL）
- Ctrl+V / Cmd+V 貼付（paste イベントの clipboard items から image）
- スクショ貼付（同上・image/png）
- ファイル選択（hidden input[type=file][accept=image/*]）
- サムネイル表示（取り込んだ画像をプレビュー）

## 5. Phase1 範囲（実装する）
右パネルUI / DnD / Ctrl+V / スクショ / ファイル選択 / サムネ / 13カテゴリ編集カード / 手動入力（スタブ抽出）/ 各[適用] / 一括ボタン / `referenceNote` 配線 / scope ON 連携 / 生成時 body 統合 / 保護ゲート。

## 6. Phase2 範囲（今回やらない）
`POST /api/extract-reference`（Gemini Vision）。厳格プロンプトで「背景/衣装/髪/ポーズ/構図/カメラ/光/色/小物/前景/世界観/質感/雰囲気」の短い日本語のみ抽出。**人物の顔・同一性を描写/複製しない・作者名/ロゴ/透かし/固有キャラ名を出さない**。JSON 返却。

## 7. レイアウト
新規追加要素。右側 **position:fixed** のサイドパネル（既存DOM構造・サイズ・余白は不変）。折りたたみトグル付き。既存メインカラム幅は変えない。

## 8. 不変条件（厳守）
分析ロジック / 生成ロジック / Identity Shield / Scope Filter / バックアップ / 履歴保存 / お気に入り保存 / skyveil学習 / 神引き は**変更しない**。`referenceNote` の生成時マージは worldCombinedNote と同型の**追加のみ**。

## 9. 検証
tsc / vite build。実機（隔離オリジン）で「手入力→適用→scope ON・referenceNote に軸タグ付き・生成body統合・ロックON軸は適用不可」を確認。

## 10. Phase2 抽出プロンプト設計（短句素材抽出・確定案）

> 方針: **長文説明ではなく、プロンプト素材として再利用しやすい短句**を優先。
> 例: 背景=「古い映画館構造美」／衣装=「黒レイヤードモード」／光=「寒色斜光」／雰囲気=「都会的退廃美」。

- 各値 = **1〜3 の短句**（目安 4〜16字・名詞句/複合語）。複数は「・」区切り。説明文・句点・長文は禁止。転用要素が無ければ `""`。
- 13キー固定（`REFERENCE_CATEGORIES` と一致）。順序固定・増減禁止。
- 人物/顔/年齢/性別/同一性/特定キャラ/作品/ブランド/作者/ロゴ/透かし/画像内文字は出さない。髪/衣装/ポーズは「スタイル」としてのみ抽出可。

### システムプロンプト（短句版・Gemini Vision へ送る本文）
```text
あなたは画像編集プロンプトツール「Image Prompt Maker」の素材抽出器です。
画像のキャプションを書くAIではありません。参照画像から「別画像に転用できる
スタイル要素」だけを抽出し、13カテゴリ固定の JSON で返します。

# 絶対ルール
- 人物そのもの・顔・目鼻立ち・肌・表情・年齢・性別・人種・体型・個人や特定
  キャラクターの同一性は一切記述しない。
- 実在人物名・キャラ名・作品名・ブランド名・作者名・ロゴ・透かし・画像内文字は出さない。
- 各値は「プロンプト素材として再利用できる短句」にする：名詞句/複合語で 1〜3 個、
  目安4〜16字、複数は「・」区切り。説明文（「〜です」「人物が〜」）や句点は禁止。
  例) 背景:古い映画館構造美 / 衣装:黒レイヤードモード / 光:寒色斜光 / 雰囲気:都会的退廃美
- 髪/衣装/ポーズはスタイルのみ（髪=長さ質感色傾向、衣装=素材シルエット色、
  ポーズ=体の向き/重心の抽象）。個人特定につながる記述はしない。
- 転用要素が無いカテゴリは "" にする。推測で埋めない。
- 出力は JSON のみ。前後に文章・マークダウン・コメントを付けない。

# 各カテゴリ（短句で）
background 場所/空間/奥行き・環境 / outfit 素材シルエット色 / hair 長さ質感色傾向 /
pose 体の向き重心の抽象 / composition 配置・余白・縦横傾向 / camera アングル距離レンズ感 /
lighting 光源方向強さ逆光/リム / color 配色トーン彩度傾向 / props 小物/アクセサリー /
foreground 前ボケ/粒子等の前景演出 / world 世界観時代文化の雰囲気 / texture 質感描画傾向 /
mood 空気感・感情トーン

# 出力フォーマット（このキー・順序で固定）
{"background":"","outfit":"","hair":"","pose":"","composition":"","camera":"","lighting":"","color":"","props":"","foreground":"","world":"","texture":"","mood":""}
```

### レスポンス封筒（拡張前提・後方互換）
```json
{ "version": 2, "elements": { "background": "古い映画館構造美", "outfit": "黒レイヤードモード", "...": "" } }
```
- client は常に `elements`（13キー）を各欄へ流し込む。`version` で段階管理。

### モデル/パラメータ
- gemini-2.5-flash・structured output（responseMimeType=application/json ＋ 13 string プロパティの responseSchema）・temperature 0〜0.3。
- 新 endpoint `/api/extract-reference` のみ。promptSystem/scopeFilter/gemini の既存ロジックは不変。
- サーバ後処理: 13キー以外は破棄／`person`等のキーが来ても無視／極端に長い値は切り詰め。

## 11. Phase3+ 拡張設計（confidence / 複数参照画像）

**いずれも additive・後方互換で拡張できるよう Phase2 を設計しておく。**

- **confidence（抽出信頼度）**: レスポンスに `confidence?: { 13キー: number(0-1) }` を**追加**（Phase2 consumer は `elements` のみ読むので非破壊）。低信頼は薄表示・「選択項目だけ適用」の自動選択から除外。
- **複数参照画像**: endpoint が `images: string[]` を受け、`elements`（軸ごとに代表をマージ）＋ `candidates?: { 13キー: [{ text, confidence, sourceIndex }] }` を返す。UI は軸ごとに候補選択（画像A→背景／画像B→衣装／画像C→ポーズ／画像D→ライティング…）。
- `version` で段階管理。Phase1 の `referenceNote`（catKey→string）モデルは不変のまま、抽出の入り口だけ拡張する。

## 12. 重複分析 / 好み分析 との統合（将来・表示と提案のみ）
- 抽出短句を正規化タグ化 → `biasAnalyzer.MONITORED_MOTIFS` と突合し「この要素は履歴で既に頻出（抑制中）」を**warning 表示**（重複分析連携）。
- `preferenceProfile.preferKeywords/avoidKeywords` と突合し「好み傾向に合う/避けたい」**ヒント表示**（好み分析連携）。
- **自動適用しない（P7厳守）**。短句フォーマットがこれら集計・比較の前提（長文では tokenize/集計が困難）。

## 13. Phase2 実装（Gemini Vision 実連携・2026-06-06・実装済み）

**「Reference Picker（参照ピッカー / 要素抽出）」に改名。仮抽出は廃止。**

- 新規 `server/src/referenceExtract.ts`：`extractReference(imageDataUrl)` が Gemini Vision（gemini-2.5-flash・temperature 0.2・`responseMimeType: application/json`）で参照画像を解析し、13カテゴリ固定JSONを返す。**既存 gemini.ts/promptSystem.ts/scopeFilter.ts は不変**（独立ファイル）。
- 抽出プロンプト：**画像に実際に見える要素だけ**を具体プロンプト素材として抽出。background/outfit/hair/pose/composition/camera/lighting/color は必ず具体化（outfit=色/素材/形/丈/重ね着/トップス/ボトムス/靴/アクセ/シルエット、pose=立ち座り/体の向き/手脚位置/重心/カメラ角度、background=場所/奥行き/壁床窓家具/明るさ/色味）。**画像に無い要素（黒ゴシック/サイバー/青ネオン等）を足さない・別物にしない**。顔/同一性/年齢/人物複製は禁止。サーバ sanitize で13キー固定・空欄許容（でっち上げない）・`missingRequired` 返却。
- 新 endpoint `POST /api/extract-reference`（index.ts）。`backendClient.ts` に `extractReferenceViaBackend`（BUG-11方式のエラー処理）。
- パネルの「✨ 画像から要素抽出」を**実 Gemini 呼び出し**に接続（解析中表示・エラー表示・結果で13欄上書き）。
- 生成への強反映：`referenceNoteText` を **「[参照画像から適用]（以下の要素を最優先で反映する）」見出し＋軸別行**のブロックに整形（extraInstructions 経由・生成ロジック本体不変）。

### 検証（Phase2）
| 検証 | 結果 |
|---|---|
| サーバ `tsc --noEmit` / フロント `tsc -b` / `vite build` | ✅ exit 0 |
| 実 `/api/extract-reference`（合成画像・実Gemini） | ✅ 13キーJSON返却。淡青画像→`background:単色のライトブルー…` `color:ペールブルー低彩度…` を正確抽出。人物無し画像では outfit/hair/pose を**空のまま（でっち上げない）**・missingRequired で通知 |
| 実機 end-to-end（5173・実Gemini抽出） | ✅ 画像→抽出で11欄充填・**黒レイヤード等の捏造なし**→背景適用→scope ON→生成bodyの extraInstructions に **`[参照画像から適用]…背景：単色の明るい青灰色…`** 統合 |

### Phase3+（未実装・docs §11/§12）
confidence / 複数参照画像 / 履歴・好み学習への保存（サムネ・抽出/適用カテゴリ・適用文・生成画像/評価/お気に入りとの関連）・参照画像履歴UI。

**End of Doc 23**
