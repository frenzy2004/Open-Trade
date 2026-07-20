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
Import-Module (Join-Path $PSScriptRoot 'higgsfield-job-tools.psm1') -Force

$inputs = @()
$effectiveInputRoot = $InputRoot
$effectiveOutputRoot = $OutputRoot
if ($FrameRoot) {
    $inputs = @(Get-ChildItem -Path $FrameRoot -Filter '*.png' -File | Sort-Object Name)
    if ($inputs.Count -ne 16) { throw "Expected exactly 16 animation frames under $FrameRoot; found $($inputs.Count)." }
} else {
    $effectiveInputRoot = Join-Path $InputRoot "attempt-$Attempt"
    $effectiveOutputRoot = Join-Path $OutputRoot "attempt-$Attempt"
    $plan = Get-Content -Raw $PlanPath | ConvertFrom-Json
    $transparentAssets = @($plan.assets | Where-Object transparent)
    if ($transparentAssets.Count -ne 6) { throw "Expected exactly six transparent static assets; found $($transparentAssets.Count)." }
    foreach ($asset in $transparentAssets) {
        $matches = @(Get-ChildItem -Path $effectiveInputRoot -File | Where-Object BaseName -eq $asset.id)
        if ($matches.Count -ne 1) { throw "Expected exactly one transparent source for $($asset.id) under $effectiveInputRoot; found $($matches.Count)." }
        $inputs += $matches[0]
    }
    if ($inputs.Count -ne 6) { throw "Expected exactly six transparent static inputs; found $($inputs.Count)." }
}
New-Item -ItemType Directory -Force -Path $effectiveOutputRoot, $JobsDirectory | Out-Null

$submissions = foreach ($input in $inputs) {
    $key = if ($FrameRoot -and $ProvenancePrefix) { "$ProvenancePrefix-$($input.BaseName)-remove-bg-a$Attempt" } else { "$($input.BaseName)-remove-bg-a$Attempt" }
    $requestPath = Join-Path $JobsDirectory "$key-request.json"
    if (Test-Path $requestPath) {
        $requestJson = Get-Content -Raw $requestPath
    } else {
        $requestJson = higgsfield generate create image_background_remover --image $input.FullName --json
        Set-Content -Path $requestPath -Value $requestJson -NoNewline -Encoding utf8
    }
    [pscustomobject]@{ Input = $input; Key = $key; JobId = Get-HiggsfieldJobId -JsonText $requestJson }
}

foreach ($submission in $submissions) {
    $rawPath = Join-Path $effectiveOutputRoot "$($submission.Input.BaseName).png"
    $completePath = Join-Path $JobsDirectory "$($submission.Key)-complete.json"
    if (Test-Path $completePath) {
        $completeJson = Get-Content -Raw $completePath
    } else {
        $completeJson = higgsfield generate wait $submission.JobId --timeout 20m --interval 5s --json
        Set-Content -Path $completePath -Value $completeJson -NoNewline -Encoding utf8
    }
    if (-not (Test-Path $rawPath)) {
        $downloadUrl = Get-HiggsfieldResultUrl -JsonText $completeJson
        if (-not $downloadUrl) { throw "No raw download URL in completion for $($submission.Input.Name)." }
        Invoke-WebRequest -Uri $downloadUrl -OutFile $rawPath
    }
}
