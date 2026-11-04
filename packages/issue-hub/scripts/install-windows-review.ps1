param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

# 安装完整YG包；节点助手固定核验内容和宿主接口，不复制登录或业务数据。
try {
  if (-not (Get-Command node -CommandType Application -ErrorAction SilentlyContinue)) { throw '缺少Node，请先安装Node 24。' }
  $toolkitArguments = @((Join-Path $PSScriptRoot 'install-toolkit.cjs'), '--bundle', $PSScriptRoot)
  if ($CheckOnly) { $toolkitArguments += '--check-only' }
  & node @toolkitArguments
  if ($LASTEXITCODE -ne 0) { throw 'YG检查或安装未完成，请按上述提示处理；原Issue数据与缓存保留。' }
  if ($CheckOnly) { Write-Host '检查完成，未注册、安装或停用插件。' }
  else { Write-Host 'YG Toolkit已核验安装，Tokens与Issue Hub分别保留页面入口。请重新打开Codex插件页面。' }
} catch { Write-Error $_.Exception.Message; exit 1 }
