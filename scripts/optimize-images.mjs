#!/usr/bin/env node
// Converts images to WebP next to the originals.
//
//   npm run images -- public/vidya/img/new-guy.png          → new-guy.webp
//   npm run images -- --width 480 public/vidya/img/flag.svg  → flag.webp (rasterized)
//
// PNG/JPG: tries lossy (quality 90, full-quality alpha) and lossless, keeps the smaller.
// Dimensions are kept unless --width is given. Originals are not deleted.

import { basename, extname } from 'node:path';
import { stat } from 'node:fs/promises';
import sharp from 'sharp';

const args = process.argv.slice(2);
let width;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--width') width = Number(args[++i]);
  else files.push(args[i]);
}

if (!files.length) {
  console.error('Usage: npm run images -- [--width N] <file.png|jpg|svg>...');
  process.exit(1);
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

for (const file of files) {
  const ext = extname(file).toLowerCase();
  const out = file.slice(0, -ext.length) + '.webp';
  // SVGs are rendered at a high density first so the downscale stays sharp.
  let img = sharp(file, ext === '.svg' ? { density: 300 } : {});
  if (width) img = img.resize({ width });

  const lossy = await img.clone().webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
  const lossless = await img.clone().webp({ lossless: true, effort: 6 }).toBuffer();
  const best = lossless.length <= lossy.length ? lossless : lossy;
  await sharp(best).toFile(out);

  const before = (await stat(file)).size;
  const mode = best === lossless ? 'lossless' : 'q90';
  console.log(`${basename(file)} ${kb(before)} → ${basename(out)} ${kb(best.length)} (${mode})`);
}
