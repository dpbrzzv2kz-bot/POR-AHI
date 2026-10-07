import {Redirect} from 'expo-router';
import DeleteAccount from '../../components/DeleteAccount';
import {legalReady} from '../../lib/legalContent';
export default function DeleteAccountRoute(){return legalReady?<DeleteAccount/>:<Redirect href="/"/>;}
