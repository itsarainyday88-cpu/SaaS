
trap {
    Write-Host "`n[FATAL ERROR] An unhandled exception occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor White
    Write-Host "`nPress any key to exit..." -ForegroundColor Gray
    [Console]::ReadKey() | Out-Null
    exit
}

# [1] 3000번 포트 강제 점유 해제 및 '완벽 대기'
$targetPort = 3000
try {
    $conns = Get-NetTCPConnection -LocalPort $targetPort -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listening' }
    if ($conns) {
        foreach ($c in $conns) {
            Write-Host "Cleaning port $targetPort (PID: $($c.OwningProcess))..." -ForegroundColor Yellow
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        # OS가 소켓을 완전히 해제할 시간을 줍니다 (중요: TIME_WAIT 방지)
        Start-Sleep -Seconds 1
    }
} catch { }

# [2] 레지스트리 기반 크롬 경로 정밀 탐색 (추가 예외 처리)
function Get-ChromePath {
    $keys = @(
        "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
        "Registry::HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
    )
    foreach ($k in $keys) {
        if (Test-Path $k) {
            $val = Get-ItemProperty -Path $k -Name "(Default)" -ErrorAction SilentlyContinue
            if ($val -and (Test-Path $val."(Default)")) { return $val."(Default)" }
        }
    }
    return $null
}

# [3] 서버 실행 (경로 정규화)
$baseDir = $PSScriptRoot
if ($baseDir.EndsWith("scripts")) { $baseDir = Split-Path $baseDir }

$nodeExe = Join-Path $baseDir "bin\node.exe"
if (-not (Test-Path $nodeExe)) { $nodeExe = "node" }

$standaloneDir = Join-Path $baseDir "standalone"
$serverJs = "server.js" # WorkingDirectory가 standalone이므로 파일명만 지정

if (Test-Path $standaloneDir) {
    Write-Host "Starting server..." -ForegroundColor Cyan
    # 서버 프로세스를 변수에 담아 관리합니다 (-PassThru)
    $serverProc = Start-Process $nodeExe -ArgumentList $serverJs -WorkingDirectory $standaloneDir -PassThru

    $chrome = Get-ChromePath
    Write-Host "Waiting for server to be ready (Max 15s)..." -ForegroundColor Gray
    
    $ready = $false
    for ($i = 1; $i -le 15; $i++) {
        Write-Host "." -NoNewline
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method Head -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) { 
                $ready = $true
                Write-Host " [Ready!]" -ForegroundColor Green
                break 
            }
        } catch { }
        Start-Sleep -Seconds 1
    }

    if ($ready) {
        if ($chrome) {
            Write-Host "Opening Chrome..." -ForegroundColor Green
            Start-Process $chrome -ArgumentList "http://localhost:3000"
        } else {
            Write-Host "Chrome not found. Opening default browser..." -ForegroundColor Yellow
            Start-Process "http://localhost:3000"
        }
    } else {
        Write-Host "`n[ERROR] Server failed to respond at http://localhost:3000" -ForegroundColor Red
        Write-Host "Please check if another application is using port 3000." -ForegroundColor White
    }
} else {
    Write-Host "ERROR: 'standalone' directory not found!" -ForegroundColor Red
}

Write-Host "`n[✅ RUNNING] Press any key to stop the server and exit..." -ForegroundColor Gray
$null = [Console]::ReadKey()

# 종료 전 자식 프로세스(서버) 처형
if ($serverProc) {
    Write-Host "Stopping server ($($serverProc.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
}
