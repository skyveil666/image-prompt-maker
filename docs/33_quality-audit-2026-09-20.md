# Image Prompt Maker 品質調査 — 2026-09-20

## 現状確認

- 指定フォルダ `F:\Image Prompt Maker` 自体は Git リポジトリではない。実対象は `03_generated_app`。
- ブランチ: `develop`。開始時 HEAD: `d4dff47`。開始時の未コミット差分なし。
- 手元の `origin/develop` に対して ahead 1 / behind 0。未pushは `d4dff47 fix(custom-instruction): 保留した✏指示がプロンプトに残り続けるバグを修正`。fetch はしていないためリモートの現在状態までは未確認。
- Git の所有者相違は対象コマンドだけの `-c safe.directory=...` で対応。global 設定は変更していない。ユーザーの global ignore への読み取り警告あり。
- `npm run build` / `npx tsc -b` / `npx tsc --noEmit -p server/tsconfig.json`: 修正前・修正後とも成功。
- build 警告: 500 kB超のチャンク2本（最終 main 約871 kB、Camera3DPicker 約841 kB、非gzip）。失敗ではない。分割は今回は実施しない。
- `node --import ./server/node_modules/tsx/dist/loader.mjs --test tests/shortenPrompt.test.ts`: 6/6成功。
- `npm run dev -- --host 127.0.0.1 --port 4330 --strictPort` と本番 preview（4331）で起動確認。
- `CLAUDE.md` の実データ保護方針に従い、5173の実データ画面は開かず、Playwrightの新規ブラウザコンテキストと別ポートで検証した。全 `/api/**` をモック応答し、実Geminiへの生成・分析は呼んでいない。APIキーも読んでいない。
- 最終の開発版・本番版の確認操作では新規console error / pageerrorなし。修正前には同一結果画像の重複登録でReactの重複key警告を再現した。
- 保存形式・DBバージョン・既存履歴・お気に入り・評価データに変更なし。実データの初期化・削除、commit / push はしていない。

### UIで確認した範囲

|画面・操作|結果|
|---|---|
|生成画面・詳細設定|展開・折りたたみ・案数変更・モック生成を確認|
|背景・NG設定|場所と天候タグのダブルクリック、選択解除、送信payloadを確認|
|ChatGPT短縮|生成結果カードのチェックボックス。表示とコピーは同じ271字、保存原文は668字のまま|
|履歴・カレンダー|モック生成案が表示される。履歴から戻る操作も確認|
|お気に入り|カードで登録→一覧表示→再読み込み後も保持|
|生成結果・評価|画像登録、同一画像3枚、画像ごとの評価、コピー状態の保存を確認|
|Explorer左メニュー|開閉・空状態を確認。実フォルダ選択やOSの権限ダイアログは未検証|
|分析センター・結果画像AI分析パネル|現コードでは撤去済み。ボタンと実行UIは存在しない|
|1440px / 390px|主要画面を確認。結果カード評価欄の縦崩れを修正。確認画面のページ横溢れ0px|

実モデルの出力品質、顔同一性、ChatGPT側の生成失敗・ブロック率は未検証。以下はコード・モック送信・純関数の再現結果であり、実画像の生成成功を保証するものではない。

## 発見した問題

P1=優先して判断・対応、P2=通常の不具合、P3=表示・整理。

