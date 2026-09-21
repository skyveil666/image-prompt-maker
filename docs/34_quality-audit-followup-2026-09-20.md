# Image Prompt Maker 追加品質調査 — 2026-09-20

この報告は、開始時点で既にあった変更を維持して実施した追加調査を記録する。別の作業で追加された `33_quality-audit-2026-09-20.md` の修正実績とは区別する。

## 現状確認

- 指定フォルダ直下ではなく、`F:\Image Prompt Maker\03_generated_app` が実際のリポジトリ。
- ブランチ `develop`。開始時HEAD `d4dff47`、ahead 1 / behind 0。終了時HEAD `b68bccf`、手元の `origin/develop` に対して ahead 2 / behind 0。未pushは `b68bccf fix: stabilize prompt shortening and result card display` と `d4dff47 fix(custom-instruction): 保留した✏指示がプロンプトに残り続けるバグを修正`。fetch未実施のため最新リモートとの一致は未確認。
- 開始時の未コミット変更: `DetailsCard.tsx`、`PromptCard.tsx`、`PromptTargetSelector.tsx`、`shortenPrompt.ts`。未追跡: `tests/shortenPrompt.test.ts`。既存変更として扱い、上書き・取り消しをしていない。
- 作業中、別操作により上記の既存変更と `docs/33_quality-audit-2026-09-20.md`、`docs/master-plan-v1.md` がステージされ、終了確認時には `b68bccf` としてcommitされていた。本作業はステージ操作、commit、pushを実行していない。今回追加した `PromptCard.tsx` の10行追加・3行削除と本報告書は未コミットで残る。
- `npm run build`、`npx tsc -b`、`npx tsc --noEmit -p server/tsconfig.json` は修正前後とも成功。
- 既存の短縮テスト `server/node_modules/.bin/tsx --test tests/shortenPrompt.test.ts` は6/6成功。下記の未対応形式まで保証するテストではない。
- buildは成功するが、main約871 kB、Camera3DPicker約841 kBのチャンク警告が残る。
- `npm run dev -- --host 127.0.0.1 --port 5197 --strictPort --open false` で起動。4330、4331は使用中だったため停止せず別ポートを使用。
- Playwrightの新規・一時ブラウザコンテキストで検証。`/api/**` は全てモック化し、実Gemini生成・AI分析は呼び出していない。5173、3001の実データには触れていない。APIキーは未読。
- 最終UI検証: console error 0 / pageerror 0。履歴・お気に入り・画像・評価・メモの検証は合成データのみ。
- Git所有者相違は実行時の `-c safe.directory=...` で対応。global設定は変更していない。global ignoreの読み取り警告は環境由来。

### UI確認結果

|対象|結果|
|---|---|
|生成画面・詳細設定|展開・背景指定・NG入力・モック生成を確認|
|背景・NG|水彩画を選択し、ガラス植物ドーム・雪をダブルクリックNG。送信payloadを確認|
|短縮|カード表示545字→277字。個別コピーと表示が一致し、保存原文は545字のまま|
|生成結果カード|合成画像登録、神評価、メモ保存、お気に入り登録が成功|
|履歴・お気に入り|履歴4件、お気に入り1件を別画面で確認。戻る操作も成功|
|Explorer|開閉と空状態を確認。OSのフォルダ選択・実フォルダ読み込みは未検証|
|分析センター・AI仮評価パネル|現コードでは撤去済み。操作対象のUIはない|
|1440px、390px|修正前はカード内の操作列が切れる。修正後は短縮・コピーを含む全ヘッダー操作がカード内に収まり、390pxでページ横溢れなし|
|画像登録のキーボード操作|修正前はEnterで開かない。修正後はEnter・Space両方でファイル選択が開く|

実モデルでの画像生成、顔同一性の保持、ChatGPTの失敗・ブロック率は未検証。モックの「接続中」表示は実API接続確認ではない。

## 発見した問題

P1=優先判断が必要、P2=通常の不具合、P3=表示・整理。

