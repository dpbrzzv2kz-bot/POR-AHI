import {Platform} from 'react-native';
import * as Haptics from 'expo-haptics';

// Only a successful reaction triggers feedback; unsupported devices stay silent.
export async function softReactionFeedback(){
 try{
  if(Platform.OS==='android')await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick);
  else if(Platform.OS==='ios')await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
 }catch{/* Touch feedback must never prevent saving a reaction. */}
}
