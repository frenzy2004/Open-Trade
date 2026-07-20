[CmdletBinding()]
param(
    [string]$PlanPath = 'design/higgsfield/audio-plan.json',
    [string]$JobsDirectory = 'design/higgsfield/jobs',
    [string]$RawDirectory = 'work/higgsfield/raw/audio',
    [int]$Attempt = 1
)

$ErrorActionPreference = 'Stop'
if ($Attempt -ne 1 -and $Attempt -ne 2) { throw 'Attempt must be 1 or 2.' }

function Get-JobId([object]$Response) {
    foreach ($name in @('jobId', 'job_id', 'id')) {
        if ($Response.PSObject.Properties.Name -contains $name -and $Response.$name) { return [string]$Response.$name }
    }
    throw 'Higgsfield response did not contain a job ID.'
}
function Get-DownloadUrl([object]$Response) {
    foreach ($name in @('download_url', 'downloadUrl', 'url')) {
        if ($Response.PSObject.Properties.Name -contains $name -and $Response.$name) { return [string]$Response.$name }
    }
    foreach ($name in @('output', 'result', 'data')) {
        if ($Response.PSObject.Properties.Name -contains $name -and $Response.$name) {
            $url = Get-DownloadUrl $Response.$name
            if ($url) { return $url }
        }
    }
    return $null
}

$attemptRawDirectory = Join-Path $RawDirectory "attempt-$Attempt"
New-Item -ItemType Directory -Force -Path $JobsDirectory, $attemptRawDirectory | Out-Null
$plan = Get-Content -Raw $PlanPath | ConvertFrom-Json
$submissions = foreach ($asset in $plan.assets) {
    if ($asset.model -eq 'seed_audio') {
        $requestJson = higgsfield generate create seed_audio --prompt $asset.prompt --format wav --sample_rate 48000 --json
    } elseif ($asset.model -eq 'sonilo_music') {
        $requestJson = higgsfield generate create sonilo_music --prompt $asset.prompt --duration 30 --json
    } else {
        throw "Unsupported audio model: $($asset.model)"
    }
    Set-Content -Path (Join-Path $JobsDirectory "$($asset.id)-a$Attempt-request.json") -Value $requestJson -NoNewline -Encoding utf8
    [pscustomobject]@{ Asset = $asset; JobId = Get-JobId ($requestJson | ConvertFrom-Json) }
}

foreach ($submission in $submissions) {
    $completeJson = higgsfield generate wait $submission.JobId --timeout 20m --interval 5s --json
    Set-Content -Path (Join-Path $JobsDirectory "$($submission.Asset.id)-a$Attempt-complete.json") -Value $completeJson -NoNewline -Encoding utf8
    $downloadUrl = Get-DownloadUrl ($completeJson | ConvertFrom-Json)
    if (-not $downloadUrl) { throw "No raw download URL in completion for $($submission.Asset.id)." }
    Invoke-WebRequest -Uri $downloadUrl -OutFile (Join-Path $attemptRawDirectory "$($submission.Asset.id).wav")
}
