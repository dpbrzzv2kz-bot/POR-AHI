import React from 'react';
import {WebView} from 'react-native-webview';
import MapPickerShell,{type MapPickerProps} from './MapPickerShell';

// iPhone y Android: el mapa vive en un WebView. baseUrl da un Referer válido a OpenStreetMap.
export default function MapPicker(props:MapPickerProps){
 return <MapPickerShell {...props} surface={({html,onRaw})=><WebView originWhitelist={['*']} source={{html,baseUrl:'https://incredible-crumble-34cbca.netlify.app/'}} onMessage={event=>onRaw(event.nativeEvent.data)} javaScriptEnabled domStorageEnabled setSupportMultipleWindows={false} style={{flex:1}}/>}/>;
}
