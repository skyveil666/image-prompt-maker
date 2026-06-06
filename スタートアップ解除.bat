@echo off
chcp 65001 >nul
echo ============================================================
echo   Image Prompt Maker  スタートアップ自動起動 解除
echo ============================================================
echo.

set "SHORTCUT_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ImagePromptMaker.lnk"

if exist "%SHORTCUT_PATH%" (
  del "%SHORTCUT_PATH%"
  echo [OK] スタートアップから解除しました。
  echo      次回ログインからは自動起動しなくなります。
) else (
  echo [INFO] スタートアップには登録されていませんでした。
)

echo.
pause
