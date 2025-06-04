import { getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from '../login/firebase-config';

export function initFirebase() {
  // Only initialize if there are no apps
  if (!getApps().length) {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    return { app, db, auth };
  }
  // If already initialized, return the first app
  const app = getApps()[0];
  const db = getFirestore(app);
  const auth = getAuth(app);
  return { app, db, auth };
} 