@echo off
chcp 65001 >nul
echo ============================================================
echo   Image Prompt Maker  スタートアップ自動起動 登録
echo ============================================================
echo.

REM ── スタートアップフォルダにショートカットを作成する VBScript を一時生成 ──
set "APP_DIR=%~dp0"
set "BAT_PATH=%~dp0起動.bat"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_DIR%\ImagePromptMaker.lnk"
set "VBS_TMP=%TEMP%\create_shortcut_ipm.vbs"

echo Set ws = WScript.CreateObject("WScript.Shell") > "%VBS_TMP%"
echo Set sc = ws.CreateShortcut("%SHORTCUT_PATH%") >> "%VBS_TMP%"
echo sc.TargetPath = "%BAT_PATH%" >> "%VBS_TMP%"
echo sc.WorkingDirectory = "%APP_DIR%" >> "%VBS_TMP%"
echo sc.WindowStyle = 7 >> "%VBS_TMP%"
echo sc.Description = "Image Prompt Maker 自動起動" >> "%VBS_TMP%"
echo sc.Save >> "%VBS_TMP%"

cscript //nologo "%VBS_TMP%"
del "%VBS_TMP%" >nul 2>&1

if exist "%SHORTCUT_PATH%" (
  echo [OK] スタートアップへの登録が完了しました。
  echo.
  echo      次回 Windows にログインすると
  echo      自動で Image Prompt Maker が起動します。
  echo.
  echo      ※ タスクバーに最小化された黒い画面が出ますが、
  echo         それがサーバーです。閉じると止まります。
  echo.
  echo      登録先: %SHORTCUT_PATH%
) else (
  echo [ERROR] 登録に失敗しました。
  echo         管理者として実行してみてください。
)

echo.
pause
