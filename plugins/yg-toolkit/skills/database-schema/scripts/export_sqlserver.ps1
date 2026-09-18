param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

$commonScript = Join-Path $PSScriptRoot 'sqlserver_common.ps1'
if (-not (Test-Path -LiteralPath $commonScript -PathType Leaf)) {
    throw "SQL Server 公共辅助脚本不存在：$commonScript"
}
. $commonScript

function Get-RequiredEnvironmentValue {
    param([string]$Name)

    $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "缺少内部环境变量：$Name"
    }
    return $value
}

function ConvertTo-Boolean {
    param([string]$Value)
    return $Value -eq 'true'
}

function Get-SafeFileStem {
    param([string]$Identifier)

    $readable = [regex]::Replace($Identifier, '[<>:"/\\|?*\x00-\x1f]', '_')
    $readable = [regex]::Replace($readable, '\s+', '_').Trim('.', ' ', '_')
    if ([string]::IsNullOrWhiteSpace($readable)) {
        $readable = 'object'
    }
    if ($readable.Length -gt 100) {
        $readable = $readable.Substring(0, 100).TrimEnd('.', ' ')
    }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Identifier)
        $hash = [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant().Substring(0, 10)
    }
    finally {
        $sha.Dispose()
    }
    return "$readable--$hash"
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

$records = New-Object System.Collections.Generic.List[object]

function Write-SmoObject {
    param(
        [object]$Object,
        [string]$ObjectType,
        [string]$Schema,
        [string]$Name,
        [string]$Identifier,
        [object]$Scripter
    )

    $folder = Join-Path $OutputDirectory $ObjectType
    [System.IO.Directory]::CreateDirectory($folder) | Out-Null
    $fileName = "$(Get-SafeFileStem -Identifier $Identifier).sql"
    $path = Join-Path $folder $fileName
    $fragments = @($Scripter.Script(@($Object.Urn)))
    if ($fragments.Count -eq 0) {
        throw "对象 $Identifier 的 DDL 为空。"
    }
    $content = (($fragments | ForEach-Object { $_.ToString().TrimEnd() }) -join "`r`nGO`r`n") + "`r`n"
    Write-Utf8NoBom -Path $path -Content $content
    $relative = "$ObjectType/$fileName"
    $records.Add([pscustomobject]@{
        object_type = $ObjectType
        schema = if ([string]::IsNullOrWhiteSpace($Schema)) { $null } else { $Schema }
        name = $Name
        file = $relative
    })
}

function Write-TextObject {
    param(
        [string]$Ddl,
        [string]$ObjectType,
        [string]$Schema,
        [string]$Name,
        [string]$Identifier
    )

    $folder = Join-Path $OutputDirectory $ObjectType
    [System.IO.Directory]::CreateDirectory($folder) | Out-Null
    $fileName = "$(Get-SafeFileStem -Identifier $Identifier).sql"
    $path = Join-Path $folder $fileName
    Write-Utf8NoBom -Path $path -Content ($Ddl.TrimEnd() + "`r`n")
    $records.Add([pscustomobject]@{
        object_type = $ObjectType
        schema = if ([string]::IsNullOrWhiteSpace($Schema)) { $null } else { $Schema }
        name = $Name
        file = "$ObjectType/$fileName"
    })
}

try {
    Import-Module SqlServer -ErrorAction Stop
}
catch {
    throw "缺少或无法加载 PowerShell SqlServer 模块。请在用户确认后运行 Install-Module SqlServer -Scope CurrentUser。原始错误：$($_.Exception.Message)"
}

$hostName = Get-RequiredEnvironmentValue -Name 'DB_SCHEMA_SQLSERVER_HOST'
$port = Get-RequiredEnvironmentValue -Name 'DB_SCHEMA_SQLSERVER_PORT'
$databaseName = Get-RequiredEnvironmentValue -Name 'DB_SCHEMA_SQLSERVER_DATABASE'
$authentication = Get-RequiredEnvironmentValue -Name 'DB_SCHEMA_SQLSERVER_AUTH'
$encrypt = ConvertTo-Boolean -Value ([Environment]::GetEnvironmentVariable('DB_SCHEMA_SQLSERVER_ENCRYPT', 'Process'))
$trustCertificate = ConvertTo-Boolean -Value ([Environment]::GetEnvironmentVariable('DB_SCHEMA_SQLSERVER_TRUST_CERT', 'Process'))

$serverConnection = New-Object Microsoft.SqlServer.Management.Common.ServerConnection
$serverConnection.ServerInstance = "$hostName,$port"
if ($authentication -eq 'integrated') {
    $serverConnection.LoginSecure = $true
}
else {
    $serverConnection.LoginSecure = $false
    $serverConnection.Login = Get-RequiredEnvironmentValue -Name 'DB_SCHEMA_SQLSERVER_USER'
    $serverConnection.Password = Get-RequiredEnvironmentValue -Name 'DB_SCHEMA_SQLSERVER_PASSWORD'
}
if ($serverConnection.PSObject.Properties.Name -contains 'EncryptConnection') {
    $serverConnection.EncryptConnection = $encrypt
}
if ($serverConnection.PSObject.Properties.Name -contains 'TrustServerCertificate') {
    $serverConnection.TrustServerCertificate = $trustCertificate
}

