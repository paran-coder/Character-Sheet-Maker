import { cardRows, views, viewIds, presets, defaultPreset } from './2026-11-12-views.mjs';

const get = id => document.getElementById(id);
const form = get('sheet');
const reference = get('reference');
const generate = get('generate');
const login = get('login');
const status = get('status');
const download = get('download');
let sourceUrl;
let resultUrl;
const upscaleButton = get('download-original');
let connected = false;
let working = false;


const artworkRects = [[0,75,470,560],[1010,35,140,205],null,null,null,null,[495,20,350,625],[904,20,350,625],[55,625,350,625],null,null,[415,755,445,400],[860,820,380,340]];
for (const [row, entries] of cardRows.entries()) {
  const field = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = row === 0 ? '얼굴·손' : '전신·의상·발';
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

async function request(path, body = {}) {
  const response = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

async function refresh() {
  const state = await request('/status');
  connected = state.connected;
  update();
  if (!state.installed) status.textContent = 'Codex CLI를 시작할 수 없습니다. 실행 환경을 확인하세요.';
  return state;
}

login.addEventListener('click', async () => {
  const auth = window.open('about:blank', '_blank');
  if (auth) auth.opener = null;
  login.disabled = true;
  try {
    const result = await request('/login');
    if (result.authUrl) {
      if (!auth) throw new Error('브라우저 팝업을 허용한 뒤 다시 시도하세요.');
      const url = new URL(result.authUrl);
      if (url.protocol !== 'https:') throw new Error('로그인 주소를 확인할 수 없습니다.');
      auth.location.replace(url.href);
      status.textContent = '새 탭에서 ChatGPT에 로그인한 뒤 돌아오세요.';
      for (let attempt = 0; attempt < 150 && !connected; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await refresh();
        if (!connected) login.disabled = true;
      }
      status.textContent = connected ? '' : '로그인 연결 시간이 지났습니다. 다시 시도하세요.';
    } else {
      auth?.close();
      await refresh();
    }
  } catch (error) {
    auth?.close();
    status.textContent = error.message;
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
  const settings = new FormData(form); const views = settings.getAll('view').map(Number);
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
    get('result').hidden = false;
    get('empty').hidden = true;

    upscaleButton.hidden = false;
    download.hidden = false;
    status.textContent = '시트가 완성되었습니다.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    working = false;
    update();
  }
});

refresh().catch(error => { status.textContent = error.message; });



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
  const ids = fields.getAll('view').map(Number);
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
upscaleButton.addEventListener('click', async () => {
  if (!resultUrl || upscaleButton.disabled) return;
  upscaleButton.disabled = true;
  status.textContent = '로컬에서 이미지를 업스케일하고 있습니다…';
  try {
    const { upscaleImage } = await import('./2026-11-12-upscale.mjs');
    const url = URL.createObjectURL(await upscaleImage(resultUrl));
    savePng(url, 'character-sheet-upscaled.png');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status.textContent = '업스케일 PNG를 저장했습니다.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    upscaleButton.disabled = false;
  }
});
