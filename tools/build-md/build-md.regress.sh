#!/usr/bin/env bash
# Regression test for build-md. Exits non-zero on failure.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tool="$here/build-md"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fails=0
ok() { echo "PASS $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

# 1. --help exits 0 and mentions options
node "$tool" --help | grep -q -- '--out-dir' && ok help-outdir || bad help-outdir
node "$tool" --help | grep -q -- '--media-dir' && ok help-mediadir || bad help-mediadir

# 2. bad option exits 1
node "$tool" --bogus=1 >/dev/null 2>&1 && bad badopt || ok badopt

# 3. missing input directory exits 1
node "$tool" --in-dir="$tmp/nonexistent" >/dev/null 2>&1 && bad missing-dir || ok missing-dir

# 4. missing specific file argument exits 1
node "$tool" "$tmp/nope.mp3" >/dev/null 2>&1 && bad missing-file || ok missing-file

# Setup mock 01-mp3s directory
mkdir -p "$tmp/mp3s"
touch "$tmp/mp3s/.keep"
touch "$tmp/mp3s/readme.txt"
touch "$tmp/mp3s/240101-s02-untitled.mp3"
touch "$tmp/mp3s/240101-s01-untitled.mp3"
touch "$tmp/mp3s/240101-s16-untitled.mp3"
touch "$tmp/mp3s/261001-s01-intro.mp3"

# 5. default processing with custom --in-dir, --out-dir, and --media-dir
node "$tool" --in-dir="$tmp/mp3s" --out-dir="$tmp/dates" --media-dir="$tmp/media" >/dev/null

[[ -f "$tmp/dates/240101.md" ]] && ok "date-file-240101" || bad "date-file-240101"
[[ -f "$tmp/dates/261001.md" ]] && ok "date-file-261001" || bad "date-file-261001"

# Check moved files in media dir
[[ -f "$tmp/media/240101-s01-untitled.mp3" ]] && ok "moved-240101-s01" || bad "moved-240101-s01"
[[ -f "$tmp/media/240101-s02-untitled.mp3" ]] && ok "moved-240101-s02" || bad "moved-240101-s02"
[[ -f "$tmp/media/240101-s16-untitled.mp3" ]] && ok "moved-240101-s16" || bad "moved-240101-s16"
[[ -f "$tmp/media/261001-s01-intro.mp3" ]] && ok "moved-261001-s01" || bad "moved-261001-s01"

# Check source files were removed from mp3s dir
[[ ! -f "$tmp/mp3s/240101-s01-untitled.mp3" ]] && ok "removed-from-src" || bad "removed-from-src"
[[ -f "$tmp/mp3s/.keep" ]] && ok "kept-dotfile" || bad "kept-dotfile"
[[ -f "$tmp/mp3s/readme.txt" ]] && ok "kept-undated" || bad "kept-undated"

# Check content of 240101.md
expected_240101=$(cat <<'EOF'
1. [240101-s01-untitled.mp3](media/240101-s01-untitled.mp3)
2. [240101-s02-untitled.mp3](media/240101-s02-untitled.mp3)
3. [240101-s16-untitled.mp3](media/240101-s16-untitled.mp3)
EOF
)

actual_240101=$(cat "$tmp/dates/240101.md")
if [[ "$actual_240101" == "$expected_240101" ]]; then
  ok "content-240101"
else
  bad "content-240101"
  echo "Expected:"
  echo "$expected_240101"
  echo "Got:"
  echo "$actual_240101"
fi

# Check content of 261001.md
expected_261001=$(cat <<'EOF'
1. [261001-s01-intro.mp3](media/261001-s01-intro.mp3)
EOF
)

actual_261001=$(cat "$tmp/dates/261001.md")
if [[ "$actual_261001" == "$expected_261001" ]]; then
  ok "content-261001"
else
  bad "content-261001"
fi

# 6. custom media prefix
mkdir -p "$tmp/mp3s2"
touch "$tmp/mp3s2/261001-s01-intro.mp3"
node "$tool" --in-dir="$tmp/mp3s2" --out-dir="$tmp/custom_dates" --media-dir="$tmp/media2" --media-prefix="/audio/media" >/dev/null
grep -q '1. \[261001-s01-intro.mp3\](/audio/media/261001-s01-intro.mp3)' "$tmp/custom_dates/261001.md" && ok "custom-media-prefix" || bad "custom-media-prefix"
[[ -f "$tmp/media2/261001-s01-intro.mp3" ]] && ok "moved-custom-media-dir" || bad "moved-custom-media-dir"

# 7. positional file args
mkdir -p "$tmp/mp3s3"
touch "$tmp/mp3s3/240101-s01-untitled.mp3"
touch "$tmp/mp3s3/240101-s02-untitled.mp3"
mkdir -p "$tmp/dates_pos"
mkdir -p "$tmp/media_pos"
node "$tool" --out-dir="$tmp/dates_pos" --media-dir="$tmp/media_pos" "$tmp/mp3s3/240101-s01-untitled.mp3" "$tmp/mp3s3/240101-s02-untitled.mp3" >/dev/null
[[ $(wc -l < "$tmp/dates_pos/240101.md") -eq 2 ]] && ok "positional-args" || bad "positional-args"
[[ -f "$tmp/media_pos/240101-s01-untitled.mp3" ]] && ok "moved-positional" || bad "moved-positional"
[[ ! -f "$tmp/mp3s3/240101-s01-untitled.mp3" ]] && ok "removed-positional" || bad "removed-positional"

echo
((fails == 0)) && echo "All passed" || { echo "$fails failed"; exit 1; }