$server = New-Object Microsoft.SqlServer.Management.Smo.Server($serverConnection)
try {
    $server.ConnectionContext.Connect()
    $database = $server.Databases[$databaseName]
    if ($null -eq $database) {
        throw "数据库不存在或当前账户不可见：$databaseName"
    }
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

    $systemSchemas = @('dbo', 'guest', 'sys', 'INFORMATION_SCHEMA')
    foreach ($schemaObject in @($database.Schemas | Where-Object { $systemSchemas -notcontains $_.Name })) {
        $escapedSchema = $schemaObject.Name.Replace(']', ']]')
        Write-TextObject -Ddl "CREATE SCHEMA [$escapedSchema];" -ObjectType 'schema' -Schema $schemaObject.Name -Name $schemaObject.Name -Identifier $schemaObject.Name
    }

    foreach ($table in @($database.Tables | Where-Object { -not $_.IsSystemObject })) {
        Write-SmoObject -Object $table -ObjectType 'table' -Schema $table.Schema -Name $table.Name -Identifier "$($table.Schema).$($table.Name)" -Scripter $scripter
        foreach ($trigger in @($table.Triggers | Where-Object { -not $_.IsSystemObject })) {
            Write-SmoObject -Object $trigger -ObjectType 'trigger' -Schema $table.Schema -Name "$($table.Name).$($trigger.Name)" -Identifier "$($table.Schema).$($table.Name).$($trigger.Name)" -Scripter $scripter
        }
    }

    foreach ($view in @($database.Views | Where-Object { -not $_.IsSystemObject })) {
        Write-SmoObject -Object $view -ObjectType 'view' -Schema $view.Schema -Name $view.Name -Identifier "$($view.Schema).$($view.Name)" -Scripter $scripter
    }
    foreach ($function in @($database.UserDefinedFunctions | Where-Object { -not $_.IsSystemObject })) {
        Write-SmoObject -Object $function -ObjectType 'function' -Schema $function.Schema -Name $function.Name -Identifier "$($function.Schema).$($function.Name)" -Scripter $scripter
    }
    foreach ($procedure in @($database.StoredProcedures | Where-Object { -not $_.IsSystemObject })) {
        Write-SmoObject -Object $procedure -ObjectType 'procedure' -Schema $procedure.Schema -Name $procedure.Name -Identifier "$($procedure.Schema).$($procedure.Name)" -Scripter $scripter
    }
    foreach ($trigger in @($database.Triggers | Where-Object { -not $_.IsSystemObject })) {
        Write-SmoObject -Object $trigger -ObjectType 'trigger' -Schema $null -Name $trigger.Name -Identifier "database.$($trigger.Name)" -Scripter $scripter
    }

    if ($database.PSObject.Properties.Name -contains 'Sequences') {
        foreach ($sequence in @($database.Sequences)) {
            Write-SmoObject -Object $sequence -ObjectType 'sequence' -Schema $sequence.Schema -Name $sequence.Name -Identifier "$($sequence.Schema).$($sequence.Name)" -Scripter $scripter
        }
    }
    if ($database.PSObject.Properties.Name -contains 'Synonyms') {
        foreach ($synonym in @($database.Synonyms)) {
            Write-SmoObject -Object $synonym -ObjectType 'synonym' -Schema $synonym.Schema -Name $synonym.Name -Identifier "$($synonym.Schema).$($synonym.Name)" -Scripter $scripter
        }
    }
    foreach ($dataType in @($database.UserDefinedDataTypes)) {
        Write-SmoObject -Object $dataType -ObjectType 'type' -Schema $dataType.Schema -Name $dataType.Name -Identifier "$($dataType.Schema).$($dataType.Name)" -Scripter $scripter
    }
    if ($database.PSObject.Properties.Name -contains 'UserDefinedTableTypes') {
        foreach ($tableType in @($database.UserDefinedTableTypes)) {
            Write-SmoObject -Object $tableType -ObjectType 'type' -Schema $tableType.Schema -Name $tableType.Name -Identifier "$($tableType.Schema).$($tableType.Name)" -Scripter $scripter
        }
    }

    $objectsPath = Join-Path $OutputDirectory 'objects.json'
    $json = ConvertTo-RecordJson -Records $records
    Write-Utf8NoBom -Path $objectsPath -Content ($json + "`n")
}
finally {
    if ($serverConnection.IsOpen) {
        $serverConnection.Disconnect()
    }
    Remove-Item Env:DB_SCHEMA_SQLSERVER_PASSWORD -ErrorAction SilentlyContinue
}
