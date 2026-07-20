[CmdletBinding()]
param(
    [string]$PlanPath = 'design/higgsfield/generation-plan.json',
    [string]$StylePath = 'design/style-formula.txt',
    [string]$JobsDirectory = 'design/higgsfield/jobs',
    [string]$RawDirectory = 'work/higgsfield/raw/static'
)

$ErrorActionPreference = 'Stop'
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

New-Item -ItemType Directory -Force -Path $JobsDirectory, $RawDirectory | Out-Null
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
    $requestJson = & higgsfield @args
    $requestPath = Join-Path $JobsDirectory "$($asset.id)-request.json"
    Set-Content -Path $requestPath -Value $requestJson -NoNewline -Encoding utf8
    [pscustomobject]@{ Asset = $asset; JobId = Get-JobId ($requestJson | ConvertFrom-Json) }
}

foreach ($submission in $submissions) {
    $completeJson = higgsfield generate wait $submission.JobId --timeout 20m --interval 5s --json
    Set-Content -Path (Join-Path $JobsDirectory "$($submission.Asset.id)-complete.json") -Value $completeJson -NoNewline -Encoding utf8
    $downloadUrl = Get-DownloadUrl ($completeJson | ConvertFrom-Json)
    if (-not $downloadUrl) { throw "No raw download URL in completion for $($submission.Asset.id)." }
    $extension = if ($submission.Asset.transparent) { '.png' } else { '.webp' }
    Invoke-WebRequest -Uri $downloadUrl -OutFile (Join-Path $RawDirectory "$($submission.Asset.id)$extension")
}
