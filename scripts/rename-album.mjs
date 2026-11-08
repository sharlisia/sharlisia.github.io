#!/usr/bin/env node
/**
 * 给相册改名（文件夹、照片文件名、编排文件、原图文件夹的子文件夹一起改）。
 *
 * 用法：npm run rename-album -- <旧名> <新名>
 *   例：npm run rename-album -- canopy foliage
 *
 * 会改：
 *   - src/assets/photos/<旧名>/<旧名>-NN.jpg → <新名>/<新名>-NN.jpg
 *   - src/content/series/<旧名>.yaml → <新名>.yaml
 *   - manifest.json 里的记录
 *   - site.config.ts 里头图引用的 "<旧名>-NN"
 *   - 原图文件夹 ../original/<旧名> → ../original/<新名>（如果存在）
 * 相册显示的标题（title / zh）在 yaml 里另外改。
 */
import fs from 'node:fs';
import path from 'node:path';

const [from, to] = process.argv.slice(2);
if (!from || !to || !/^[a-z0-9-]+$/.test(to)) {
  console.error('用法：npm run rename-album -- <旧名> <新名>（新名只用小写字母、数字、-）');
  process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const photos = path.join(root, 'src/assets/photos');
const series = path.join(root, 'src/content/series');
const original = path.resolve(root, '../original');

const oldDir = path.join(photos, from);
const newDir = path.join(photos, to);
if (!fs.existsSync(oldDir)) { console.error(`找不到相册文件夹：${oldDir}`); process.exit(1); }
if (fs.existsSync(newDir)) { console.error(`已存在：${newDir}`); process.exit(1); }

fs.renameSync(oldDir, newDir);
for (const f of fs.readdirSync(newDir)) {
  if (f.startsWith(`${from}-`)) fs.renameSync(path.join(newDir, f), path.join(newDir, to + f.slice(from.length)));
}
fs.renameSync(path.join(series, `${from}.yaml`), path.join(series, `${to}.yaml`));

const mp = path.join(photos, 'manifest.json');
const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
const out = {};
for (const [k, v] of Object.entries(m)) {
  const [folder, name] = k.split('/');
  if (folder !== from) { out[k] = v; continue; }
  out[`${to}/${to}${name.slice(from.length)}`] = { ...v, original: `${to}/${v.original.split('/').slice(1).join('/')}` };
}
fs.writeFileSync(mp, JSON.stringify(Object.fromEntries(Object.entries(out).sort()), null, 2) + '\n');

const cfg = path.join(root, 'src/site.config.ts');
fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replaceAll(`'${from}-`, `'${to}-`));

if (fs.existsSync(path.join(original, from)) && !fs.existsSync(path.join(original, to))) {
  fs.renameSync(path.join(original, from), path.join(original, to));
  console.log(`原图文件夹：${from}/ → ${to}/`);
}
console.log(`相册 ${from} → ${to} 完成。记得在 src/content/series/${to}.yaml 里改 title / zh。`);
