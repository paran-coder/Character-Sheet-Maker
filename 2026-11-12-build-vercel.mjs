import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const app = new URL('./2026-11-12-Character-Sheet-v0.6.1/', import.meta.url);
const output = new URL('./public/', import.meta.url);
const site = 'https://charactersheetmaker.vercel.app';
const assets = [
  'og-image.png',
  '2026-11-12-analytics.js',
  '2026-11-12-app.mjs',
  '2026-11-12-style.css',
  '2026-11-12-views.mjs',
  '2026-11-12-upscale.mjs',
  '2026-11-12-clothing_back.png',
  '2026-11-12-clothing_front.png',
  '2026-11-12-face_3q_left.png',
  '2026-11-12-face_3q_right.png',
  '2026-11-12-face_back.png',
  '2026-11-12-face_right.png',
  '2026-11-12-mannequin-atlas.png',
  '2026-11-12-upscale-model/model.json',
  '2026-11-12-upscale-model/group1-shard1of1.bin',
  '2026-11-12-upscale-model/LICENSE',
];

await mkdir(new URL('./2026-11-12-upscale-model/', output), { recursive: true });
await Promise.all(assets.map(asset => copyFile(new URL(asset, app), new URL(asset, output))));
const installer = '2026-11-12-AIConnector-Setup-v1.15.1.exe';
await copyFile(new URL('./2026-11-12-GitHub-Release-v1.15.1/' + installer, import.meta.url), new URL(installer, output));
await copyFile(new URL('2026-11-12-connector-detection.mjs', import.meta.url), new URL('2026-11-12-connector-detection.mjs', output));
const html = await readFile(new URL('2026-11-12-index.html', app), 'utf8');
await writeFile(new URL('index.html', output), html
  .replace('<meta property="og:type"', '<meta property="og:url" content="' + site + '/">\n<meta property="og:type"')
  .replace('<div class="connection">', '<div class="connection"><a id="connector-download" class="connector-download" href="/' + installer + '" download>AI연결앱 설치·업데이트</a> ')
  .replace('</html>', '<script type="module" src="/2026-11-12-connector-detection.mjs"></script></html>')
  .replaceAll('content="/og-image.png"', 'content="' + site + '/og-image.png"'));
