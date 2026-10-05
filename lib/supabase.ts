import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState, Platform} from 'react-native';
import {createClient} from '@supabase/supabase-js';
import {createAuthFetch} from './authFetch';
import {createRecoveryAccess,inspectRecoveryCallback} from './passwordRecovery';

const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const recoveryCallback=Platform.OS==='web'&&typeof window!=='undefined'?inspectRecoveryCallback(window.location.href):'none';
let recoveryStorage:Storage|undefined;
try{if(Platform.OS==='web'&&typeof window!=='undefined')recoveryStorage=window.sessionStorage;}catch{/* Restricted browser storage. */}
export const supabase=url&&key?createClient(url,key,{global:{fetch:createAuthFetch()},auth:{
  ...(Platform.OS!=='web'?{storage:AsyncStorage}:{}),
  persistSession:true,autoRefreshToken:true,detectSessionInUrl:Platform.OS==='web',
}}):null;
export const recoveryAccess=createRecoveryAccess(supabase?.auth||null,recoveryCallback,recoveryStorage);
if(Platform.OS!=='web'&&supabase){
  AppState.addEventListener('change',state=>{
    if(state==='active')supabase!.auth.startAutoRefresh();
    else supabase!.auth.stopAutoRefresh();
  });
}
