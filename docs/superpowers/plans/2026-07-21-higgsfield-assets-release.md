# OpenTrade Higgsfield Assets and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and integrate the frozen OpenTrade Higgsfield media set, make the completed three-game hub installable and offline-capable, enforce visual/accessibility/performance release gates, and deploy the same tested application to Higgsfield and GitHub Pages without marketplace publication.

**Architecture:** A checked-in design contract and manifest precede every generation. Nine reusable static images, one derived runner sheet, and six audio files are generated through live Higgsfield job types, inspected, optimized locally, and exposed through one typed asset catalog; game-specific card and episode variation remains CSS/data. Vite builds the same hash-routed application with `/Open-Trade/` for GitHub Pages and `./` for the Higgsfield source ZIP.

**Tech Stack:** Node 24, npm, Vite, React, TypeScript, Phaser, Vitest, Playwright, Higgsfield CLI 1.1.19, PowerShell 7, Python 3.12.7, NumPy 2.5.1, Pillow 12.3.0, and ffmpeg 8.1.2.

## Global Constraints

- Repository root: `C:\Users\USER\Documents\Codex\2026-07-20\hi\work\Open-Trade`.
- Select the single available Higgsfield workspace `f9057194-5494-4de0-8e5b-a27bdc219d27`; do not create or choose another.
- Main agent reads the installed skill and each required reference completely, in order, before generation.
- All three games are solo browser games. Do not add multiplayer, 3D, native-app, authentication, brokerage, payment, or live-market-data scope.
- Create `design/assets.csv`, `design/plan.md`, `design/thresholds.md`, and `design/style-formula.txt` before any generation.
- Use `nano_banana_flash`, never the ambiguous `nano_banana_2` alias.
- The primary static submission is exactly nine calls. A permitted second attempt replaces a rejected output under the same manifest ID; it never adds a tenth static asset or a new manifest row.
- Use `gpt_image_2` only as the second and final attempt for an arrow icon whose first output fails controlled geometry/readability.
- AutoSprite is unavailable. The only generated animation is the runner loop: `flux_2` → `seedance1_5` → ffmpeg → per-frame `image_background_remover` → local sheet assembly.
- Every asset or stage gets at most two generation attempts total.
- Generated media is stored locally and loaded by relative path. No runtime media URL is allowed.
- All readable text—including stock labels, episode variants, LONG, SHORT, prices, charts, and buttons—is rendered by code.
- Cards and Founder episode variants use CSS/data treatments over reusable backgrounds; they do not add image calls.
- Missing images show a branded code-rendered fallback. Audio failures degrade silently to muted play.
- GitHub Pages uses hash routing at `https://frenzy2004.github.io/Open-Trade/`.
- Higgsfield ZIP root contains `index.html` and exactly one platform module, `logic.js`.
- Never run `higgsfield game publish`. Marketplace publication is outside scope.
- After first deployment, every update includes the saved `--game-id`.

## Exact Shared STYLE FORMULA

The exact one-line contents of `design/style-formula.txt` are:

> High-contrast editorial finance arcade art combining cinematic collage, hand-inked contours, subtle risograph grain, and clean geometric silhouettes. Use off-black and warm-ivory environments; original market-archetype characters contrast in electric market-yellow, signal-red, and gain-green accents. Lighting uses warm rim highlights and deep graphic shadows. Keep interface illustrations flat-frontal, and runner scenes in a consistent forward-facing one-point perspective. Preserve readable silhouettes and muted background detail, with no embedded text, logos, watermarks, tiny details, or photorealistic clutter.

This paragraph is inserted byte-for-byte into every visual prompt. Perspective, subject, key-color, and asset-kind clauses live before or after it; the paragraph itself never changes.

## Expected File Map

Created:

- `requirements-assets.txt`
- `design/style-formula.txt`
- `design/plan.md`
- `design/thresholds.md`
- `design/assets.csv`
- `design/higgsfield/generation-plan.json`
- `design/higgsfield/audio-plan.json`
- `design/higgsfield/review.csv`
- `design/higgsfield/jobs/.gitkeep`
- `scripts/assets/generate-static.ps1`
- `scripts/assets/remove-backgrounds.ps1`
- `scripts/assets/select_frames.py`
- `scripts/assets/assemble_spritesheet.py`
- `scripts/assets/process-images.py`
- `scripts/assets/generate-audio.ps1`
- `scripts/assets/normalize-audio.ps1`
- `scripts/assets/validate-assets.mjs`
- `scripts/release/check-budgets.mjs`
- `scripts/release/package-higgsfield.ps1`
- `src/assets/catalog.ts`
- `src/assets/generated/fanstocks/draft-room.webp`
- `src/assets/generated/founder-mode/boardroom.webp`
- `src/assets/generated/wallstreet-surfers/runner-street.webp`
- `src/assets/generated/wallstreet-surfers/runner-avatar.png`
- `src/assets/generated/wallstreet-surfers/train.png`
- `src/assets/generated/wallstreet-surfers/barrier.png`
- `src/assets/generated/wallstreet-surfers/long-arrow.png`
- `src/assets/generated/wallstreet-surfers/short-arrow.png`
- `src/assets/generated/wallstreet-surfers/coin.png`
- `src/assets/generated/wallstreet-surfers/runner_run_f15_256x256_g4x4_fps16_loop.png`
- `src/assets/audio/shared/ui-confirm.ogg`
- `src/assets/audio/shared/market-success.ogg`
- `src/assets/audio/shared/market-failure.ogg`
- `src/assets/audio/wallstreet-surfers/coin-pickup.ogg`
- `src/assets/audio/wallstreet-surfers/collision.ogg`
- `src/assets/audio/shared/arcade-loop.ogg`
- `src/shared/assets/SafeImage.tsx`
- `src/shared/assets/safe-image.css`
- `src/shared/audio/audio-manager.ts`
- `src/shared/pwa/register-service-worker.ts`
- `public/manifest.webmanifest`
- `public/sw.js`
- `public/icons/open-trade-192.png`
- `public/icons/open-trade-512.png`
- `deploy/higgsfield/logic.js`
- `deploy/higgsfield/game-id.txt` after first successful deployment
- `tests/assets/asset-catalog.test.ts`
- `tests/assets/sprite-tools.test.py`
- `tests/shared/SafeImage.test.tsx`
- `tests/shared/audio-manager.test.ts`
- `tests/e2e/offline.spec.ts`
- `tests/e2e/release-qa.spec.ts`
- `tests/e2e/deployed-smoke.spec.ts`
- `.github/workflows/pages.yml`

