param()

$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $projectPath 'logs'
$pidPath = Join-Path $logPath 'nusaquant-processes.json'
New-Item -ItemType Directory -Force -Path $logPath | Out-Null

# Prefer a normal Python installation if one is later installed. The bundled
# runtime keeps the application usable on this computer today.
$pythonCandidates = @(
    $env:NUSAQUANT_PYTHON,
    'C:\Users\PLN\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if (-not $pythonCandidates) {
    "$(Get-Date -Format o) Python runtime was not found." | Set-Content -Path (Join-Path $logPath 'startup-error.log') -Encoding utf8
    exit 1
}

$pythonExe = @($pythonCandidates)[0]

function Test-RunningProcess([int]$Id) {
    return $null -ne (Get-Process -Id $Id -ErrorAction SilentlyContinue)
}

# Do not create duplicate workers when Task Scheduler is manually re-run.
if (Test-Path -LiteralPath $pidPath) {
    try {
        $existing = Get-Content -Raw -LiteralPath $pidPath | ConvertFrom-Json
        if ((Test-RunningProcess $existing.server_pid) -and (Test-RunningProcess $existing.engine_pid)) {
            exit 0
        }
    } catch {
        # Replace an incomplete or old PID file below.
    }
}

$server = Start-Process -FilePath $pythonExe -ArgumentList 'server.py' -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logPath 'server.stdout.log') -RedirectStandardError (Join-Path $logPath 'server.stderr.log') -PassThru
$engine = Start-Process -FilePath $pythonExe -ArgumentList 'engine.py', 'daemon', '--interval', '60' -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logPath 'engine.stdout.log') -RedirectStandardError (Join-Path $logPath 'engine.stderr.log') -PassThru

[pscustomobject]@{
    started_at = Get-Date -Format o
    python = $pythonExe
    server_pid = $server.Id
    engine_pid = $engine.Id
} | ConvertTo-Json | Set-Content -Path $pidPath -Encoding utf8
