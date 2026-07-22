$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'manifest.json') | ConvertFrom-Json
$versions = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'versions.json') | ConvertFrom-Json
$main = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'main.js')
$styles = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'styles.css')
$entry = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'community-plugin-entry.json') | ConvertFrom-Json

$checks = [ordered]@{
  'release.required-assets' = @('main.js', 'manifest.json', 'styles.css') | ForEach-Object { Test-Path (Join-Path $root $_) } | Where-Object { -not $_ } | Measure-Object | Select-Object -ExpandProperty Count
  'manifest.mobile-compatible' = ($manifest.isDesktopOnly -eq $false)
  'manifest.version-mapped' = ($versions.PSObject.Properties.Name -contains $manifest.version)
  'directory.identity-matches' = ($entry.id -eq $manifest.id -and $entry.name -eq $manifest.name -and $entry.author -eq $manifest.author)
  'ui.single-screen-actions' = ($main.Contains('jdb-command-add-files') -and $main.Contains('jdb-command-submit') -and $main.Contains('jdb-command-receipt'))
  'ui.preview-and-remove' = ($main.Contains('URL.createObjectURL') -and $main.Contains('jdb-command-remove-file') -and $main.Contains('aria-live'))
  'ui.voice-recording' = ($main.Contains('jdb-command-record-voice') -and $main.Contains('jdb-command-stop-voice') -and $main.Contains('navigator.mediaDevices.getUserMedia') -and $main.Contains('new MediaRecorder'))
  'files.multi-selection-accumulates' = ($main.Contains('fileInput.multiple = true') -and $main.Contains('selectedFiles.push'))
  'files.standard-sync-chunking' = ($main.Contains('SYNC_SAFE_CHUNK_BYTES') -and $main.Contains('.jdbparts.md') -and $main.Contains('encoding: "base64"') -and $main.Contains('sha256Hex'))
  'failure.partial-files-rollback' = ($main.Contains('await this.app.vault.delete(partial, true)'))
  'privacy.no-network-adapter' = (-not ($main -match '\b(fetch|XMLHttpRequest|WebSocket)\b'))
  'styles.mobile-layout' = ($styles.Contains('@media (max-width: 480px)'))
}

$failed = @()
foreach ($name in $checks.Keys) {
  $value = $checks[$name]
  $passed = if ($name -eq 'release.required-assets') { $value -eq 0 } else { [bool]$value }
  if (-not $passed) { $failed += $name }
  [pscustomobject]@{ name = $name; passed = $passed }
}

if ($failed.Count) {
  throw "Release verification failed: $($failed -join ', ')"
}