|ID / 重要度|問題・原因|対象|対応|
|---|---|---|---|
|A01 / P1|背景・衣装固定の最終フィルターをすり抜ける。行内に「維持」があれば、別の文の変更指示も行ごと通す|`server/src/scopeFilter.ts:79,177`|保留。保護中核の意味変更が必要|
|A02 / P1|好みAIのUIは非表示でも自動分析・保存が動く。自動学習の既定ON、評価5件・20秒デバウンスで実行|`src/App.tsx:1036,1155`、`src/lib/preferenceProfile.ts:108`、`SkyveilBar.tsx`|保留。フラグと学習仕様の判断が必要|
|A03 / P1|過去の分析反映ON設定が送信に残る一方、現在の画面に反映・解除入口がない|`src/App.tsx:344,603,625`、`src/lib/motifPolicy.ts:85`|保留。旧設定をどう扱うか要判断|
|A04 / P1|場所・スタイル以外のタグNGが英語列へ変換され、手動NGと合流して大量出力される|`src/lib/backendClient.ts:63–88`、`src/data/tagNgOptions.ts`|保留。単純削除は現在の除外効果も失わせる|
|A05 / P1|背景NGが全候補経路を覆わない。雰囲気、追加指示、固定場所、抽選の補助指示から再流入する|`server/src/promptSystem.ts:174,540,1390,1437,3330`、`server/src/varietyEngine.ts:139,259`|保留。§4と候補除外の設計変更が必要|
|A06 / P2|短縮をONにすると短い人体補正文が長い定型文に置き換わる|`src/lib/shortenPrompt.ts:57`|修正済み。短くなる場合だけ置換|
|A07 / P1|複数行NGの継続行が英語補足扱いで消える。見出し行だけの保護が原因|`src/lib/shortenPrompt.ts:49`|修正済み。NGセクション全体を保護|
|A08 / P2|同じ結果画像を複数登録すると評価行のReact keyが衝突|`src/components/PromptCard.tsx:322`|修正済み。画像位置もkeyに含める|
|A09 / P2|390px幅で結果画像の横に評価欄が押し込まれ、ボタン・説明が縦に潰れる|`src/components/PromptCard.tsx:282`|修正済み。狭い幅では評価欄を折り返す|
|A10 / P3|「グリッドではNG指定できない」「NG適用は準備中」「評価は次回生成に反映」の表示が実装と不一致|`DetailsCard.tsx:1726,2019`、`PromptCard.tsx:389`|修正済み。現動作に合わせた説明へ|
|A11 / P3|出力先のtooltipに旧名称DALL-Eが残る。短縮関数のコメントが450〜600字を保証するように読める|`PromptTargetSelector.tsx:27`、`shortenPrompt.ts:5`|修正済み|
|A12 / P2・仕様確認|結果画像の差し替え時、同じ位置の旧評価・メモ・AI分析情報が引き継がれる。別画像として評価を維持すべきか未確定|`src/components/PromptCard.tsx:497`|保留。コード上の挙動を確認。保存情報を勝手に消さない|

### A01の決定的な再現

`scopes: ["hair"]`（背景・衣装は変更対象外）で `applyServerScopeFilter()` に渡す:

```text
【変更】背景を温室に変更。衣装を赤いドレスに変更。顔は維持。
```

結果は原文のまま、削除0件、警告0件、`isSafe: true`。末尾の「顔は維持。」を取り除くと背景・衣装の2件が削除される。`isProtective(line)` を文分割より先に実行することが原因。保護語を含む行全体ではなく、軸・文ごとに保護と変更を判別する案を推奨するが、否定文を壊す危険があるため今回未実装。

### A02・A03の再現と自動反映の区別

- A02: 新規隔離オリジンに評価済みの合成画像5件を追加→再読み込み→ボタンを押さずに待つと、`/api/analyze-preferences` へ5サンプルが送られ、モック結果が `ipm_preference_profile_v1` に保存された。分析・自動学習のUIボタンは0件。
- ただし通常生成の `buildInputs()` は `preferenceProfile / ratingBias / favoriteTraits / favoriteStrength` を `undefined` にしている。**自動学習は残存、自動の好み注入は停止**という状態である。
- A03: 隔離環境で旧保存値 `ipm_motif_policy_applied_v1="1"` と `ipm_motif_levels_v1={"gothic_black":0}` を再現すると、生成payloadに `motifControls:[{label:"黒ゴシック衣装",level:0}]` が入った。反映UIは撤去済み。過去に明示反映した設定の継続であり、新規状態で勝手にONになるという意味ではない。
- 自動の画像特徴抽出も残る（`App.tsx:1253`、1.5秒後）。これはローカル集計で、結果画像のAI仮評価とは別処理。
- `resultAiAnalysis` と `resultRatings` は独立フィールド。既存AI分析情報は互換用に残る。合成履歴5件でユーザー評価・旧AI分析値が再読み込み後も各5件保持されることを確認。
- ZOZOは `zozoApplied` があり、衣装が変更対象の場合のみ送信。神引き補助は選択済み `activeBoosts` のみ送信。初期payloadにはこれらの自動注入なし。

