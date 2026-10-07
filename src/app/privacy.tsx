import LegalPage from '../../components/LegalPage';
import {Redirect} from 'expo-router';
import {legalReady} from '../../lib/legalContent';
export default function Privacy(){return legalReady?<LegalPage kind="privacy"/>:<Redirect href="/"/>;}
