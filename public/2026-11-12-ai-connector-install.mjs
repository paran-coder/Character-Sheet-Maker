const publicKey = {"kty":"EC","x":"dbupxzjfZFaiujLm3pZLqG87hjVOmysiNmrk6WTOLdI","y":"5kXSqCkQAKSBJivuWbgVCGNqWsgTRJAshByoNTgWCkg","crv":"P-256"};
const origin = 'https://charactersheetmaker.vercel.app';
const bridge = 'http://127.0.0.1:43186';
const versionPattern = /^\d+\.\d+\.\d+$/;

function newer(latest, installed) {
  const current = installed.split('.').map(Number);
  return latest.split('.').map(Number).some((part, index, all) =>
    part > current[index] && all.slice(0,index).every((value,i) => value === current[i]));
}

async function showInstaller() {
  if (location.origin !== origin) return;
  const response = await fetch('/2026-11-12-ai-connector-update.json', {cache:'no-store'});
  if (!response.ok) return;
  const {payload, signature} = await response.json();
  const key = await crypto.subtle.importKey('jwk', publicKey, {name:'ECDSA', namedCurve:'P-256'}, false, ['verify']);
  const valid = await crypto.subtle.verify({name:'ECDSA', hash:'SHA-256'}, key,
    Uint8Array.from(atob(signature), value => value.charCodeAt(0)), new TextEncoder().encode(payload));
  if (!valid) return;
  const {version, url} = JSON.parse(payload);
  if (!versionPattern.test(version) ||
      url !== 'https://github.com/paran-coder/Character-Sheet-Maker/releases/download/ai-connector-v' + version + '/AIConnector-Setup-v' + version + '.exe') return;

  const link = document.createElement('a');
  link.href = url;
  link.textContent = 'AI연결앱 설치';
  document.querySelector('header').insertBefore(link, document.querySelector('#login'));
  try {
    const state = await fetch(bridge + '/status', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:'{}',
      signal:AbortSignal.timeout(12000),
    });
    if (!state.ok) return;
    const {connectorVersion} = await state.json();
    if (!versionPattern.test(connectorVersion ?? '')) return;
    if (newer(version, connectorVersion)) link.textContent = 'AI연결앱 업데이트';
    else link.remove();
  } catch {
    // Leave the installer accessible when the local bridge cannot be reached.
  }
}

showInstaller().catch(error => console.warn('AI연결앱 버전 확인 실패', error));
