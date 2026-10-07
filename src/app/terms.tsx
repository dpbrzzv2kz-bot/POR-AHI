import LegalPage from '../../components/LegalPage';
import {Redirect} from 'expo-router';
import {legalReady} from '../../lib/legalContent';
export default function Terms(){return legalReady?<LegalPage kind="terms"/>:<Redirect href="/"/>;}
