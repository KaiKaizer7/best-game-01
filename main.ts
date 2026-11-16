// EMBERHOLD hand-in (Node 22, standard library only). The game is static files under
// game/ and the screenshots live in this repository as base64 text (screenshots/*.jpg.b64),
// because the upload path accepts text files only. This program decodes them back into
// real JPEG files in /output/screenshots/, copies game/ to /output/game/, and writes
// /output/dossier.json with the kit's buildDossier, exactly as the scorer recomputes it.
// Both runs write the same bytes: the decode is deterministic and the dossier is
// deterministic.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const shotsDir = join(here, 'screenshots');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

// Decode each base64 screenshot into a JPEG in /output/screenshots/. The output name
// drops the .b64 suffix, so 1-start.jpg.b64 becomes 1-start.jpg and the first file by
// name stays the cover.
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  for (const file of readdirSync(shotsDir).sort()) {
    if (!file.endsWith('.b64')) continue;
    const text = readFileSync(join(shotsDir, file), 'utf8').trim();
    const jpg = Buffer.from(text, 'base64');
    const name = basename(file, '.b64');
    writeFileSync(join(out, 'screenshots', name), jpg);
  }
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the
// others refuse an entry the scorer would refuse (more than 4 screenshots or one over
// 256 KiB; more than 993 files in game/ or 48 MiB of game files, in all: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
