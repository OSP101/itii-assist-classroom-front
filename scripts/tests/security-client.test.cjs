const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute the real service modules with isolated browser storage and transport.
// TypeScript is already a dev dependency; no browser or live account is needed.
function client(transport) {
  const storage = new Map([['csrf_token', 'old-csrf']]);
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const window = { localStorage, location: { origin: 'http://app.test', pathname: '/login' } };
  const cache = new Map();
  const stubs = {
    '@/config/api': { API_BASE_URL: 'http://app.test/api' },
    '@/lib/auth-resume': { buildPreferredLoginHref: () => '/login' },
    '@/lib/session-timeout': {
      clearSessionExpiresAt() {}, markSessionExpiredByTimeout() {}, setSessionExpiresAt() {},
    },
  };
  function load(filename) {
    filename = path.resolve(__dirname, '../..', filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const requireLocal = (name) => {
      if (stubs[name]) return stubs[name];
      const target = name.startsWith('@/')
        ? name.slice(2)
        : path.relative(path.resolve(__dirname, '../..'), path.resolve(path.dirname(filename), name));
      return load(`${target}.ts`);
    };
    new Function('require', 'module', 'exports', 'fetch', 'window', 'document', 'localStorage', source)(
      requireLocal, module, module.exports, transport, window, { cookie: '' }, localStorage,
    );
    return module.exports;
  }
  return {
    api: load('services/api.service.ts').default,
    raw: load('services/authenticated-fetch.ts').authenticatedFetch,
    csrf: load('lib/csrf.ts'),
  };
}

function json(status, data, headers = {}) {
  return Response.json(data, { status, headers });
}

const options = { timeout: 3000 };

test('upload errors retain server reasons and explain proxy rejections without HTML', options, async () => {
  for (const [response, expected] of [
    [json(400, { success: false, message: 'รูปภาพเกิน 25 ล้านพิกเซล' }), /25/],
    [json(400, { success: false, error: 'รองรับ JPG, PNG, GIF หรือ WebP' }), /WebP/],
    [new Response('<html>too large</html>', { status: 413 }), /10 MB/],
    [json(413, { success: false, message: 'Request Entity Too Large' }), /10 MB/],
    [new Response('<html>Bad Gateway</html>', { status: 502 }), /เซิร์ฟเวอร์.*502/],
  ]) {
    const { api } = client(async () => response);
    const result = await api.post('/courses/cover-image', new FormData());
    assert.equal(result.success, false);
    assert.match(result.message, expected);
    assert.doesNotMatch(result.message, /<html>/);
  }
});

test('network upload failures provide an actionable message to message-only callers', options, async () => {
  const { api } = client(async () => { throw new TypeError('NetworkError'); });
  const result = await api.post('/courses/cover-image', new FormData());
  assert.equal(result.success, false);
  assert.match(result.message, /เชื่อมต่อเซิร์ฟเวอร์.*อินเทอร์เน็ต/);
  assert.equal(result.error, result.message);
});

test('all upload routes send multipart bytes with cookies and CSRF', options, async () => {
  for (const [endpoint, field] of [
    ['/courses/cover-image', 'image'],
    ['/score-edit-requests', 'images'],
    ['/students/me/courses/test/leave-requests', 'evidence'],
  ]) {
    const form = new FormData();
    form.append(field, new File(['image bytes'], 'test.png', { type: 'image/png' }));
    const { api } = client(async (_url, init) => {
      assert.equal(init.credentials, 'include');
      assert.equal(init.headers['X-CSRF-Token'], 'old-csrf');
      assert.equal(init.headers['Content-Type'], undefined);
      const request = new Request('http://app.test/api', init);
      assert.match(request.headers.get('content-type'), /^multipart\/form-data; boundary=/);
      assert.equal(await (await request.formData()).get(field).text(), 'image bytes');
      return json(200, { success: true });
    });
    assert.equal((await api.post(endpoint, form)).success, true);
  }
});

test('expired access cookie refreshes once and retries mutation with rotated CSRF', options, async () => {
  const calls = [];
  const { api } = client(async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/auth/refresh')) {
      assert.equal(init.headers['X-CSRF-Token'], 'old-csrf');
      return json(200, { success: true, data: {} }, { 'X-CSRF-Token': 'new-csrf' });
    }
    if (calls.length === 1) return json(401, { success: false });
    assert.equal(init.headers['X-CSRF-Token'], 'new-csrf');
    assert.equal(init.credentials, 'include');
    return json(200, { success: true });
  });
  assert.equal((await api.post('/queue/bookings', { desk_number: 1 })).success, true);
  assert.equal(calls.length, 3);
});

test('2FA rejection stays on verification flow without refreshing a session', options, async () => {
  const calls = [];
  const { api } = client(async (url) => {
    calls.push(url);
    return json(401, { success: false, message: 'expired challenge' });
  });
  for (const route of ['verify-login', 'complete-login', 'send-login-code']) {
    assert.equal((await api.post(`/auth/2fa/${route}`, { challenge: 'expired' })).success, false);
  }
  assert.equal(calls.length, 3);
  assert.ok(calls.every((url) => !url.endsWith('/auth/refresh')));
});

test('concurrent private data and evidence share one session refresh', options, async () => {
  let refreshes = 0;
  let releaseRefresh;
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
  let refreshed = false;
  const { api } = client(async (url) => {
    if (url.endsWith('/auth/refresh')) {
      refreshes++;
      await refreshGate;
      refreshed = true;
      return json(200, { success: true, data: {} });
    }
    if (!refreshed) return json(401, { success: false });
    if (url.includes('/uploads/')) return new Response('evidence');
    return json(200, { success: true });
  });
  const data = api.get('/queue/bookings/31/status');
  const evidence = api.getBlob('/uploads/score-edit-requests/example.jpg');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(refreshes, 1);
  releaseRefresh();
  assert.equal((await data).success, true);
  assert.equal(await (await evidence).text(), 'evidence');
});

test('failed refresh releases waiting data and evidence requests', options, async () => {
  let releaseRefresh;
  const gate = new Promise((resolve) => { releaseRefresh = resolve; });
  const { api } = client(async (url) => {
    if (url.endsWith('/auth/refresh')) await gate;
    return json(401, { success: false });
  });
  const data = api.get('/queue/bookings/31/status');
  const evidence = api.getBlob('/uploads/score-edit-requests/example.jpg');
  await new Promise((resolve) => setImmediate(resolve));
  releaseRefresh();
  assert.equal((await data).success, false);
  assert.equal(await evidence, null);
});

test('forbidden evidence is not exposed or retried as an expired session', options, async () => {
  let calls = 0;
  const { api } = client(async () => { calls++; return new Response('private', { status: 403 }); });
  assert.equal(await api.getBlob('/uploads/score-edit-requests/example.jpg'), null);
  assert.equal(calls, 1);
});

test('raw responses capture rotated CSRF for the next mutation', options, async () => {
  const seen = [];
  const { raw, csrf } = client(async (_url, init) => {
    seen.push(init);
    return new Response('ok', { headers: { 'X-CSRF-Token': 'rotated-csrf' } });
  });
  await raw('/api/queue/validate', { method: 'POST', body: '{}' });
  assert.equal(csrf.getCsrfToken(), 'rotated-csrf');
  await raw('/api/queue/bookings', { method: 'POST', body: '{}' });
  assert.equal(seen[0].headers.get('X-CSRF-Token'), 'old-csrf');
  assert.equal(seen[1].headers.get('X-CSRF-Token'), 'rotated-csrf');
  assert.equal(seen[1].credentials, 'include');
  assert.equal(seen[1].cache, 'no-store');
});
