import { cardRows, views, viewIds, presets, defaultPreset } from './2026-11-12-views.mjs';

const get = id => document.getElementById(id);
const form = get('sheet');
const reference = get('reference');
const generate = get('generate');
const login = get('login');
const status = get('status');
const connectionStatus = get('connection-status');
const download = get('download');
let sourceUrl;
let resultUrl;
let connected = false;
let working = false;


const artworkRects = [[0,75,470,560],[1010,35,140,205],null,null,null,null,[495,20,350,625],[904,20,350,625],[55,625,350,625],null,null,[415,755,445,400],[860,820,380,340]];
const [faceCards, bodyCards] = cardRows;
const displayRows = [faceCards.slice(0, -1), bodyCards.slice(0, -1), [faceCards.at(-1), bodyCards.at(-1)]];
const displayGroups = ['얼굴', '전신·의상', '손·발'];
const selectedViews = fields => {
  const selected = fields.getAll('view').map(Number);
  return cardRows.flat().filter(id => selected.includes(id));
};
for (const [row, entries] of displayRows.entries()) {
  const field = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = displayGroups[row];
  field.append(legend);
  for (const id of entries) {
    const {label} = views[id];
    const chip = document.createElement('label');
    chip.className = 'view'; chip.dataset.view = id;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'view';
    input.value = id;
    input.checked = presets[defaultPreset][1].includes(Number(input.value));
    const name = document.createElement("span"); name.textContent = label; chip.append(input, sketch(Number(input.value)), name);
    field.append(chip);
  }
  get('views').append(field);
}

function update() {
  renderGuide();
  generate.disabled = working || !connected || !reference.files.length || !form.querySelector(':checked');
  login.textContent = connected ? 'ChatGPT 연결됨' : 'ChatGPT 연결';
  login.disabled = connected;
}

const publicSite = location.origin === 'https://charactersheetmaker.vercel.app';
const bridgeHelp = '공통 AI연결앱을 실행한 뒤 ChatGPT 연결을 눌러 주세요.';
const pairingKey = 'character-sheet-maker:pairing';
let pairingToken = '';
let tabId = crypto.randomUUID();

if (publicSite) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(pairingKey) || 'null');
    if (saved && /^[a-f0-9]{64}$/.test(saved.token) && /^[\w-]{1,80}$/.test(saved.tabId)) {
      pairingToken = saved.token;
      tabId = saved.tabId;
    }
  } catch {
    // The current page can still connect when session storage is unavailable.
  }
}

function rememberPairing(token) {
  pairingToken = token;
  if (!publicSite) return;
  try {
    if (token) sessionStorage.setItem(pairingKey, JSON.stringify({token, tabId}));
    else sessionStorage.removeItem(pairingKey);
  } catch {
    // Keep the current page connected when session storage is unavailable.
  }
}

async function request(path, body = {}) {
  const response = await fetch((publicSite ? 'http://127.0.0.1:43186/api' : '') + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
      ...(publicSite && pairingToken ? { Authorization: 'Bearer ' + pairingToken } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(path === '/generate' ? 300000 : path === '/claim' ? 2000 : 20000),
  }).catch(() => { throw new Error(bridgeHelp); });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error(bridgeHelp);
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || bridgeHelp);
    error.status = response.status;
    throw error;
  }
  return publicSite && path === '/status' ? {...result, connected:Boolean(result.account)} : result;
}

let preparedActivation;

async function prepareActivation() {
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)),
    byte => byte.toString(16).padStart(2,'0')).join('');
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));
  const challenge = Array.from(new Uint8Array(digest),
    byte => byte.toString(16).padStart(2,'0')).join('');
  const uri = 'nodecanvas://connect?' + new URLSearchParams({origin:location.origin,challenge});
  preparedActivation = {secret, uri};
}

if (publicSite) void prepareActivation();

