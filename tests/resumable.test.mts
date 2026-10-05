import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {uploadInChunks, UploadPaused, waitForOperation} from '../lib/resumable.ts';
import {validateMedia, IMAGE_LIMIT, VIDEO_LIMIT} from '../lib/mediaRules.ts';

async function protocolServer(mode = 'ok') {
  let offset = 0, creates = 0, patches = 0, failures = 0;
  const chunks: Buffer[] = [], heads: number[] = [];
  const server = createServer(async (req, res) => {
    res.setHeader('Tus-Resumable', '1.0.0');
    if (req.headers.authorization !== 'Bearer local-fixture') {res.writeHead(403).end(); return;}
    if (req.method === 'HEAD') {heads.push(offset); res.writeHead(200, {'Upload-Offset': offset, 'Upload-Length': 8 * 1024 * 1024}).end(); return;}
    if (req.method === 'POST') {
      creates++;
      if (mode === 'too-large') {res.writeHead(413).end(); return;}
      if (mode === 'permission') {res.writeHead(403).end(); return;}
      assert.equal(req.headers['upload-length'], String(8 * 1024 * 1024));
      assert.ok(String(req.headers['upload-metadata']).includes('bucketName'));
    }
    if (req.method === 'PATCH') {
      patches++;
      assert.equal(Number(req.headers['upload-offset']), offset);
      if (mode === 'retry' && failures++ === 0) {req.resume(); res.writeHead(503).end(); return;}
    }
    const part: Buffer[] = [];
    for await (const chunk of req) part.push(Buffer.from(chunk));
    const body = Buffer.concat(part); assert.ok(body.length <= 6 * 1024 * 1024);
    chunks.push(body); offset += body.length;
    if (mode === 'lost-response' && offset === 8 * 1024 * 1024) {req.socket.destroy(); return;}
    res.writeHead(req.method === 'POST' ? 201 : 204, {'Upload-Offset': offset, Location: `${endpoint}/one`}).end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const endpoint = `http://127.0.0.1:${address.port}/storage/v1/upload/resumable`;
  return {endpoint, stop: () => new Promise<void>(resolve => {server.closeAllConnections(); server.close(() => resolve());}),
    result: () => ({offset, creates, patches, heads, body: Buffer.concat(chunks)})};
}
function input(endpoint: string, path: string) {
  return {file: Buffer.alloc(8 * 1024 * 1024, 42), size: 8 * 1024 * 1024, mime: 'video/mp4', endpoint, path,
    authorization: async () => ({authorization: 'Bearer local-fixture'})};
}
test('accepts boundaries; rejects overflow, empty, mismatched type and unknown/long duration', () => {
  validateMedia('image', IMAGE_LIMIT, 'image/jpeg');
  validateMedia('video', VIDEO_LIMIT, 'video/mp4', 60);
  assert.throws(() => validateMedia('image', IMAGE_LIMIT + 1, 'image/png'));
  assert.throws(() => validateMedia('video', VIDEO_LIMIT + 1, 'video/mp4', 60));
  assert.throws(() => validateMedia('image', 0, 'image/png'));
  assert.throws(() => validateMedia('image', 128, 'video/mp4'));
  assert.throws(() => validateMedia('video', 128, 'video/mp4'));
  assert.throws(() => validateMedia('video', 128, 'video/mp4', 60.001));
});
test('pause/timeout during preparation stop waiting for an unavailable server', async () => {
  const controller = new AbortController();
  const promise = waitForOperation(new Promise<void>(() => {}), controller.signal);
  controller.abort(); await assert.rejects(promise, UploadPaused);
  await assert.rejects(waitForOperation(new Promise<void>(() => {}), undefined, 20), /tardó demasiado/);
});
test('uploads 8 MiB in two chunks and reports completion', async () => {
  const server = await protocolServer(), values: number[] = [], args = input(server.endpoint, 'test/complete.mp4');
  try {
    await uploadInChunks({...args, progress: value => values.push(value.sent)});
    assert.deepEqual(server.result().body, args.file);
    assert.equal(server.result().creates, 1); assert.equal(server.result().patches, 1);
    assert.equal(values.at(-1), args.size);
  } finally {await server.stop();}
});
test('network/server failure resumes the accepted offset without duplicating chunks', async () => {
  const server = await protocolServer('retry'), args = input(server.endpoint, 'test/retry.mp4'), phases: string[] = [];
  try {
    await uploadInChunks({...args, progress: value => phases.push(value.phase)});
    assert.deepEqual(server.result().body, args.file); assert.equal(server.result().creates, 1);
    assert.deepEqual(server.result().heads, [6 * 1024 * 1024]); assert.ok(phases.includes('retrying'));
  } finally {await server.stop();}
});
test('pause and manual retry keep the uploaded part and use the same upload', async () => {
  const server = await protocolServer(), args = input(server.endpoint, 'test/pause.mp4'), controller = new AbortController();
  try {
    await assert.rejects(uploadInChunks({...args, signal: controller.signal, progress: value => {
      if (value.sent >= 6 * 1024 * 1024) controller.abort();
    }}), UploadPaused);
    assert.equal(server.result().offset, 6 * 1024 * 1024);
    await uploadInChunks(args);
    assert.deepEqual(server.result().body, args.file); assert.equal(server.result().creates, 1);
    assert.deepEqual(server.result().heads, [6 * 1024 * 1024]);
  } finally {await server.stop();}
});
test('a lost final response is confirmed by HEAD and does not upload again', async () => {
  const server = await protocolServer('lost-response'), args = input(server.endpoint, 'test/lost.mp4');
  try {
    await uploadInChunks(args); assert.deepEqual(server.result().body, args.file);
    assert.equal(server.result().creates, 1); assert.deepEqual(server.result().heads, [args.size]);
  } finally {await server.stop();}
});
test('size/permission errors do not retry; already aborted operation makes no request', async () => {
  for (const mode of ['too-large', 'permission']) {
    const server = await protocolServer(mode);
    try {await assert.rejects(uploadInChunks(input(server.endpoint, `test/${mode}.mp4`))); assert.equal(server.result().creates, 1);}
    finally {await server.stop();}
  }
  const server = await protocolServer(), controller = new AbortController(); controller.abort();
  try {await assert.rejects(uploadInChunks({...input(server.endpoint, 'test/abort.mp4'), signal: controller.signal}), UploadPaused); assert.equal(server.result().creates, 0);}
  finally {await server.stop();}
});
