// Live test: does the RUNNING server reject a duplicate masuk today?
const API = 'http://localhost:3001';
const EMAIL = 'tes-admin@local.test';
const PWD = 'admin123';

async function req(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

(async () => {
  const login = await req('POST', '/auth/login', { email: EMAIL, password: PWD, deviceModel: 'Tes', deviceId: 'tes-e2e-guard' });
  console.log('login:', login.status);
  const token = login.data.token;
  const tryDup = await req('POST', '/attendances', {
    type: 'luring', sessionType: 'masuk', status: 'hadir', date: '2026-10-01',
    clockInTime: new Date().toISOString(), latitude: 0, longitude: 0, distanceMeters: 0, officeName: 'SKMI',
  }, token);
  console.log('dup masuk 2026-10-01 ->', tryDup.status, tryDup.data?.error || 'INSERTED?!');
  console.log(tryDup.status === 409 ? 'PASS: guard live, duplicate blocked' : 'FAIL: guard ineffective / missing');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });