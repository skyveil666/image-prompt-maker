# 16. Future Roadmap

> **目的**: Phase 1（設計書整備）完了後の **実装ロードマップ** を明示する。
> **位置づけ**: 本書が **上位ロードマップ**、[08_今後の実装案.md](./08_今後の実装案.md) は **機能アイデアの蓄積場** として並走。
> **依拠**: [master-plan-v1.md](./master-plan-v1.md), [11_UI重複一覧.md](./11_UI重複一覧.md)

---

## 0. 現在の Phase

| Phase | 内容 | 状態 |
|---|---|---|
| **Phase 0** | 機能実装（Identity Shield, Scope Filter, 重複分析, skyveil 等） | ✅ 完了 |
| **Phase 1** | 設計書整備（master-plan-v1 + 09-16） | ✅ 完了（2026-06-04） |
| **Phase 2** | UI 可視化（ProtectionBar 常時表示 ✅ + AI分析ライブビュー強化 ✅） | ✅ 完了（2026-06-04） |
| **Phase 3** | UI 重複整理（M-1/M-2/M-3 + UI表記整合）※P3 MoodSelector は Phase4 で実施 | ✅ 完了 |
| **Phase 4** | UI改善・圧縮（上部1段統合/反映状態圧縮/skyveil微圧縮/詳細設定優先展開/生成サマリ/tooltip/MoodSelector整理）＋ faceLock統合(前倒し済) | ✅ 完了（2026-06-04・[20](./20_phase4-ui改善.md)） |
| **Phase 5** | App.tsx 分割・hooks 抽出 ／ コア共通モジュール化（identityRiskCore 等）／ 分析キュー化（複数分析の同時表示対応） | ⏸ |
| **Phase 6** | フォルダ構成再編 | ⏸ |
| **Phase 7** | パフォーマンス強化（Web Worker 化） | ⏸ |
| **Phase 8** | 長期機能（マルチユーザー / クラウド同期 / 出力先追加） | ⏸ 検討段階 |

---

## 1. Phase 2: UI 可視化（即着手候補）

### 1.1 ProtectionBar 常時表示 ✅ 完了（2026-06-04）

**設計書**: [10_protection-bar常時表示.md](./10_protection-bar常時表示.md)（§10 に実装完了記録）

**実装ステップ**:
- ✅ A. 新 `GlobalProtectionBar.tsx` 作成（メインビュー最上部 全幅 sticky 配置／このアプリに header が無いため案A を読み替え）
- ✅ B. `analyzeIdentityRisk("", currentLock)` のリアルタイム計算を `useMemo` で実装
- ✅ C. リスクレベル色分け（low=emerald / medium=sky / high=amber / danger=rose）
- ✅ D. 詳細展開 UI（常時3項目＋展開時詳細）
- ⏸ E. レスポンシブ全画面オーバーレイ → flex-wrap の簡易対応にとどめ（将来）

**完了条件**:
- ✅ メイン画面のどの位置にスクロールしても保護状態とリスクレベルが見える（sticky top-0）
- ✅ 設定変更の瞬間にリスクスコアが更新される（背景のみ LOW0 → 背景+ポーズ+カメラ MEDIUM28 を実機確認）

### 1.2 Identity Shield 採点を生成前にライブ表示

**設計書**: [13_identity-risk.md](./13_identity-risk.md)

**実装ステップ**:
- ✅ A. フロントの `analyzeIdentityRisk` を GlobalProtectionBar に統合（Phase 2.1 で実施）
- B. 「リスク低減アクション提案」を danger 時に表示（未・将来）
- ✅ C. 加算理由を展開時に列挙（GlobalProtectionBar 展開時）

### 1.3 AI分析ライブビュー強化（Phase 2.2）✅ 完了（2026-06-04）

**設計書**: [17_analysis-live-view.md](./17_analysis-live-view.md)（§4 に実装完了記録）