Modified:

- `package.json`
- `package-lock.json`
- `.gitignore`
- `index.html`
- `vite.config.ts`
- `playwright.config.ts`
- `src/main.tsx`
- `src/app/App.tsx`
- `src/games/fanstocks/FanStocksRoute.tsx`
- `src/games/founder-mode/ui/FounderModeRoute.tsx`
- `src/games/wallstreet-surfers/phaser/WallstreetSurfersScene.ts`
- `src/games/wallstreet-surfers/ui/WallstreetSurfersRoute.tsx`

This plan starts only after the application shell and all three playable vertical slices exist. Verify:

```powershell
$required = @(
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'src/main.tsx',
  'src/games/fanstocks/FanStocksRoute.tsx',
  'src/games/founder-mode/ui/FounderModeRoute.tsx',
  'src/games/wallstreet-surfers/phaser/WallstreetSurfersScene.ts',
  'src/games/wallstreet-surfers/ui/WallstreetSurfersRoute.tsx'
)
$missing = $required | Where-Object { -not (Test-Path $_) }
if ($missing.Count) { throw "Finish prior milestones first: $($missing -join ', ')" }
```

Expected: no output and exit code 0.

---

### Task 1: Select the Workspace and Freeze the Design Contract

**Files:**

- Create: `requirements-assets.txt`
- Create: `design/style-formula.txt`
- Create: `design/plan.md`
- Create: `design/thresholds.md`
- Create: `design/assets.csv`
- Create: `design/higgsfield/review.csv`
- Create: `design/higgsfield/jobs/.gitkeep`

**Interfaces:**

- Consumes: approved three-game rebuild spec and installed Higgsfield skill v0.12.0.
- Produces: immutable style, asset IDs, numeric gates, workspace, and dependency state for every later task.

- [ ] **Step 1: Read the required Higgsfield sources completely**

Run in this order:

```powershell
$gameSkill = 'C:\Users\USER\Documents\Codex\2026-07-20\hi\.agents\skills\higgsfield-game-generation'
Get-Content -Raw "$gameSkill\SKILL.md"
Get-Content -Raw "$gameSkill\references\game-design-system.md"
Get-Content -Raw "$gameSkill\references\stylization.md"
Get-Content -Raw "$gameSkill\references\2d-animation.md"
Get-Content -Raw "$gameSkill\references\audio.md"
Get-Content -Raw "$gameSkill\references\build-game.md"
```

Expected: each file prints from heading through final line. Do not read `multiplayer.md`, texture/PBR references, or 3D references because the frozen manifest has no matching row.

- [ ] **Step 2: Select and verify the single workspace**

```powershell
$workspaces = higgsfield workspace list --json | ConvertFrom-Json
if ($workspaces.Count -ne 1) { throw "Expected one workspace; found $($workspaces.Count)." }
if ($workspaces[0].id -ne 'f9057194-5494-4de0-8e5b-a27bdc219d27') {
  throw "Unexpected workspace $($workspaces[0].id)."
}
higgsfield workspace set f9057194-5494-4de0-8e5b-a27bdc219d27
higgsfield workspace status --json
higgsfield account status --json
higgsfield game deploy --help
```

Expected: selected ID matches exactly; account reports Plus and positive credits; deploy help lists `--title`, `--description`, and `--game-id`.

- [ ] **Step 3: Install NumPy only when required**

Write `requirements-assets.txt`:

```text
numpy==2.5.1
Pillow==12.3.0
```

Probe, install on failure, and re-probe:

```powershell
python -c "import numpy, PIL; assert numpy.__version__ == '2.5.1'; assert PIL.__version__ == '12.3.0'; print('asset-python-ok')"
if ($LASTEXITCODE -ne 0) { python -m pip install --user -r requirements-assets.txt }
python -c "import numpy, PIL; assert numpy.__version__ == '2.5.1'; assert PIL.__version__ == '12.3.0'; print('asset-python-ok')"
ffmpeg -version
```

Expected: `asset-python-ok`; ffmpeg 8.1.2 or newer.

- [ ] **Step 4: Inspect every live model contract**

```powershell
higgsfield model list --json
higgsfield model get nano_banana_flash
higgsfield model get gpt_image_2
higgsfield model get flux_2
higgsfield model get seedance1_5
higgsfield model get image_background_remover
higgsfield model get seed_audio
higgsfield model get sonilo_music
higgsfield model get autosprite
```

Expected: all requested models except `autosprite` exist; AutoSprite exits 1; Nano Banana supports 1k plus 1:1/16:9; Seedance supports 4 seconds, 720p, 1:1, start/end, and audio false.

- [ ] **Step 5: Write the exact planning files before generation**

`design/plan.md` records:

- solo delivery on desktop/mobile, with gamepad for the runner;
- nine static outputs reused across hub/game screens;
- CSS/data card and episode variations;
- one runner loop, with jump/roll/hit expressed through Phaser transforms and the static avatar;
- shared audio semantics used by all three games;
- local media only, max-two-attempt policy, and no marketplace publication;
- Pages base `/Open-Trade/` and Higgsfield base `./`.

`design/thresholds.md` contains:

```markdown
# OpenTrade asset and release thresholds

| Gate | Exact value |
|---|---|
| Primary static image outputs | 9 |
| Derived spritesheets | 1 |
| Audio outputs | 6 |
| Generation attempts | 2 maximum per asset or stage |
| Background | 1280×720 WebP; 400 KiB maximum |
| Transparent static image | PNG with alpha; 512×512 maximum; 350 KiB maximum |
| Arrow and coin icon | PNG with alpha; 256×256; 160 KiB maximum |
| Run sheet | 15 frames; 256×256 cells; 4×4 grid; 16 fps; loop; 2 MiB maximum |
| Any shipped file | below 25 MiB |
| SFX loudness | -11 LUFS; true peak at or below -3 dBFS |
| Music loudness | -19 LUFS; true peak at or below -3 dBFS |
| Initial JS and CSS | 350 KiB gzip maximum |
| Lazy Phaser chunk | 1.20 MiB gzip maximum |
| Full dist | 20 MiB maximum |
| Runner target | 60 fps; p95 frame interval at or below 16.7 ms |
| Canvas DPR cap | 1.5 |
| Touch target | at least 44×44 CSS px |
| Responsive widths | 320, 375, 768, 1024, 1440 CSS px |
| Network and console | zero 404s and zero uncaught errors |
| Offline | hub and all three routes reload after one online traversal |
```

