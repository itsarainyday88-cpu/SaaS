
# 1. 포트 3000번 확인 및 정리 (좀비 프로세스 제거)
$port = 3000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "Cleaning up port $port..." -ForegroundColor Yellow
    Stop-Process -Id $process.OwningProcess -Force
}

# 2. 백그라운드에서 Next.js 개발 서버 실행
Write-Host "Starting SEOUL YONSEI Marketing OS..." -ForegroundColor Cyan
Start-Process "npm" -ArgumentList "run dev" -WindowStyle Hidden

# 3. 서버 준비 상태 확인 (localhost:3000 응답 대기)
Write-Host "Waiting for server to be ready..." -ForegroundColor Gray
$maxRetries = 30
$count = 0
while ($count -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method Head -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "Server is ready!" -ForegroundColor Green
            break
        }
    } catch { }
    Start-Sleep -Seconds 1
    $count++
}

# 4. Chrome 실행 (Chrome 경로 탐색)
$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

foreach ($path in $chromePaths) {
    if (Test-Path $path) {
        Start-Process $path -ArgumentList "http://localhost:3000"
        exit
    }
}

# Chrome 못 찾으면 기본 브라우저로 실행
Start-Process "http://localhost:3000"