**実装ステップ**（すべて達成）:
- ✅ A. 新 `AnalysisStatusStrip.tsx`（読み取り専用）を GlobalProtectionBar 直下の sticky スタックに配置
- ✅ B. 5分析（重複/色/画像/お気に入り/skyveil）を **件数 + 鮮度（相対時刻）** で常時一覧化
- ✅ C. 実行中カテゴリのパルス表示で「分析が生きている」ことを可視化
- ✅ D. 既存 AnalysisLiveView（13ステップ/ログ/根拠）は無変更で残置・住み分け
- ✅ E. 分析ロジック（lib/*Analyzer 等）は一切変更せず、既存 state から算出

**衝突対応**: 案①（現状維持・最小）を採用。複数分析の同時表示は Phase 5 候補（§4.3）へ。

---

## 2. Phase 3: UI 重複整理

### 2.1 P0: 守るもの三重化の解消

**対象**: ProtectionBar / LockToggles / FaceLockSwitch

**実装ステップ**:
- A. 新 GlobalProtectionBar を主、旧 ProtectionBar を廃止
- B. LockToggles / FaceLockSwitch / SafetyToggle を新 ProtectionBar の内部 UI として再利用
- C. ControlPanel から該当セクションを除去

**完了条件**:
- 「守るもの」の操作 UI が 1 箇所だけになる
- 表示・操作が衝突しない

### 2.2 P1: skyveil 表示二重化の解消

**対象**: SkyveilBar / DuplicateAnalysisPanel 内 RealAnalysisCard

**実装ステップ**:
- A. SkyveilBar に操作系を集約
- B. DuplicateAnalysisPanel 側を「読み取り専用サマリ + SkyveilBar へのジャンプ」に縮小

### 2.3 P1: 反映状態二重表示の役割分離

**対象**: ReflectionStatusBar / DuplicateAnalysisPanel ヘッダ

**実装ステップ**:
- A. DuplicateAnalysisPanel ヘッダの表記を「重複分析: 反映中」のようにローカル状態専用に変更
- B. ReflectionStatusBar は「全体の生成補助状態」として維持
- C. ProtectionBar は「保護状態」として独立（重複しない）

### 2.4 P2: 反映ボタン分散の整理

**対象**: 重複分析 / skyveil / 成功パターン / 色重みの各「反映」ボタン

**実装ステップ**:
- A. 各ボタンに「影響範囲チップ」を追加（例: 「反映 (重複制御のみ)」）
- B. グローバル「全分析を反映」ボタンを追加するか議論

### 2.5 P2: NG / 禁止入力の整理

**対象**: NgInput / ForbiddenTokens / 色 0=禁止 / モチーフ 0=NG / コンボ block

**実装ステップ**:
- A. PromptGuardSection に「現在の最終 NG リスト」全文表示を追加
- B. 各 NG 源にラベル付け

---

## 3. Phase 4: 状態管理整理

### 3.1 locks.face / faceLock 統合 ✅ 完了（2026-06-04・前倒し実施）

**設計書**: [09_face-lock統合.md](./09_face-lock統合.md)（§9 に実装完了記録）

**実装ステップ**: Phase A-E（同設計書 §3）に従って完了

**完了条件**（すべて達成）:
- ✅ `LockKey` から face/identity/expression が消えた
- ✅ 既存履歴を読み込んでも UI が落ちない（旧 locks キーは読み捨て）
- ✅ サーバ送信ペイロードに `locks.face` が含まれない
- ✅ フロント/サーバ tsc・vite build すべて exit 0
- ✅ Identity Shield / Scope Filter への悪影響なし
- ✅ 副次効果: faceLock=OFF 時の「表情維持」潜在バグも解消

### 3.2 App.tsx 分割

**対象**: 2885 行の App.tsx を分割

**新設するファイル**:
- `src/hooks/useAppState.ts` — useState 集約
- `src/hooks/useBuildInputs.ts` — `buildInputs()` 切り出し
- `src/hooks/useGenerationFlow.ts` — generate / restore / undo
- `src/hooks/useAnalysisOrchestration.ts` — 分析オーケストレーション
- `src/App.tsx` — ビュー切替 + DI のみ（< 500行）

**完了条件**:
- App.tsx が 500 行未満
- 各 hook が単体で読みやすい
- 既存挙動は完全互換

### 3.3 settings 永続化の整理

- `settingsPersist.ts` のスキーマ管理を明示化
- マイグレーション関数を導入（`_v1 → _v2` の互換層）

---

## 4. Phase 5: コア共通モジュール化

### 4.1 identityRiskCore 共通化

**設計書**: [13_identity-risk.md §10](./13_identity-risk.md)

**実装ステップ**:
- A. `src/lib/identityRiskCore.ts` を作成
- B. サーバの `applyIdentityShield` を Core 関数 + 注入文ロジックに分解
- C. フロントの `analyzeIdentityRisk` を Core 関数の薄いラッパーに変更
- D. サーバが共通の Core を import するように（必要なら shared/ ディレクトリ作成）

**完了条件**:
- 採点重みの単一ソース化
- フロント・サーバの乖離が技術的に発生し得ない

### 4.2 Scope Matrix 共通化

[12_scope-matrix.md](./12_scope-matrix.md) の表を JSON 化:

```
shared/scopeMatrix.json
```

フロントの `buildInputs()` ゲート判定とサーバの promptSystem ブロック挿入判定が同じデータを参照。

### 4.3 分析キュー化（複数分析の同時表示対応）【Phase 2.2 からの繰越候補】

**背景**: 現在の `useAnalysisLive` は単一インスタンスで、`start()` のたびに状態をリセットする。
生成直後の `runBiasAnalysis`（重複・色・お気に入り）と、約1.5秒後に発火する背景 `startImageAnalysis`（画像）が
衝突すると「後勝ち」で上書きされ、AnalysisStatusStrip の実行中表示は片方しか出ない。

**現状（Phase 2.2）**: 案①（現状維持）を採用。Strip は「直近で動いている1分析」を表示すれば
目的（今何を分析中か）は満たせるため、衝突は許容している。

**Phase 5 候補としての改善案**（分析ロジックは非変更・状態コンテナのみ）:
- A. `useAnalysisLive` を **複数同時実行（キュー/並走）対応** に拡張
  - `start()` を「実行中なら別レーンを開始」に変更し、`activeRuns: Map<runId, RunState>` を保持
  - AnalysisStatusStrip が複数の進行中分析を同時にパルス表示
- B. 各カテゴリが「今まさに走っているか」を個別に追跡（現在は currentStepId 1つのみ）
- C. 完了レーンは一定時間後にフェードアウト

**影響範囲（想定）**: `src/lib/useAnalysisLive.ts` / `analysisLiveTypes.ts` / `AnalysisStatusStrip.tsx` / `AnalysisLiveView.tsx`。
**非対象**: `lib/*Analyzer.ts` 等の分析ロジック（引き続き無変更）。

---

## 5. Phase 6: フォルダ構成再編

[master-plan-v1.md の §16 推奨フォルダ構成](./master-plan-v1.md) を参照。

```
src/lib/
  ├── identity/   identityRisk, promptLockCheck
  ├── analysis/   biasAnalyzer, historyAnalyzer, imageAnalyzer, ...
  ├── learning/   favoriteProfile, preferenceProfile, ratingAnalyzer, ...
  ├── policy/     motifPolicy, colorPolicy, forbiddenTokens, reversePrompt
  ├── prompt/     arrange, quickActions, chaosEngine, variationEngine, zozoTrend
  ├── persistence/  settingsPersist, idb, history, backup, operationLog
  ├── ui-helpers/   cleanup, imageThumb, completionSound, ...
  └── api/        backendClient
```

**実装ステップ**:
- A. フォルダ作成 + 機械的 mv
- B. import パス一括置換
- C. tsconfig path alias 追加

---

## 6. Phase 7: パフォーマンス強化

### 6.1 historyAnalyzer Web Worker 化

**契機**: 1万件超で UI フリーズが発生する既知課題

**実装ステップ**:
- A. historyAnalyzer 本体を Worker thread に切り出し
- B. Comlink 等で通信
- C. プログレス通知を analysisLive に統合

### 6.2 imageAnalyzer のバッチ化

- IndexedDB の読み込みを `IDBCursor` ベースで継続的に進める
- メモリピーク制御

### 6.3 サムネキャッシュの LRU

[08_今後の実装案.md](./08_今後の実装案.md) §既知の課題:

- IndexedDB クォータ対策
- 古いものから LRU 削除

---

## 7. Phase 8: 長期機能（検討段階）

### 7.1 マルチユーザー / プロジェクト切替
- 履歴・お気に入りを namespace 化
- プロジェクト切替 UI

### 7.2 クラウド同期
- Firebase / Supabase 連携検討
- 認証フロー設計
- E2E 暗号化

### 7.3 出力先追加
- Midjourney V7 形式
- Sora 形式（動画用）
- Stable Diffusion XL（positive / negative / LoRA）

### 7.4 AI 強化
- aiAgent を Gemini Function Calling 化
- ⭐画像から構図・カメラ・ライティングを自動抽出
- 別ジャンル化を LLM ベース化

---

## 8. やらないこと（明示的に範囲外）

[08_今後の実装案.md](./08_今後の実装案.md) §やらないこと の継承:

- ❌ 画像生成 API の追加（本ツールはプロンプト生成専用）
- ❌ 安全基準回避の実装（危険表現の隠蔽機能は作らない）
- ❌ API キーのブラウザ側保存
- ❌ UI レイアウトの大規模変更（ボタンサイズ・余白・配置・テーマカラーは固定）

追加:

- ❌ **P1〜P7 のいずれかを破る変更**（例: 「学習結果を自動反映するオプション」）
- ❌ **保護対象（faceLock 等）をユーザー操作で完全無効化する機能**

---

## 9. 各 Phase の依存関係

```
Phase 1 (設計書) ──┬──→ Phase 2 (UI可視化)
                  │
                  └──→ Phase 4.1 (faceLock統合) ──→ Phase 3 (UI重複整理)
                                                   ↓
                                                Phase 4.2 (App.tsx分割)
                                                   ↓
                                                Phase 5 (共通モジュール化)
                                                   ↓
                                                Phase 6 (フォルダ再編)
                                                   ↓
                                                Phase 7 (パフォーマンス)
                                                   ↓
                                                Phase 8 (長期機能)
```

**並走可能**:
- Phase 2.1 (ProtectionBar) と Phase 4.1 (faceLock 統合) は **同時着手可能**
  - ただし統合後 ProtectionBar が `locks.face` を参照しないよう設計

---

## 10. 各 Phase の完了条件（チェックリスト）

### Phase 2 完了条件
- [ ] ProtectionBar がヘッダ直下で常時表示されている
- [ ] Identity Shield リスクレベルがライブで更新される
- [ ] 旧 ProtectionBar の責務は新 GlobalProtectionBar に統合済み
- [ ] レイアウト制約（[01_UI構成.md](./01_UI構成.md) §レイアウト制約）を遵守

### Phase 3 完了条件
- [ ] [11_UI重複一覧.md](./11_UI重複一覧.md) の P0-P1 が解消
- [ ] 表示・操作の重複箇所が 5 箇所以下

### Phase 4 完了条件
- [ ] `LockKey` から face/identity/expression が消えている
- [ ] App.tsx が 500 行未満
- [ ] 既存履歴を読み込んでも UI が落ちない（回帰テスト合格）
- [ ] サーバ送信ペイロードに `locks.face` が含まれない

### Phase 5 完了条件
- [ ] フロント・サーバの identityRisk スコアが完全に一致
- [ ] 採点ルールが 1 ファイルから管理されている

### Phase 6 完了条件
- [ ] `src/lib/` がフラットでなくテーマ別フォルダになっている
- [ ] import パスが破損していない
- [ ] tsconfig path alias で `@/lib/identity/...` のように使える

### Phase 7 完了条件
- [ ] 1万件履歴で UI フリーズが発生しない
- [ ] サムネキャッシュが LRU で自動削除される

---

## 11. ロードマップ管理

- **本書を四半期ごとにレビュー**し、Phase の優先順位を見直す
- 完了 Phase は「✅ 完了」マークと完了日を記載
- 計画変更時は [master-plan-v1.md §15 設計判断ログ](./master-plan-v1.md) に記録

---

## 12. 08_今後の実装案.md との関係

| 項目 | 本書（16） | 既存 docs/08 |
|---|---|---|
| 性質 | **上位ロードマップ**（Phase 単位） | **機能アイデアの蓄積場**（粒度自由） |
| 改訂 | Phase 完了時 + 四半期 | 随時 |
| 着手判断 | 必ず本書を経由 | アイデア出しの場 |
| 例 | Phase 3 で UI 重複整理 | 「テーマプリセット（ダーク/ライト/HC）」 |

→ docs/08 のアイデアは、本書の Phase に **取り込まれてから** 着手する。

---

## 13. 関連ドキュメント

- [master-plan-v1.md](./master-plan-v1.md)
- [08_今後の実装案.md](./08_今後の実装案.md)（機能アイデア蓄積）
- [09_face-lock統合.md](./09_face-lock統合.md)（Phase 4.1）
- [10_protection-bar常時表示.md](./10_protection-bar常時表示.md)（Phase 2.1）
- [11_UI重複一覧.md](./11_UI重複一覧.md)（Phase 3）
- [13_identity-risk.md](./13_identity-risk.md)（Phase 5.1）

---

**End of Doc 16**