Write `design/style-formula.txt` as the exact STYLE FORMULA above.

- [ ] **Step 6: Write the frozen manifest**

Write `design/assets.csv`:

```csv
id,role,type,description,size/ratio,style line ref,source
fs-draft-room,"FanStocks route background and hub-card crop",background,"cinematic after-hours trading draft room with a card table and market screens; no readable text","1280x720 (16:9)","design/style-formula.txt:1",generate
fm-boardroom,"Founder Mode route background and hub-card crop",background,"tense founder boardroom split between legacy decline and a bright strategic future; no readable text","1280x720 (16:9)","design/style-formula.txt:1",generate
ws-runner-street,"Wallstreet Surfers parallax backdrop and hub-card crop",background,"forward-facing three-lane financial district canyon with distant bull and bear silhouettes; empty foreground lanes; no readable text","1280x720 (16:9)","design/style-formula.txt:1",generate
ws-runner-avatar,"Runner static fallback tutorial figure and animation source",sprite,"original young market courier viewed from behind in a running-ready pose; full body visible","512x512 (1:1)","design/style-formula.txt:1",generate
ws-train,"Ticker-train collision obstacle",sprite,"single stylized commuter train front with blank destination panel; no readable text","512x512 (1:1)","design/style-formula.txt:1",generate
ws-barrier,"Jump and lane-change obstacle",sprite,"single striped financial-district road barrier with warning lights; no readable text","256x256 (1:1)","design/style-formula.txt:1",generate
ws-long-arrow,"LONG market-gate direction icon",ui,"single bold upward market arrow emblem without letters or numbers","256x256 (1:1)","design/style-formula.txt:1",generate
ws-short-arrow,"SHORT market-gate direction icon",ui,"single bold downward market arrow emblem without letters or numbers","256x256 (1:1)","design/style-formula.txt:1",generate
ws-coin,"Runner pickup and FanStocks value token",ui,"single embossed market coin with an abstract rising-line emblem and no currency mark","256x256 (1:1)","design/style-formula.txt:1",generate
ws-run-loop,"Animated runner rendered by Phaser with static-source fallback",spritesheet,"fifteen-frame bottom-centered run-in-place loop derived from ws-runner-avatar","1024x1024 sheet; 15 frames; 256x256 cells; 4x4 grid; 16 fps","design/style-formula.txt:1",generate
arcade-loop,"Low-volume looping score beneath all three games",music,"confident 108 BPM instrumental finance-arcade pulse with warm analog synth bass brushed percussion and restrained brass stabs; no vocals","30 seconds; seamless loop","design/style-formula.txt:1 concept",generate
ui-confirm,"Draft selection buttons and Founder choice receipt",sfx,"single crisp tactile card-lock click with a short warm synth tick; no music; no voice; no ambience","under 1 second","design/style-formula.txt:1 concept",generate
market-success,"Accepted trade correct Founder outcome and correct market gate",sfx,"single bright restrained market-success chime with two ascending notes; no music; no voice; no ambience","under 1 second","design/style-formula.txt:1 concept",generate
market-failure,"Passed trade weak Founder outcome and incorrect market gate",sfx,"single dry low market-error pulse with a short descending tail; no music; no voice; no ambience","under 1 second","design/style-formula.txt:1 concept",generate
coin-pickup,"Runner coin pickup feedback",sfx,"single compact metallic token pickup ping with no sparkle trail; no music; no voice; no ambience","under 1 second","design/style-formula.txt:1 concept",generate
collision,"Runner train or barrier collision feedback",sfx,"single punchy padded impact with a brief rail rattle; no music; no voice; no ambience","under 2 seconds","design/style-formula.txt:1 concept",generate
```

Write `design/higgsfield/review.csv`:

```csv
id,stage,attempt,model,accepted,inspection,compensation
```

- [ ] **Step 7: Validate and commit the contract**

```powershell
$rows = Import-Csv design/assets.csv
if ($rows.Count -ne 16) { throw "Expected 16 rows; found $($rows.Count)." }
if (($rows.id | Sort-Object -Unique).Count -ne 16) { throw 'Duplicate asset id.' }
$style = (Get-Content -Raw design/style-formula.txt).TrimEnd("`r", "`n")
$expectedStyle = 'High-contrast editorial finance arcade art combining cinematic collage, hand-inked contours, subtle risograph grain, and clean geometric silhouettes. Use off-black and warm-ivory environments; original market-archetype characters contrast in electric market-yellow, signal-red, and gain-green accents. Lighting uses warm rim highlights and deep graphic shadows. Keep interface illustrations flat-frontal, and runner scenes in a consistent forward-facing one-point perspective. Preserve readable silhouettes and muted background detail, with no embedded text, logos, watermarks, tiny details, or photorealistic clutter.'
if ($style -cne $expectedStyle) { throw 'STYLE FORMULA byte sequence differs from the approved paragraph.' }
git add requirements-assets.txt design
git commit -m "chore: lock Higgsfield asset production contract"
```

Expected: milestone commit contains only design/dependency contract files.

---

### Task 2: Build and Test the Media Production Pipeline

**Files:**

- Create: `design/higgsfield/generation-plan.json`
- Create: `design/higgsfield/audio-plan.json`
- Create: all scripts under `scripts/assets` listed in the File Map
- Create: `scripts/assets/validate-assets.mjs`
- Create: `tests/assets/sprite-tools.test.py`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: Task 1 manifest and style.
- Produces: reproducible job submission, local processing, provenance, review, and `npm run check:assets`.

- [ ] **Step 1: Encode exact static definitions**

`design/higgsfield/generation-plan.json` contains these nine records:

