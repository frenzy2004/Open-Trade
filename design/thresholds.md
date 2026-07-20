# Open Trade Arcade — Verification Thresholds

These values are frozen before implementation. A failed threshold is fixed in code, content, or assets; the number is not weakened in the same iteration.

## Performance and packaging

| Measure | Threshold |
|---|---:|
| Fixed simulation rate | 60 Hz |
| Runner catch-up cap | 5 steps per rendered frame |
| Device pixel ratio cap | 1.5 |
| Sustained worst-case render rate | at least 60 fps |
| P95 rendered frame time | at most 16.7 ms |
| P99 rendered frame time | at most 33.4 ms |
| Runner entities alive | at most 36 |
| Worst-case runner draw calls | at most 12 |
| Per-frame heap allocations after warm-up | 0 intentional allocations |
| Initial app JavaScript excluding lazy runner | at most 350 KiB gzip |
| Lazy runner JavaScript chunk | at most 1.2 MiB gzip |
| Complete production `dist/` | at most 20 MiB |
| Each 1280×720 background | at most 400 KiB |
| Each 512×512 transparent sprite | at most 350 KiB |
| Each 256×256 transparent icon | at most 160 KiB |
| 15-frame 4×4 runner sheet | at most 2 MiB |
| Single packaged asset | less than 25 MiB |
| Missing asset requests | 0 |
| Console errors in production E2E | 0 |

## Interaction and layout

| Measure | Threshold |
|---|---:|
| Minimum pointer/touch target | 44 by 44 CSS px |
| Input acknowledgment | within 100 ms |
| Tested mobile viewport | 390 by 844 CSS px |
| Tested desktop viewport | 1440 by 900 CSS px |
| Additional responsive widths | 320, 375, 768, and 1024 CSS px |
| Keyboard-only completion | all three games |
| Touch-only completion | all three games |
| Gamepad-only runner completion | Wallstreet Surfers tutorial plus one deterministic gate |
| Unlabeled interactive controls | 0 |
| Focus trapped or lost after modal close | 0 |
| Overflow hiding a required action | 0 |

## Determinism and gameplay

| Measure | Threshold |
|---|---:|
| FanStocks draft rounds | exactly 3 |
| FanStocks candidates per round | exactly 3 |
| FanStocks starting portfolio | exactly $50.00 simulated value |
| Founder episodes | exactly 4 |
| Founder decisions per episode | exactly 5 |
| Founder choices per decision | exactly 3 |
| Runner lanes | exactly 3 |
| Lane transition | 180 ms |
| Jump action window | 760 ms |
| Roll action window | 650 ms |
| Spawn-safety proof | 100 seeds through 5,000 m |
| Same seed plus command stream mismatch | 0 state fields |
| Restart leakage into a new seeded run | 0 transient fields |

## Audio

| Measure | Threshold |
|---|---:|
| Music integrated loudness | -19 LUFS +/- 2 LU |
| SFX integrated loudness (>=400 ms) | -11 LUFS +/- 3 LU |
| Final encoded true peak | at most -3 dBFS |
| Final audio format | 48 kHz Opus; SFX mono, music stereo |
| Final duration | plan duration +/- 50 ms |
| Non-silence | max volume above -60 dBFS |

Sub-400 ms transient SFX are measured for duration, format, non-silence, and true peak, but not rejected by integrated-LUFS comparison: EBU R128 integrated loudness is not stable for clips shorter than its analysis window. For longer high-crest transients, the -11 LUFS check is also reported but not rejected when achieving it would exceed the -3 dBFS true-peak gate (more than 8 dB crest factor). The audio plan keeps production SFX at 500 ms or longer.
| Playability while muted | 100% of mechanics |
| Raw full-gain model clips in the mix | 0 |

## Release gates

- Unit, component, accessibility, deterministic simulation, and end-to-end suites all exit 0.
- Production assets load from relative paths under a non-root preview subpath.
- The built Higgsfield ZIP has `index.html`, solo `logic.js`, and `assets/` at the archive root with no wrapper, source repository, cache, or `node_modules`.
- GitHub Pages and the Higgsfield deployment are each opened and replayed from a fresh session before their URLs are handed over.
