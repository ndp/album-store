# split-songs — agent reference

Audience: an AI agent modifying or debugging this tool. Read fully before editing.
Installed tool directory: `~/workspace/album-store/tools/split-songs/`. The executable is `split-songs` (no extension); the adjacent regression script and this README are part of the tool.

## Purpose
Linux Node (ESM, no npm deps) CLI. Input: long live-band `.wav` recordings. Output: one MP3 per song, with banter/silence/wind removed. Uses **only ffmpeg + ffprobe** (via `spawnSync`). User: `ndp`. Recordings: bands with steady drums + bass + guitar, **no vocals**, lots of wind/mic noise and 1–10 min banter gaps between songs.

Files:
- `split-songs` — the tool (single Node.js ESM file, executable; formerly `split-songs.mjs`).
- `split-songs.regress.sh` — synthetic-audio regression test (run it after every change; ~1 min).
- The obsolete Audacity mod-script-pipe version remains outside this tool directory at `/home/ndp/workspace/bin/split-song.mjs`. It froze constantly; do not revive or delete unless asked.
- `samples/261001_0071.wav` and `samples/261001_0073.wav` — copies of the user's hand-marked sample recordings for analysis and regression against real audio.

## CLI
```
./split-songs [options] <file.wav> [...]
--help|-h  --analyze  --verbose|-v  --out-dir=path (alias --outDir=path)
--threshold=-25 --silence=20 --min-minutes=3 --lufs=-16 --pre=0.3 --post=1 --extend=60 --low-threshold=-28
```
Options use `--key=value` only (no space form). kebab-case is converted to the camelCase keys of `SETTINGS`. No args → prints help to stderr, exit 1. Any failure → red message, **exit code 1** (user demands fail-fast, never hang). `--help` → exit 0.

## Naming / grouping rules (user requirements)
- First 6 digits of the file name = recording date (`261001_0071.wav` → `261001`). The rest (track no.) is dropped.
- Files with same folder + same date are **stitched** (sorted by name) into one continuous recording; songs are numbered from 1 across the day.
- Output name: `<date>-sNN-untitled.mp3` (lowercase `s`, 2-digit number, `-untitled` suffix). Example `261001-s01-untitled.mp3`.
- Names without a leading 6-digit date → the whole base name is the "day".
- Output dir = `--out-dir` (created recursively) else the folder of the first file of the day.
- Songs that cross a file boundary are annotated `spliced: a.wav + b.wav at m:ss` in the list.
- Histogram/chart printed only with `--verbose`.
- Old Audacity-era files in `~/Music` like `261010_0082- S01.mp3` are unrelated; never touch.

## Pipeline (code map)
1. `main()` validates args (`.wav`, exists), `groupByDay()` → `[{day, files}]`, calls `processDay()` per day in try/catch → `fail()`.
2. `processDay()`: `duration()` (ffprobe) per file; `stitchedInput()` writes an ffmpeg concat-demuxer list in a `mkdtemp` dir (never cleaned up — known minor leak) and returns `-f concat -safe 0 -i list`.
3. `bandLevels(input, filters)`: one RMS dB value per second. Filter chain: `aresample=8000,<band>,asetnsamples=n=8000:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-`; parsed from stdout `RMS_level=` lines (`-inf` → -120). Two calls:
   - mid band `highpass=f=500,lowpass=f=3400` → `levels`
   - low band `highpass=f=60,lowpass=f=500` → `lowLevels`
4. `findSongs(levels, lowLevels, total)`:
   - `on[i]` = 5 s moving average (`smooth(levels,2)`) > `threshold`.
   - Contiguous runs; merge runs whose gap < `silence`; drop runs < `minMinutes*60`.
   - **Reach-back** for each start `a`: walk `t = a-1` downward up to `extend` s while `smooth(lowLevels,1)[t] > lowThreshold`, tolerating ≤2 consecutive misses; start = earliest hit. Catches drum/bass-only intros.
   - Result `{start: max(0, s-pre), end: min(total, b+post)}` in seconds.
5. Export per song: `ffmpeg -ss START -t LEN <concat input> -vn -af loudnorm=I=-16:TP=-1:LRA=11 -ar 44100 -c:a libmp3lame -b:a 192k out.mp3`. (`-ss` before a concat input decodes through preceding audio, so late songs of long days are slow — ~15 s+ each. Acceptable.)

