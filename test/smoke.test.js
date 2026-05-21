// Minimal end-to-end smoke test using Node's built-in test runner.
// Runs the real HTTP server against a throwaway data dir.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-test-'));

const { server } = await import('../server.js');

let base;
before(async () => {
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function get(p) {
  return fetch(base + p, { redirect: 'manual' });
}
async function postForm(p, data) {
  return fetch(base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString(),
    redirect: 'manual',
  });
}

test('landing and dashboard render', async () => {
  assert.equal((await get('/')).status, 200);
  assert.equal((await get('/dashboard')).status, 200);
});

let hotelId;
test('create a hotel', async () => {
  const res = await postForm('/hotels', {
    name: 'Grand Plaza',
    whatsapp: '+1 (555) 123-4567',
    googleUrl: 'https://g.page/r/abc/review',
    tripadvisorUrl: 'https://tripadvisor.com/review',
  });
  assert.equal(res.status, 303);
  hotelId = res.headers.get('location').split('/').pop();
  assert.ok(hotelId);
});

test('high rating funnels to public platforms', async () => {
  const res = await get(`/r/${hotelId}/rate?stars=5`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /Review on Google/);
  assert.match(html, /Review on TripAdvisor/);
});

test('low rating captures private feedback', async () => {
  const ratePage = await get(`/r/${hotelId}/rate?stars=2`);
  assert.match(await ratePage.text(), /private/i);
  const submit = await postForm(`/r/${hotelId}/feedback`, {
    stars: '2',
    message: 'Room was noisy',
    name: 'Sam',
  });
  assert.equal(submit.status, 200);
  assert.match(await submit.text(), /Thank you/);
});

test('feedback appears on the dashboard with escaped input', async () => {
  await postForm(`/r/${hotelId}/feedback`, {
    stars: '1',
    message: '<script>alert(1)</script> bad wifi',
  });
  const html = await (await get(`/dashboard/${hotelId}`)).text();
  assert.match(html, /Room was noisy/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('stats reflect recorded ratings', async () => {
  const html = await (await get(`/dashboard/${hotelId}`)).text();
  assert.match(html, /avg from 2 ratings/); // the 5-star and 2-star rate calls
  assert.match(html, /1 guest sent to public/);
});

test('unknown hotel returns 404', async () => {
  assert.equal((await get('/r/nope404')).status, 404);
});