|問題|重要度|対象ファイル・原因|対応|
|---|---|---|---|
|操作ボタンがカード外に切れる|P2|`src/components/PromptCard.tsx`。折り返さないヘッダーと操作列の`flex-shrink-0`、カードの`overflow-hidden`が重なる。Explorer表示時の狭い列・390pxで再現|修正|
|画像登録欄をEnter/Spaceで開けない|P2|同ファイル。`role="button"`と`tabIndex`はあるがキーハンドラーがない|修正|
|神評価のサムネイル枠が通常色になる|P3|同ファイル。`ratingFrameClass`に評価6の分岐がない|修正|
|分析UI非表示でも自動学習する|P1|`src/lib/preferenceProfile.ts:108`の未設定時既定ON、`src/App.tsx:1155`の自動実行が残存。`SkyveilBar.tsx`は`return null`|保留|
|旧分析設定が解除できないまま送信される|P1|`src/App.tsx:340`以降と`buildInputs`。旧`policyApplied`・levels・colorWeightsの読み込みと送信は残る一方、編集UIは撤去済み|保留。コード確認|
|タグNGの大量本文出力|P1|`src/lib/backendClient.ts:63`以降。背景place/style以外を英語化して手動NGへ再合流|保留|
|背景NGが全経路を覆わない|P1|`server/src/promptSystem.ts:1432`以降、`varietyEngine.ts`、`src/lib/quickActions.ts`。適用条件と候補経路に穴|保留|
|改行形式で人体補正を短縮できない|P2|`src/lib/shortenPrompt.ts`。見出しと本文が同じ行の場合だけ圧縮するが、サーバは見出し後の改行を指示|保留|
|短縮時に明示の英語指示を消しうる|P1|同ファイル。`Keep natural`等で始まる英語行をNG以外では所属セクションに関係なく削除|保留|
|全案コピーは短縮表示を使わない|P2・仕様確認|`src/components/PromptList.tsx:241`。全案コピーは各`promptText`原文から作成し、カード内shortModeを参照しない|保留|
|固定対象の変更文をフィルターが通す|P1|`server/src/scopeFilter.ts:177`。文単位に分ける前に「維持」等を含む行全体を保護文として通す|保留|

固定フィルターは `scopes:["hair"]` で次の入力をそのまま返すことを独立に確認した。

```text
【変更】背景を温室に変更。衣装を赤いドレスに変更。顔は維持。
```

結果は `removedItems:[]`、`warnings:[]`、`isSafe:true`。背景・衣装の変更指示が残る。保護中核に関わるため、この関数を変更していない。

## 修正した内容

変更したアプリソースは `src/components/PromptCard.tsx` のみ。

1. ヘッダーに折り返しを追加し、操作列の最小幅と最大幅を制限。短縮・コピー・お気に入り等の操作をカード内に収める。
2. 空の画像登録欄にEnter/Spaceのキーハンドラーを追加。既存のファイル選択関数を呼ぶだけで、登録・保存処理は変更しない。
3. 神評価の画像枠を金色へ統一。

生成ロジック、scope/builder/flagの意味、API、保存形式、DB、履歴・評価の更新処理は変更していない。開始時に存在した短縮ロジック・NG説明・重複key・評価欄の変更は今回の修正実績に含めない。

追加文書はこの報告書のみ。別作業の報告書・master-planは編集していない。

## 修正しなかったもの

