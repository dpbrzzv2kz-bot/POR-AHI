import {Platform} from 'react-native';
import {File as NativeFile, FileMode} from 'expo-file-system';
import type {Media} from './posts';
import {formats, validateMedia, IMAGE_LIMIT, VIDEO_LIMIT} from './mediaRules';

export async function prepareMedia(media: Media): Promise<Media> {
  const native = Platform.OS === 'web' ? null : new NativeFile(media.uri);
  const file = Platform.OS === 'web' ? media.file || await (await fetch(media.uri)).blob() : null;
  const size = file?.size ?? native?.size ?? 0;
  const extension = (native ? media.uri : media.fileName || '').split('.').at(-1)?.toLowerCase();
  const byExtension: Record<string, string> = {jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime'};
  const mime = file?.type || (native && byExtension[extension || '']) || media.mimeType || byExtension[extension || ''] || '';
  // Reject oversized files before loading metadata or reading any file bytes.
  if (size > (media.type === 'image' ? IMAGE_LIMIT : VIDEO_LIMIT))
    throw new Error(media.type === 'image' ? 'La foto supera 10 MB. Elige una versión más pequeña.' : 'El video supera 50 MB. Recórtalo o exporta una versión más pequeña.');
  let duration = media.duration;
  if (Platform.OS === 'web' && file) duration = await inspectWebMedia(file, media.type);
  validateMedia(media.type, size, mime, duration);
  return {...media, size, mimeType: mime, duration};
}

async function inspectWebMedia(file: Blob, kind: 'image' | 'video'): Promise<number | undefined> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const element = kind === 'image' ? document.createElement('img') : document.createElement('video');
    const finish = (error?: Error, duration?: number) => {
      clearTimeout(timer); element.onload = null; element.onerror = null;
      if (element instanceof HTMLVideoElement) {element.onloadedmetadata = null; element.removeAttribute('src'); element.load();}
      URL.revokeObjectURL(url);
      if (error) reject(error); else resolve(duration);
    };
    const timer = setTimeout(() => finish(new Error('No se pudo abrir el archivo. Prueba otro formato compatible.')), 15000);
    element.onerror = () => finish(new Error('Este archivo no se puede reproducir o mostrar aquí. Prueba una foto JPG/PNG o un video MP4 compatible.'));
    if (element instanceof HTMLVideoElement) {
      element.preload = 'metadata';
      element.onloadedmetadata = () => finish(undefined, element.duration);
    } else element.onload = () => finish();
    element.src = url;
  });
}

export async function mediaSource(media: Media) {
  if (Platform.OS === 'web') return {file: media.file || await (await fetch(media.uri)).blob()};
  const file = new NativeFile(media.uri);
  return {
    file: new Blob(),
    fileReader: {async openFile() {
      return {size: file.size, async slice(start: number, end: number) {
        const handle = file.open(FileMode.ReadOnly);
        try {handle.offset = start; return {value: handle.readBytes(Math.min(end, file.size) - start), done: end >= file.size};}
        finally {handle.close();}
      }, close() {} }; // Each chunk closes its native handle, including failures/pauses.
    }},
  };
}
export function mediaExtension(mime: string) {return formats[mime];}
