import React from 'react';
import {View,Text,ScrollView} from 'react-native';
import {router} from 'expo-router';
import Moderation,{AdminButton,adminStyles as s} from '../../components/Moderation';
import useIdentity from '../../lib/useIdentity';
import useModerator from '../../lib/useModerator';
export default function Admin(){
 const identity=useIdentity(),gate=useModerator(identity.id);
 if(!identity.ready||gate.loading)return <View style={s.screen}><View style={s.content}><Text style={s.note}>Comprobando acceso…</Text></View></View>;
 if(!identity.id||!gate.allowed)return <View style={s.screen}><ScrollView contentContainerStyle={s.content}><AdminButton label="Volver a por ahí" onPress={()=>router.replace('/')}/><Text style={s.title}>Administración</Text><Text style={s.note}>{!identity.id?'Inicia sesión con una cuenta administradora desde Perfil.':'Esta cuenta no tiene permiso de administración.'}</Text>{!!gate.error&&<Text accessibilityRole="alert" style={s.note}>{gate.error}</Text>}{identity.id&&<AdminButton label="Volver a comprobar permiso" onPress={gate.retry}/>}</ScrollView></View>;
 return <Moderation key={identity.id} close={()=>router.replace('/')}/>;
}
