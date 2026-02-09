@echo off
chcp 65001 >nul
echo Arresto server MCP...

:: Trova e termina il processo node sulla porta 3847
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3847" ^| findstr "LISTENING"') do (
    echo Termino processo PID: %%a
    taskkill /PID %%a /F >nul 2>nul
)

:: Chiudi anche la finestra del server se presente
taskkill /FI "WINDOWTITLE eq MCP Server" /F >nul 2>nul

echo Server MCP arrestato.
timeout /t 2
