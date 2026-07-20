[CmdletBinding()]
param(
    [string]$AvatarPath = 'src/assets/generated/wallstreet-surfers/runner-avatar.png',
    [string]$StylePath = 'design/style-formula.txt',
    [string]$JobsDirectory = 'design/higgsfield/jobs',
    [string]$AnimationRoot = 'work/higgsfield/raw/animation',
    [string]$FramesRoot = 'work/higgsfield/frames/run',
    [string]$OutputPath = 'src/assets/generated/wallstreet-surfers/runner_run_f15_256x256_g4x4_fps16_loop.png',
    [int]$Attempt = 1
)

$ErrorActionPreference = 'Stop'
if ($Attempt -ne 1 -and $Attempt -ne 2) { throw 'Attempt must be 1 or 2.' }
Import-Module (Join-Path $PSScriptRoot 'runner-tools.psm1') -Force

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

function Wait-And-Download([string]$JobId, [string]$CompletionPath, [string]$RawPath) {
    $completeJson = higgsfield generate wait $JobId --timeout 20m --interval 5s --json
    Set-Content -Path $CompletionPath -Value $completeJson -NoNewline -Encoding utf8
    $downloadUrl = Get-DownloadUrl ($completeJson | ConvertFrom-Json)
    if (-not $downloadUrl) { throw "No raw download URL in completion for $JobId." }
    Invoke-WebRequest -Uri $downloadUrl -OutFile $RawPath
}

if (-not (Test-Path $AvatarPath)) { throw "Missing accepted runner avatar: $AvatarPath" }
$attemptAnimationRoot = Join-Path $AnimationRoot "attempt-$Attempt"
$attemptFramesRoot = Join-Path $FramesRoot "attempt-$Attempt"
New-Item -ItemType Directory -Force -Path $JobsDirectory, $attemptAnimationRoot, (Join-Path $attemptFramesRoot 'raw'), (Join-Path $attemptFramesRoot 'selected'), (Join-Path $attemptFramesRoot 'alpha') | Out-Null

$style = (Get-Content -Raw $StylePath).TrimEnd("`r", "`n")
$keyPosePrompt = "$style Original scrappy market runner at the peak of a forward sprint stride, one knee high and opposite arm forward. Full body in frame with empty margin above the head and below the feet. Clean uniform bright magenta #FF00FF background."
$keyPoseRequest = higgsfield generate create flux_2 --image $AvatarPath --prompt $keyPosePrompt --aspect_ratio 1:1 --resolution 1k --json
Set-Content -Path (Join-Path $JobsDirectory "ws-run-loop-key-pose-a$Attempt-request.json") -Value $keyPoseRequest -NoNewline -Encoding utf8
$keyPosePath = Join-Path $attemptAnimationRoot 'run-pose.png'
Wait-And-Download (Get-JobId ($keyPoseRequest | ConvertFrom-Json)) (Join-Path $JobsDirectory "ws-run-loop-key-pose-a$Attempt-complete.json") $keyPosePath

$videoPrompt = New-RunnerVideoPrompt -StyleFormula $style
$videoRequest = higgsfield generate create seedance1_5 --start-image $keyPosePath --end-image $keyPosePath --prompt $videoPrompt --duration 4 --resolution 720p --aspect_ratio 1:1 --generate_audio false --json
Set-Content -Path (Join-Path $JobsDirectory "ws-run-loop-video-a$Attempt-request.json") -Value $videoRequest -NoNewline -Encoding utf8
$videoPath = Join-Path $attemptAnimationRoot 'run.mp4'
Wait-And-Download (Get-JobId ($videoRequest | ConvertFrom-Json)) (Join-Path $JobsDirectory "ws-run-loop-video-a$Attempt-complete.json") $videoPath

$rawFrames = Join-Path $attemptFramesRoot 'raw'
$selectedFrames = Join-Path $attemptFramesRoot 'selected'
$alphaFrames = Join-Path $attemptFramesRoot 'alpha'
& ffmpeg -y -i $videoPath -vsync 0 (Join-Path $rawFrames '%04d.png')
if ($LASTEXITCODE -ne 0) { throw 'ffmpeg frame extraction failed.' }
& python (Join-Path $PSScriptRoot 'select_frames.py') $rawFrames $selectedFrames --count 16
if ($LASTEXITCODE -ne 0) { throw 'Frame selection failed.' }
& $PSScriptRoot\remove-backgrounds.ps1 -FrameRoot $selectedFrames -OutputRoot $alphaFrames -Attempt $Attempt -ProvenancePrefix 'ws-run-loop-frame' -JobsDirectory $JobsDirectory
Set-RunnerLoopEndpoint -FrameDirectory $alphaFrames
& python (Join-Path $PSScriptRoot 'assemble_spritesheet.py') $alphaFrames $OutputPath --frame-count 16 --cell-width 256 --cell-height 256 --columns 4 --rows 4 --fps 16 --loop
if ($LASTEXITCODE -ne 0) { throw 'Runner spritesheet assembly failed.' }

[pscustomobject]@{
    sourceFrames = 16
    outputFrames = 15
    cellSize = '256x256'
    grid = '4x4'
    fps = 16
    loop = $true
    output = $OutputPath
    attempt = $Attempt
} | ConvertTo-Json | Set-Content -Path (Join-Path $JobsDirectory "ws-run-loop-assembly-a$Attempt.json") -Encoding utf8
