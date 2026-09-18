param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$currentStage = '初始化'

function Set-ExportStage {
    param([string]$Stage)
    $script:currentStage = $Stage
    [Console]::Error.WriteLine("[datapull] SQL Server 导出阶段：$Stage")
}

function Get-RequiredEnvironmentValue {
    param([string]$Name)
    $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "缺少内部环境变量：$Name"
    }
    return $value
}

function Get-SafeFileStem {
    param([string]$Identifier)
    $readable = [regex]::Replace($Identifier, '[<>:"/\\|?*\x00-\x1f]', '_')
    $readable = [regex]::Replace($readable, '\s+', '_').Trim('.', ' ', '_')
    if ([string]::IsNullOrWhiteSpace($readable)) { $readable = 'object' }
    if ($readable.Length -gt 100) { $readable = $readable.Substring(0, 100).TrimEnd('.', ' ') }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Identifier)
        $hash = [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant().Substring(0, 10)
    }
    finally { $sha.Dispose() }
    return "$readable--$hash"
}

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

$selectedTypes = @((Get-RequiredEnvironmentValue -Name 'DATAPULL_SQLSERVER_TYPES') | ConvertFrom-Json)
$records = New-Object System.Collections.Generic.List[object]
$objectsDirectory = Join-Path $OutputDirectory '_objects'
[System.IO.Directory]::CreateDirectory($objectsDirectory) | Out-Null

function Test-TypeSelected {
    param([string]$ObjectType)
    return $selectedTypes -contains $ObjectType
}

function Add-Record {
    param(
        [string]$Ddl,
        [string]$ObjectType,
        [AllowEmptyString()][string]$Schema,
        [string]$Name,
        [string]$Identity
    )
    if (-not (Test-TypeSelected -ObjectType $ObjectType)) { return }
    if ([string]::IsNullOrWhiteSpace($Ddl)) { throw "对象 $Identity 的 DDL 为空。" }
    $fileName = "$(Get-SafeFileStem -Identifier "$ObjectType.$Identity").sql"
    $relativePath = "_objects/$fileName"
    Write-Utf8NoBom -Path (Join-Path $objectsDirectory $fileName) -Content ($Ddl.TrimEnd() + "`n")
    $records.Add([pscustomobject]@{
        objectType = $ObjectType
        schema = if ([string]::IsNullOrWhiteSpace($Schema)) { $null } else { $Schema }
        name = $Name
        identity = $Identity
        file = $relativePath
    })
}

function Add-SmoRecord {
    param(
        [object]$Object,
        [string]$ObjectType,
        [AllowEmptyString()][string]$Schema,
        [string]$Name,
        [string]$Identity,
        [object]$Scripter
    )
    if (-not (Test-TypeSelected -ObjectType $ObjectType)) { return }
    $fragments = @($Scripter.Script(@($Object.Urn)))
    if ($fragments.Count -eq 0) { throw "对象 $Identity 的 DDL 为空。" }
    $ddl = (($fragments | ForEach-Object { $_.ToString().TrimEnd() }) -join "`nGO`n")
    Add-Record -Ddl $ddl -ObjectType $ObjectType -Schema $Schema -Name $Name -Identity $Identity
}

Set-ExportStage -Stage '加载 SqlServer 模块'
try {
    Import-Module SqlServer -ErrorAction Stop
}
catch {
    throw "缺少或无法加载 PowerShell SqlServer 模块。请运行 Install-Module SqlServer -Scope CurrentUser。原始错误：$($_.Exception.Message)"
}

$hostName = Get-RequiredEnvironmentValue -Name 'DATAPULL_SQLSERVER_HOST'
$port = Get-RequiredEnvironmentValue -Name 'DATAPULL_SQLSERVER_PORT'
$databaseName = Get-RequiredEnvironmentValue -Name 'DATAPULL_SQLSERVER_DATABASE'
$authentication = Get-RequiredEnvironmentValue -Name 'DATAPULL_SQLSERVER_AUTH'
$encrypt = (Get-RequiredEnvironmentValue -Name 'DATAPULL_SQLSERVER_ENCRYPT') -eq 'true'
$trustCertificate = (Get-RequiredEnvironmentValue -Name 'DATAPULL_SQLSERVER_TRUST_CERT') -eq 'true'