## 修正した内容

|変更ファイル|変更内容・影響範囲|
|---|---|
|`src/lib/shortenPrompt.ts`|短い人体補正はそのまま保持。NG継続行・空白・改行を保持。同じ行に複数見出しがある想定外入力も保持。結果カードの表示・コピーの整形だけが変わる|
|`src/components/PromptCard.tsx`|重複画像の評価行keyを一意化、評価欄の折り返し、評価の保存を説明する文言へ修正|
|`src/components/DetailsCard.tsx`|タグNGの操作説明・送信経路のコメントを現動作に一致させる|
|`src/components/PromptTargetSelector.tsx`|tooltipを「ChatGPT画像編集向け」に統一|
|`tests/shortenPrompt.test.ts`|短文維持、固定指示維持、複数行NG、NG後の次セクション、想定外形式、複数案・CRLFの回帰テスト|
|`docs/33_quality-audit-2026-09-20.md`、`docs/master-plan-v1.md`|本調査と保留理由を記録|

サーバの生成ロジック、送信payload、scope / builder / handler / flagの意味、保存スキーマは変更していない。**短縮ON時の表示・コピー用テキストの後処理だけは修正した**ため、テキスト関連ロジックが全く無変更という意味ではない。短縮後も保存原文は変更されない。

## 修正しなかったもの

- A01: 保護判定の変更には、顔同一性・背景固定・衣装固定・否定文に対する回帰条件の合意が必要。
- A02: 非表示の自動学習を停止するか、手動分析のみ残すかの判断が必要。保存済み学習データは保持する方針を推奨。
- A03: 旧反映ON値を保持して解除UIを復旧するか、生成への送信を止めるかを選ぶ必要がある。localStorage初期化による対処はしない。
- A04/A05: 本文へのNG合流だけ止めると、雪・衣装などの除外経路が消える。候補除外の対象拡張とセットで決める必要がある。`server/src/promptSystem.ts` は無変更。
- A12: 画像差し替え時に旧評価を維持するか、明示操作で分離するかを判断する。今回は削除しない。
- 大きなチャンクの分割、App.tsxの分割、大規模UI改修は未実施。
- 同一性保護文そのものは削らない。`applyIdentityShield()` は今回の通常例・faceLock ONで追加0行、OFFで2行だった。通常時に必ず大量付加される構造ではない。

### 撤去機能・不要参照

- 「この画像でバズる」の専用ボタン・handler・prop・builderは撤去済み。「1ヶ月生成カレンダー」の入口・planタブ・MonthlyCalendarSection / postingCalendarも撤去済み。
- `CalendarView.tsx` と `ImageSidebar.onShowCalendar` は現在も使う**履歴カレンダー**。撤去対象の1ヶ月生成カレンダーとは異なる。
- `viralMode` / `viralNote.ts` は既存履歴・旧追加指示の互換処理等から参照されている。名前だけで削除しない。
- `DuplicateAnalysisPanel.tsx` は存在せず、コード中の残りは主に撤去経緯のコメント。`SkyveilBar.tsx` は `return null` だが、propsとApp側ハンドラは残る。自動学習はこの残存経路と別のeffectで生きている。
- 118個のフロントTS/TSXの静的import/export・dynamic import到達性を調査。`src/lib/promptDiff.ts` の `diffPrompts()` は呼び出し元なし。一方 `PromptVersion` 型は `src/types.ts:1279` から参照されており、ファイル全体を未使用として削除してはいけない。
- `noUnusedLocals / noUnusedParameters` 有効の型チェックで、未使用import/state/propsのコンパイルエラーなし。到達性のないexportや、描画しないコンポーネントへの配線まではこのチェックでは検出できない。
- 削除は今回行っていない。

