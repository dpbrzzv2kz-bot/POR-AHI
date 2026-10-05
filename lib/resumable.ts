import {Upload, type HttpRequest} from 'tus-js-client';

export type UploadProgress = {phase: 'preparing' | 'uploading' | 'retrying' | 'confirming' | 'paused'; sent: number; total: number; accepted?: number};
type UploadOptions = ConstructorParameters<typeof Upload>[1];
type PreviousUpload = Awaited<ReturnType<Upload['findPreviousUploads']>>[number];
// Only unfinished upload URLs are held in memory; credentials and files are never stored here.
// Manual retry/pause can resume while the form remains open, including on native platforms.
const pending = new Map<string, PreviousUpload>();
const urlStorage: NonNullable<UploadOptions['urlStorage']> = {
  async findAllUploads() {return [...pending.values()];},
  async findUploadsByFingerprint(key) {const row = pending.get(key); return row ? [row] : [];},
  async removeUpload(key) {pending.delete(key);},
  async addUpload(key, row) {
    if (pending.size >= 50) pending.delete(pending.keys().next().value!);
    pending.set(key, {...row, urlStorageKey: key}); return key;
  },
};
export class UploadPaused extends Error {
  constructor() {super('Carga pausada. Pulsa Reintentar publicación para continuar.'); this.name = 'UploadPaused';}
}
export function checkSignal(signal?: AbortSignal) {if (signal?.aborted) throw new UploadPaused();}
export function waitForOperation<T>(operation: PromiseLike<T>, signal?: AbortSignal, timeoutMs = 15000): Promise<T> {
  checkSignal(signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value?: T, error?: unknown) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value!);
    };
    const abort = () => finish(undefined, new UploadPaused());
    const timer = setTimeout(() => finish(undefined, new Error('La conexión tardó demasiado. Pulsa Reintentar publicación.')), timeoutMs);
    signal?.addEventListener('abort', abort, {once: true});
    Promise.resolve(operation).then(value => finish(value), error => finish(undefined, error));
  });
}

export async function uploadInChunks(input: {
  file: ConstructorParameters<typeof Upload>[0]; size: number; mime: string;
  endpoint: string; path: string; signal?: AbortSignal;
  authorization: () => Promise<Record<string, string>>;
  progress?: (value: UploadProgress) => void; fileReader?: UploadOptions['fileReader'];
}) {
  checkSignal(input.signal);
  const endpoint = new URL(input.endpoint);
  const fingerprint = `por-ahi:${input.path}:${input.size}:${input.mime}`;
  let accepted = 0;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return; settled = true;
      input.signal?.removeEventListener('abort', pause);
      if (error) reject(error); else resolve();
    };
    const upload = new Upload(input.file, {
      endpoint: input.endpoint, chunkSize: 6 * 1024 * 1024,
      uploadSize: input.size, uploadDataDuringCreation: true,
      retryDelays: [1000, 3000, 5000, 10000],
      metadata: {bucketName: 'review-media', objectName: input.path, contentType: input.mime, cacheControl: '3600'},
      fingerprint: async () => fingerprint, urlStorage, removeFingerprintOnSuccess: true,
      ...(input.fileReader ? {fileReader: input.fileReader} : {}),
      onBeforeRequest: async (request: HttpRequest) => {
        checkSignal(input.signal);
        const url = new URL(request.getURL());
        if (url.origin !== endpoint.origin || !(url.pathname === endpoint.pathname || url.pathname.startsWith(endpoint.pathname + '/')))
          throw new Error('La dirección de carga no es válida.');
        const headers = await waitForOperation(input.authorization(), input.signal); checkSignal(input.signal);
        for (const [name, value] of Object.entries(headers)) request.setHeader(name, value);
        const xhr = request.getUnderlyingObject() as XMLHttpRequest;
        // The browser stack exposes XHR, while the Node test stack does not.
        if (xhr && 'timeout' in xhr) {
          xhr.timeout = 60000;
          xhr.ontimeout = () => xhr.onerror?.({type: 'timeout'} as ProgressEvent);
        }
      },
      onAfterResponse: (request, response) => {
        if (request.getMethod() === 'HEAD' && response.getStatus() >= 200 && response.getStatus() < 300) {
          const offset = Number(response.getHeader('Upload-Offset'));
          if (Number.isSafeInteger(offset) && offset >= 0 && offset <= input.size) accepted = offset;
        }
      },
      onProgress: (bytes, total) => {input.progress?.({phase: 'uploading', sent: bytes, total, accepted});},
      onChunkComplete: (_chunk, bytes, total) => {accepted = bytes; input.progress?.({phase: 'uploading', sent: bytes, total, accepted});},
      onShouldRetry: (error) => {
        if (input.signal?.aborted) return false;
        const status = error.originalResponse?.getStatus() ?? 0;
        const retry = status === 0 || status === 408 || status === 423 || status === 429 || status >= 500;
        if (retry) input.progress?.({phase: 'retrying', sent: accepted, total: input.size, accepted});
        return retry;
      },
      onError: (error) => {
        const status = 'originalResponse' in error ? (error as {originalResponse?: {getStatus(): number}}).originalResponse?.getStatus() : 0;
        finish(input.signal?.aborted ? new UploadPaused() : new Error(
          status === 401 || status === 403 ? 'Tu sesión no permite subir este archivo. Vuelve a iniciar sesión.' :
          status === 413 ? 'El archivo supera el límite permitido por el servidor.' :
          status === 400 || status === 409 ? 'No se pudo completar este archivo. Pulsa Reintentar publicación para comprobarlo.' :
          'No se pudo completar la carga. Revisa tu conexión y pulsa Reintentar publicación.'));
      },
      onSuccess: () => finish(),
    });
    const pause = () => {void upload.abort().finally(() => finish(new UploadPaused()));};
    input.signal?.addEventListener('abort', pause, {once: true});
    void upload.findPreviousUploads().then(rows => {
      if (settled || input.signal?.aborted) {pause(); return;}
      const previous = rows.find(row => row.uploadUrl && row.size === input.size && row.metadata.objectName === input.path);
      if (previous) upload.resumeFromPreviousUpload(previous);
      input.progress?.({phase: 'uploading', sent: 0, total: input.size});
      upload.start();
    }).catch(() => finish(new Error('No se pudo preparar la carga. Pulsa Reintentar publicación.')));
  });
}