if (-not $encrypt) {
    throw 'DataPull 要求 SQL Server 启用加密。'
}

$serverConnection = New-Object Microsoft.SqlServer.Management.Common.ServerConnection
$serverConnection.ServerInstance = "$hostName,$port"
if ($serverConnection.PSObject.Properties.Name -contains 'ConnectTimeout') {
    $serverConnection.ConnectTimeout = 30
}
if ($serverConnection.PSObject.Properties.Name -contains 'StatementTimeout') {
    $serverConnection.StatementTimeout = 120
}
if ($authentication -eq 'integrated') {
    $serverConnection.LoginSecure = $true
}
else {
    $serverConnection.LoginSecure = $false
    $serverConnection.Login = Get-RequiredEnvironmentValue -Name 'DATAPULL_SQLSERVER_USER'
    $serverConnection.Password = Get-RequiredEnvironmentValue -Name 'DATAPULL_SQLSERVER_PASSWORD'
}
if ($serverConnection.PSObject.Properties.Name -contains 'EncryptConnection') {
    $serverConnection.EncryptConnection = $true
}
if ($serverConnection.PSObject.Properties.Name -contains 'TrustServerCertificate') {
    $serverConnection.TrustServerCertificate = $trustCertificate
}
elseif ($trustCertificate) {
    throw '当前 PowerShell SqlServer 模块不支持 TrustServerCertificate，请升级模块后重试。'
}

