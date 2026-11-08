#!/usr/bin/env node
/**
 * 让网站的照片和原图文件夹保持一致。
 *
 * 用法：npm run sync-photos            （默认原图文件夹 = ../original）
 *       npm run sync-photos -- <文件夹>
 *
 * 原图文件夹里每个子文件夹 = 一个相册（名字与网站相册一致，如 eaves/、sunlit/），backup/ 和 "_" 开头的跳过。
 *
 * 做的事：
 *   1. 原图里删掉的照片 → 网站里也删掉
 *   2. 原图里换了相册的照片 → 网站里也移过去（在新相册里排到最后）
 *   3. 原图里新增的照片 → 生成网页版导入（见 import-photos.mjs）
 *   4. 自动清理相册编排（src/content/series/*.yaml）里引用了已删 / 已移走照片的地方
 *
 * 原图文件夹不会被修改。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SKIP = new Set(['backup']);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.resolve(root, process.argv[2] || '../original');
const photosDir = path.join(root, 'src/assets/photos');
const seriesDir = path.join(root, 'src/content/series');
const manifestPath = path.join(photosDir, 'manifest.json');

if (!fs.existsSync(src)) {
  console.error(`找不到原图文件夹：${src}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const bySha = new Map(Object.entries(manifest).map(([key, v]) => [v.sha1, key]));

// 原图文件夹现状：sha1 → { album, file }
const now = new Map();
for (const album of fs.readdirSync(src).sort()) {
  const dir = path.join(src, album);
  if (!fs.statSync(dir).isDirectory() || album.startsWith('_') || SKIP.has(album)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/\.jpe?g$/i.test(f)) continue;
    const sha1 = crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, f))).digest('hex');
    now.set(sha1, { album, file: f });
  }
}

const log = [];
const nextIndex = (album) => {
  const dir = path.join(photosDir, album);
  fs.mkdirSync(dir, { recursive: true });
  const nums = fs.readdirSync(dir).map((f) => f.match(/-(\d+)\.jpg$/)?.[1]).filter(Boolean).map(Number);
  return nums.length ? Math.max(...nums) + 1 : 0;
};

// 1. 删除
for (const [sha1, key] of bySha) {
  if (now.has(sha1)) continue;
  fs.rmSync(path.join(photosDir, key), { force: true });
  delete manifest[key];
  log.push(`删除  ${key}`);
}

// 2. 换相册
for (const [sha1, key] of bySha) {
  const cur = now.get(sha1);
  if (!cur) continue;
  const oldAlbum = key.split('/')[0];
  if (cur.album === oldAlbum) continue;
  const name = `${cur.album}-${String(nextIndex(cur.album)).padStart(2, '0')}.jpg`;
  const newKey = `${cur.album}/${name}`;
  fs.renameSync(path.join(photosDir, key), path.join(photosDir, newKey));
  manifest[newKey] = { ...manifest[key], original: `${cur.album}/${cur.file}` };
  delete manifest[key];
  log.push(`移动  ${key} → ${newKey}`);
}

fs.writeFileSync(manifestPath, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2) + '\n');

// 3. 新增（交给导入脚本，它会跳过已有的照片）
execFileSync(process.execPath, [path.join(root, 'scripts/import-photos.mjs'), src], { stdio: 'inherit' });

// 4. 清理相册编排里失效的引用
const exists = (album, n) => fs.existsSync(path.join(photosDir, album, `${album}-${String(n).padStart(2, '0')}.jpg`));
for (const f of fs.readdirSync(seriesDir).filter((f) => f.endsWith('.yaml'))) {
  const album = f.replace(/\.yaml$/, '');
  const p = path.join(seriesDir, f);
  const before = fs.readFileSync(p, 'utf8');
  const albumPhotos = fs.existsSync(path.join(photosDir, album))
    ? fs.readdirSync(path.join(photosDir, album)).map((x) => x.match(/-(\d+)\.jpg$/)?.[1]).filter(Boolean).sort()
    : [];
  const out = [];
  for (const line of before.split('\n')) {
    let m;
    if ((m = line.match(/^(\s*- \w+: )\[(.*)\]\s*$/))) {
      // 多张：row / stack
      const keep = m[2].split(',').map((s) => s.trim()).filter((s) => s && (!/^\d+$/.test(s) || exists(album, Number(s))));
      if (keep.length === 1) out.push(m[1].replace(/\w+: $/, 'center: ') + keep[0]); // 只剩一张：改成居中单张
      else if (keep.length) out.push(`${m[1]}[${keep.join(', ')}]`);
    } else if ((m = line.match(/^(\s*- \w+: )(\d+)\s*$/))) {
      // 单张：full / wide / center / left / right
      if (exists(album, Number(m[2]))) out.push(line);
    } else if ((m = line.match(/^(cover|backdrop): (\d+)\s*$/))) {
      out.push(exists(album, Number(m[2])) || !albumPhotos.length ? line : `${m[1]}: ${albumPhotos[0]}`);
    } else if ((m = line.match(/^hidden: \[(.*)\]\s*$/))) {
      const keep = m[1].split(',').map((s) => s.trim()).filter((s) => s && exists(album, Number(s)));
      if (keep.length) out.push(`hidden: [${keep.join(', ')}]`);
    } else {
      out.push(line);
    }
  }
  // 去掉被清空的组
  const cleaned = out.filter((line, i) => !(/^\s*- rows:\s*$/.test(line) && !/^\s+- \w+: /.test(out[i + 1] ?? '')));
  const after = cleaned.join('\n');
  if (after !== before) {
    fs.writeFileSync(p, after);
    log.push(`更新编排  ${f}`);
  }
}

console.log(log.length ? log.join('\n') : '原图文件夹和网站已经一致，没有需要同步的。');
