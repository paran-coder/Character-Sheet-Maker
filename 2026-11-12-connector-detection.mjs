const download = document.querySelector('#connector-download');
const status = document.querySelector('#connection-status');
const login = document.querySelector('#login');

async function commonConnector() {
  try {
    const response = await fetch('http://127.0.0.1:43186/api/presence', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: '{}',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return false;
    const {version} = await response.json();
    return /^\d+\.\d+\.\d+$/.test(version);
  } catch {
    return false;
  }
}

async function oldPortResponds() {
  try {
    const response = await fetch('http://127.0.0.1:7330/api/ready', {
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    return response.type === 'opaque' || response.ok;
  } catch {
    return false;
  }
}

async function detect({ask = false} = {}) {
  if (await commonConnector()) {
    download.hidden = true;
    return;
  }

  download.hidden = false;
  if (!(await oldPortResponds())) return;

  download.textContent = 'AI연결앱 업데이트';
  if (!ask || sessionStorage.getItem('connector-update-v1.15.0')) return;
  sessionStorage.setItem('connector-update-v1.15.0', 'shown');
  if (window.confirm('기존 AI연결앱 포트가 응답했습니다. 공통 AI연결앱 v1.15.0 설치 파일을 받을까요? 내려받은 파일을 실행하면 업데이트할 수 있습니다.')) {
    download.click();
    status.textContent = '트레이에서 기존 AI연결앱을 종료한 뒤 내려받은 설치 파일을 실행하세요.';
  }
}

if (download && location.hostname === 'charactersheetmaker.vercel.app') {
  void detect({ask:true});
  login.addEventListener('click', () => { void detect(); });
  window.addEventListener('focus', () => { void detect(); });
}
