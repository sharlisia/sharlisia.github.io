#!/usr/bin/env node
/**
 * 把照片导入网站项目（只导入"网页版"，原图不进仓库）。
 *
 * 用法：npm run import-photos -- <源文件夹>
 *   <源文件夹> 下的每个子文件夹 = 一个系列（如 shine/、plant/）。
 *   以 "_" 开头的文件夹、以及 backup/ 会被跳过。
 *
 * 做的事：
 *   1. 生成网页版：按 EXIF 方向转正，长边缩到 2400px，高质量 JPG
 *   2. 去掉全部 EXIF（GPS、设备、拍摄时间等）
 *   3. 存到 src/assets/photos/<系列>/<系列>-NN.jpg（编号接着已有的往后排）
 *   4. 已导入过的照片（原图内容相同）自动跳过，记录在 src/assets/photos/manifest.json
 *
 * 原文件夹不会被修改。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const LONG_EDGE = 2400;
const QUALITY = 88;
const SKIP = new Set(['backup']);

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const destRoot = path.join(root, 'src/assets/photos');
const manifestPath = path.join(destRoot, 'manifest.json');

const src = process.argv[2];
if (!src) {
  console.error('用法：npm run import-photos -- <源文件夹>');
  process.exit(1);
}

fs.mkdirSync(destRoot, { recursive: true });
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const knownHashes = new Set(Object.values(manifest).map((m) => m.sha1));

let added = 0, skipped = 0, before = 0, after = 0;

for (const series of fs.readdirSync(src).sort()) {
  const dir = path.join(src, series);
  if (!fs.statSync(dir).isDirectory() || series.startsWith('_') || SKIP.has(series)) continue;

  const outDir = path.join(destRoot, series);
  fs.mkdirSync(outDir, { recursive: true });
  const existing = fs.readdirSync(outDir).map((f) => f.match(/-(\d+)\.jpg$/)?.[1]).filter(Boolean).map(Number);
  let next = existing.length ? Math.max(...existing) + 1 : 0;

  const files = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort();
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f));
    const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
    if (knownHashes.has(sha1)) { skipped++; continue; }

    const out = await sharp(buf)
      .rotate() // 按 EXIF 方向转正（之后 EXIF 会被整体丢弃）
      .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true })
      .toColorspace('srgb')
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer(); // sharp 默认不写入任何 EXIF / GPS

    const name = `${series}-${String(next++).padStart(2, '0')}.jpg`;
    fs.writeFileSync(path.join(outDir, name), out);
    manifest[`${series}/${name}`] = { original: `${series}/${f}`, sha1 };
    knownHashes.add(sha1);
    added++; before += buf.length; after += out.length;
    process.stdout.write(`\r${added} ${name}            `);
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const mb = (n) => (n / 1048576).toFixed(0) + 'MB';
console.log(`\n导入 ${added} 张（${mb(before)} → ${mb(after)}），跳过已存在 ${skipped} 张。`);
