import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CodexProvider } from './2026-11-12-codex-provider.mjs';
import { viewIds } from './2026-11-12-views.mjs';

const bridge = new CodexProvider(fileURLToPath(new URL('./2026-11-12-runtime/', import.meta.url)));
const files = new Map([
  ['/', ['2026-11-12-index.html', 'text/html']],
  ['/2026-11-12-style.css', ['2026-11-12-style.css', 'text/css']],
  ['/2026-11-12-app.mjs', ['2026-11-12-app.mjs', 'text/javascript']],
  ['/2026-11-12-views.mjs', ['2026-11-12-views.mjs', 'text/javascript']],
]);
const port = Number(process.env.CHARACTER_SHEET_PORT || 43186);
const host = `127.0.0.1:${port}`;
const origin = `http://${host}`;
for (const name of ['mannequin-atlas','clothing_front','clothing_back','face_right','face_back','face_3q_left','face_3q_right']) {
  const filename = '2026-11-12-' + name + '.png';
  files.set('/' + filename, [filename, 'image/png']);
}
for (const [name, type] of [
  ['og-image.png', 'image/png'],
  ['2026-11-12-analytics.js', 'text/javascript'],
  ['2026-11-12-upscale.mjs', 'text/javascript'],
  ['2026-11-12-upscale-model/model.json', 'application/json'],
  ['2026-11-12-upscale-model/group1-shard1of1.bin', 'application/octet-stream'],
]) files.set('/' + name, [name, type]);

let busy = false;
async function compileH3(ids, options = {}) {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => !Number.isInteger(id) || !viewIds[id])) {
    throw new Error('시트에 넣을 뷰를 선택하세요.');
  }
  if (ids.includes(13)) return compileHeadlessLayout(ids, options ?? {});
  return compileOriginal(ids, options);
}

function compileOriginal(ids, options) {
  const script = fileURLToPath(new URL('./2026-11-12-h3-compiler.py', import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.CHARACTER_SHEET_PYTHON || 'python', ['-B', script], { windowsHide: true, timeout: 10000 });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
    child.stderr.resume();
    child.stdin.on('error', reject);
    child.on('error', reject);
    child.on('close', code => {
      try {
        if (code !== 0) throw new Error('H3 가이드를 계산하지 못했습니다. Python 및 설정값을 확인하세요.');
        const result = JSON.parse(output);
        if (result.error) throw new Error(result.error);
        resolve(result);
      } catch (error) { reject(error); }
    });
    child.stdin.end(JSON.stringify({views: ids.map(id => viewIds[id]), options}));
  });
}

