Set-StrictMode -Version Latest

function New-RunnerVideoPrompt {
    param([Parameter(Mandatory)][string]$StyleFormula)

    return $StyleFormula + ' fast forward sprint cycle in place. Camera locked, no camera movement, no zoom, subject stays fully in frame, plain static background. The character performs ONLY this action; nothing else happens. The subject keeps facing the same direction for the entire video - never turns around, never rotates toward or away from the camera, no head turns past the shoulder.'
}

function Set-RunnerLoopEndpoint {
    param([Parameter(Mandatory)][string]$FrameDirectory)

    $frames = @(Get-ChildItem -LiteralPath $FrameDirectory -Filter '*.png' -File | Sort-Object Name)
    if ($frames.Count -ne 16) { throw "Expected exactly 16 alpha frames under $FrameDirectory; found $($frames.Count)." }
    $firstFrame = Join-Path $FrameDirectory '0000.png'
    $lastFrame = Join-Path $FrameDirectory '0015.png'
    if (-not (Test-Path -LiteralPath $firstFrame) -or -not (Test-Path -LiteralPath $lastFrame)) {
        throw "Runner alpha frames must include 0000.png and 0015.png under $FrameDirectory."
    }
    Copy-Item -LiteralPath $firstFrame -Destination $lastFrame -Force
}

Export-ModuleMember -Function New-RunnerVideoPrompt, Set-RunnerLoopEndpoint
