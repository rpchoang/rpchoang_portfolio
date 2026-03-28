import sharp from 'sharp';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// --- 1. PNG frames → WebP ---
const framesDir = join(root, 'public/assets/hero_landing_frames');
const files = readdirSync(framesDir).filter(f => f.endsWith('.png'));
console.log(`Converting ${files.length} PNG frames to WebP…`);

let done = 0;
await Promise.all(
  files.map(async (file) => {
    const src = join(framesDir, file);
    const dest = join(framesDir, file.replace('.png', '.webp'));
    await sharp(src).resize(600, null).webp({ quality: 72 }).toFile(dest);
    process.stdout.write(`\r  ${++done}/${files.length}`);
  })
);
console.log('\n  Done. WebP frames written.');

// --- 2. WAV → MP3 ---
const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const wavSrc = join(root, 'public/assets/audio/intro_music_2.wav');
const mp3Dest = join(root, 'public/assets/audio/intro_music_2.mp3');

if (!existsSync(mp3Dest)) {
  console.log('Converting intro_music_2.wav → MP3…');
  execSync(`"${ffmpeg}" -i "${wavSrc}" -codec:a libmp3lame -qscale:a 3 "${mp3Dest}"`, { stdio: 'inherit' });
  console.log('  Done. MP3 written.');
} else {
  console.log('intro_music_2.mp3 already exists, skipping.');
}

console.log('\nAll conversions complete.');
