---
name: implement-feature
description: This skill should be used when the user gives an already-scoped, concrete build
  or fix instruction — messages tagged "【実装指示｜...】", or "実装して", "これを直して",
  once the change's scope, priorities, and constraints are already stated (investigation is
  either already done or trivial). Not for open-ended "what should we build" questions — use
  brainstorming for those instead. Carries a change from instruction through investigate (if
  needed) → implement → self-verify → real-device confirmation → commit, and knows when a
  change must stop for an explicit go-ahead instead of proceeding automatically.
---

Turn an already-decided instruction into a verified, committed change with the least possible
back-and-forth, while never crossing into territory the requester hasn't actually approved.

## 絶対の行動規範（最重要・全実装で必ず適用）

1. **オーナー（非エンジニアの操作者）への問いかけは必ず次の3形式のどれかに翻訳する**。
   コード/enum/§4/内部構造の話をオーナーに出さない：
   - 「〇〇を見て、変じゃなければOKと言ってください」（実機確認・基本はこれで統一）
   - 「AとB、どちらがいいですか」（好みの選択）
   - 「これで進めていいですか（はい/いいえ）」（GO確認）
   「〇〇」「A」「B」は画面に見える・触れる言葉で言う。state名・関数名・ファイル名・
   「scope」等の内部語彙は出さない。技術に明るい開発者と直接やり取りしている通常のセッ
   ションでは、この翻訳は最終確認の一言にだけ適用する（進捗報告や技術的な相談自体は
   従来どおり詳しく行ってよい） — 問いかけ（決定を求める一言）だけが対象。
2. **自動で進めてよい範囲**（確認は実機のみでよい）：front完結の修正・UI変更・タグ追加・
   バグ修正・調査・テスト。investigate→implement→self-verify→実機確認依頼→OKでcommit。
3. **★取り返しのつかない領域＝自動で進めない**。差分が以下に触れるなら、実装前に必ず
   「これで進めていいですか（はい/いいえ）」を理由1文つきで出し、承認を待つ：
   `server/src/promptSystem.ts` / `server/src/scopeFilter.ts` / `server/src/gemini.ts`、
   `src/lib/preferenceProfile.ts` 系・skyveil系・各analyzer系、`src/lib/cleanup.ts` /
   `idb.ts` / `backup.ts` / `history.ts` の中核部分。理由が1文で言えないなら着手しない。
4. **絶対禁止（GOがあっても不可）**：`indexedDB.deleteDatabase()` /
   `localStorage.clear()` / `store.clear()` / 既存ストア削除 / 無計画な `DB_VERSION` 変更。
   お気に入りの自動削除・バックアップの無断上書きも同様。
5. 迷ったら止める。安全側に倒す。
6. **commit規律**：1機能=1コミット。hide-not-delete（使われなくなった物はまず非表示/
   無効化、完全削除は別途の提案止まり）。`--no-verify` 等のフック無視は使わない。

## 手順

### 1. 調査（すでに済んでいなければ）
真因が不明なら `stage0-investigate` の手順を先に踏む。症状のまま直しに入らない。

### 2. 実装
- 指示された範囲だけを変更する（P2＝変更対象だけ変更、と同じ発想）。関係ない整形・
  リファクタ・将来のための抽象化は追加しない。
- 既存の似た仕組みがあるなら、その形をそのまま踏襲する（このプロジェクトでは「新しい
  自動注入を追加する前に、ユーザーが何も選んでいないのに全案に乗らないか確認する」
  「棒立ち・無難への退行を避けつつ毒だけ抜く」が既存の教訓＝新規実装でも踏まえる）。
- 全案の生成に効く新しい設定を追加・変更する場合は、可視化＋ワンクリック解除もセットで
  実装する（バッジの発火条件はサーバ側の注入条件と厳密一致させる）。「効くのに画面に
  見えない」設定は絶対に作らない。

### 3. 自己検証（オーナーに見せる前に必ず自分で済ませる）
```
npx tsc -b --noEmit            # front 型チェック（exit 0）
cd server && npx tsc --noEmit  # server 型チェック（exit 0）
npx vite build                 # 本番ビルド（exit 0）
```
UI変更があれば隔離previewで実機同等の確認を行う：
```
npx vite preview --port 4330 --strictPort   # 4330使用中なら4331
```
実データの起点（開発サーバ5173・API 3001）には検証中に一切書き込まない。ポートが違う
だけで別データベース（空のIndexedDB）になる点を利用し、合成データで検証する。

検証の型：
- fetchを横取りして `/api/generate` に渡る実際のpayloadを見る（本物のAPIは呼ばない。
  `Promise.reject(new Error(...))` でモックする。`new Promise(()=>{})` は `generating`
  状態が戻らずボタンが固まるので使わない）。
- クリックは `document.querySelectorAll("button")` のテキスト一致＋ネイティブ`.click()`
  で行い、1回のクリックごとに別のツール呼び出しにする（同一tick内で複数クリックすると
  Reactのstateが古いまま読まれることがある）。
- ブラウザconsoleエラー0件を確認する。
- 検証が終わったらpreviewを停止し、一時ファイル・一時スクリプトを削除する。

### 4. 実機確認を依頼する
オーナーが実際に見て触れる、具体的で観察可能な言葉で「〇〇を見て、変じゃなければOKと
言ってください」を出す。「〇〇」の例：「リセットボタンを押した後の画面」「新しく増えた
ボタンを押した時の表示」。内部の設定名・スコープ名・コンポーネント名は使わない。

### 5. OKが来たらcommit
1機能=1コミット。コミットメッセージは日本語で、何を・なぜ変えたかを簡潔に書く。

### 2つの変更が同じファイルに混ざった時（スナップショット分割）
1機能=1コミットを守れなくなった場合の手順：
1. 影響を受けるファイルをまとめてscratchpadへコピー（両方の変更込みの状態を保存）。
2. `git diff` を精査し、片方の変更だけをEditで取り除く（import・props・JSX・関数呼び
   出し等、追加された箇所を1つずつ）。grepで対象の識別子が0件になったことを確認。
3. 型チェック・ビルドを通してから、残った方の機能だけをcommit。
4. scratchpadのコピーから元のファイルを復元（両方の変更込みに戻す）。
5. 型チェック・ビルドを再度通して復元前と一致することを確認してから、もう片方の機能を
   commit。
`git checkout --` のような破壊的コマンドは使わない。常にコピー→編集→復元で行う。

## オーナー向け語彙の翻訳表

| 内部の言葉 | オーナーに言う言葉 |
|---|---|
| scope / 変更対象 | 「変えている項目」 |
| §4 / promptSystem / scopeFilter | 「顔や安全に関わる一番大事な部分」 |
| state漏れ・残留 | 「消えるはずの設定が消えずに残っている」 |
| regression（回帰） | 「前は平気だったのに、今は崩れている」 |
| バッジ / DominatorBadge | 「今かかっている設定の表示」 |
| commit / push | 出さない。「直したので反映します」で足りる |

## 参照

- 検証コマンド・untouchableファイル一覧の正本は `CLAUDE.md`（§4・§6）。矛盾する記載を
  見つけたら `CLAUDE.md` を優先する。
- 棚卸し（バグ/デッドコード/新機能の洗い出し）が先に必要な場合は `inventory-audit` を、
  区切りの記録は `progress-checkpoint` を使う。