- 自動学習: UIが非表示でも既定ONのまま。合成画像5サンプルを保存して再読み込みし、分析ボタン操作0回のまま約26秒以内に `/api/analyze-preferences` への送信1回を確認した。応答はモック。停止は学習フラグ・既存保存設定の扱いに関わるため要承認。
- 好みの自動反映との区別: 現`buildInputs()`は`preferenceProfile`、`ratingBias`、`favoriteTraits`、`favoriteStrength`を送信しない。初期payloadでも未送信。自動学習が残っていることと、好みが自動注入されることは別。
- `resultAiAnalysis`と`resultRatings`は別フィールド。結果AI分析のUI・APIは撤去済みで型は互換用。合成画像の手動評価は`resultRatings:[6]`として保存され、AI分析値は新規作成されなかった。
- 旧分析設定: 過去に反映した`policyApplied`がONならモチーフ等が効き続ける。`colorWeights`はこのゲートに依存せず送られる。既存設定を無効化するか、解除入口を戻すかの判断が必要。無断リセットはしない。
- NG分離: 非背景タグNGを単純に本文から外すと、現状唯一の除外効果も失われる。内部除外をどの軸まで対応するかを決めてから、送信とUI説明を一緒に変更する。
- 背景NG・固定フィルター・短縮仕様: いずれも生成内容や保護の意味が変わるため、再現結果と修正範囲の承認後に対応する。
- 廃止機能: 「この画像でバズる」「1ヶ月生成カレンダー」のUI・handler・専用props・planタブ・専用ファイルは撤去済み。`viralNote.ts`は旧保存値の後方互換処理で現役。`CalendarView.tsx`は履歴閲覧用なので削除しない。共有`viralMode`も残存用途があり削除しない。
- 不要参照: front/serverのnoUnused型検査は成功。main.tsxを起点とする相対importの静的探索で、到達不能なsrcのTS/TSXモジュールは検出されなかった。ただし型参照や非表示コンポーネントを含むため、全てが実行時に必要という保証ではない。非表示SkyveilBarへ渡すprops等は整理候補だが未削除。
- build警告: バンドル分割は大きな構成変更になるため保留。

## プロンプト関連の調査結果

### 通常と短縮の文字数

実利用履歴を読まず、サーバの人体補正文例を含む同一内容の合成プロンプトで比較した。値はJavaScriptの`string.length`で、実モデル出力の平均値ではない。

|入力形式|通常|短縮|差|
|---|---:|---:|---:|
|見出しと人体補正文が同じ行|535|267|268字削減|
|見出しの次行に人体補正文|536|536|変化なし|
|同じ行の形式＋多数のタグNG由来の英語|4,330|4,062|268字削減のみ|

旧`chatgpt_short`は型・出力先選択から撤去され、旧保存値は`settingsPersist.ts:211`で`chatgpt_safe`として読み込まれる。現在の短縮は各PromptCardのローカルstateで、表示と個別コピーにだけ適用される。保存原文、全案コピー、サーバ生成条件は変わらない。

短縮処理の対象は人体補正の一行と特定の英語行だけ。同一性、サイズ・体型、背景2D化、品質、追加指示、NGなどは大半が残る。サーバは7〜11行を目安にするだけで文字数上限を強制せず、同じ人体補正・体型維持を日本語と英語で要求する。固定保護を削る前に、重複する同義文と見出し構造を整理すべき。

`【変更】`の次行にある`Keep natural skin texture`が短縮で消えることも確認した。NGセクション保護の既存修正だけでは、英語の正の指示は守られない。短縮対象を人体補正セクション内の確認済み重複に限定する案があるが、今回未実装。

### NG出力経路

```text
手動ngList / forbiddenTokens
  → splitNg（該当語は肯定誘導としてextraInstructions、残りはngForBlock）
  → applyNgGate
tagNg.background.place/style → ngExclude（別フィールド）
その他tagNg → tagNgToNgTerms → mergeNgLines → payload.ngList
server: payload.ngList ＋ colorStrategyNgAddon → effectiveNg
  → ngBlock → 生成モデルへ【NG】出力を要求
```

