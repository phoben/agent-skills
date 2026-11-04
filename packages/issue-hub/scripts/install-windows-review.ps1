param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

# 此脚本只安装独立验收源，已有正式Issue Hub时不并装、不替换原插件源。
try {
  foreach ($issueHubTool in @('node', 'git', 'gh', 'codex')) {
    if (-not (Get-Command $issueHubTool -CommandType Application -ErrorAction SilentlyContinue)) { throw "缺少 $issueHubTool，请先安装后重试。" }
  }
  $issueHubNodeVersion = (& node --version).Trim()
  if ($issueHubNodeVersion -notmatch '^v24\.') { throw '需要Node 24，请更新后重试。' }
  $issueHubBundle = $PSScriptRoot
  Set-Location -LiteralPath $issueHubBundle
  $issueHubManifest = Get-Content -LiteralPath (Join-Path $issueHubBundle 'package-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($issueHubManifest.name -ne 'issue-hub' -or $issueHubManifest.marketplace -ne 'issue-hub-review' -or $issueHubManifest.version -notmatch '^\d+\.\d+\.\d+$') { throw '验收包清单无效。' }
  foreach ($issueHubFile in $issueHubManifest.files) {
    $issueHubFilePath = Join-Path $issueHubBundle $issueHubFile.path
    $issueHubHashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
    $issueHubHashStream = [System.IO.File]::OpenRead($issueHubFilePath)
    try { $issueHubHash = [BitConverter]::ToString($issueHubHashAlgorithm.ComputeHash($issueHubHashStream)).Replace('-', '').ToLowerInvariant() }
    finally { $issueHubHashStream.Dispose(); $issueHubHashAlgorithm.Dispose() }
    if ($issueHubHash -ne $issueHubFile.sha256) { throw "文件校验失败：$($issueHubFile.path)" }
  }
  $issueHubPreviousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $issueHubDoctorText = & node (Join-Path $issueHubBundle 'plugins/issue-hub/dist/issue-hub.cjs') --doctor 2>$null
    $issueHubDoctorCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $issueHubPreviousPreference }
  $issueHubDoctor = ($issueHubDoctorText -join "`n") | ConvertFrom-Json
  foreach ($issueHubCheck in $issueHubDoctor.data.checks) {
    Write-Host "$($issueHubCheck.label)：$($issueHubCheck.message)"
    if ($issueHubCheck.status -ne 'ok' -and $issueHubCheck.action) { Write-Host "  $($issueHubCheck.action)" }
  }
  if ($issueHubDoctorCode -ne 0) { throw '环境检查未通过，请按提示处理后重试。' }
  if ($CheckOnly) { Write-Host '检查完成，未注册或安装插件。'; exit 0 }
  $issueHubInventoryText = & codex plugin list --json
  if ($LASTEXITCODE -ne 0) { throw '无法读取现有插件，未开始安装。' }
  $issueHubInventory = ($issueHubInventoryText -join "`n") | ConvertFrom-Json
  $issueHubExisting = @($issueHubInventory.installed | Where-Object { $_.name -eq 'issue-hub' })
  if (@($issueHubExisting | Where-Object { $_.pluginId -ne 'issue-hub@issue-hub-review' }).Count -gt 0) { throw '已有正式Issue Hub，请从原源更新，不要并装验收版。' }
  $issueHubSame = $issueHubExisting | Where-Object { $_.version -eq $issueHubManifest.version } | Select-Object -First 1
  if ($issueHubSame) { Write-Host '当前版本已安装。请重新打开Issue Hub。'; exit 0 }
  if (@($issueHubExisting | Where-Object { [version]$_.version -gt [version]$issueHubManifest.version }).Count -gt 0) { throw '已安装较新版本，不自动降级。' }
  & codex plugin marketplace add $issueHubBundle --json
  if ($LASTEXITCODE -ne 0) { throw '验收源注册失败，未继续安装。' }
  & codex plugin add 'issue-hub@issue-hub-review' --json
  if ($LASTEXITCODE -ne 0) { throw '安装失败，请保留原缓存并核对提示，不要覆盖运行中文件。' }
  Write-Host 'Issue Hub验收版已安装，请在Codex中重新打开插件。正式发布后从原yg源安装，勿并装两个来源。'
} catch { Write-Error $_.Exception.Message; exit 1 }
