#!/usr/bin/env bash
# Regression test for split-songs using synthetic audio (needs ffmpeg, node). Exits non-zero on failure.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tool="$here/split-songs"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fails=0
ok() { echo "PASS $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

# make out.wav quiet1 loud1 quiet2 loud2 ... (alternating seconds; quiet first)
make() {
  local out=$1; shift
  local inputs=() filt="" i=0 n=$#
  for d in "$@"; do
    local amp=0.05; ((i % 2 == 1)) && amp=6
    inputs+=(-f lavfi -i "sine=f=1000:r=44100:d=$d")
    filt+="[$i:a]volume=$amp[a$i];"
    i=$((i + 1))
  done
  for ((j = 0; j < n; j++)); do filt+="[a$j]"; done
  filt+="concat=n=$n:v=0:a=1[o]"
  ffmpeg -nostdin -v error -y "${inputs[@]}" -filter_complex "$filt" -map '[o]' -ac 1 "$out"
}

# Day 261001: two files; song A (200s) + song B (200s) in file 1, song C (200s) in file 2.
make "$tmp/261001_0001.wav" 20 200 40 200 20
make "$tmp/261001_0002.wav" 20 200 20
# Separate day.
make "$tmp/261002_0001.wav" 20 200 20

# 1. --help exits 0 and mentions options
node "$tool" --help | grep -q -- '--out-dir' && ok help || bad help

# 2. no args exits 1
node "$tool" >/dev/null 2>&1 && bad noargs || ok noargs

# 3. bad option exits 1
node "$tool" --bogus=1 "$tmp/261001_0001.wav" >/dev/null 2>&1 && bad badopt || ok badopt

# 4. missing file exits 1
node "$tool" "$tmp/nope.wav" >/dev/null 2>&1 && bad missing || ok missing

# 5. analyze: stitched day finds 3 songs, 2 days total, no mp3 written
out=$(node "$tool" --analyze "$tmp/261001_0002.wav" "$tmp/261001_0001.wav" "$tmp/261002_0001.wav")
echo "$out" | grep -q 'Found 3 songs' && ok analyze-3 || bad analyze-3
echo "$out" | grep -q 'Found 1 song ' && ok analyze-day2 || bad analyze-day2
ls "$tmp"/*.mp3 >/dev/null 2>&1 && bad analyze-no-export || ok analyze-no-export
# first song starts ~0:20 (never later than 0:20), second ~3:40+
echo "$out" | grep -qE 's01  0:(19|20) ' && ok start-s01 || bad start-s01

# 6. verbose prints chart, default does not
node "$tool" --analyze "$tmp/261002_0001.wav" | grep -q 'Mid-band level' && bad quiet-chart || ok quiet-chart
node "$tool" --analyze -v "$tmp/261002_0001.wav" | grep -q 'Mid-band level' && ok verbose-chart || bad verbose-chart

# 7. export with --out-dir: names, count, location
node "$tool" --out-dir="$tmp/out/nested" "$tmp/261001_0001.wav" "$tmp/261001_0002.wav" "$tmp/261002_0001.wav" >/dev/null
for f in 261001-s01-untitled 261001-s02-untitled 261001-s03-untitled 261002-s01-untitled; do
  [[ -s "$tmp/out/nested/$f.mp3" ]] && ok "file $f" || bad "file $f"
done
[[ $(ls "$tmp/out/nested" | wc -l) -eq 4 ]] && ok count-4 || bad count-4

# 8. default output goes next to source
node "$tool" "$tmp/261002_0001.wav" >/dev/null
[[ -s "$tmp/261002-s01-untitled.mp3" ]] && ok default-dir || bad default-dir

echo
((fails == 0)) && echo "All passed" || { echo "$fails failed"; exit 1; }