## プロンプト関連の調査結果

### chatgpt_short と文字数

- `chatgpt_short` は現行の生成モードではない。`settingsPersist.ts:202–212` に旧保存値を `chatgpt_safe` に読み替える互換処理がある。
- 現在の「✂ 短縮」は `PromptCard.tsx` 内の非永続stateで、生成後に `shortenPrompt()` を使う。サーバへ短縮モードは送らない。
- カードごとのON/OFFで、画面の再マウントではOFFへ戻る。履歴側のコピーや他の出力経路は保存された原文を使うため、短縮が全コピー経路に共通適用されるわけではない。
- 下記は**サーバ定型文を組み合わせた合成例**。実モデルの生成結果の統計ではない。文字数はJavaScriptの `.length`。

|例|通常|短縮|差|
|---|---:|---:|---:|
|固定・変更文＋サーバの人体補正文例|668|271|397減（約59%）|
|上記＋多数タグNG由来のNG欄|4,409|4,012|397減（約9%）|
|短い人体補正（修正前）|23|110|87増|
|短い人体補正（修正後）|23|23|変化なし|

多数タグ例は196タグ（各対象フィールドから最大2タグ）を合成したストレスケース。送信時のNGは重複排除後195行・3,736字になった。実ユーザーの保存値を読み出した数ではない。

### 長文化の原因

1. `bodyFixBlock()` が全案に日本語の人体補正・体型/レンズ保護・英語の同内容・脚部補足を要求する。日本語のみという `langNote` と英語入り例文も不整合。
2. 顔ロック・固定原則・例文・追加固定の内容が重複し得る。短縮は固定、変更、人物サイズ、脚部の日本語補足、雰囲気、光、追加指示、NGを大幅には削らない。
3. 手動NGは `splitNg()` / 禁止モチーフの類語展開、タグNGは英語列への展開で膨らむ。重複排除は主に行単位で、意味の重複は整理しない。
4. 世界観・背景・画法・融合・配色主従・参照・自由指示が `extraInstructions` に重ねて入る。
5. 背景2D化は現クライアントの既定値が `true`（`settingsPersist.ts:119`）。背景スコープが有効な初期payloadでもON。`promptSystem.ts` の「既定OFF」というコメントとはずれる。設定の意味変更になるため未変更。
6. サーバ内部のsystem promptは今回の初期相当・背景指定例で11,385字、ジャンル計画込みで約12.7千字。ただしこれはGeminiに渡す内部指示の長さで、ユーザーがChatGPTに貼る最終プロンプトとは別物。

### NG出力の経路

```text
手動ngList・禁止モチーフ → splitNg / applyNgGate → gated.ngList
tagNg の background.place/style → ngExclude（候補除外）
その他のtagNg → tagNgToNgTerms → finalNgListへ合流
finalNgList → payload.ngList
server: req.ngList ＋ colorStrategyNgAddon → effectiveNg
effectiveNg → ngBlock() → モデルへ【NG】出力を要求
```

- `tagNg=[background.place:greenhouse]` のみ: `payload.ngList=""`、`ngExclude.place=["greenhouse"]`。
- `tagNg=[background.weather:snowy]` のみ: 手動NGが空でも `payload.ngList="snowy"`。
- 手動「温室」＋雪タグ: `payload.ngList="温室\nsnowy"`。
- NGが完全に空・色戦略追加なしなら `ngBlock()` は空、統一フォーマットも【NG】省略を指示する。ただしモデル応答を後処理で必ず省略させる保証はない。
- 手動・タグが空でも `colorStrategy="no_pink"` ならサーバ側で色の類語を追加する。
- 手動「室内」は「屋外・広い空…」という正の追加指示に変換される。語の変換は変更範囲と独立で、保護指示との競合候補になる。