$server = New-Object Microsoft.SqlServer.Management.Smo.Server($serverConnection)
try {
    Set-ExportStage -Stage '连接目标数据库'
    $server.ConnectionContext.Connect()
    Set-ExportStage -Stage '读取数据库元数据'
    $database = $server.Databases[$databaseName]
    if ($null -eq $database) { throw "数据库不存在或当前账户不可见：$databaseName" }
    $database.Refresh()

    $options = New-Object Microsoft.SqlServer.Management.Smo.ScriptingOptions
    $options.ScriptSchema = $true
    $options.ScriptData = $false
    $options.SchemaQualify = $true
    $options.IncludeHeaders = $false
    $options.IncludeIfNotExists = $false
    $options.ScriptOwner = $false
    $options.Permissions = $false
    $options.NoFileGroup = $true
    $options.DriAll = $true
    $options.Indexes = $true
    $options.Triggers = $false
    $options.ExtendedProperties = $true

    $scripter = New-Object Microsoft.SqlServer.Management.Smo.Scripter($server)
    $scripter.Options = $options

    if (Test-TypeSelected -ObjectType 'schema') {
        Set-ExportStage -Stage '导出 schema'
        $systemSchemas = @('dbo', 'guest', 'sys', 'INFORMATION_SCHEMA')
        foreach ($schemaObject in @($database.Schemas | Where-Object { $systemSchemas -notcontains $_.Name })) {
            $escapedSchema = $schemaObject.Name.Replace(']', ']]')
            Add-Record -Ddl "CREATE SCHEMA [$escapedSchema];" -ObjectType 'schema' -Schema $schemaObject.Name -Name $schemaObject.Name -Identity $schemaObject.Name
        }
    }

    Set-ExportStage -Stage '导出 table 与表级 trigger'
    foreach ($table in @($database.Tables | Where-Object { -not $_.IsSystemObject })) {
        Add-SmoRecord -Object $table -ObjectType 'table' -Schema $table.Schema -Name $table.Name -Identity "$($table.Schema).$($table.Name)" -Scripter $scripter
        foreach ($trigger in @($table.Triggers | Where-Object { -not $_.IsSystemObject })) {
            Add-SmoRecord -Object $trigger -ObjectType 'trigger' -Schema $table.Schema -Name "$($table.Name).$($trigger.Name)" -Identity "$($table.Schema).$($table.Name).$($trigger.Name)" -Scripter $scripter
        }
    }
    Set-ExportStage -Stage '导出 view'
    foreach ($view in @($database.Views | Where-Object { -not $_.IsSystemObject })) {
        Add-SmoRecord -Object $view -ObjectType 'view' -Schema $view.Schema -Name $view.Name -Identity "$($view.Schema).$($view.Name)" -Scripter $scripter
    }
    Set-ExportStage -Stage '导出 function'
    foreach ($function in @($database.UserDefinedFunctions | Where-Object { -not $_.IsSystemObject })) {
        Add-SmoRecord -Object $function -ObjectType 'function' -Schema $function.Schema -Name $function.Name -Identity "$($function.Schema).$($function.Name)" -Scripter $scripter
    }
    Set-ExportStage -Stage '导出 procedure'
    foreach ($procedure in @($database.StoredProcedures | Where-Object { -not $_.IsSystemObject })) {
        Add-SmoRecord -Object $procedure -ObjectType 'procedure' -Schema $procedure.Schema -Name $procedure.Name -Identity "$($procedure.Schema).$($procedure.Name)" -Scripter $scripter
    }
    Set-ExportStage -Stage '导出数据库级 trigger'
    foreach ($trigger in @($database.Triggers | Where-Object { -not $_.IsSystemObject })) {
        Add-SmoRecord -Object $trigger -ObjectType 'trigger' -Schema '' -Name $trigger.Name -Identity "database.$($trigger.Name)" -Scripter $scripter
    }
    if ($database.PSObject.Properties.Name -contains 'Sequences') {
        Set-ExportStage -Stage '导出 sequence'
        foreach ($sequence in @($database.Sequences)) {
            Add-SmoRecord -Object $sequence -ObjectType 'sequence' -Schema $sequence.Schema -Name $sequence.Name -Identity "$($sequence.Schema).$($sequence.Name)" -Scripter $scripter
        }
    }
    if ($database.PSObject.Properties.Name -contains 'Synonyms') {
        Set-ExportStage -Stage '导出 synonym'
        foreach ($synonym in @($database.Synonyms)) {
            Add-SmoRecord -Object $synonym -ObjectType 'synonym' -Schema $synonym.Schema -Name $synonym.Name -Identity "$($synonym.Schema).$($synonym.Name)" -Scripter $scripter
        }
    }
    Set-ExportStage -Stage '导出用户定义类型'
    foreach ($dataType in @($database.UserDefinedDataTypes)) {
        Add-SmoRecord -Object $dataType -ObjectType 'type' -Schema $dataType.Schema -Name $dataType.Name -Identity "$($dataType.Schema).$($dataType.Name)" -Scripter $scripter
    }
    if ($database.PSObject.Properties.Name -contains 'UserDefinedTableTypes') {
        foreach ($tableType in @($database.UserDefinedTableTypes)) {
            Add-SmoRecord -Object $tableType -ObjectType 'type' -Schema $tableType.Schema -Name $tableType.Name -Identity "$($tableType.Schema).$($tableType.Name)" -Scripter $scripter
        }
    }

    Set-ExportStage -Stage '写入对象清单'
    [object[]]$recordArray = $records
    Write-Utf8NoBom -Path (Join-Path $OutputDirectory 'objects.json') -Content ((ConvertTo-Json -InputObject $recordArray -Depth 5) + "`n")
}
catch {
    throw "SQL Server 结构导出失败（阶段：$currentStage）。原始错误：$($_.Exception.Message)"
}
finally {
    if ($serverConnection.IsOpen) { $serverConnection.Disconnect() }
    Remove-Item Env:DATAPULL_SQLSERVER_PASSWORD -ErrorAction SilentlyContinue
}
