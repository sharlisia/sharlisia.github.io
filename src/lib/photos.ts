import type { ImageMetadata } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';

const modules = import.meta.glob<{ default: ImageMetadata }>('/src/assets/photos/*/*.{jpg,jpeg,JPG,JPEG}', {
  eager: true,
});

export interface Photo {
  id: string; // 如 "building-08"
  folder: string;
  src: ImageMetadata;
  ratio: number; // 宽 / 高
}

export const photos = new Map<string, Photo>();
for (const [path, mod] of Object.entries(modules)) {
  const [, folder, file] = path.match(/photos\/([^/]+)\/([^/]+)\.\w+$/)!;
  photos.set(file, { id: file, folder, src: mod.default, ratio: mod.default.width / mod.default.height });
}

/** "08" / 8 / "building-08" → Photo */
export function resolve(ref: string | number, folder: string): Photo {
  const s = String(ref);
  const id = /^\d+$/.test(s) ? `${folder}-${s.padStart(2, '0')}` : s;
  const p = photos.get(id);
  if (!p) throw new Error(`[photos] 找不到照片 "${s}"（系列 ${folder}）。检查 src/content/series/${folder}.yaml`);
  return p;
}

export type Layout = 'full' | 'wide' | 'center' | 'left' | 'right' | 'row' | 'stack';
export interface Row { layout: Layout; photos: Photo[] }
export interface Group { title?: string; rows: Row[] }

export interface Series {
  slug: string;
  title: string;
  zh?: string;
  place?: string;
  theme: 'light' | 'dark';
  cover: Photo;
  backdrop: Photo;
  groups: Group[];
  count: number;
}

/** 没写进 yaml 的照片自动排在最后：横图单张大图，竖图/方图两两并排 */
function autoRows(list: Photo[]): Row[] {
  const rows: Row[] = [];
  let buf: Photo[] = [];
  const flush = () => { if (buf.length) rows.push({ layout: buf.length === 1 ? 'center' : 'row', photos: buf }); buf = []; };
  for (const p of list) {
    if (p.ratio > 1.4) { flush(); rows.push({ layout: 'wide', photos: [p] }); }
    else { buf.push(p); if (buf.length === 2) flush(); }
  }
  flush();
  return rows;
}

function build(entry: CollectionEntry<'series'>): Series {
  const d = entry.data;
  const folder = d.folder ?? entry.id;
  const used = new Set<string>(d.hidden.map((r) => resolve(r, folder).id));

  const groups: Group[] = d.groups.map((g) => ({
    title: g.title,
    rows: g.rows.map((r) => {
      const [layout, val] = Object.entries(r)[0] as [Layout, string | number | (string | number)[]];
      const list = (Array.isArray(val) ? val : [val]).map((v) => resolve(v, folder));
      list.forEach((p) => used.add(p.id));
      return { layout, photos: list };
    }),
  }));

  const rest = [...photos.values()].filter((p) => p.folder === folder && !used.has(p.id)).sort((a, b) => a.id.localeCompare(b.id));
  if (rest.length) groups.push({ rows: autoRows(rest) });

  const count = groups.reduce((n, g) => n + g.rows.reduce((m, r) => m + r.photos.length, 0), 0);
  return { slug: entry.id, title: d.title, zh: d.zh, place: d.place, theme: d.theme, cover: resolve(d.cover, folder), backdrop: resolve(d.backdrop ?? d.cover, folder), groups, count };
}

export async function getSeries(): Promise<Series[]> {
  const entries = await getCollection('series');
  return entries.sort((a, b) => a.data.order - b.data.order).map(build);
}
