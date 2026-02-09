# Timesheet Manager - Launcher
$Host.UI.RawUI.WindowTitle = "Timesheet Manager"

Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Timesheet Manager - Launcher" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Directory dello script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Verifica Node.js
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
    Write-Host "[ERRORE] Node.js non trovato. Installalo da https://nodejs.org" -ForegroundColor Red
    Read-Host "Premi INVIO per uscire"
    exit 1
}

# Verifica server MCP
$serverPath = Join-Path $scriptDir "mcp-server\index.js"
if (-not (Test-Path $serverPath)) {
    Write-Host "[ERRORE] Server MCP non trovato: $serverPath" -ForegroundColor Red
    Read-Host "Premi INVIO per uscire"
    exit 1
}

# Controlla se la porta 3847 e' gia' in uso
$portInUse = Get-NetTCPConnection -LocalPort 3847 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "[INFO] Server MCP gia' attivo sulla porta 3847" -ForegroundColor Yellow
} else {
    # Avvia il server MCP in una nuova finestra
    Write-Host "[INFO] Avvio server MCP..." -ForegroundColor Green
    $mcpDir = Join-Path $scriptDir "mcp-server"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$mcpDir'; node index.js" -WindowStyle Minimized

    # Attendi che il server sia pronto
    Write-Host "[INFO] Attendo avvio server..." -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

# Apri l'app nel browser
Write-Host "[INFO] Apertura browser..." -ForegroundColor Green
$indexPath = Join-Path $scriptDir "index.html"
Start-Process $indexPath

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  App avviata!" -ForegroundColor Green
Write-Host "  Il server MCP e' nella finestra PowerShell minimizzata." -ForegroundColor Gray
Write-Host "  Per fermarlo: chiudi quella finestra." -ForegroundColor Gray
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Start-Sleep -Seconds 3