```json
{
  "styleFormulaFile": "design/style-formula.txt",
  "assets": [
    {"id":"fs-draft-room","kind":"background","model":"nano_banana_flash","description":"smoky editorial stock draft room","aspectRatio":"16:9","resolution":"1k","transparent":false,"width":1280,"height":720,"output":"src/assets/generated/fanstocks/draft-room.webp"},
    {"id":"fm-boardroom","kind":"background","model":"nano_banana_flash","description":"sparse editorial founder boardroom","aspectRatio":"16:9","resolution":"1k","transparent":false,"width":1280,"height":720,"output":"src/assets/generated/founder-mode/boardroom.webp"},
    {"id":"ws-runner-street","kind":"background","model":"nano_banana_flash","description":"forward perspective three lane market street","aspectRatio":"16:9","resolution":"1k","transparent":false,"width":1280,"height":720,"output":"src/assets/generated/wallstreet-surfers/runner-street.webp"},
    {"id":"ws-runner-avatar","kind":"sprite","model":"nano_banana_flash","description":"original scrappy market runner","aspectRatio":"1:1","resolution":"1k","transparent":true,"width":512,"height":512,"output":"src/assets/generated/wallstreet-surfers/runner-avatar.png"},
    {"id":"ws-train","kind":"sprite","model":"nano_banana_flash","description":"original bull bear ticker train","aspectRatio":"1:1","resolution":"1k","transparent":true,"width":512,"height":512,"output":"src/assets/generated/wallstreet-surfers/train.png"},
    {"id":"ws-barrier","kind":"sprite","model":"nano_banana_flash","description":"striped financial road barrier","aspectRatio":"1:1","resolution":"1k","transparent":true,"width":256,"height":256,"output":"src/assets/generated/wallstreet-surfers/barrier.png"},
    {"id":"ws-long-arrow","kind":"ui","model":"nano_banana_flash","description":"upward gain arrow symbol","aspectRatio":"1:1","resolution":"1k","transparent":true,"width":256,"height":256,"output":"src/assets/generated/wallstreet-surfers/long-arrow.png"},
    {"id":"ws-short-arrow","kind":"ui","model":"nano_banana_flash","description":"downward loss arrow symbol","aspectRatio":"1:1","resolution":"1k","transparent":true,"width":256,"height":256,"output":"src/assets/generated/wallstreet-surfers/short-arrow.png"},
    {"id":"ws-coin","kind":"ui","model":"nano_banana_flash","description":"glowing market coin symbol","aspectRatio":"1:1","resolution":"1k","transparent":true,"width":256,"height":256,"output":"src/assets/generated/wallstreet-surfers/coin.png"}
  ]
}
```

- [ ] **Step 2: Write failing manifest/tool tests**

`validate-assets.mjs` asserts:

- 16 unique manifest IDs;
- nine static outputs, one exact run sheet, and six exact audio outputs exist;
- every generation has request/completion JSON under `design/higgsfield/jobs`;
- image dimensions, alpha, and thresholds match `design/thresholds.md`;
- accepted review row exists for each output;
- catalog and manifest IDs agree;
- success prints `asset validation passed: 16/16`.

`sprite-tools.test.py` asserts endpoint-preserving selection, union bounds, bottom-center anchoring, final duplicate removal, 15 frames, 4×4 grid, and the exact filename.

Add scripts:

```json
{
  "scripts": {
    "check:assets": "node scripts/assets/validate-assets.mjs"
  }
}
```

Run:

```powershell
python -m unittest tests.assets.sprite-tools -v
npm run check:assets
```

Expected: both fail because tools and outputs do not yet exist.

- [ ] **Step 3: Implement exact prompt assembly and parallel submission**

Prompt parts:

```powershell
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
```

`generate-static.ps1` loads the style with `.TrimEnd()`, assembles template + description + exact formula + suffix, and submits all nine calls before waiting:

```powershell
$args = @(
  'generate','create','nano_banana_flash',
  '--prompt',$prompt,
  '--aspect_ratio',$asset.aspectRatio,
  '--resolution',$asset.resolution,
  '--json'
)
$requestJson = & higgsfield @args
```

It saves `design/higgsfield/jobs/{id}-request.json`, waits with:

```powershell
higgsfield generate wait $jobId --timeout 20m --interval 5s --json
```

and saves `{id}-complete.json` plus the raw download under ignored `work/higgsfield/raw/static`.

- [ ] **Step 4: Implement removal, processing, and review artifacts**

`remove-backgrounds.ps1` submits the six transparent static files and later the 16 selected animation frames:

```powershell
higgsfield generate create image_background_remover --image $inputPath --json
```

`process-images.py` uses LANCZOS, cover-crops backgrounds to 1280×720 WebP quality 88, contains alpha art inside the exact PNG size, strips metadata, and composes PWA icons from the coin on an off-black/warm-ivory field.

It writes three contact sheets under `work/higgsfield/inspection`: `backgrounds.png`, `runner-kit.png`, and `runner-scale.png`.

- [ ] **Step 5: Implement frame selection and assembly**

Exact interfaces:

```python
def select_indices(total: int, count: int) -> list[int]:
    """Return 16 unique rounded linspace indices including 0 and total - 1."""

def assemble_sheet(
    frame_paths: list[str],
    output_path: str,
    cell_size: tuple[int, int] = (256, 256),
    columns: int = 4,
    rows: int = 4,
    fps: int = 16,
    loop: bool = True,
) -> None:
    """Union-crop, bottom-center, drop duplicate loop endpoint, and save RGBA PNG."""
```

Expected output: `runner_run_f15_256x256_g4x4_fps16_loop.png`.

- [ ] **Step 6: Encode exact audio prompts**

`design/higgsfield/audio-plan.json`:

```json
{
  "assets": [
    {"id":"ui-confirm","model":"seed_audio","prompt":"Short isolated dry paper-and-casino-chip confirmation, one clean tactile hit, no music, no voice, no ambience.","seconds":0.7,"channels":1,"lufs":-11,"output":"src/assets/audio/shared/ui-confirm.ogg"},
    {"id":"market-success","model":"seed_audio","prompt":"Single bullish arcade confirmation burst with crisp brass tick and upward energy, no music bed, no voice, no ambience.","seconds":0.9,"channels":1,"lufs":-11,"output":"src/assets/audio/shared/market-success.ogg"},
    {"id":"market-failure","model":"seed_audio","prompt":"Single bearish arcade rejection buzz with short downward pitch, no music bed, no voice, no ambience.","seconds":0.9,"channels":1,"lufs":-11,"output":"src/assets/audio/shared/market-failure.ogg"},
    {"id":"coin-pickup","model":"seed_audio","prompt":"Single bright metallic market coin ping with a tiny arcade sparkle, no music, no voice, no ambience.","seconds":0.5,"channels":1,"lufs":-11,"output":"src/assets/audio/wallstreet-surfers/coin-pickup.ogg"},
    {"id":"collision","model":"seed_audio","prompt":"Single heavy comic market crash combining metal impact and paper burst, no music, no voice, no ambience.","seconds":1.2,"channels":1,"lufs":-11,"output":"src/assets/audio/wallstreet-surfers/collision.ogg"},
    {"id":"arcade-loop","model":"sonilo_music","prompt":"Thirty-second seamless instrumental finance arcade loop at 108 BPM, warm analog synth bass, brushed breakbeat percussion, restrained brass stabs, subtle stock-ticker rhythm, confident editorial tension, instrumental, no vocals, no spoken words.","seconds":30.0,"channels":2,"lufs":-19,"output":"src/assets/audio/shared/arcade-loop.ogg"}
  ]
}
```

