import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBVwkSdXiPx2GHWRqEhe1-ZNBboNIMbyGc",
  authDomain: "query-builder-bot.firebaseapp.com",
  projectId: "query-builder-bot",
  storageBucket: "query-builder-bot.appspot.com",
  messagingSenderId: "511571415270",
  appId: "1:511571415270:web:6e8e4f33791d04d1f1eb27"
};

// Debug function to check configuration
function debugFirebaseConfig() {
  console.log('Firebase Config Check:');
  const configStatus = Object.entries(firebaseConfig).every(([key, value]) => {
    const exists = !!value;
    console.log(`${key} exists:`, exists);
    if (!exists) {
      console.error(`Missing Firebase config: ${key}`);
    }
    return exists;
  });
  
  if (!configStatus) {
    throw new Error('Firebase configuration is incomplete');
  }
}

let firebaseApp: FirebaseApp | null = null;

export function initFirebase() {
  console.log('Initializing Firebase...');
  
  try {
    debugFirebaseConfig();

    if (!firebaseApp) {
      if (!getApps().length) {
        console.log('No existing Firebase app, creating new one...');
        firebaseApp = initializeApp(firebaseConfig);
        console.log('Firebase app initialized successfully');
    } else {
        console.log('Using existing Firebase app');
        firebaseApp = getApps()[0];
      }
    }

    if (!firebaseApp) {
      throw new Error('Failed to initialize Firebase app');
    }

    const auth = getAuth(firebaseApp);
    if (!auth) {
      throw new Error('Failed to initialize Firebase Auth');
    }
    console.log('Firebase Auth initialized successfully');

    const db = getFirestore(firebaseApp);
    if (!db) {
      throw new Error('Failed to initialize Firestore');
    }
    console.log('Firestore initialized successfully');

    return { auth, db };
  } catch (error) {
    console.error('Error during Firebase initialization:', error);
    throw error;
  }
}

// Function to check if Firebase is initialized
export function isFirebaseInitialized(): boolean {
  return firebaseApp !== null;
}

// Function to clear Firebase instance (useful for testing/development)
export function clearFirebaseInstance(): void {
  firebaseApp = null;
} 