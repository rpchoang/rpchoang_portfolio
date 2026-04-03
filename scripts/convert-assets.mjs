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

// --- 3. about_spin PNG frames → chroma-keyed transparent WebP ---
const spinDir   = join(root, 'public/assets/about_spin');
const spinFiles = readdirSync(spinDir).filter(f => f.endsWith('.png'));
console.log(`\nChroma-keying + converting ${spinFiles.length} spin frames to WebP…`);

let spinDone = 0;
await Promise.all(
  spinFiles.map(async (file) => {
    const src  = join(spinDir, file);
    const dest = join(spinDir, file.replace('.png', '.webp'));

    // Resize to 500 px tall (keeps ~889 px wide at 1280×720 source), then chroma-key in-place
    const { data, info } = await sharp(src)
      .resize(null, 500)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (g > 60 && g - r > 15 && g - b > 15) {
        const gn  = Math.min(1, (g - Math.max(r, b)) / 40);
        data[i + 3] = Math.round((1 - gn) * 255);
      }
    }

    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .webp({ quality: 72, alphaQuality: 85 })
      .toFile(dest);

    process.stdout.write(`\r  ${++spinDone}/${spinFiles.length}`);
  })
);
console.log('\n  Done. Spin WebP frames written.');

console.log('\nAll conversions complete.');
