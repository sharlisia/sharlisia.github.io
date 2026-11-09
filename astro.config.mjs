// @ts-check
import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Astro 用 import.meta.glob 导入的原图会被一并复制进 dist。
 * 构建结束后删掉页面没有引用的原图，只发布压缩后的 webp。
 */
const dropUnusedOriginals = {
  name: 'drop-unused-originals',
  hooks: {
    'astro:build:done': ({ dir, logger }) => {
      const root = fileURLToPath(dir);
      const files = [];
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
        const p = path.join(d, e.name);
        e.isDirectory() ? walk(p) : files.push(p);
      });
      walk(root);
      const text = files.filter((f) => /\.(html|css|js|xml|json)$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
      let n = 0;
      for (const f of files) {
        if (/\.(jpe?g)$/i.test(f) && !text.includes(path.basename(f))) { fs.rmSync(f); n++; }
      }
      logger.info(`removed ${n} unused original images`);
    },
  },
};

// 部署到 GitHub Pages 时由 GitHub Actions 传入 SITE / BASE（见 .github/workflows/deploy.yml）。
// 若仓库名是 <用户名>.github.io，BASE 就是 "/"。
export default defineConfig({
  site: process.env.SITE || 'http://localhost:4321',
  base: process.env.BASE || '/',
  trailingSlash: 'always',
  integrations: [dropUnusedOriginals],
  // 主页暂未上线：访问网站根地址时直接跳到照片页（页面文件在 src/drafts/）
  redirects: { '/': '/photo/' },
});
