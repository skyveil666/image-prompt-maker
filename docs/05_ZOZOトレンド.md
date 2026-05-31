# 05. ZOZOトレンド反映

世代別の流行傾向を、プロンプトに自動的に注入する機能。

## ファイル

| ファイル | 役割 |
|---|---|
| `src/lib/zozoTrend.ts` | 年代別 traits の辞書 |
| `src/components/ZozoTrendBar.tsx` | 横長の選択帯 UI |
| `server/src/promptSystem.ts` | `zozoTrendBlock(req)` の合成 |

## 年代プリセット

```ts
type ZozoAge = "age10" | "age20" | "age30";
```

| Age | 想定 | 例（traits） |
|---|---|---|
| `age10` | 10代後半〜大学生 | 量産型 / 地雷 / ガーリー / Y2K / メッシュ髪 |
| `age20` | 20代前半〜中盤 | 韓国系 / 黒髪レイヤー / きれいめカジュアル / モード |
| `age30` | 20代後半〜30代 | きれいめモード / 大人カジュアル / オフィス映え |

詳細値（モチーフ・色・髪型・小物）は `zozoTrend.ts` の定数で管理。

## 反映モード

`ZozoTrend.mode` で2モード：

| Mode | 動作 |
|---|---|
| `priority` | **優先**: 既存スコープの値を上書きする強い反映 |
| `auto` | **自動**: 既存値と並列に提案、衝突は既存優先 |

UI 上は `priority` のとき badge が "優先中" として表示される。

## UI

```
[年代] age20 ▼  |  反映: ○優先  ○自動  |  [反映中: priority] [解除]
```

- ボタンクリックで `setZozoApplied(...)` 即発火
- 何もしない既定状態（null）
- 永続化キー: `ipm_settings_v1.zozoApplied` （`settingsPersist.ts`）

## サーバ側ブロック

```ts
function zozoTrendBlock(req: GenerateRequest): string {
  const z = req.zozoTrend;
  if (!z) return "";
  // mode = priority → 「以下の傾向を最優先で反映」
  // mode = auto     → 「以下の傾向を参考に」
  return ...;
}
```

`pt === "nano_safe"` のときは traits を3個までに絞って短文化。

## 注意点

- ZOZO はあくまで**プロンプト合成時の参考**で、外部 API には接続しない（オフライン辞書）
- 衝突解決：ユーザがスコープで明示した色 / 髪型 / 衣装は上書きしない（auto モードの場合）
- `priority` でも顔・体型・同一性のロックは破らない
- 年代は単独選択（複数同時 ON はしない＝混ざり防止）

## バグ修正履歴

- `zozoApplied` がリロードで消える問題を修正
  - 原因: `PersistedSettings` に未登録
  - 対応: `settingsPersist.ts` に追加、`saveSettings` 呼び出しに含めた
