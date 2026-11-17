@echo off
rem Codex Chinese UI launcher - resets leftover instances then starts with debug port
rem NOTE: the exe path contains a version number; update it after Codex upgrades
rem       (see chatGPT汉化包/说明.md for maintenance steps)
set LOG=%TEMP%\codex-zh-launch.log
echo === %date% %time% === >> "%LOG%"
taskkill /IM ChatGPT.exe /F >nul 2>&1
taskkill /IM codex.exe /F >nul 2>&1
ping -n 4 127.0.0.1 >nul
start "" "C:\Program Files\WindowsApps\OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0\app\ChatGPT.exe" --remote-debugging-port=9222
echo start exit=%ERRORLEVEL% >> "%LOG%"