- [ ] **Step 7: Validate script syntax and commit**

```powershell
python -m py_compile scripts/assets/select_frames.py scripts/assets/assemble_spritesheet.py scripts/assets/process-images.py
$null = [scriptblock]::Create((Get-Content -Raw scripts/assets/generate-static.ps1))
$null = [scriptblock]::Create((Get-Content -Raw scripts/assets/remove-backgrounds.ps1))
git add design/higgsfield scripts/assets tests/assets package.json package-lock.json .gitignore
git commit -m "build: add deterministic Higgsfield media tooling"
```

Expected: tools/configuration committed; no generated output.

---

### Task 3: Generate and Accept the Nine Static Images

**Files:**

- Create: nine exact static output files and two PWA icons from the File Map
- Create: job JSON under `design/higgsfield/jobs`
- Modify: `design/higgsfield/review.csv`

**Interfaces:**

- Consumes: Task 2 scripts.
- Produces: inspected, optimized static media with no embedded text.

- [ ] **Step 1: Estimate cost before generation**

```powershell
$style = (Get-Content -Raw design/style-formula.txt).TrimEnd("`r","`n")
$background = "game background of smoky editorial stock draft room, wide establishing view, $style, no characters, no UI elements, slightly muted detail so foreground game elements stay readable, soft depth layering"
$sprite = "game sprite of original scrappy market runner, single character/object, full body visible, centered, $style, on a solid uniform bright magenta #FF00FF background, no shadows cast on the background, no ground plane, nothing cropped at the edges"
higgsfield generate cost nano_banana_flash --prompt $background --aspect_ratio 16:9 --resolution 1k --json
higgsfield generate cost nano_banana_flash --prompt $sprite --aspect_ratio 1:1 --resolution 1k --json
```

Expected: total for nine static calls plus removal/animation/audio reserve is below current credits. Stop before generation if it is not.

- [ ] **Step 2: Submit nine jobs, remove six backgrounds, and process**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assets/generate-static.ps1 -Attempt 1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assets/remove-backgrounds.ps1 -Static -Attempt 1
python scripts/assets/process-images.py
```

Expected: exactly nine accepted-path images and two derived icons; nine request/completion pairs and six removal pairs.

- [ ] **Step 3: Inspect every output at original detail**

Open all three contact sheets and each source at original size. Accept only when:

- one visual system, contours, grain, shadows, and role palette are coherent;
- no letters, company logos, watermarks, fake UI, or proprietary mascot appears;
- backgrounds leave usable overlay regions;
- runner lanes read immediately in forward perspective;
- avatar, train, and barrier silhouettes remain distinct at play size;
- arrow directions are unmistakable without LONG/SHORT text;
- transparent edges have no magenta halo or eaten details;
- coin remains readable at 44 CSS px.

Append one row per attempt to `review.csv`.

- [ ] **Step 4: Apply the two-attempt rule**

Style drift reruns the exact same prompt. Content errors amend only the three-to-five-word description. For an arrow whose first attempt has wrong geometry, use the final controlled attempt:

```powershell
$style = (Get-Content -Raw design/style-formula.txt).TrimEnd("`r","`n")
$prompt = "game UI element: upward gain arrow symbol, single element, centered, $style, no letters, no words, no numerals, on a solid uniform bright magenta #FF00FF background, crisp edges, no drop shadow outside the element"
higgsfield generate create gpt_image_2 --prompt $prompt --aspect_ratio 1:1 --quality high --resolution 1k --wait --json
```

For SHORT, replace only `upward gain` with `downward loss`. After attempt two, use CSS tint/crop/rotation and record `css-compensation`; do not generate a third time.

- [ ] **Step 5: Validate and commit**

```powershell
npm run check:assets
```

Expected: only the run sheet and six audio outputs are missing.

```powershell
git add src/assets/generated public/icons design/higgsfield
git commit -m "assets: add reusable OpenTrade visual kit"
```

---

### Task 4: Derive the Runner Loop

**Files:**

- Create: exact run sheet from the File Map
- Modify: `design/higgsfield/review.csv`
- Create: animation job JSON

**Interfaces:**

- Consumes: `runner-avatar.png`.
- Produces: one 15-frame alpha loop; jump, roll, and hit remain code transforms.

- [ ] **Step 1: Generate and inspect the key pose**

```powershell
$style = (Get-Content -Raw design/style-formula.txt).TrimEnd("`r","`n")
$prompt = "$style Original scrappy market runner at the peak of a forward sprint stride, one knee high and opposite arm forward. Full body in frame with empty margin above the head and below the feet. Clean uniform bright magenta #FF00FF background."
higgsfield generate create flux_2 `
  --image src/assets/generated/wallstreet-surfers/runner-avatar.png `
  --prompt $prompt --aspect_ratio 1:1 --resolution 1k --wait --json
```

Expected: full body, margins, unchanged identity/proportions, uniform key, one facing direction. Save JSON and `work/higgsfield/raw/animation/run-pose.png`.

- [ ] **Step 2: Generate the exact four-second loop**

```powershell
higgsfield generate create seedance1_5 `
  --start-image work/higgsfield/raw/animation/run-pose.png `
  --end-image work/higgsfield/raw/animation/run-pose.png `
  --prompt "fast forward sprint cycle in place. Camera locked, no camera movement, no zoom, subject stays fully in frame, plain static background. The character performs ONLY this action; nothing else happens. The subject keeps facing the same direction for the entire video - never turns around, never rotates toward or away from the camera, no head turns past the shoulder." `
  --duration 4 --resolution 720p --aspect_ratio 1:1 --generate_audio false --wait --json
