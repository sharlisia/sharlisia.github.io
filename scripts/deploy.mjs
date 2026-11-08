#!/usr/bin/env node
/**
 * 本地构建并发布到 GitHub Pages（gh-pages 分支）。
 * 用法：npm run deploy
 *
 * 不依赖 GitHub Actions。如果以后改回 Actions 自动部署，
 * 见 .github/workflows/deploy.yml 顶部说明。
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
const out = (cmd) => execSync(cmd, { cwd: root }).toString().trim();

const remote = out('git remote get-url origin');           // https://github.com/<user>/<repo>.git
const [, user, repo] = remote.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
const isUserSite = repo.toLowerCase() === `${user.toLowerCase()}.github.io`;
const env = { ...process.env, SITE: `https://${user}.github.io`, BASE: isUserSite ? '/' : `/${repo}/` };

console.log(`构建：${env.SITE}${env.BASE}`);
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
run('npx astro build', { env });
fs.writeFileSync(path.join(root, 'dist/.nojekyll'), '');

const dist = path.join(root, 'dist');
const name = out('git config user.name');
const email = out('git config user.email');
const sh = (cmd) => run(cmd, { cwd: dist });
sh('git init -q -b gh-pages');
sh(`git -c user.name="${name}" -c user.email="${email}" add -A`);
sh(`git -c user.name="${name}" -c user.email="${email}" commit -q -m "Deploy ${new Date().toISOString()}"`);
sh(`git push -f ${remote} gh-pages`);
fs.rmSync(path.join(dist, '.git'), { recursive: true, force: true });
console.log(`\n已发布，1–2 分钟后生效：${env.SITE}${env.BASE}`);
