function ConvertTo-RecordJson {
    param(
        [Parameter(Mandatory = $true)]
        [System.Collections.Generic.List[object]]$Records
    )

    # PowerShell 7 对泛型 List[object] 使用 @($Records) 时可能抛出参数类型不匹配。
    [object[]]$recordArray = $Records
    return ConvertTo-Json -InputObject $recordArray -Depth 5
}