async function pairIfNeeded() {
  if (!publicSite) return;
  if (pairingToken) {
    try { await request('/heartbeat', {tabId}); return; }
    catch (error) {
      if (error.status !== 401) throw error;
      rememberPairing('');
    }
  }
  if (!preparedActivation) throw new Error('연결을 준비하고 있습니다. 잠시 후 다시 눌러 주세요.');
  const {secret, uri} = preparedActivation;
  preparedActivation = null;
  void prepareActivation();
  const link = document.createElement('a');
  link.href = uri;
  link.click();
  connectionStatus.textContent = 'AI연결앱에서 사이트 주소를 승인해 주세요.';
  for (let attempt=0;attempt<40;attempt++) {
    try {
      const result = await request('/claim',{secret,tabId});
      rememberPairing(result.token);
      break;
    } catch (error) {
      if (error.status && error.status !== 401 && error.status !== 404) throw error;
      await new Promise(resolve=>setTimeout(resolve,750));
    }
  }
  if (!pairingToken) throw new Error('AI연결앱을 열고 사이트를 승인했는지 확인하세요. v1.15.1 이상이 필요합니다.');
  renderGuide();
}

async function refresh() {
  const state = await request('/status');
  connected = state.connected;
  update();
  if (!state.installed) connectionStatus.textContent = 'Codex CLI를 시작할 수 없습니다. 실행 환경을 확인하세요.';
  return state;
}

login.addEventListener('click', async () => {
  login.disabled = true;
  connectionStatus.textContent = '공통 AI연결앱을 확인하고 있습니다…';
  try {
    await pairIfNeeded();
    const state = await refresh();
    if (state.connected) { connectionStatus.textContent = ''; return; }
    login.disabled = true;
    const result = await request('/login');
    if (result.authUrl) {
      const url = new URL(result.authUrl);
      if (url.protocol !== 'https:') throw new Error('로그인 주소를 확인할 수 없습니다.');
      const link = document.createElement('a');
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'ChatGPT 로그인 열기';
      connectionStatus.replaceChildren(link);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('로그인 링크가 만료되었습니다.')), 120000);
        link.addEventListener('click', () => {
          clearTimeout(timer);
          setTimeout(resolve, 0);
        }, {once:true});
      });
      connectionStatus.textContent = '새 탭에서 ChatGPT에 로그인한 뒤 돌아오세요.';
      for (let attempt = 0; attempt < 150 && !connected; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await refresh();
        if (!connected) login.disabled = true;
      }
      connectionStatus.textContent = connected ? '' : '로그인 연결 시간이 지났습니다. 다시 시도하세요.';
      if (connected) renderGuide();
    } else {
      await refresh();
    }
  } catch (error) {
    connectionStatus.textContent = error.message;
  } finally {
    update();
  }
});

form.addEventListener('change', event => {
  if (event.target === reference) {
    const file = reference.files[0];
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    get('source').hidden = true;
    if (file && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      reference.value = '';
      status.textContent = 'PNG, JPEG 또는 WebP 이미지를 선택하세요.';
    } else if (file && file.size > 8 * 1024 * 1024) {
      reference.value = '';
      status.textContent = '8MB 이하의 이미지를 선택하세요.';
    } else if (file) {
      sourceUrl = URL.createObjectURL(file);
      get('source').src = sourceUrl;
      get('source').hidden = false;
    }
  }
  update();
});

function asDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('참조 이미지를 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

async function pngUrl(data) {
  if (data.startsWith('data:image/png;')) {
    return URL.createObjectURL(await (await fetch(data)).blob());
  }
  const image = new Image();
  image.src = data;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d').drawImage(image, 0, 0);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG로 변환할 수 없습니다.');
  return URL.createObjectURL(blob);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (generate.disabled) return;
  const settings = new FormData(form); const views = selectedViews(settings);
  working = true;
  update();
  status.textContent = '캐릭터 시트를 생성하고 있습니다…';
  try {
    const image = await asDataUrl(reference.files[0]);
    const result = await request('/generate', { image, views, options: Object.fromEntries(settings) });
    const url = await pngUrl(result.image);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = url;
    get('result').src = url;
    get('result-open').hidden = false;
    get('empty').hidden = true;

    download.hidden = false;
    status.textContent = '시트가 완성되었습니다.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    working = false;
    update();
  }
});

async function restoreConnection() {
  if (publicSite && !pairingToken) return;
  try {
    await refresh();
    connectionStatus.textContent = '';
  } catch (error) {
    if (publicSite && error.status === 401) rememberPairing('');
    connected = false;
    update();
    connectionStatus.textContent = error.status === 401
      ? 'AI연결앱이 다시 시작됐습니다. ChatGPT 연결을 눌러 주세요.'
      : error.message;
  }
}



