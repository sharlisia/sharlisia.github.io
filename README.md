# Sharlisia

个人网站，基于 [Astro](https://astro.build)，部署在 GitHub Pages。

## 日常使用

```bash
npm install        # 第一次
npm run dev        # 本地预览 http://localhost:4321 ，改动实时刷新
```

发布网站：

```bash
git add -A && git commit -m "更新照片" && git push   # 保存源码
npm run deploy                                        # 构建并发布：主页 https://sqxw7n.github.io/sharlisia/ ，摄影 /photo/
```

## 添加照片

1. 把新照片放进某个文件夹的子文件夹里（子文件夹名 = 系列名，例如 `新照片/plant/`）
2. 运行：`npm run import-photos -- 新照片`
   - 自动复制到 `src/assets/photos/<系列>/`，按顺序编号
   - 自动生成网页版（长边 2400px），去掉全部 EXIF/GPS，跳过已导入过的照片
   - 原文件夹不会被改动
3. 新照片会自动出现在系列页末尾；想调整位置，编辑 `src/content/series/<系列>.yaml`（写法见同目录 `_README.md`）

新建一个系列：在 `src/content/series/` 下新建同名 `.yaml`，写上 `title`、`order`、`cover` 和 `groups`。

## 结构

```
src/
  assets/photos/      网页版照片（长边 2400px，无 EXIF）；原图不进仓库，留在本地
  content/series/     每个系列的排版
  site.config.ts      网站名、首页轮播图
  components/         照片、系列索引、系列排版
  pages/              页面
scripts/import-photos.mjs
```
