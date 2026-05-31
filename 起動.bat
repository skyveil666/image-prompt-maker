@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Image Prompt Maker - dev server

echo ============================================================
echo   Image Prompt Maker  開発サーバー
echo ============================================================
echo   フロント(5173) と API(3001) を起動します。
echo   準備ができると ブラウザが自動で開きます（数秒〜十数秒）。
echo   この黒い画面は開いたままにしてください（閉じると停止）。
echo   止めるときは この画面で  Ctrl + C 。
echo ============================================================
echo.

REM 依存が無ければ自動インストール（初回のみ時間がかかります）
if not exist "node_modules" (
  echo [setup] フロントの依存をインストール中...
  call npm install
)
if not exist "server\node_modules" (
  echo [setup] サーバーの依存をインストール中...
  call npm --prefix server install
)

REM 同じウィンドウで両方起動。準備完了時に Vite(open:true) がブラウザを開く。
REM 固定待ちでブラウザを開かないので「準備前アクセス→接続拒否」が起きない。
call npm run dev:all

echo.
echo ============================================================
echo  サーバーが停止しました。閉じるには何かキーを押してください。
echo ============================================================
pause >nul
