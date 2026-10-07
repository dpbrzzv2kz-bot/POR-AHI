import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {UploadProgress} from '../lib/resumable';
import {palette as p} from '../lib/theme';
export default function UploadStatus({value}: {value: UploadProgress}) {
  const percent = value.total ? Math.min(100, Math.round(value.sent / value.total * 100)) : 0;
  const label = value.phase === 'preparing' ? 'Comprobando archivo…' : value.phase === 'confirming' ? 'Archivo subido. Guardando publicación…' :
    value.phase === 'paused' ? 'Carga detenida. Puedes reintentar.' : value.phase === 'retrying' ? 'La conexión falló. Reintentando…' : `Subiendo archivo · ${percent}%`;
  return <View style={styles.box}>
    <Text accessibilityLiveRegion="polite" style={styles.text}>{label}</Text>
    <View accessibilityRole="progressbar" accessibilityLabel="Progreso de subida" accessibilityValue={{min: 0, max: 100, now: percent}} style={styles.track}>
      <View style={[styles.fill, {width: `${percent}%`}]}/>
    </View>
    {value.total > 0 && <Text style={styles.note}>{(value.sent / 1048576).toFixed(1)} de {(value.total / 1048576).toFixed(1)} MB</Text>}
  </View>;
}
const styles = StyleSheet.create({box: {padding: 16, marginVertical: 12, backgroundColor: p.violetSoft, borderRadius: 16}, text: {color: p.ink, fontWeight: '600',lineHeight:20}, track: {height: 8, backgroundColor: '#DCCFF4', borderRadius: 8, overflow: 'hidden', marginTop: 12}, fill: {height: 8, backgroundColor: p.violet}, note: {fontSize: 12, color: p.muted, marginTop: 8}});