```

Expected: no camera/facing drift, crop, extra action, or visible wrap jump.

- [ ] **Step 3: Extract, select 16, remove backgrounds, assemble 15**

```powershell
ffmpeg -i work/higgsfield/raw/animation/run.mp4 -vsync 0 work/higgsfield/frames/run/raw/%04d.png
python scripts/assets/select_frames.py work/higgsfield/frames/run/raw work/higgsfield/frames/run/selected --count 16
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assets/remove-backgrounds.ps1 -FrameRoot work/higgsfield/frames/run/selected -Attempt 1
python scripts/assets/assemble_spritesheet.py `
  work/higgsfield/frames/run/alpha `
  src/assets/generated/wallstreet-surfers/runner_run_f15_256x256_g4x4_fps16_loop.png `
  --frame-count 16 --cell-width 256 --cell-height 256 --columns 4 --rows 4 --fps 16 --loop
```

Expected: first/last selected; duplicate last removed; planted feet do not jitter; sheet is 1024×1024 with alpha.

- [ ] **Step 4: Test, inspect, retry at most once, and commit**

```powershell
python -m unittest tests.assets.sprite-tools -v
npm run check:assets
```

Expected: sprite tests pass; only audio outputs remain missing.

If the second animation attempt fails, retain the static avatar and implement running squash/bob in Phaser; amend `ws-run-loop` source to `reference_media[ws-runner-avatar]`.

```powershell
git add src/assets/generated/wallstreet-surfers/runner_run_*.png design/higgsfield
git commit -m "assets: add runner animation loop"
```

---

### Task 5: Generate, Normalize, and Accept Six Audio Files

**Files:**

- Create: `scripts/assets/generate-audio.ps1`
- Create: `scripts/assets/normalize-audio.ps1`
- Create: six exact audio outputs
- Modify: `design/higgsfield/review.csv`

**Interfaces:**

- Consumes: `audio-plan.json`.
- Produces: five semantic cues and one shared loop; raw model audio never ships.

- [ ] **Step 1: Submit all audio jobs before waiting**

For five Seed Audio rows:

```powershell
higgsfield generate create seed_audio --prompt $asset.prompt --format wav --sample_rate 48000 --json
```

For music:

```powershell
higgsfield generate create sonilo_music --prompt $asset.prompt --duration 30 --json
```

Save request/completion JSON and raw downloads. After all submissions, wait with `higgsfield generate wait`.

- [ ] **Step 2: Normalize and encode**

For SFX:

```powershell
ffmpeg -y -i $rawPath `
  -af "atrim=0:$seconds,asetpts=N/SR/TB,loudnorm=I=-11:LRA=7:TP=-3,afade=t=in:st=0:d=0.02,afade=t=out:st=$fadeOut:d=0.08" `
  -ar 48000 -ac 1 -c:a libopus -b:a 96k $outputPath
```

For music, use `I=-19`, stereo, 128k, and a 0.15-second final fade.

- [ ] **Step 3: Verify ears and meters**

```powershell
ffmpeg -i src/assets/audio/shared/arcade-loop.ogg -af ebur128=peak=true -f null NUL
npm run check:assets
```

Expected: SFX approximately -11 LUFS, music approximately -19 LUFS, peak ≤ -3 dBFS, durations within 0.05 seconds, no speech/unwanted layer, and `asset validation passed: 16/16`.

Listen on headphones and phone-class speakers. At most one retry per file. On second failure, shared cues may map to `ui-confirm`; music may be omitted and recorded as `reference_media[muted-runtime]`.

- [ ] **Step 4: Commit**

```powershell
git add src/assets/audio scripts/assets/generate-audio.ps1 scripts/assets/normalize-audio.ps1 design/higgsfield
git commit -m "assets: add normalized OpenTrade audio"
```

---

### Task 6: Integrate Assets, Fallbacks, and Audio

**Files:**

- Create: `src/assets/catalog.ts`
- Create: `src/shared/assets/SafeImage.tsx`
- Create: `src/shared/assets/safe-image.css`
- Create: `src/shared/audio/audio-manager.ts`
- Create: catalog/fallback/audio tests
- Modify: the six app/game files in the File Map

**Interfaces:**

- Consumes: 16 accepted manifest rows.
- Produces: typed local URLs and failure-safe runtime behavior.

- [ ] **Step 1: Write failing tests**

Assert manifest/catalog ID equality, local URL resolution, `SafeImage` error fallback with preserved alt text, gesture-only audio unlock, persisted mute/volume, hidden-tab suspension, and silent decode failure.

```powershell
npm test -- --run tests/assets/asset-catalog.test.ts tests/shared/SafeImage.test.tsx tests/shared/audio-manager.test.ts
```

Expected: fail because implementations do not exist.

- [ ] **Step 2: Implement exact catalog contract**

```ts
export type AssetId =
  | 'fs-draft-room' | 'fm-boardroom' | 'ws-runner-street'
  | 'ws-runner-avatar' | 'ws-train' | 'ws-barrier'
  | 'ws-long-arrow' | 'ws-short-arrow' | 'ws-coin' | 'ws-run-loop'
  | 'ui-confirm' | 'market-success' | 'market-failure'
  | 'coin-pickup' | 'collision' | 'arcade-loop';

export interface AssetRecord {
  readonly id: AssetId;
  readonly url: string;
  readonly kind: 'image' | 'spritesheet' | 'audio';
  readonly alt: string;
}

export const ASSET_CATALOG: Readonly<Record<AssetId, AssetRecord>>;
export function asset(id: AssetId): AssetRecord;
```

Use `new URL(..., import.meta.url).href`; no HTTP media URL.

- [ ] **Step 3: Integrate reuse instead of variant images**

- FanStocks overlays CSS seat glows, tickers, chips, and card metadata on `fs-draft-room`.
- Founder Mode overlays episode palette, year, founder data, charts, and decisions on `fm-boardroom`.
- Runner preloads the street, avatar, train, barrier, arrows, coin, run sheet, and audio only inside the lazy Phaser route.
- LONG and SHORT text is code-rendered beside arrow icons.
- Jump/roll/hit use static avatar transforms and reduced-motion-safe variants.
- Phaser creates code-rendered fallback textures before file loading and continues on `loaderror`.

- [ ] **Step 4: Implement resilient shared behavior**

`SafeImage` swaps to an off-black/warm-ivory block with gain-green geometry and code-rendered label. `audio-manager.ts` exports `unlock`, `play`, `loop`, `setMuted`, `setVolume`, `suspend`, `resume`, and `dispose`; it never lets audio failure reject gameplay.

