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

**End of Doc 23**
