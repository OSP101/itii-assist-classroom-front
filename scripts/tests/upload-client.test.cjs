const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function coverClient(uploadCoverImage) {
  const filename = path.resolve(__dirname, '../../components/course/course-cover-utils.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', source)(
    () => ({ courseService: { uploadCoverImage } }), module, module.exports,
    () => { throw new TypeError('CSP blocked fetch'); },
  );
  return module.exports;
}

test('course cover uploads original bytes even when CSP blocks fetch of data URLs', async () => {
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1sAAAAASUVORK5CYII=', 'base64');
  let uploads = 0;
  const client = coverClient(async (file) => {
    uploads++;
    assert.equal(file.type, 'image/png');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
    return { success: true, data: { url: '/api/uploads/course-covers/test.jpg' } };
  });
  assert.equal(await client.uploadCourseCoverIfNeeded(`data:image/png;base64,${bytes.toString('base64')}`), '/api/uploads/course-covers/test.jpg');
  assert.equal(uploads, 1);
});

test('unchanged covers skip upload and unsupported data URLs are rejected', async () => {
  const client = coverClient(() => { throw new Error('unexpected upload'); });
  assert.equal(await client.uploadCourseCoverIfNeeded('/api/uploads/old.jpg'), '/api/uploads/old.jpg');
  assert.equal(await client.uploadCourseCoverIfNeeded(''), undefined);
  for (const value of ['data:text/html;base64,PGh0bWw+', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64']) {
    await assert.rejects(client.uploadCourseCoverIfNeeded(value), /JPG/);
  }
});

test('course cover retains the API failure reason', async () => {
  const client = coverClient(async () => ({ success: false, error: 'Connection failed' }));
  await assert.rejects(client.uploadCourseCoverIfNeeded('data:image/jpeg;base64,/9j/'), /Connection failed/);
});

test('course cover accepts 10 MiB exactly and rejects one byte over before upload', async () => {
  let uploads = 0;
  const client = coverClient(async (file) => {
    uploads++;
    assert.equal(file.size, 10 * 1024 * 1024);
    return { success: true, data: { url: '/api/uploads/cover.jpg' } };
  });
  const image = (size) => `data:image/jpeg;base64,${Buffer.alloc(size).toString('base64')}`;
  assert.equal(await client.uploadCourseCoverIfNeeded(image(10 * 1024 * 1024)), '/api/uploads/cover.jpg');
  await assert.rejects(client.uploadCourseCoverIfNeeded(image(10 * 1024 * 1024 + 1)), /10 MB/);
  assert.equal(uploads, 1);
});