- [ ] **Step 5: Verify and commit**

```powershell
npm test -- --run tests/assets/asset-catalog.test.ts tests/shared/SafeImage.test.tsx tests/shared/audio-manager.test.ts
npm run test:e2e
git add src tests/assets tests/shared
git commit -m "feat: integrate resilient media and audio"
```

Expected: routes complete normally while image/audio requests are deliberately aborted.

---

### Task 7: Optimize and Enforce Visual, Accessibility, and Performance Gates

**Files:**

- Create: `scripts/release/check-budgets.mjs`
- Create: `tests/e2e/release-qa.spec.ts`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: observed failing styles/runtime only

**Interfaces:**

- Consumes: integrated app.
- Produces: deterministic release budgets and approved responsive screenshots.

- [ ] **Step 1: Add failing budget checks**

`check-budgets.mjs` reads `dist/.vite/manifest.json`, gzips JS/CSS in memory, checks every threshold in `design/thresholds.md`, and prints measured values plus `release budgets passed`.

Add:

```json
{
  "scripts": {
    "build:pages": "vite build --base=/Open-Trade/",
    "build:higgsfield": "vite build --base=./",
    "check:release": "node scripts/release/check-budgets.mjs dist"
  }
}
```

Run:

```powershell
npm run build:higgsfield
npm run check:release
```

Expected: fail until checker and any required optimizations exist.

- [ ] **Step 2: Keep Phaser lazy and expose debug telemetry**

In `vite.config.ts`, set `build.manifest=true` and isolate IDs containing `/node_modules/phaser/` into `phaser-runtime`.

Under `?debug=1`, expose seed, lane, distance, active/pool counts, draw calls, next gate, and last 600 frame intervals. No debug object in normal production mode.

- [ ] **Step 3: Add release QA**

At widths 320, 375, 768, 1024, and 1440, assert:

- no horizontal document overflow;
- every control ≥ 44×44;
- visible keyboard focus;
- dialog trap/Escape/focus return;
- useful alt and chart text alternatives;
- no color-only status;
- Founder choices reachable at 1280×720;
- visible touch controls;
- `event.code` controls under non-Latin layout;
- reduced-motion removes shake, flash, and large parallax;
- zero console errors and 404s.

Run deterministic runner seed `release-2026-07-21` for 60 seconds on 1440×900 and 390×844. Expected: 60 fps on release hardware, p95 ≤ 16.7 ms, bounded pools, legal lane.

- [ ] **Step 4: Optimize in fixed order**

Keep Phaser lazy; remove unused imports; lower only over-budget WebP from quality 88 to 84; optimize alpha PNG metadata; reduce music 128k→112k only if needed; keep invisible pooled entities inactive. Do not reduce the sheet below 15 frames.

- [ ] **Step 5: Run full release gates and commit**

Add:

```json
{
  "scripts": {
    "verify:release": "npm run lint && npm run typecheck && npm test -- --run && npm run check:assets && npm run build:higgsfield && npm run check:release && npm run test:e2e"
  }
}
```

Run:

```powershell
npm run verify:release
npx playwright test tests/e2e/release-qa.spec.ts --project=firefox
npx playwright test tests/e2e/release-qa.spec.ts --project=webkit
git add package.json vite.config.ts scripts/release/check-budgets.mjs tests/e2e/release-qa.spec.ts src
git commit -m "perf: enforce media accessibility and runner budgets"
```

Expected: all automated gates pass and screenshots are visually approved at original detail.

---

### Task 8: Add PWA and Offline-After-First-Load Support

**Files:**

- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `src/shared/pwa/register-service-worker.ts`
- Create: `tests/e2e/offline.spec.ts`
- Modify: `index.html`
- Modify: `src/main.tsx`

**Interfaces:**

- Consumes: local relative assets and hash routing.
- Produces: installable app and cached hub/routes after one online traversal.

- [ ] **Step 1: Write failing offline test**

Load hub and each route online, wait for service worker ready/control, set Playwright context offline, reload hub and all hash routes, and assert headings/actions/media fallbacks remain usable.

Expected before implementation: reload fails offline.

- [ ] **Step 2: Add manifest and registration**

`manifest.webmanifest` uses name `OpenTrade Arcade`, short name `OpenTrade`, `start_url="./#/"`, `scope="./"`, standalone display, theme `#f2c94c`, background `#171511`, and the exact 192/512 icons.

`register-service-worker.ts`:

```ts
export async function registerOpenTradeServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return null;
  const base = new URL(import.meta.env.BASE_URL, window.location.href);
  try {
    return await navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname });
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Implement `public/sw.js`**

Use cache `open-trade-shell-v1`; pre-cache scope root, manifest, and icons; network-first navigation with cached-root fallback; cache-first/background-refresh local scripts, styles, fonts, images, and audio; ignore non-GET/cross-origin; delete older `open-trade-shell-*` caches on activate.

- [ ] **Step 4: Verify both bases and commit**

```powershell
npm run build:pages
Select-String dist/index.html '/Open-Trade/'
npm run build:higgsfield
Select-String dist/index.html 'src="/'
npm run test:e2e -- tests/e2e/offline.spec.ts
git add public index.html src/main.tsx src/shared/pwa tests/e2e/offline.spec.ts
git commit -m "feat: add installable offline app shell"
```

Expected: Pages base present; Higgsfield root-relative asset search returns none; offline test passes.

---

### Task 9: Package, Deploy, Update, and Smoke-Test Higgsfield

**Files:**

- Create: `deploy/higgsfield/logic.js`
- Create: `scripts/release/package-higgsfield.ps1`
- Create: `tests/e2e/deployed-smoke.spec.ts`
- Create after deployment: `deploy/higgsfield/game-id.txt`
- Modify: `package.json`

**Interfaces:**

- Consumes: passing `verify:release`.
- Produces: root-correct ZIP, stable game ID, and verified CLI URL.

- [ ] **Step 1: Add required solo module**

```js
export const meta = { game: 'open-trade-arcade', minPlayers: 1, maxPlayers: 1 };
export function setup() { return {}; }
export function validateAction() { return { ok: true }; }
export function applyAction(state) { return state; }
export function isGameOver() { return { over: false }; }
export function viewFor(state) { return state; }
```

- [ ] **Step 2: Implement PowerShell packaging**

`package-higgsfield.ps1`:

1. runs `npm run build:higgsfield`;
2. resolves and verifies repo-local `build/higgsfield-package`;
3. copies contents of `dist`, not its wrapper;
4. copies `logic.js` to root and design files under `design`;
5. rejects root `server.js` and root-relative `/assets/`;
6. rejects files ≥25 MiB;
7. uses `Compress-Archive -Path "$staging\*"` to create `artifacts/open-trade-higgsfield.zip`;
8. opens the ZIP with `[System.IO.Compression.ZipFile]::OpenRead()` and requires root `index.html`/`logic.js` with no wrapper.

- [ ] **Step 3: Test package and deploy**

```powershell
npm run verify:release
npm run package:higgsfield
$zipPath = 'C:\Users\USER\Documents\Codex\2026-07-20\hi\work\Open-Trade\artifacts\open-trade-higgsfield.zip'
$deployJson = higgsfield game deploy $zipPath `
  --title 'OpenTrade Arcade' `
  --description 'Three original deterministic finance games: draft stocks, relive founder decisions, and outrun the market.' `
  --json
$deployJson | Set-Content -Encoding utf8 artifacts/higgsfield-deploy.json
$deploy = $deployJson | ConvertFrom-Json
if (-not $deploy.game_id -or -not $deploy.url) { throw 'Incomplete deployment response.' }
$deploy.game_id | Set-Content -NoNewline deploy/higgsfield/game-id.txt
```

