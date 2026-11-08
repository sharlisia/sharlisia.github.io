import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const ref = z.union([z.string(), z.number()]);
const LAYOUTS = ['full', 'wide', 'center', 'left', 'right', 'row', 'stack'] as const;

const series = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/series' }),
  schema: z.object({
    title: z.string(),
    zh: z.string().optional(),
    place: z.string().optional(),
    order: z.number(),
    folder: z.string().optional(), // 默认 = 文件名
    cover: ref,
    backdrop: ref.optional(), // 垫在相册背景里的照片，默认用封面
    tint: z.string().optional(), // 背景的色彩倾向，如 "#3a78d8"
    theme: z.enum(['light', 'dark']).default('light'),
    hidden: z.array(ref).default([]),
    groups: z.array(
      z.object({
        title: z.string().optional(),
        rows: z.array(z.record(z.enum(LAYOUTS), z.union([ref, z.array(ref)]))),
      }),
    ),
  }),
});

export const collections = { series };
