param([string]$Version = "1.0.90")

$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputDirectory = Join-Path $workspace "backups\releases-local"
$archive = Join-Path $outputDirectory "loteria-server-v$($Version.Replace('.', '_')).tar.gz"

Push-Location $workspace
try {
    $dirty = git status --porcelain -- server
    if ($dirty) { throw "Server working tree is not clean. Commit or review changes before packaging." }

    Push-Location (Join-Path $workspace "server")
    try {
        npm run check
        if ($LASTEXITCODE -ne 0) { throw "Server checks failed" }
    } finally {
        Pop-Location
    }

    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    git archive --format=tar.gz --output="$archive" "HEAD:server"
    if ($LASTEXITCODE -ne 0) { throw "git archive failed" }
} finally {
    Pop-Location
}

$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$archive.sha256" -Value "$hash  $([IO.Path]::GetFileName($archive))" -Encoding ascii
Write-Output "Archive: $archive"
Write-Output "SHA-256: $hash"
