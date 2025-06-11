import { getApps, initializeApp, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from '../login/firebase-config';

export function initFirebase() {
  try {
    // If Firebase app is already initialized, return existing instance
    if (getApps().length) {
      const app = getApp();
      const db = getFirestore(app);
      const auth = getAuth(app);
      return { app, db, auth };
    }

    // Initialize Firebase for the first time
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    return { app, db, auth };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
} 