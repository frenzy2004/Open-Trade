[CmdletBinding()]
param(
    [string]$PlanPath = 'design/higgsfield/generation-plan.json',
    [string]$StylePath = 'design/style-formula.txt',
    [string]$JobsDirectory = 'design/higgsfield/jobs',
    [string]$RawDirectory = 'work/higgsfield/raw/static',
    [int]$Attempt = 1
)

$ErrorActionPreference = 'Stop'
if ($Attempt -ne 1 -and $Attempt -ne 2) { throw 'Attempt must be 1 or 2.' }
Import-Module (Join-Path $PSScriptRoot 'higgsfield-job-tools.psm1') -Force
$templates = @{
    background = 'game background of {0}, wide establishing view, '
    sprite = 'game sprite of {0}, single character/object, full body visible, centered, '
    ui = 'game UI element: {0}, single element, centered, '
}
$suffixes = @{
    background = ', no characters, no UI elements, slightly muted detail so foreground game elements stay readable, soft depth layering'
    sprite = ', on a solid uniform bright magenta #FF00FF background, no shadows cast on the background, no ground plane, nothing cropped at the edges'
    ui = ', no letters, no words, no numerals, on a solid uniform bright magenta #FF00FF background, crisp edges, no drop shadow outside the element'
}

$attemptRawDirectory = Join-Path $RawDirectory "attempt-$Attempt"
New-Item -ItemType Directory -Force -Path $JobsDirectory, $attemptRawDirectory | Out-Null
$plan = Get-Content -Raw $PlanPath | ConvertFrom-Json
$style = (Get-Content -Raw $StylePath).TrimEnd()
$submissions = foreach ($asset in $plan.assets) {
    if (-not $templates.ContainsKey($asset.kind)) { throw "Unsupported asset kind: $($asset.kind)" }
    $prompt = (($templates[$asset.kind] -f $asset.description) + $style + $suffixes[$asset.kind])
    $args = @(
        'generate','create','nano_banana_flash',
        '--prompt',$prompt,
        '--aspect_ratio',$asset.aspectRatio,
        '--resolution',$asset.resolution,
        '--json'
    )
    $requestPath = Join-Path $JobsDirectory "$($asset.id)-a$Attempt-request.json"
    if (Test-Path $requestPath) {
        $requestJson = Get-Content -Raw $requestPath
    } else {
        $requestJson = & higgsfield @args
        Set-Content -Path $requestPath -Value $requestJson -NoNewline -Encoding utf8
    }
    [pscustomobject]@{ Asset = $asset; JobId = Get-HiggsfieldJobId -JsonText $requestJson }
}

foreach ($submission in $submissions) {
    $extension = if ($submission.Asset.transparent) { '.png' } else { '.webp' }
    $rawPath = Join-Path $attemptRawDirectory "$($submission.Asset.id)$extension"
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
