# 暂未上线的页面

这里的页面不会被生成成网页。等有内容了，把文件挪回 `src/pages/` 即可上线：

- `home.astro` → `src/pages/index.astro`（同时删掉 astro.config.mjs 里把主页跳到照片页的 redirects）
- `media.astro` → `src/pages/media.astro`
- `graphic.astro` → `src/pages/graphic.astro`

挪回后，把 `src/layouts/Base.astro` 里对应栏目的 `live` 改成 `true`，顶栏上的链接就能点了。
