export const IMAGE_LIMIT = 10 * 1024 * 1024;
export const VIDEO_LIMIT = 50 * 1024 * 1024;
export const VIDEO_SECONDS = 60;
export const formats: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
};
export function validateMedia(kind: 'image' | 'video', size: number, mime: string, duration?: number) {
  if (!formats[mime] || !mime.startsWith(kind === 'image' ? 'image/' : 'video/'))
    throw new Error('Usa una foto JPG, PNG o WebP, o un video MP4/MOV compatible con tu teléfono.');
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error('Este archivo está vacío o no se pudo leer. Elige otro.');
  if (size > (kind === 'image' ? IMAGE_LIMIT : VIDEO_LIMIT))
    throw new Error(kind === 'image' ? 'La foto supera 10 MB. Elige una versión más pequeña.' : 'El video supera 50 MB. Recórtalo o exporta una versión más pequeña.');
  if (kind === 'video' && (!Number.isFinite(duration) || duration! <= 0))
    throw new Error('No se pudo leer la duración del video. Prueba otro archivo MP4/MOV.');
  if (kind === 'video' && duration! > VIDEO_SECONDS)
    throw new Error('Elige un video de hasta 60 segundos.');
}
