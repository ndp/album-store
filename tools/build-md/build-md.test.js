import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tool = path.join(__dirname, 'build-md');

function runTool(args = [], options = {}) {
  return spawnSync(process.execPath, [tool, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

describe('build-md CLI', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-md-test-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('--help displays usage and options with exit code 0', () => {
    const result = runTool(['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /--out-dir/);
    assert.match(result.stdout, /--media-dir/);
    assert.match(result.stdout, /--yaml-preamble/);
    assert.match(result.stdout, /--personnel/);
  });

  it('fails with exit code 1 when given unknown option', () => {
    const result = runTool(['--bogus=1']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown option --bogus/);
  });

  it('fails with exit code 1 when input directory does not exist', () => {
    const nonexistent = path.join(tmpDir, 'nonexistent');
    const result = runTool([`--in-dir=${nonexistent}`]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Input directory not found/);
  });

  it('fails with exit code 1 when positional file argument does not exist', () => {
    const nope = path.join(tmpDir, 'nope.mp3');
    const result = runTool([nope]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /File or directory not found/);
  });

  it('processes directory of MP3 files, moves media into date subfolders, and generates Markdown', () => {
    const mp3sDir = path.join(tmpDir, 'mp3s');
    const datesDir = path.join(tmpDir, 'dates');
    const mediaDir = path.join(tmpDir, 'media');

    fs.mkdirSync(mp3sDir, { recursive: true });
    fs.writeFileSync(path.join(mp3sDir, '.keep'), '');
    fs.writeFileSync(path.join(mp3sDir, 'readme.txt'), 'info');
    fs.writeFileSync(path.join(mp3sDir, '240101-s02-untitled.mp3'), 'audio-content');
    fs.writeFileSync(path.join(mp3sDir, '240101-s01-untitled.mp3'), 'audio-content');
    fs.writeFileSync(path.join(mp3sDir, '240101-s16-untitled.mp3'), 'audio-content');
    fs.writeFileSync(path.join(mp3sDir, '261001-s01-intro.mp3'), 'audio-content');

    const result = runTool([
      `--in-dir=${mp3sDir}`,
      `--out-dir=${datesDir}`,
      `--media-dir=${mediaDir}`,
    ]);

    assert.equal(result.status, 0);

    // Verify Markdown files created
    assert.ok(fs.existsSync(path.join(datesDir, '240101.md')));
    assert.ok(fs.existsSync(path.join(datesDir, '261001.md')));

    // Verify media files moved into date subdirectories without date prefix
    assert.ok(fs.existsSync(path.join(mediaDir, '240101', 's01-untitled.mp3')));
    assert.ok(fs.existsSync(path.join(mediaDir, '240101', 's02-untitled.mp3')));
    assert.ok(fs.existsSync(path.join(mediaDir, '240101', 's16-untitled.mp3')));
    assert.ok(fs.existsSync(path.join(mediaDir, '261001', 's01-intro.mp3')));

    // Verify source files removed, non-mp3 / dotfiles retained
    assert.ok(!fs.existsSync(path.join(mp3sDir, '240101-s01-untitled.mp3')));
    assert.ok(fs.existsSync(path.join(mp3sDir, '.keep')));
    assert.ok(fs.existsSync(path.join(mp3sDir, 'readme.txt')));

    // Verify contents of 240101.md
    const expected240101 = [
      '---',
      'date: 2024-01-01',
      'title: Monday, January 1, 2024',
      'layout: base.njk',
      '---',
      '',
      '# Monday, January 1, 2024',
      '',
      '## Personnel: TBD',
      '',
      '1. [s01-untitled.mp3](../../media/240101/s01-untitled.mp3)',
      '2. [s02-untitled.mp3](../../media/240101/s02-untitled.mp3)',
      '3. [s16-untitled.mp3](../../media/240101/s16-untitled.mp3)',
      '',
    ].join('\n');

    const actual240101 = fs.readFileSync(path.join(datesDir, '240101.md'), 'utf8');
    assert.equal(actual240101, expected240101);

    // Verify contents of 261001.md
    const expected261001 = [
      '---',
      'date: 2026-10-01',
      'title: Thursday, October 1, 2026',
      'layout: base.njk',
      '---',
      '',
      '# Thursday, October 1, 2026',
      '',
      '## Personnel: TBD',
      '',
      '1. [s01-intro.mp3](../../media/261001/s01-intro.mp3)',
      '',
    ].join('\n');

    const actual261001 = fs.readFileSync(path.join(datesDir, '261001.md'), 'utf8');
    assert.equal(actual261001, expected261001);
  });

  it('supports custom media prefix, custom personnel, and string YAML preamble', () => {
    const mp3sDir = path.join(tmpDir, 'mp3s2');
    const datesDir = path.join(tmpDir, 'custom_dates');
    const mediaDir = path.join(tmpDir, 'media2');

    fs.mkdirSync(mp3sDir, { recursive: true });
    fs.writeFileSync(path.join(mp3sDir, '261001-s01-intro.mp3'), 'audio-content');

    const result = runTool([
      `--in-dir=${mp3sDir}`,
      `--out-dir=${datesDir}`,
      `--media-dir=${mediaDir}`,
      '--media-prefix=/audio/media',
      '--personnel=Alice, Bob',
      '--yaml-preamble=layout: concert',
    ]);

    assert.equal(result.status, 0);

    const content = fs.readFileSync(path.join(datesDir, '261001.md'), 'utf8');
    assert.match(content, /1\. \[s01-intro\.mp3\]\(\/audio\/media\/261001\/s01-intro\.mp3\)/);
    assert.match(content, /## Personnel: Alice, Bob/);
    assert.match(content, /layout: concert/);
    assert.ok(fs.existsSync(path.join(mediaDir, '261001', 's01-intro.mp3')));
  });

  it('supports JSON YAML preamble configuration', () => {
    const mp3sDir = path.join(tmpDir, 'mp3s_json');
    const datesDir = path.join(tmpDir, 'dates_json');
    const mediaDir = path.join(tmpDir, 'media_json');

    fs.mkdirSync(mp3sDir, { recursive: true });
    fs.writeFileSync(path.join(mp3sDir, '261001-s01-intro.mp3'), 'audio-content');

    const yamlObj = JSON.stringify({
      layout: 'performance.njk',
      tags: 'concert',
      performer: '{{personnel}}',
    });

    const result = runTool([
      `--in-dir=${mp3sDir}`,
      `--out-dir=${datesDir}`,
      `--media-dir=${mediaDir}`,
      '--personnel=Trio',
      `--yaml-preamble=${yamlObj}`,
    ]);

    assert.equal(result.status, 0);

    const content = fs.readFileSync(path.join(datesDir, '261001.md'), 'utf8');
    assert.match(content, /layout: performance\.njk/);
    assert.match(content, /tags: concert/);
    assert.match(content, /performer: Trio/);
  });

  it('supports positional file arguments', () => {
    const mp3sDir = path.join(tmpDir, 'mp3s3');
    const datesDir = path.join(tmpDir, 'dates_pos');
    const mediaDir = path.join(tmpDir, 'media_pos');

    fs.mkdirSync(mp3sDir, { recursive: true });
    const file1 = path.join(mp3sDir, '240101-s01-untitled.mp3');
    const file2 = path.join(mp3sDir, '240101-s02-untitled.mp3');
    fs.writeFileSync(file1, 'audio-1');
    fs.writeFileSync(file2, 'audio-2');

    const result = runTool([
      `--out-dir=${datesDir}`,
      `--media-dir=${mediaDir}`,
      file1,
      file2,
    ]);

    assert.equal(result.status, 0);
    assert.ok(fs.existsSync(path.join(datesDir, '240101.md')));
    const content = fs.readFileSync(path.join(datesDir, '240101.md'), 'utf8');
    assert.match(content, /# Monday, January 1, 2024/);
    assert.ok(fs.existsSync(path.join(mediaDir, '240101', 's01-untitled.mp3')));
    assert.ok(!fs.existsSync(file1));
  });

  it('prints informative logs when --verbose flag is passed', () => {
    const mp3sDir = path.join(tmpDir, 'mp3s_v');
    const datesDir = path.join(tmpDir, 'dates_v');
    const mediaDir = path.join(tmpDir, 'media_v');

    fs.mkdirSync(mp3sDir, { recursive: true });
    fs.writeFileSync(path.join(mp3sDir, '240101-s01-untitled.mp3'), 'audio-1');

    const result = runTool([
      '--verbose',
      `--in-dir=${mp3sDir}`,
      `--out-dir=${datesDir}`,
      `--media-dir=${mediaDir}`,
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Wrote .*240101\.md/);
    assert.match(result.stdout, /Moved /);
  });
});
