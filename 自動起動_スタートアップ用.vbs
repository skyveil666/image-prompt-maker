Set objShell = WScript.CreateObject("WScript.Shell")

' サーバーをバックグラウンドで起動（ウィンドウ最小化）
objShell.Run "cmd /c cd /d ""F:\Image Prompt Maker\03_generated_app"" && npm run dev:all", 7, False

' 5秒待ってからブラウザを開く
WScript.Sleep 5000
objShell.Run "http://localhost:5173"
