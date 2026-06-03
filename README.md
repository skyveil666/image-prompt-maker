# Image Prompt Maker

画像編集AI（**Nano Banana / Gemini / ChatGPT Image**）向け、**統合プロンプト生成 & 履歴分析** Web アプリ。

---

## 概要

複数の ChatGPTs（背景変更・ポーズ変更など）を1つに統合した上で、
画像をアップロード → 変更したい範囲を選ぶ → ChatGPT版・Nano Banana版を**同時に並べて出力**するアプリ。

さらに、生成履歴から **重複・偏り・流行** を自動分析し、
**AI分析エージェント**が「次に何を変えるか」を提案してくれる。

主な特徴：

- **2系統同時出力**：ChatGPT Image 用（日本語・項目分け）と Nano Banana 用（短文命令型）を並べて生成
- **0-5段階モチーフ制御**：「ドレス全般を Lv2 まで下げる」「金髪は一発NG」など細かい抑制
- **頻出構成 TOP10**：ドレス×花×夕焼け のような3要素同時出現を検出して、まとめて別ジャンル化
- **AI分析エージェント**：履歴・お気に入り・組合せから具体的な改善提案＋ワンクリック反映（重複分析センター内）
- **ZOZOトレンド反映**：年代別の流行傾向（age10/age20/age30）を「優先 / 自動」で反映
- **お気に入り学習**：⭐したカードからモチーフ・色・モードを抽出してプロンプトに自動寄せ
- **履歴カレンダー**：日別の生成枚数を月単位で可視化、過去の任意の日にジャンプ
- **神引きブースト 4種**：被り回避 / 別世界 / バズ寄せ / 顔映え＋風レベル 0-5
- **API キーはサーバー側のみ**：ブラウザにはキーを露出しない構成

---

## 起動方法

### 必要環境

- Node.js 20+
- npm（または互換のパッケージマネージャ）
- Gemini API キー（[Google AI Studio](https://ai.google.dev/) で発行）

### 初回セットアップ

```bash
# 依存インストール（フロント + サーバ）
npm install
cd server && npm install && cd ..

# サーバの .env を作成
cp server/.env.example server/.env
# server/.env を編集して GEMINI_API_KEY を設定
```

### 開発起動

ターミナル2つで並列に：

```bash
# Terminal 1 — フロント（http://localhost:5173）
npm run dev

# Terminal 2 — APIサーバ（http://localhost:3001）
cd server && npm run dev
```

Windows なら同梱の `起動.bat` ダブルクリックでも両方起動可能。

### 本番ビルド

```bash
npm run build        # フロント
cd server && npm run build && npm start
```

---

## フォルダ構成

```
03_generated_app/
├── README.md
├── docs/                          # 機能別の設計書
│   ├── 00_概要.md
│   ├── 01_UI構成.md
│   ├── 02_神引き.md
│   ├── 04_重複分析センター.md
│   ├── 05_ZOZOトレンド.md
│   ├── 06_お気に入り学習.md
│   ├── 07_履歴カレンダー.md
│   └── 08_今後の実装案.md
├── public/                        # 静的アセット
│   ├── favicon.svg
│   └── icon.svg
├── src/                           # フロント（React 18 + TS）
│   ├── App.tsx                    # 全体オーケストレーション
│   ├── types.ts
│   ├── components/                # UI 部品（40+）
│   │   ├── MiniExplorer.tsx       # 左サイドのエクスプローラ（履歴グリッド）
│   │   ├── DuplicateAnalysisPanel.tsx # 重複分析センター
│   │   ├── HistoryView.tsx        # 履歴ビュー
│   │   ├── CalendarView.tsx       # 履歴カレンダー
│   │   ├── BoostControls.tsx      # 神引きブースト / 風
│   │   ├── ZozoTrendBar.tsx       # ZOZO トレンド帯
│   │   ├── DetailsCard.tsx        # 詳細設定アコーディオン
│   │   ├── PromptCard.tsx         # 出力カード（ChatGPT / Nano Banana）
│   │   └── ...
│   └── lib/                       # ロジック層（30+）
│       ├── aiAgent.ts             # AI分析エージェント（ヒューリスティック）
│       ├── assistantEngine.ts     # 短文化＋口調変換
│       ├── assistantSpeech.ts     # Web Speech API ラッパー
│       ├── motifPolicy.ts         # 0-5モチーフ制御 / コンボ制御
│       ├── historyAnalyzer.ts     # 偏り検出 / 頻出構成 TOP10
│       ├── favoriteProfile.ts     # お気に入り学習（42 traits）
│       ├── zozoTrend.ts           # 年代別トレンド
│       ├── biasAnalyzer.ts        # MONITORED_MOTIFS の偏り検知
│       ├── presets.ts             # プリセット
│       └── ...
├── server/                        # バックエンド（Express + Gemini）
│   ├── src/
│   │   ├── index.ts               # ルーティング・バリデーション
│   │   ├── gemini.ts              # Gemini 2.5 Flash 呼び出し
│   │   ├── promptSystem.ts        # スコープゲート式プロンプト合成
│   │   ├── varietyEngine.ts       # 反復回避エンジン
│   │   ├── outfitSubStyles.ts
│   │   └── types.ts
│   └── .env.example               # GEMINI_API_KEY のテンプレート
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── 起動.bat                       # Windows用ランチャ
```

---

## 技術スタック

- **フロント**: Vite 6 / React 18 / TypeScript 5 / TailwindCSS 3
- **サーバ**: Express / Node.js 20+ / Gemini 2.5 Flash
- **永続化**: localStorage（設定）+ IndexedDB（履歴・お気に入り）
- **音声**: Web Speech API（ブラウザ標準、追加依存なし）

---

## ブランチ運用

| ブランチ | 役割 |
|---|---|
| `stable` | 動作確認済みの安定版。ここを基準に master/release タグを切る |
| `develop` | 日常の機能追加・バグ修正の統合ブランチ |
| `experimental` | 大きな試作・破壊的変更の隔離。stableへは段階的にマージ |

通常フロー：
```
experimental → 評価OK → develop → 動作確認OK → stable
```

---

## 設計上の留意点

- **APIキーはサーバ側のみ**：`server/.env` で管理。ブラウザには絶対に送らない。
- **危険表現の隠蔽はしない**：安全基準回避目的の実装は禁止。誤判定されにくい自然な日本語に整える方針。
- **既存機能を壊さない**：UIサイズ・余白・配置・テーマカラー・コンポーネント構造は変更禁止。文字サイズ・色・ウェイトのみ調整可。
- **スコープゲート**：色・風など反映系のブロックは選択中スコープに該当する場合のみ注入される（無関係軸を勝手に変えない）。

---

## 今後の予定

詳細は **[`docs/08_今後の実装案.md`](docs/08_今後の実装案.md)** 参照。

短期：
- 📊 重複分析の反映モード5択（軽く / 標準 / 強く / 禁止だけ / 未開拓優先）
- 🔍 反映前プレビュー（変更差分の確認）
- 🎨 色重みのプリセット（黒一色禁止 / 韓国カラー寄せ など）

中期：
- 詳細履歴の expansion UI（カード→展開で全プロンプト/出力差分）
- お気に入り学習の自動再評価（古い記録の重み減衰）

長期：
- マルチユーザー対応（プロジェクト切替）
- カレンダーへの「今日のおすすめ」自動投稿
- 別ジャンル化の提案を LLM ベースに格上げ（現在はヒューリスティック）

---

## ライセンス

個人プロジェクト。再配布・改変は要相談。
