# 21. 履歴・お気に入り復旧パネル（緊急対応）

> 目的: 履歴・お気に入りが「見えない」時に、IndexedDB に残っているデータを **見える化＋即再読み込み＋バックアップ/インポート** する。
> **読み取りと追加マージのみ。破壊的操作（削除/clear/deleteDatabase/migration/上書き削除）は一切行わない。**

---

## 1. 背景

[調査（前段）](./19_bugfixes.md) のとおり、アプリのコードに履歴・お気に入りを全消去する経路は無い。
消えて見える主因は **origin（ポート）違い**（例：`localhost:5173` のデータを別ポートの preview で見ている）か、ブラウザのサイトデータ消去。
そこで「実データが在るか／どこに在るか」を即判定し、UI に戻すための復旧パネルを追加した。

## 2. 構成

- 新規: `src/components/RecoveryPanel.tsx`（読み取り＋非破壊）
- 入口: 中央カラム最上部の「🛟 履歴・お気に入り復旧」ボタン（トグルで展開）
- App.tsx: `dataVersion` state ＋ `reloadAllData()`。`key={`history-${dataVersion}`}` / `key={`favorites-${dataVersion}`}` を HistoryView / FavoritesPanel に付与し、再読み込み時に再マウント＝IDB を再 getAll（**リロードなし**）。

## 3. 機能

| 機能 | 実装 |
|---|---|
| origin 表示 | `location.origin` |
| 件数表示 | 履歴=`getAll().length` / お気に入り=`isFavorite` 数 / 直近画像=`listRecentImages()` / Explorer★=`listExplorerFavorites()`（miniExplorerDB.exFavs） |
| 0件警告 | 履歴0なら「このURLには履歴データがありません。…localhost:5173 を確認」 |
| 🔄 再読み込み | `reloadAllData()`（dataVersion++ → HistoryView/FavoritesPanel 再マウント → 再 getAll、＋ `refreshFavoriteProfile()`）＋ パネル件数更新 |
| ⬇ 書き出し | `exportBackup()`（履歴＋直近画像＋設定を JSON ダウンロード） |
| ⬆ 読み込み | `importBackup(file)`（**id 重複スキップのマージ**・既存を上書き/削除しない） |

## 4. 不変条件（禁止事項の遵守）

- `indexedDB.deleteDatabase` / `localStorage.clear` / `objectStore.clear` / `deleteObjectStore` / migration / DB version変更 = **一切なし**。
- インポートは追加マージのみ（`backup.ts` 既存・非破壊）。お気に入りフラグも保持。

## 5. 検証（2026-06-05・preview :4330 隔離ブラウザ）

| 検証 | 結果 |
|---|---|
| 空オリジン | 履歴0/お気に入り0/直近0/Explorer★0 ＋ origin違い警告表示 ✅ |
| 履歴4件（お気に入り2）注入 → 🔄再読み込み | パネル件数 履歴4/お気に入り2、警告消滅 ✅ |
| UI 反映（リロードなし） | HistoryView カレンダー4件、お気に入りフィルタ「2件 表示中」 ✅ |
| フロント `tsc -b` / `vite build` | exit 0 ✅ |

> 注: 件数は origin（ブラウザ）ごとの実データ。ユーザーの実数値は **`localhost:5173`** でパネルを開いて確認する。

## 6. 変更ファイル

- 新規: `src/components/RecoveryPanel.tsx`
- 変更: `src/App.tsx`（import / `recoveryOpen`・`dataVersion`・`reloadAllData` / 入口ボタン＋パネル / HistoryView・FavoritesPanel に key）
- 再利用（無変更）: `lib/backup.ts`・`lib/history.ts`・`lib/recentImages.ts`・`lib/miniExplorer.ts`

---

**End of Doc 21**