- 手動「ピンク」＋温室・雪・衣装casualのタグNGでは、`payload.ngList="ピンク\nsnowy\ncasual"`、`ngExclude.place=["greenhouse"]`となる。
- 各100フィールドから2タグずつ、合計200タグNGの合成例で、手動NGが空でも`payload.ngList`は3,790字・195行となった。英語語句に長さ上限はなく、行単位の重複排除のみ。
- 手動NG空・タグNG空・色戦略の追加NGなしなら、サーバは【NG】省略を指示する。ただし実生成後の出力から空セクションを確実に除く後処理ではない。
- 手動NGが空でも、非背景タグNGや`no_blue/no_purple/no_pink/no_transparent`の色戦略によるNG追加があれば空にならない。
- 手動NGの肯定変換は部分一致。例えば「室内」は屋外方向の追加指示へ変わるため、固定背景との矛盾も別途レビュー対象。

### 背景の確定・NG漏れ

1. clientの世界観・プリセットbuilderが先に`details.background.place`やノートを決める経路がある。`quickActions.ts`に`greenhouse`や`night_amusement`を選ぶ定義が残る。これら自体は廃止済みバズ機能専用ではない。
2. 送信時にタグNGから`ngExclude`を作るが、ここでは既に選ばれた詳細や追加指示を除去しない。
3. serverの`varietyEngine`は一部ジャンルをNGで除外する。ただし別のsurprise候補に「自然（植物・水・雪）と人工…」等があり、同じNGフィルターを通らない。
4. `promptSystem.ts`は場所とスタイルの**両方がauto/skip**の時だけ背景除外の説明を組み立てる。場所auto・スタイルwatercolorでは、温室等の`ngExclude`あり／なしで`buildSystemPrompt`出力が完全一致した（plan未指定で比較）。ジャンル抽選側の除外は別途存在するが、この詳細指示側では伝わらない。
5. 両方autoでも、禁止場所の具体名はモデルに渡さず「一部の背景を除外」とだけ説明する。候補の文字列除去も完全一致で、forest NG時に「森」は消えても「霧の森」が積極採用候補に残る。
6. 雰囲気の`venue_greenhouse`を選ぶと、温室NGがあっても「温室・植物に囲まれたガラス建築…」が正の指示に残る。

clientだけで衝突を検出しユーザーへ知らせる案はあるが、serverで生成される候補すべての除外はclientだけでは保証できない。§4とvarietyEngineを含めた範囲の判断が必要。`promptSystem.ts`は変更していない。

ChatGPT側のブロック原因は実モデル未検証のため断定しない。長いNG列、正負の背景指示の競合、繰り返す人体補正、不要な英語補足は出力の不安定さを調べる候補。安全要件や顔保護を弱めるための短縮は提案しない。

## 残タスク

- すぐ判断したいもの: 非表示UIの自動学習停止、固定対象の変更フィルター、タグNGの内部除外化、短縮が明示指示を消す条件。
- 次に対応: 背景候補の全経路での除外、複数行短縮対応、全案コピーの扱い、解除入口のない旧分析設定。
- 保留でよいもの: 共有・互換コードの整理、バンドル分割、廃止機能に関する古い文書の整理。
- ユーザー判断: 非背景タグNGの対応軸、過去の反映設定を維持するか、短縮をカード単位の表示機能として続けるか、§4・保護フィルターの変更範囲。

## commit案

メッセージ案: `fix(ui): プロンプトカードの操作欄と画像登録操作を修正`

- 含める候補: 今回の`src/components/PromptCard.tsx`の4差分（コメントと神枠色、キーハンドラー、ヘッダー折り返し、操作列幅）、この追加報告書。
- 別扱い: 開始時からの4ファイル・テストの変更、別作業の`docs/33_quality-audit-2026-09-20.md`・master-plan更新は、終了時には別操作の`b68bccf`へ入っている。本作業の差分と混同しない。
- 含めない: dist、node_modules、検証用`.audit-20260920`配下の合成データ・スクリーンショット・一時スクリプト。保存データ・APIキーは対象外。
- 承認前のcommit / pushは実施しない。既存ステージ内容も変更していない。

検証記録はリポジトリ外の `F:\Image Prompt Maker\.audit-20260920` に保存。`logic-results.json`、`ui-results.json`、各スクリーンショットは合成データによる証拠。今回起動した5197の開発サーバと検証ブラウザは停止済み。