## Design rationale — do not undo without evidence
- **Peak/threshold on full band failed** (original Audacity −15 dB found 1 song/file). Music is loud everywhere; banter is not, but wind/mic bumps/rumble are loud in low bands.
- **500–3400 Hz RMS** separates music (≈ −5…−17 dB) from banter (≈ −30…−40 dB). Threshold −25 chosen; sweeps showed −24…−20 best for file 0073.
- **1500–3400 Hz** worked on 0073 but made 0071 S02 start ~55 s late → rejected.
- **Below 60 Hz = wind** (loudest there, falls off quickly above) → low band begins at 60 Hz.
- Beat-periodicity detector: did not discriminate; dropped.
- Applause can be quiet, songs have no internal silence (steady drums) → large `silence` gap (20 s) is safe.
- User preference: **err toward including extra** audio (esp. at song ends). Late starts are unacceptable; early starts are tolerated (but disliked: guitarist noodles before songs).
- `loudnorm` (single-pass, EBU R128) replaced Audacity Normalize/Amplify, which made output too quiet; the −1 dB true-peak ceiling prevents clipping.

## Ground truth samples
The sample WAVs are stored beside this README in `samples/`; they are copies of files originally located in `/home/ndp/Music/`.
| file | length | marked songs |
|---|---|---|
| `261001_0073.wav` | 25:33 | 1:20–10:00, 11:35–21:55; rest banter; ≈25:06 is wind/mic noise (must not be a song) |
| `261001_0071.wav` | 93:10 | S01 1:20–10:02, S02 11:35–21:53 (S02 start must be ≤ ~11:35; 11:56 was rejected) |

Last output of `--analyze 261001_0071.wav 261001_0073.wav` (stitched, 118:42, 9 songs):
```
s01 0:48–10:57   s02 11:34–22:44   s03 23:08–36:16   s04 39:21–49:21  s05 50:29–60:22
s06 63:40–76:41  s07 77:43–93:12 (spliced, crosses by ~2 s)  s08 93:56–103:11  s09 104:44–115:03
```
Known limits: s01 starts ~30 s early (guitar noodling in low band); ends run up to ~50 s late (applause). Open ideas: ignore splice flag when overlap is only a few seconds; trim applause; another marked file to tune intros; delete temp concat lists.

## Testing
1. Always run `./split-songs.regress.sh` from this directory (synthetic sine tones: 1 kHz at loud/quiet levels; creates temp dir, auto-cleaned). Checks: help, exit codes (no args, bad option, missing file), stitching + date grouping (3 songs for day 261001 across two files, 1 for day 261002), start time, `--analyze` writes nothing, verbose gating of the chart, `--out-dir` creation, naming, default output location. Prints `All passed` / exits 1.
   - Gotcha: ffmpeg `sine` default amplitude is 0.125; the test scales by `volume=6` (loud ≈ −16 dB) vs `0.05`.
   - Synthetic tones have no low-band content, so reach-back is untested there.
2. Real-data check: `./split-songs --analyze samples/261001_0071.wav samples/261001_0073.wav` and compare to the table above; first two starts must not be later than the marks (±2 s) and songs must not absorb the 25:06 wind noise of 0073.
3. Don't write real MP3s into `~/Music` while testing; use `--out-dir=/tmp/x` and remove afterwards.

## Environment / gotchas
- Linux; `ffmpeg`, `ffprobe` at `/usr/bin`. Python has no numpy/pip. Node built-ins only.
- Write files with the edit/create tools (heredoc-style scripted rewrites got blocked in this environment).
- Source WAVs are float-like and hot (RMS up to +8 dB), hence `loudnorm` with peak ceiling.
- Spawn uses `-nostdin` and `maxBuffer 1<<28`; `ffmpeg()` throws on non-zero exit, caught in `main()`.
- `FLAGS` and `SETTINGS` are module-level mutables parsed at import time; there are no exports — test via CLI only.
- Adding a numeric option = add key to `SETTINGS` (parser picks it up automatically) + document in `HELP` + here.
