# build-md — agent reference

Audience: an AI agent modifying or debugging this tool. Read fully before editing.
Installed tool directory: `~/workspace/album-store/tools/build-md/`. The executable is `build-md` (no extension); the adjacent regression script and this README are part of the tool.

## Purpose
Linux Node (ESM, no npm deps) CLI. Input: MP3 files (by default in `./01-mp3s/`). Output: Markdown files in `src/dates/` (e.g. `src/dates/240101.md`) and MP3 files moved into `src/media/` (e.g. `src/media/240101-s16-untitled.mp3`). Each markdown file contains:
- Configurable YAML preamble frontmatter
- Level 1 heading (`#`) with the long-form date (e.g. `# Monday, January 1, 2024`)
- Level 2 heading (`##`) for personnel (e.g. `## Personnel: TBD`)
- Ordered list of song links with URLs located in `media/` (e.g. `1. [240101-s16-untitled.mp3](media/240101-s16-untitled.mp3)`)

Files:
- `build-md` — the tool (single Node.js ESM file, executable).
- `build-md.regress.sh` — regression test script (run it after every change).
- `build-md.README.md` — this reference document.

## CLI
```
./build-md [options] [file.mp3 ...]
--help|-h  --verbose|-v  --in-dir=path (alias --inDir=path)  --out-dir=path (alias --outDir=path)  --media-dir=path (alias --mediaDir=path)  --media-prefix=path (alias --mediaPrefix=path)  --personnel=str  --yaml-preamble=str (alias --yamlPreamble=str)
```
Options use `--key=value` syntax. kebab-case is converted to camelCase keys of `SETTINGS`. `--help` → exit 0. Any failure → red message, **exit code 1**.

## Naming / grouping rules
- First 6 digits of the filename = recording date (`240101-s01-untitled.mp3` → `240101`).
- Files are grouped by date and sorted naturally.
- Destination for Markdown: `<out-dir>/<date>.md` (default: `./src/dates/<date>.md`).
- Destination for MP3s: `<media-dir>/<filename>` (default: `./src/media/<filename>`).
- Content format:
```markdown
---
date: 2024-01-01
title: Monday, January 1, 2024
---

# Monday, January 1, 2024

## Personnel: TBD

1. [240101-s01-untitled.mp3](media/240101-s01-untitled.mp3)
2. [240101-s02-untitled.mp3](media/240101-s02-untitled.mp3)
```

## Testing
Always run `./build-md.regress.sh` from `tools/build-md/`.
