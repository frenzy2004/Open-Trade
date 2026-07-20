[CmdletBinding()]
param(
    [string]$PlanPath = 'design/higgsfield/audio-plan.json',
    [string]$JobsDirectory = 'design/higgsfield/jobs',
    [string]$RawDirectory = 'work/higgsfield/raw/audio',
    [int]$Attempt = 1
)

$ErrorActionPreference = 'Stop'
if ($Attempt -ne 1 -and $Attempt -ne 2) { throw 'Attempt must be 1 or 2.' }
Import-Module (Join-Path $PSScriptRoot 'higgsfield-job-tools.psm1') -Force

$attemptRawDirectory = Join-Path $RawDirectory "attempt-$Attempt"
New-Item -ItemType Directory -Force -Path $JobsDirectory, $attemptRawDirectory | Out-Null
$plan = Get-Content -Raw $PlanPath | ConvertFrom-Json
$submissions = foreach ($asset in $plan.assets) {
    $requestPath = Join-Path $JobsDirectory "$($asset.id)-a$Attempt-request.json"
    if (Test-Path $requestPath) {
        $requestJson = Get-Content -Raw $requestPath
    } else {
        if ($asset.model -eq 'seed_audio') {
            $requestJson = higgsfield generate create seed_audio --prompt $asset.prompt --format wav --sample_rate 48000 --json
        } elseif ($asset.model -eq 'sonilo_music') {
            $requestJson = higgsfield generate create sonilo_music --prompt $asset.prompt --duration 30 --json
        } else {
            throw "Unsupported audio model: $($asset.model)"
        }
        Set-Content -Path $requestPath -Value $requestJson -NoNewline -Encoding utf8
    }
    [pscustomobject]@{ Asset = $asset; JobId = Get-HiggsfieldJobId -JsonText $requestJson }
}

foreach ($submission in $submissions) {
    $rawPath = Join-Path $attemptRawDirectory "$($submission.Asset.id).wav"
    $completePath = Join-Path $JobsDirectory "$($submission.Asset.id)-a$Attempt-complete.json"
    if (Test-Path $completePath) {
        $completeJson = Get-Content -Raw $completePath
    } else {
        $completeJson = higgsfield generate wait $submission.JobId --timeout 20m --interval 5s --json
        Set-Content -Path $completePath -Value $completeJson -NoNewline -Encoding utf8
    }
    if (-not (Test-Path $rawPath)) {
        $downloadUrl = Get-HiggsfieldResultUrl -JsonText $completeJson
        if (-not $downloadUrl) { throw "No raw download URL in completion for $($submission.Asset.id)." }
        Invoke-WebRequest -Uri $downloadUrl -OutFile $rawPath
    }
}
