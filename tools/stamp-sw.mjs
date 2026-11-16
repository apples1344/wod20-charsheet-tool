// Derives the service-worker cache name from the content of the shipped files,
// so a deploy can never serve a stale mix of old and new assets.
// Usage: npm run stamp   (run before deploying). Not named "build" on purpose: Vercel
// treats a build script as a framework build and then looks for a "public" folder.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = path.join(root, 'assets/js');
const list = (dir, re) => fs.readdirSync(path.join(root, dir)).filter(f => re.test(f)).sort().map(f => `${dir}/${f}`);
const files = [
  'index.html', 'dice3d.html', 'manifest.json',
  ...list('assets/css', /\.css$/),
  ...list('assets/img', /^(?!og-card).*\.png$/), // og-card is only for link previews
  ...fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort().map(f => 'assets/js/' + f)
];

const hash = crypto.createHash('sha256');
for (const f of files) { hash.update(f); hash.update(fs.readFileSync(path.join(root, f))); }
const version = hash.digest('hex').slice(0, 10);

const swPath = path.join(root, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');

const missing = files.filter(f => f !== 'index.html' && !sw.includes(`'./${f}'`));
if (missing.length) { console.error('sw.js OPTIONAL_ASSETS is missing:', missing.join(', ')); process.exit(1); }

sw = sw.replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = 'wod20-sheet-${version}';`);
fs.writeFileSync(swPath, sw);
console.log('sw.js cache name -> wod20-sheet-' + version);