No thumbnail/favicon is supplied because those flags require hosted HTTPS media and are optional.

- [ ] **Step 4: Smoke-test returned URL**

`deployed-smoke.spec.ts` reads `OPEN_TRADE_DEPLOY_URL`, opens it, checks hub/disclaimer, exercises one deterministic action in each game, triggers runner collision/restart, validates manifest/service worker subpath, and fails on console error/404.

```powershell
$env:OPEN_TRADE_DEPLOY_URL = $deploy.url
npx playwright test tests/e2e/deployed-smoke.spec.ts --project=chromium
Remove-Item Env:OPEN_TRADE_DEPLOY_URL
```

Expected: smoke passes.

- [ ] **Step 5: Prove update identity**

```powershell
npm run package:higgsfield
$gameId = (Get-Content -Raw deploy/higgsfield/game-id.txt).Trim()
$updateJson = higgsfield game deploy artifacts/open-trade-higgsfield.zip `
  --game-id $gameId `
  --title 'OpenTrade Arcade' `
  --description 'Three original deterministic finance games: draft stocks, relive founder decisions, and outrun the market.' `
  --json
$update = $updateJson | ConvertFrom-Json
if ($update.game_id -ne $gameId) { throw 'Deployment identity changed.' }
```

Repeat smoke against `$update.url`. Never omit `--game-id`; never publish.

- [ ] **Step 6: Commit**

```powershell
git add deploy/higgsfield scripts/release/package-higgsfield.ps1 tests/e2e/deployed-smoke.spec.ts package.json
git commit -m "build: package and deploy Higgsfield game"
```

ZIP/deploy JSON remain ignored; stable game ID is tracked.

---

### Task 10: Deploy and Smoke-Test GitHub Pages

**Files:**

- Modify: `.github/workflows/pages.yml`

**Interfaces:**

- Consumes: passing release gates and Pages-base build.
- Produces: `https://frenzy2004.github.io/Open-Trade/`.

- [ ] **Step 1: Add current official workflow**

```yaml
name: Deploy GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - uses: actions/configure-pages@v5
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --run
      - run: npm run check:assets
      - run: npm run test:e2e
      - run: npm run build:pages
      - run: npm run check:release
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Validate locally and commit**

```powershell
npm ci
npm run lint
npm run typecheck
npm test -- --run
npm run check:assets
npm run build:pages
npm run check:release
git add .github/workflows/pages.yml
git commit -m "ci: deploy OpenTrade to GitHub Pages"
```

Expected: all gates pass; `dist/index.html` uses `/Open-Trade/`.

- [ ] **Step 3: Enable Pages and release**

Configure Pages for GitHub Actions through the signed-in GitHub surface if the repository has not enabled it yet, then push and poll the public Actions API (the local environment does not provide `gh`):

```powershell
git push origin main
$headers = @{ 'User-Agent' = 'Open-Trade-release-check' }
$runsUri = 'https://api.github.com/repos/frenzy2004/Open-Trade/actions/workflows/pages.yml/runs?per_page=1'
$runId = (Invoke-RestMethod -Headers $headers -Uri $runsUri).workflow_runs[0].id
do {
  Start-Sleep -Seconds 5
  $run = Invoke-RestMethod -Headers $headers -Uri "https://api.github.com/repos/frenzy2004/Open-Trade/actions/runs/$runId"
} while ($run.status -ne 'completed')
if ($run.conclusion -ne 'success') { throw "Pages run $runId ended: $($run.conclusion)" }
```

Expected: build/deploy succeed.

- [ ] **Step 4: Smoke-test exact public URL**

```powershell
$env:OPEN_TRADE_DEPLOY_URL = 'https://frenzy2004.github.io/Open-Trade/'
npx playwright test tests/e2e/deployed-smoke.spec.ts --project=chromium
Remove-Item Env:OPEN_TRADE_DEPLOY_URL
```

Expected: all critical paths, relative assets, PWA files, and offline reload pass without 404/console errors.

## Final Release Checklist

- [ ] One workspace selected; account/deploy capability verified.
- [ ] NumPy/Pillow/ffmpeg probes pass.
- [ ] Required Higgsfield references read completely in order.
- [ ] Design files and frozen 16-row manifest predate generation.
- [ ] Exact STYLE FORMULA is byte-identical in all visual prompts.
- [ ] Nine static images, one derived sheet, and six audio files are accepted or honestly amended.
- [ ] Card/episode variants remain CSS/data.
- [ ] Missing-media and audio-failure tests pass.
- [ ] Responsive, accessibility, reduced-motion, and 60 fps gates pass.
- [ ] PWA offline-after-first-load passes.
- [ ] `npm run verify:release` passes.
- [ ] Higgsfield first deploy and same-ID update smoke pass.
- [ ] GitHub Pages smoke passes.
- [ ] No marketplace publication occurs.

## Implementation Handoff

Execute with `superpowers:subagent-driven-development` for one fresh worker per task and review between tasks, or `superpowers:executing-plans` for checkpointed inline batches. Do not generate any media until Task 1’s contract commit exists.
