# Récupère le dernier App Bundle non signé (version GitHub « android-latest ») et le signe avec la clé d'envoi
# gardée dans %USERPROFILE%\.evolia (keystore.properties + .jks, jamais dans le dépôt).
#   powershell -ExecutionPolicy Bypass -File tools\app\sign-aab.ps1
# Le fichier signé, prêt pour la Play Console, arrive dans %USERPROFILE%\Downloads\evolia-play\.
$ErrorActionPreference = 'Stop'
$keys = Join-Path $env:USERPROFILE '.evolia'
$props = @{}
foreach ($line in Get-Content (Join-Path $keys 'keystore.properties')) {
	if ($line -match '^\s*([^=#]+)=(.*)$') { $props[$Matches[1].Trim()] = $Matches[2].Trim() }
}
$out = Join-Path $env:USERPROFILE 'Downloads\evolia-play'
New-Item -ItemType Directory -Force $out | Out-Null

$release = Invoke-RestMethod 'https://api.github.com/repos/zed69000/Evolia/releases/tags/android-latest'
$asset = $release.assets | Where-Object { $_.name -like '*.aab' } | Sort-Object updated_at -Descending | Select-Object -First 1
if (-not $asset) { throw "Aucun App Bundle dans la version android-latest" }
$unsigned = Join-Path $out $asset.name
Invoke-WebRequest $asset.browser_download_url -OutFile $unsigned
$signed = $unsigned -replace '-unsigned\.aab$', '.aab'
Copy-Item $unsigned $signed -Force

$jarsigner = Get-Command jarsigner -ErrorAction SilentlyContinue
if (-not $jarsigner) { throw "jarsigner introuvable : installer un JDK (Temurin)" }
& $jarsigner.Source -keystore (Join-Path $keys $props.storeFile) -storepass $props.storePassword -keypass $props.keyPassword `
	-sigalg SHA256withRSA -digestalg SHA-256 $signed $props.keyAlias | Out-Null
& $jarsigner.Source -verify $signed | Select-Object -Last 1
Remove-Item $unsigned
Write-Output "Prêt pour la Play Console : $signed"