async function compileHeadlessLayout(ids, options) {
  const standard = ids.length === 3 && [0,8,13].every(id => ids.includes(id));
  const order = standard ? [13,8,0] : [...new Set(ids)].sort((a,b)=>a-b);
  const original = await compileOriginal([...new Set(order.map(id => id === 13 ? 6 : id))], options);
  const height = original.height;
  const width = standard && options.mode !== 'manual' ? Math.round(height * 16 / 9 / 32) * 32 : original.width;
  const columns = standard ? 3 : Math.min(order.length, 5);
  const rows = Math.ceil(order.length / columns);
  const artRatios = [470/560,140/205,.75,.75,.75,.75,350/625,350/625,350/625,.64,.64,445/400,380/340,350/537];
  const panels = order.map((id,index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const left = Math.round(col * width / columns);
    const right = Math.round((col + 1) * width / columns);
    const top = Math.round(row * height / rows);
    const bottom = Math.round((row + 1) * height / rows);
    const w = Math.max(1, Math.floor(Math.min((right-left)*.96,(bottom-top)*.94*artRatios[id])));
    const h = Math.max(1, Math.floor(w/artRatios[id]));
    return {id:viewIds[id], bounds:[left,top,right,bottom], rect:[Math.floor((left+right-w)/2),Math.floor((top+bottom-h)/2),w,h]};
  });
  const {views} = await import('./2026-11-12-views.mjs');
  const instructions = order.map((id,i) => {
    const desc = id === 13
      ? 'Front-facing outfit and body from the neckline to the shoes. Omit the entire head, face and hair in this panel only. Keep both arms and shoes visible.'
      : views[id].description;
    return (i+1) + '. ' + desc;
  }).join('\n');
  const details = [['face','Face'],['body','Body'],['outfit','Outfit'],['handDetail','Hands'],['footDetail','Footwear']]
    .filter(([key]) => typeof options[key] === 'string' && options[key].trim())
    .map(([key,label]) => label + ': ' + options[key].trim().slice(0,400));
  const attire = {
    pants:'Use a pants silhouette.', skirt:'Use a skirt or robe silhouette.',
    bareHands:'Show bare hands.', gloves:'Show gloved hands.',
    bareFeet:'Show bare feet.', shoes:'Show footwear worn.',
  };
  for (const key of [options.clothing, options.hands === 'bare' ? 'bareHands' : options.hands, options.feet === 'bare' ? 'bareFeet' : options.feet]) {
    if (Object.hasOwn(attire,key)) details.push(attire[key]);
  }
  const prompt = 'Use the same character and clothing across ' + order.length + ' panels. Use ' + columns + ' equal-width columns and ' + rows + ' row(s), in the exact order below. Separate panels with thin vertical or horizontal divider lines on a neutral background. Do not add titles or text.\n' + instructions + '\n' + details.join('\n');
  return {width,height,panels,prompt};
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readBody(req, maxBytes = 12 * 1024 * 1024) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > maxBytes) throw new Error('이미지 용량이 너무 큽니다.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; connect-src 'self' data: blob:; frame-ancestors 'none'; base-uri 'none'");
  if (req.headers.host !== host) return json(res, 403, { error: '로컬 앱 주소로 접속하세요.' });
  try {
    const file = files.get(req.url);
    if (req.method === 'GET' && file) {
      const bytes = await readFile(new URL(file[0], import.meta.url));
      res.writeHead(200, { 'Content-Type': `${file[1]}` });
      return res.end(bytes);
    }
    if (req.method !== 'POST' || !['/status', '/login', '/generate', '/layout'].includes(req.url)) {
      return json(res, 404, { error: '페이지를 찾을 수 없습니다.' });
    }
    if (req.headers.origin !== origin || req.headers['content-type'] !== 'application/json') {
      return json(res, 403, { error: '앱 화면에서 요청하세요.' });
    }
    const body = await readBody(req);
    if (req.url === '/layout') {
      const { width, height, panels } = await compileH3(body.views, body.options);
      return json(res, 200, { width, height, panels });
    }
    if (req.url === '/status') {
      const status = await bridge.status();
      return json(res, 200, { installed: status.installed, connected: Boolean(status.account) });
    }
    if (busy) return json(res, 409, { error: '현재 작업이 끝난 뒤 다시 시도하세요.' });
    busy = true;
    const controller = new AbortController();
    res.once('close', () => controller.abort());
    try {
      if (req.url === '/login') return json(res, 200, await bridge.login(false));
      const { prompt: original, width, height } = await compileH3(body.views, body.options);
      const prompt = "Request an exact native output canvas of " + width + " pixels wide by " + height + " pixels high. Preserve this aspect ratio. " + 'Create one static character sheet from the attached image. Follow the panel layout and view instructions below. Picture 1 is the attached character image.\n\n' + original;
      if (prompt.length > 16000) throw new Error('프롬프트가 너무 깁니다. 부위별 지시를 줄여 주세요.');
      const result = await bridge.generate({
        prompt, images: [body.image], kind: 'edit',
      }, { signal: controller.signal });
      return json(res, 200, { image: result.images[0], width, height });
    } finally {
      busy = false;
    }
  } catch (error) {
    if (!res.destroyed && !res.headersSent) json(res, 400, { error: error.message });
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Character Sheet v0.6.1 · ${origin}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    server.close();
    await bridge.shutdown();
  });
}









