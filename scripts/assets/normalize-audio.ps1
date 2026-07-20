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
    $seconds = [double]$asset.seconds
    $duration = $seconds.ToString([Globalization.CultureInfo]::InvariantCulture)
    $fadeOut = if ($asset.model -eq 'sonilo_music') { 0.15 } else { 0.08 }
    $fadeStart = [Math]::Max(0, $seconds - $fadeOut).ToString([Globalization.CultureInfo]::InvariantCulture)
    $fadeDuration = $fadeOut.ToString([Globalization.CultureInfo]::InvariantCulture)
    $bitrate = if ($asset.model -eq 'sonilo_music') { '128k' } else { '96k' }
    $leadingSilence = if ($asset.model -eq 'seed_audio') { 'silenceremove=start_periods=1:start_duration=0.01:start_threshold=-50dB,' } else { '' }
    $timingFilter = "${leadingSilence}aresample=48000,atrim=duration=$duration,apad=whole_dur=$duration,atrim=duration=$duration,asetpts=N/SR/TB,afade=t=in:st=0:d=0.02,afade=t=out:st=${fadeStart}:d=$fadeDuration"
    $savedErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $analysisOutput = (& ffmpeg -hide_banner -loglevel info -nostdin -i $input -af "$timingFilter,loudnorm=I=$($asset.lufs):LRA=7:TP=-5:print_format=json" -f null - 2>&1 | Out-String)
    $analysisExitCode = $LASTEXITCODE
    $ErrorActionPreference = $savedErrorActionPreference
    if ($analysisExitCode -ne 0) { throw "ffmpeg loudness analysis failed for $($asset.id)." }
    $analysisMatch = [regex]::Match($analysisOutput, '(?s)\{\s*"input_i".*?\}')
    if (-not $analysisMatch.Success) { throw "ffmpeg did not return loudness measurements for $($asset.id)." }
    $analysis = $analysisMatch.Value | ConvertFrom-Json
    $loudnorm = if ($analysis.input_i -eq '-inf') {
        "loudnorm=I=$($asset.lufs):LRA=7:TP=-5"
    } else {
        "loudnorm=I=$($asset.lufs):LRA=7:TP=-5:measured_I=$($analysis.input_i):measured_LRA=$($analysis.input_lra):measured_TP=$($analysis.input_tp):measured_thresh=$($analysis.input_thresh):offset=$($analysis.target_offset):linear=true"
    }
    $filter = "$timingFilter,$loudnorm,alimiter=limit=0.55:level=0:attack=5:release=50"
    & ffmpeg -hide_banner -loglevel error -nostdin -y -i $input -af $filter -ar 48000 -ac $asset.channels -c:a libopus -b:a $bitrate $output
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $($asset.id)." }
}
