# CLAUDE.md — Image Prompt Maker 作業ルール

このリポジトリで Claude Code が作業する際の必須ルール。
**設計の正本は `docs/master-plan-v1.md`（矛盾時はそちらが優先）**。
経緯・引き継ぎは `docs/22_引き継ぎ.md` を参照。本書は「毎回守る作業ルール」の要約。

## 1. 常時ルール（開発の進め方）

- 開発フロー: **調査 → 提案（報告）→ ユーザー承認 → 段階実装 → 検証 → docs追記** の順。
- **無断実装禁止**。「実装して」と明示されるまでは調査・提案・報告にとどめる。
- **無断 commit / push 禁止**。コミットはユーザー承認後のみ。push は明示指示があった時のみ。
- `--no-verify` / `--no-gpg-sign` 等の hook スキップ禁止。
- 段階実装＝各段ごとに型チェック（§5）を通してから次へ進む。
- フェーズ完了時は `docs/master-plan-v1.md §15 設計判断ログ` と該当 docs に記録する。

## 2. 最重要原則 P1-P7（master-plan §2 の要約）

P1 顔・同一性維持が最優先 ／ P2 変更対象（scopes）だけ変更 ／
P3 背景固定ONなら背景変更禁止 ／ P4 衣装OFFなら衣装変更禁止 ／
P5 保護対象最優先 ／ P6 学習・分析結果は反映ボタンを押した時だけ適用 ／
**P7 学習結果の自動適用経路を作らない（buildInputs() ゲートを迂回する経路の新設は設計時禁則）**。
顔・同一性は **faceLock 単一管理**（LockKey に face/identity/expression を復活させない）。

## 3. 絶対禁止操作（データ消失リスク）

- `indexedDB.deleteDatabase()` / `localStorage.clear()` / `store.clear()` は**絶対に書かない・実行しない**。
- お気に入りの自動削除・お気に入りフラグの消失・インポート時の無断上書き（backup は id 重複スキップの**追加マージのみ**）。
- 破壊的 migration（idb.ts の既存ストア破壊・DB_VERSION の不用意な変更）。
- App.tsx の無計画な大規模分割。
- API キーを `server/.env` 以外に置くこと／安全フィルタ回避目的の実装。
- 検証で**実データオリジン（localhost:5173 / API 3001）の保存データに書き込まない**。
  検証は別ポートの preview（オリジン分離＝空の IndexedDB）で行う（§6）。

## 4. untouchable ファイル（変更には明示承認が必須）

| 対象 | 理由 |
|---|---|
| `server/src/scopeFilter.ts`（applyIdentityShield / applyServerScopeFilter） | 顔・同一性保護の中核 |
| `server/src/promptSystem.ts` | 出力プロンプト本文が変わる |
| `server/src/gemini.ts` | Gemini 呼び出し・応答処理 |
| `src/lib/preferenceProfile.ts` / `skyveilProfile.ts` / `skyveilScore.ts` / `favoriteProfile.ts` / `ratingAnalyzer.ts` | 学習・分析スコア計算 |
| `src/lib/colorAnalyzer.ts` / `historyAnalyzer.ts` / `imageAnalyzer.ts` / `biasAnalyzer.ts` | 分析スコア（結果が変わる） |
| `src/lib/cleanup.ts`（RETENTION_DAYS=90・除外条件） | お気に入り等の無期限保持を壊さない |
| `src/lib/idb.ts`（DB_VERSION / store名 / upgrade） | migration 破壊禁止 |
| `src/lib/backup.ts` の import | 追加マージのみ・無断上書き禁止 |
| `src/lib/history.ts`（getAll / saveBatch / deleteItem） | 履歴の単一データ源 |

レイアウト制約: 既存ボタンのサイズ／余白／配置／テーマカラー／構造は変更禁止
（文字サイズ・色・ウェイトのみ可。新規追加要素は OK）。

## 5. 「見えない支配」鉄則（このアプリの鉄則・ユーザー 2026-06-11 指定）

**全案の生成プロンプトに効く設定**（buildInputs で全案共通に注入されるもの）を
追加・変更する時は、必ず以下をセットで実装する：

1. `src/components/ReflectionStatusBar.tsx`（📡現在の反映状態バー）に
   **rose系の常時バッジ（折りたたみに隠さない）＋「× 解除」ボタン**。
2. アレンジ画面 `src/components/ArrangePreviewPanel.tsx` にも**同形のバッジ＋解除**
   （アレンジは {...current} で同設定を継承するため。実装例: DominatorBadge）。
3. **バッジの発火条件はサーバ側ゲートと厳密一致**させる
   （例: `avoidRealBackground && scopes.includes("background")` ⟺ promptSystem の注入条件）。
4. 実装後 Playwright 隔離で「設定 → バッジ表示 → × で消える」を確認する。

「効くのに画面に見えない」設定を二度と作らない。
（経緯: worldCombinedNote が不可視のまま全案に注入され、背景が「夜の遊園地」に
固定され続けた事故。既存バッジ: 世界観 / 参照画像 / 背景2D化）

## 6. 検証コマンド列（コード変更後に毎回）

03_generated_app で:

    npx tsc -b --noEmit            # ① front 型チェック（exit 0）
    cd server; npx tsc --noEmit    # ② server 型チェック（exit 0）
    npx vite build                 # ③ 本番ビルド（exit 0）

UI 変更時はさらに:

- ④ **Playwright 隔離検証**: `npx vite preview --port 4330`（4330使用中なら4331）で
  別オリジン＝空DBに合成データを seed して実機確認。
  送信内容の検証は fetch 横取りで `/api/generate` の payload を見る（実 Gemini を呼ばない）。
- ⑤ ブラウザ console エラー 0 を確認。
- ⑥ **後片付け**: preview 停止（orphan な node プロセスも kill）・ブラウザを閉じる・
  一時ファイル/スクショ削除。**5173（実データ）と 3001（API）には触らない**。

注意: IndexedDB はオリジン（ポート）ごとに分離される。preview ポートで「件数 0」に
見えてもデータ消失ではない（過去に誤認事故あり）。

## 7. 使用モデル

このプロジェクトの作業は **Claude Opus 4.8** を使用する。
