import {Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {File as NativeFile, FileMode} from 'expo-file-system';
import {supabase} from './supabase';

export const AVATAR_LIMIT = 5 * 1024 * 1024;
const extensions: Record<string, string> = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'};
const byName: Record<string, string> = {jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'};

export function avatarUrl(path?: string | null) {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return path && base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/avatars/${path}` : null;
}

// Elige una foto cuadrada, la sube a la carpeta de la persona y la guarda en su perfil.
// Devuelve la ruta nueva, o null si se cancela. Borra la foto anterior solo cuando la nueva ya quedó guardada.
export async function pickAndUploadAvatar(userId: string, previous?: string | null): Promise<string | null> {
  if (!supabase) throw new Error('La conexión todavía no está configurada.');
  const result = await ImagePicker.launchImageLibraryAsync({mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7});
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  const guess = (asset.uri.split('?')[0].split('.').pop() || '').toLowerCase();
  const mime = asset.mimeType || byName[guess] || '';
  const extension = extensions[mime];
  if (!extension) throw new Error('Elige una foto JPG, PNG o WebP.');
  let body: Blob | ArrayBuffer;
  let size: number;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob();
    body = blob; size = blob.size;
  } else {
    const file = new NativeFile(asset.uri);
    size = file.size;
    if (size > AVATAR_LIMIT) throw new Error('La foto pesa más de 5 MB. Elige una más pequeña.');
    const handle = file.open(FileMode.ReadOnly);
    try {
      const bytes = handle.readBytes(size);
      body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    } finally {handle.close();}
  }
  if (size <= 0) throw new Error('No se pudo leer la foto. Elige otra.');
  if (size > AVATAR_LIMIT) throw new Error('La foto pesa más de 5 MB. Elige una más pequeña.');
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  const upload = await supabase.storage.from('avatars').upload(path, body, {contentType: mime, upsert: false});
  if (upload.error) throw new Error('No se pudo subir la foto. Revisa tu conexión e intenta de nuevo.');
  const saved = await supabase.from('profiles').update({avatar_path: path}).eq('id', userId).select('id');
  if (saved.error || !saved.data?.length) {
    await supabase.storage.from('avatars').remove([path]);
    throw new Error('No se pudo guardar la foto en tu perfil. Primero guarda tu nombre y usuario.');
  }
  if (previous && previous !== path) await supabase.storage.from('avatars').remove([previous]);
  return path;
}

export async function removeAvatar(userId: string, path: string) {
  if (!supabase) throw new Error('La conexión todavía no está configurada.');
  const saved = await supabase.from('profiles').update({avatar_path: null}).eq('id', userId).select('id');
  if (saved.error || !saved.data?.length) throw new Error('No se pudo quitar la foto. Intenta de nuevo.');
  await supabase.storage.from('avatars').remove([path]);
}
