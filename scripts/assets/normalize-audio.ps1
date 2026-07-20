[CmdletBinding()]
param(
    [string]$PlanPath = 'design/higgsfield/audio-plan.json',
    [string]$RawDirectory = 'work/higgsfield/raw/audio'
)

$ErrorActionPreference = 'Stop'
$plan = Get-Content -Raw $PlanPath | ConvertFrom-Json
foreach ($asset in $plan.assets) {
    $input = Join-Path $RawDirectory "$($asset.id).wav"
    if (-not (Test-Path $input)) { throw "Missing raw audio for $($asset.id): $input" }
    $output = $asset.output
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $output) | Out-Null
    $fadeOut = if ($asset.model -eq 'sonilo_music') { 0.15 } else { 0.08 }
    $fadeStart = [Math]::Max(0, [double]$asset.seconds - $fadeOut)
    $bitrate = if ($asset.model -eq 'sonilo_music') { '128k' } else { '96k' }
    $filter = "atrim=0:$($asset.seconds),asetpts=N/SR/TB,loudnorm=I=$($asset.lufs):LRA=7:TP=-3,afade=t=in:st=0:d=0.02,afade=t=out:st=$fadeStart:d=$fadeOut"
    & ffmpeg -y -i $input -af $filter -ar 48000 -ac $asset.channels -c:a libopus -b:a $bitrate $output
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $($asset.id)." }
}
