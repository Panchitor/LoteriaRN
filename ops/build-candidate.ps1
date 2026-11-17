param(
    [string]$Version = "1.0.86",
    [switch]$KeepBuildCache
)

$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$appRoot = Join-Path $workspace "app-tv"
$androidRoot = Join-Path $appRoot "android"
$signingBackup = Join-Path $workspace ".secrets\signing\debug.keystore"
$activeSigning = Join-Path $androidRoot "app\debug.keystore"
$gradleHome = Join-Path $appRoot ".gradle-user"
$outputDirectory = Join-Path $workspace "backups\releases-local"
$apkOutput = Join-Path $androidRoot "app\build\outputs\apk\release\app-release.apk"
$candidate = Join-Path $outputDirectory "loteria-tv-v$($Version.Replace('.', '_'))-candidate.apk"
$expectedVersionCode = [int](($Version -split '\.')[-1])

$appConfig = Get-Content (Join-Path $appRoot "app.json") -Raw | ConvertFrom-Json
if ($appConfig.expo.version -ne $Version) {
    throw "app.json has version $($appConfig.expo.version), expected $Version"
}
if (-not (Test-Path -LiteralPath $signingBackup)) { throw "Missing private signing backup: $signingBackup" }
if (-not (Test-Path -LiteralPath $activeSigning)) {
    Copy-Item -LiteralPath $signingBackup -Destination $activeSigning
}
$backupHash = (Get-FileHash -LiteralPath $signingBackup -Algorithm SHA256).Hash
$activeHash = (Get-FileHash -LiteralPath $activeSigning -Algorithm SHA256).Hash
if ($backupHash -ne $activeHash) { throw "The active Android signing key does not match the stable key" }

$javaHome = "C:\Program Files\Android\Android Studio\jbr"
if (-not (Test-Path -LiteralPath (Join-Path $javaHome "bin\java.exe"))) {
    throw "Android Studio JDK not found at $javaHome"
}
$env:JAVA_HOME = $javaHome
$env:GRADLE_USER_HOME = $gradleHome
$env:NODE_ENV = "production"

Push-Location $appRoot
try {
    npm run check
    if ($LASTEXITCODE -ne 0) { throw "App checks failed" }
    Push-Location $androidRoot
    try {
        & ".\gradlew.bat" ":app:assembleRelease" "--no-daemon"
        if ($LASTEXITCODE -ne 0) { throw "Android release build failed" }
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $apkOutput)) { throw "Release APK was not generated" }
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
Copy-Item -LiteralPath $apkOutput -Destination $candidate -Force
$hash = (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$candidate.sha256" -Value "$hash  $([IO.Path]::GetFileName($candidate))" -Encoding ascii

$sdkRoot = "C:\Users\frapp\AppData\Local\Android\Sdk"
$buildTools = Get-ChildItem (Join-Path $sdkRoot "build-tools") -Directory |
    Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (-not $buildTools) { throw "Android build-tools not found" }
$apkSigner = Join-Path $buildTools.FullName "apksigner.bat"
$aapt = Join-Path $buildTools.FullName "aapt.exe"
& $apkSigner verify --verbose --print-certs $candidate
if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed" }
$badging = (& $aapt dump badging $candidate | Select-Object -First 1)
if ($badging -notmatch "versionCode='$expectedVersionCode'" -or $badging -notmatch "versionName='$([regex]::Escape($Version))'") {
    throw "Unexpected APK version metadata: $badging"
}

$stableApk = Join-Path $outputDirectory "loteria-tv-v1_0_85-estable.apk"
if (Test-Path -LiteralPath $stableApk) {
    $candidateCert = (& $apkSigner verify --print-certs $candidate | Select-String "certificate SHA-256 digest").ToString().Split(':')[-1].Trim()
    $stableCert = (& $apkSigner verify --print-certs $stableApk | Select-String "certificate SHA-256 digest").ToString().Split(':')[-1].Trim()
    if (-not $candidateCert -or $candidateCert -ne $stableCert) {
        throw "Candidate certificate does not match stable 1.0.85"
    }
}

if (-not $KeepBuildCache) {
    foreach ($target in @($gradleHome, (Join-Path $androidRoot "app\build"), (Join-Path $androidRoot "build"))) {
        if (Test-Path -LiteralPath $target) {
            $resolved = (Resolve-Path -LiteralPath $target).Path
            if (-not $resolved.StartsWith($appRoot, [StringComparison]::OrdinalIgnoreCase)) {
                throw "Refusing to clean unexpected path: $resolved"
            }
            Remove-Item -LiteralPath $resolved -Recurse -Force
        }
    }
}

Write-Output "Candidate: $candidate"
Write-Output "SHA-256: $hash"
