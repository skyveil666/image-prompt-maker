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
echo   止めるときは この画面を閉じる、または Ctrl + C 。
echo ============================================================
echo.

REM ── 既存の残留プロセスを掃除（ポート使用中エラー / ゾンビ node 対策） ──
echo [clean] 既存の開発サーバー(5173/3001)を確認・停止します...
for %%P in (5173 3001) do (
  for /f "tokens=5" %%K in ('netstat -aon ^| findstr ":%%P " ^| findstr LISTENING') do (
    echo   ポート %%P を使用中の PID %%K を停止します。
    taskkill /F /PID %%K >nul 2>&1
  )
)
echo.

REM ── 依存が無ければ自動インストール（初回のみ時間がかかります） ──
if not exist "node_modules" (
  echo [setup] フロントの依存をインストール中...
  call npm install
)
if not exist "server\node_modules" (
  echo [setup] サーバーの依存をインストール中...
  call npm --prefix server install
)

echo.
echo [run] サーバーを起動します。クラッシュしても自動で再起動します。
echo       完全に終了するには この画面を閉じてください。
echo.

REM ── 自動再起動ループ：dev:all が落ちても 3 秒後に再起動 ──
:loop
call npm run dev:all
echo.
echo ============================================================
echo  サーバーが停止しました（コード %errorlevel%）。
echo  3 秒後に自動再起動します。完全に止めるには今この画面を閉じてください。
echo ============================================================
timeout /t 3 >nul
goto loop
