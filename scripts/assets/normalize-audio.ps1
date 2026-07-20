[CmdletBinding()]
param(
    [string]$PlanPath = 'design/higgsfield/audio-plan.json',
    [string]$RawDirectory = 'work/higgsfield/raw/audio',
    [string]$ReviewPath = 'design/higgsfield/review.csv'
)

$ErrorActionPreference = 'Stop'
$plan = Get-Content -Raw $PlanPath | ConvertFrom-Json
$reviewRows = Import-Csv $ReviewPath
foreach ($asset in $plan.assets) {
    $acceptedRows = @($reviewRows | Where-Object { $_.id -eq $asset.id -and $_.accepted -eq 'true' })
    if ($acceptedRows.Count -ne 1) { throw "$($asset.id) must have exactly one accepted review row." }
    if ($acceptedRows[0].attempt -notin @('1', '2')) { throw "$($asset.id) accepted review attempt must be 1 or 2." }
    $input = Join-Path (Join-Path $RawDirectory "attempt-$($acceptedRows[0].attempt)") "$($asset.id).wav"
    if (-not (Test-Path $input)) { throw "Missing raw audio for $($asset.id): $input" }
    $output = $asset.output
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $output) | Out-Null
    $fadeOut = if ($asset.model -eq 'sonilo_music') { 0.15 } else { 0.08 }
    $fadeStart = [Math]::Max(0, [double]$asset.seconds - $fadeOut)
    $bitrate = if ($asset.model -eq 'sonilo_music') { '128k' } else { '96k' }
    $filter = "atrim=0:$($asset.seconds),asetpts=N/SR/TB,loudnorm=I=$($asset.lufs):LRA=7:TP=-3,afade=t=in:st=0:d=0.02,afade=t=out:st=${fadeStart}:d=$fadeOut"
    & ffmpeg -y -i $input -af $filter -ar 48000 -ac $asset.channels -c:a libopus -b:a $bitrate $output
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $($asset.id)." }
}
