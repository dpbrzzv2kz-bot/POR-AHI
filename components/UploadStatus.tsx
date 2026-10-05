import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {UploadProgress} from '../lib/resumable';
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
const styles = StyleSheet.create({box: {padding: 16, marginVertical: 12, backgroundColor: '#eef1e8', borderRadius: 12}, text: {color: '#243d31', fontWeight: '600'}, track: {height: 8, backgroundColor: '#d9dfd1', borderRadius: 8, overflow: 'hidden', marginTop: 12}, fill: {height: 8, backgroundColor: '#965337'}, note: {fontSize: 12, color: '#536350', marginTop: 8}});
