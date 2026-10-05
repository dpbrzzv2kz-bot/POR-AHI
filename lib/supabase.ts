import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState, Platform} from 'react-native';
import {createClient} from '@supabase/supabase-js';

const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase=url&&key?createClient(url,key,{auth:{
  ...(Platform.OS!=='web'?{storage:AsyncStorage}:{}),
  persistSession:true,autoRefreshToken:true,detectSessionInUrl:Platform.OS==='web',
}}):null;
if(Platform.OS!=='web'&&supabase){
  AppState.addEventListener('change',state=>{
    if(state==='active')supabase!.auth.startAutoRefresh();
    else supabase!.auth.stopAutoRefresh();
  });
}