### 背景NGが効かない経路

- **正常に働く部分**: `planBatch()` のジャンルプールでは `greenhouse` の事前除外を確認。
- **除外漏れ**: `BG_VARIETY_TRIM` は完全一致の「森」を除く一方、「霧の森」は積極候補に残った。対応表も場所・スタイル全体を網羅しない。
- **情報不足**: `resolveBgExclude()` はban語を作るが、最終指示には「一部の背景を除外」とだけ書く。計画ブロックを除いたsystem promptは温室NGと遊園地NGで同じになり、モデルに除外先の区別が届かない。
- **正の指示が優先候補として残る**: `venue_greenhouse` ムードは温室の正の指示に展開。固定場所がgreenhouseならその場所を維持する指示が残り、場所指定済みでは候補除外ブロック自体が出ない。追加指示の「夜の遊園地」もそのまま残る。
- **別の抽選**: `SURPRISE_TWISTS` には植物・雪・自然を足す指示があるが、ジャンルNGとは別に抽選している。
- **クライアント側**: 世界観ビルダーは個別の候補選択・ヒント選択を行うが `tagNg` を受け取らず、送信時の `generateViaBackend()` でも正の `details / moods / extraInstructions` との衝突は除去しない。履歴・参照から入った文も同様。
- clientだけで止められるのは手前の既知候補・選択値の衝突。serverが新たに選ぶ候補や自由生成の語まで止めるには§4・varietyEngine側の整合と、最終出力の検証方針が必要。

### 改善候補（未実装）

- 保護・変更対象・変更内容・必要な手動NGの順に、重複を避ける短い出力仕様を合意する。顔同一性、背景/衣装固定、人物サイズを削減の犠牲にしない。
- 人体補正の日本語/英語重複を生成段階で整理し、文字数は最終出力で計測する。上限を決めても、保護文や手動指示を機械的に切り捨てない。
- タグNGは本文出力と分離し、全候補生成箇所で除外する。正の指示との衝突は可視化し、勝手な置換よりユーザーが判断できる処理を設計する。
- 「参照画像はAI生成・成人・実在人物ではない」という無条件の宣言は、実際の画像と合わない可能性がある。入力の事実に合わせる仕様を検討する。特定の単語がChatGPTで必ずブロックされるとの断定や、フィルター回避を目的とする置換は行わない。

## 残タスク

- すぐ判断すべき: A01の固定対象保護、A02の非表示自動分析停止、A03の旧反映設定の扱い。
- 次に対応: タグNG完全分離と全候補除外、NGと正の指示の衝突、短縮の対象経路・長さ目標。
- 保留可: 未使用exportや非表示propsの整理、バンドル分割、画像差し替え時の評価引継ぎ方針。
- ユーザー判断が必要: 上記の生成/保護/学習仕様変更、既存設定の継続方針、機能残骸の削除範囲、commit / push。
- 実Gemini / ChatGPT / Nano Bananaでの再生成・顔同一性比較、実履歴全件の検証、Explorerの実フォルダ権限操作は今回未実施。

## commit案

```text
fix: 短縮時のNG保護と評価カード表示を修正
```

- 含める: 上記4つのsrcファイル、`tests/shortenPrompt.test.ts`、本報告書、`docs/master-plan-v1.md` の調査ログ。
- 含めない: `dist/`、`*.tsbuildinfo`、`node_modules/`、一時検証スクリプト・スクリーンショット・合成データ、認証情報、未変更のサーバファイル。
- 既存の未pushコミット `d4dff47` をamendしない。将来pushする場合は、この既存コミットもpush範囲に入る点を確認する。
- 今回はcommit / push未実施。
