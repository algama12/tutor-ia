import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDccMnW-JP0733LA89kB-GQ0NMEnxPZFLc",
  authDomain: "tutoria-a1957.firebaseapp.com",
  projectId: "tutoria-a1957",
  storageBucket: "tutoria-a1957.firebasestorage.app",
  messagingSenderId: "972524007759",
  appId: "1:972524007759:web:17f88c7baf218a57ca953a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };