Set-StrictMode -Version Latest

function ConvertFrom-HiggsfieldJson {
    param([Parameter(Mandatory)][string]$JsonText)

    try {
        return $JsonText | ConvertFrom-Json -ErrorAction Stop
    } catch {
        throw "Invalid Higgsfield JSON response: $($_.Exception.Message)"
    }
}

function Get-HiggsfieldJobId {
    param([Parameter(Mandatory)][string]$JsonText)

    $response = ConvertFrom-HiggsfieldJson -JsonText $JsonText
    if ($response -is [System.Array]) {
        if ($response.Count -ne 1 -or -not ($response[0] -is [string]) -or [string]::IsNullOrWhiteSpace($response[0])) {
            throw 'Higgsfield create response must contain one non-empty job ID.'
        }
        return [string]$response[0]
    }
    if ($response -is [string] -and -not [string]::IsNullOrWhiteSpace($response)) { return $response }
    foreach ($name in @('jobId', 'job_id', 'id')) {
        if ($response.PSObject.Properties.Name -contains $name -and $response.$name) { return [string]$response.$name }
    }
    throw 'Higgsfield response did not contain a job ID.'
}

function Get-HiggsfieldResultUrl {
    param([Parameter(Mandatory)][string]$JsonText)

    $response = ConvertFrom-HiggsfieldJson -JsonText $JsonText
    return Get-HiggsfieldResultUrlFromObject -Response $response
}

function Get-HiggsfieldResultUrlFromObject {
    param([Parameter(Mandatory)][object]$Response)

    if ($Response.PSObject.Properties.Name -contains 'result_url' -and $Response.result_url) {
        return [string]$Response.result_url
    }
    foreach ($name in @('download_url', 'downloadUrl', 'url')) {
        if ($Response.PSObject.Properties.Name -contains $name -and $Response.$name) { return [string]$Response.$name }
    }
    foreach ($name in @('output', 'result', 'data')) {
        if ($Response.PSObject.Properties.Name -contains $name -and $Response.$name) {
            $url = Get-HiggsfieldResultUrlFromObject -Response $Response.$name
            if ($url) { return $url }
        }
    }
    return $null
}

Export-ModuleMember -Function Get-HiggsfieldJobId, Get-HiggsfieldResultUrl
