---
name: inventory-audit
description: This skill should be used when the user asks for a broad, read-only sweep of the
  codebase — messages tagged "【棚卸し調査指示｜バグ＋不要ファイル＋新機能提案】", or phrases
  like "棚卸しして", "不要なファイルないか調べて", "バグないか一通り見て", "新機能の提案が
  欲しい". Produces a severity-ranked bug list, a dormant-vs-garbage file/dead-code
  classification, and several feature proposals — changes and deletes nothing; any cleanup is
  reported as a proposal only, never carried out in the same pass.
---

Survey the codebase for bugs, unused code, and improvement opportunities without changing or
deleting a single line. This skill's entire value is that its output can be trusted as neutral —
mixing in even a small fix would break that.

## 絶対の行動規範

- **read-only**：Edit/Write は使わない。ファイルの削除・移動・commit も行わない。
- 「消せそうな物」を見つけても、それは削除候補の**提案**であって実行ではない。慎重フラグ
  を付けて別枠に出す。勝手に削除候補リストへ確定で入れない。
- §4（`promptSystem.ts`/`scopeFilter.ts`/`gemini.ts`）・skyveil系・§3データ層に関する
  発見は、read-only調査自体は問題ないが、「自動で直してよい」区分には絶対に入れない
  （`implement-feature` へ渡す時は必ずGO確認が要る区分として渡す）。
- 過去にすでに報告済みの項目は「既出」として扱い、蒸し返さない（`docs/19_bugfixes.md`・
  `memory/current-priority.md` の直近エントリを確認する）。
- 最終的にオーナー（非エンジニア）へ手渡す一言だけは3形式（実機確認/AB選択/GO確認）に
  翻訳する。調査そのものの記述・技術的な報告本文は、開発者向けにはこれまでどおり詳しく
  （file:line・根本原因つきで）書いてよい — 制限がかかるのは「決定を求める一言」だけ。

## 3本柱

### A. バグ
- 致命/高/中/低でseverityを付ける。根本原因・影響範囲・file:lineを添える。
- 「バグではなく仕様」と自分で結論づける前に、実機（隔離preview）で実際に確認する —
  楽観的な決めつけをしない。過去にこのプロジェクトで「仕様のはず」と説明した後に
  再監査で「実は回帰だった」と訂正した例があるため、決めつけより実測を優先する。
- 見えない支配の鉄則（全案に効く設定には可視化＋解除ボタンが必須）に違反している箇所
  がないか確認する：バッジの発火条件と実際にサーバへ注入される条件が一致しているか。

### B. 不要ファイル・デッドコード
- 「未使用」と判定する前に最低限：①import/re-export/動的import含め全参照をgrep
  ②エントリポイントから到達可能か③テスト/設定ファイルからの参照④文字列経由の間接参照
  （ルーティング名・イベント名等）⑤型のみで使われている（type-only import）可能性、を
  確認する。1つでも見つかれば「未使用」ではない。
- **dormant（今は使われていないが意図的に隠されている）と garbage（本当の残骸）を混同
  しない**。機能フラグでOFFにされている・UIから到達不能だが将来のために残している、と
  いった「hide-not-delete」の結果を誤ってgarbage扱いしない。
- `noUnusedLocals`/`noUnusedVars` はオブジェクトリテラルのプロパティや型定義の未使用
  フィールドまでは検出しないため、tscが緑でも「本当に使われているか」は別途確認する。
- 削除は提案のみ。実行しない。

### C. 新機能提案
- 5〜10件、実用度とコストを添える。既存の恒久ルール（`docs/master-plan-v1.md` §2.3：
  似た意味のボタンを増やさない・既存カテゴリへ統合する・旧入口を復活させない）に反する
  提案はしない。撤去済みの機能（例：分析ラボ・分析センターの旧形態）の復活は提案しない。

## 調査手法

- 3並列（バグ監査／不要ファイル監査／新機能提案）で独立に洗い出した上で、高severity・
  新規性の高い項目は自分でも実機（隔離preview）でスポット検証してから報告する。サブ
  エージェントやツールの報告を鵜呑みにせず、最低限「本当にそうなるか」を1つは自分の目
  で確認する。
- 過去の自分の説明（「これは仕様です」等）を再監査で覆す場合は、古い説明のどこが楽観的
  すぎたかを具体的に訂正して報告する。訂正を報告せずに新しい結論だけ出さない。

## 成果物の形

1. バグ一覧（severity別）
2. 不要ファイル/デッドコード一覧（dormant/garbage分類・削除は提案のみ）
3. §4/skyveil/§3隣接の発見は別枠・慎重フラグ付きでまとめる
4. 新機能提案 5〜10件（実用度・コスト付き）
5. 最後に「コードは1行も変更していません」を明記する

## 次

直すかどうか・どれから直すかの決定は要求者に委ねる。開発者向けなら技術的な優先順位案を
提示してよい（このプロジェクトの通常運用）。オーナー向けの一言に落とす必要がある場面
では「これで進めていいですか（はい/いいえ）」または「AとB、どちらがいいですか」で選んで
もらう。選ばれた項目の実装は `implement-feature` に委ねる。