function sketch(id) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const rect = id === 13 ? [495, 108, 350, 537] : artworkRects[id];
  const image = new Image();
  image.onload = () => {
    const [x,y,w,h] = rect ?? [0,0,image.naturalWidth,image.naturalHeight];
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);
  };
  image.src = '/2026-11-12-' + (rect ? 'mannequin-atlas' : viewIds[id]) + '.png';
  return canvas;
}

let guideRequest = 0;
async function renderGuide() {
  const requestId = ++guideRequest;
  const fields = new FormData(form);
  const ids = selectedViews(fields);
  const guide = get('guide');
  const count = get('guide-count');
  get('selected-count').textContent = ids.length + ' / ' + viewIds.length + ' 선택';
  for (const name of ['width', 'height']) form.elements[name].disabled = fields.get('mode') !== 'manual';
  form.elements.bodyHeight.disabled = fields.get('mode') === 'manual';
  if (!ids.length) {
    guide.replaceChildren();
    guide.style.aspectRatio = '';
    count.textContent = '뷰를 선택하면 배치가 표시됩니다.';
    return;
  }
  try {
    if (publicSite && !pairingToken) throw new Error('ChatGPT 연결에서 공통 AI연결앱과 페어링하면 가이드가 표시됩니다.');
    const result = await request('/layout', { views: ids, options: Object.fromEntries(new FormData(form)) });
    if (requestId !== guideRequest) return;
    const { width, height, panels } = result;
    guide.style.aspectRatio = width + ' / ' + height;
    guide.replaceChildren();
    count.textContent = width.toLocaleString() + ' × ' + height.toLocaleString() + ' · 가이드';
    for (const {id, bounds, rect} of panels) {
      const index = viewIds.indexOf(id);
      const view = views[index];
      const panel = document.createElement('div');
      panel.className = 'model-panel';
      panel.setAttribute('aria-label', view.group + ' · ' + view.label);
      const [left, top, right, bottom] = bounds;
      const [x,y,w,h] = rect;
      Object.assign(panel.style,{left:left/width*100+'%',top:top/height*100+'%',width:(right-left)/width*100+'%',height:(bottom-top)/height*100+'%'});
      const art = sketch(index);
      Object.assign(art.style,{left:(x-left)/(right-left)*100+'%',top:(y-top)/(bottom-top)*100+'%',width:w/(right-left)*100+'%',height:h/(bottom-top)*100+'%'});
      panel.append(art);
      guide.append(panel);
    }
  } catch (error) {
    if (requestId !== guideRequest) return;
    guide.replaceChildren();
    guide.style.aspectRatio = '';
    count.textContent = error.message;
  }
}

const preset = get('preset');
for (const [key, [label]] of Object.entries(presets)) preset.add(new Option(label,key));
preset.add(new Option('사용자 선택','custom'));
preset.options[preset.options.length - 1].disabled = true;
preset.value = defaultPreset;
preset.addEventListener('change', () => {
  const ids = presets[preset.value]?.[1];
  if (!ids) return;
  for (const input of form.querySelectorAll('input[name="view"]')) input.checked = ids.includes(Number(input.value));
  update();
});
form.addEventListener('change', event => {
  if (event.target.name !== 'view') return;
  const selected = new FormData(form).getAll('view').map(Number).sort((a,b)=>a-b).join(',');
  preset.value = Object.keys(presets).find(key => presets[key][1].join(',') === selected) ?? 'custom';
});
renderGuide();

const tabs = [...document.querySelectorAll('[role="tab"]')];
function openTab(active) {
  for (const tab of tabs) {
    const selected = tab === active;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    get(tab.getAttribute('aria-controls')).hidden = !selected;
  }
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => openTab(tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : 1 - index];
    openTab(next);
    next.focus();
  });
});



function savePng(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

download.addEventListener('click', () => {
  if (resultUrl) savePng(resultUrl, 'character-sheet.png');
});
const resultDialog = get('result-dialog');
get('result-open').addEventListener('click', () => {
  if (!resultUrl || resultDialog.open) return;
  get('result-large').src = resultUrl;
  resultDialog.showModal();
});
resultDialog.addEventListener('click', event => {
  if (event.target === resultDialog) {
    const bounds = resultDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) resultDialog.close();
  }
});

void restoreConnection();
window.addEventListener('pageshow', event => {
  if (event.persisted) void restoreConnection();
});
