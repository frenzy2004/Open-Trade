[CmdletBinding()]
param(
    [string]$PlanPath = 'design/higgsfield/generation-plan.json',
    [string]$InputRoot = 'work/higgsfield/raw/static',
    [string]$OutputRoot = 'work/higgsfield/raw/alpha',
    [string]$FrameRoot,
    [int]$Attempt = 1,
    [string]$ProvenancePrefix,
    [string]$JobsDirectory = 'design/higgsfield/jobs'
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

$inputs = @()
if ($FrameRoot) {
    $inputs = @(Get-ChildItem -Path $FrameRoot -Filter '*.png' -File | Sort-Object Name)
    if ($inputs.Count -ne 16) { throw "Expected exactly 16 animation frames under $FrameRoot; found $($inputs.Count)." }
} else {
    $plan = Get-Content -Raw $PlanPath | ConvertFrom-Json
    $transparentAssets = @($plan.assets | Where-Object transparent)
    if ($transparentAssets.Count -ne 6) { throw "Expected exactly six transparent static assets; found $($transparentAssets.Count)." }
    foreach ($asset in $transparentAssets) {
        $matches = @(Get-ChildItem -Path $InputRoot -File | Where-Object BaseName -eq $asset.id)
        if ($matches.Count -ne 1) { throw "Expected exactly one transparent source for $($asset.id) under $InputRoot; found $($matches.Count)." }
        $inputs += $matches[0]
    }
    if ($inputs.Count -ne 6) { throw "Expected exactly six transparent static inputs; found $($inputs.Count)." }
}
New-Item -ItemType Directory -Force -Path $OutputRoot, $JobsDirectory | Out-Null

$submissions = foreach ($input in $inputs) {
    $requestJson = higgsfield generate create image_background_remover --image $input.FullName --json
    $key = if ($FrameRoot -and $ProvenancePrefix) { "$ProvenancePrefix-$($input.BaseName)-remove-bg-a$Attempt" } else { "$($input.BaseName)-remove-bg-a$Attempt" }
    Set-Content -Path (Join-Path $JobsDirectory "$key-request.json") -Value $requestJson -NoNewline -Encoding utf8
    [pscustomobject]@{ Input = $input; Key = $key; JobId = Get-JobId ($requestJson | ConvertFrom-Json) }
}

foreach ($submission in $submissions) {
    $completeJson = higgsfield generate wait $submission.JobId --timeout 20m --interval 5s --json
    Set-Content -Path (Join-Path $JobsDirectory "$($submission.Key)-complete.json") -Value $completeJson -NoNewline -Encoding utf8
    $downloadUrl = Get-DownloadUrl ($completeJson | ConvertFrom-Json)
    if (-not $downloadUrl) { throw "No raw download URL in completion for $($submission.Input.Name)." }
    Invoke-WebRequest -Uri $downloadUrl -OutFile (Join-Path $OutputRoot "$($submission.Input.BaseName).png")
}
