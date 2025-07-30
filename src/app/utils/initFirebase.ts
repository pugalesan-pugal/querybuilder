import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;

const firebaseConfig = {
  apiKey: "AIzaSyBVwkSdXiPx2GHWRqEhe1-ZNBboNIMbyGc",
  authDomain: "query-builder-bot.firebaseapp.com",
  projectId: "query-builder-bot",
  storageBucket: "query-builder-bot.appspot.com",
  messagingSenderId: "511571415270",
  appId: "1:511571415270:web:6e8e4f33791d04d1f1eb27"
};

// ✅ Renamed function to match import: `initFirebase`
function initFirebase() {
  try {
    if (!getApps().length) {
      console.log('Initializing new Firebase app');
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      console.log('Using existing Firebase app');
      firebaseApp = getApps()[0];
    }

    if (!firestoreDb && firebaseApp) {
      console.log('Initializing Firestore');
      firestoreDb = getFirestore(firebaseApp);
    }

    if (!firebaseAuth && firebaseApp) {
      console.log('Initializing Firebase Auth');
      firebaseAuth = getAuth(firebaseApp);
    }

    if (!firebaseApp || !firestoreDb || !firebaseAuth) {
      throw new Error('Failed to initialize one or more Firebase services');
    }

    console.log('Firebase services initialized successfully');
    return { app: firebaseApp, db: firestoreDb, auth: firebaseAuth };
  } catch (error: unknown) {
    console.error('Error initializing Firebase:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to initialize Firebase services: ${errorMessage}`);
  }
}

// ✅ Call initializer immediately
console.log('Starting Firebase initialization');
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  const services = initFirebase();
  app = services.app;
  db = services.db;
  auth = services.auth;
  console.log('Firebase initialization completed');
} catch (error) {
  console.error('Critical error during Firebase initialization:', error);
}

// ✅ Export function and instances
export { initFirebase }; // ✅ this fixes your import errors
export { app, db, auth };

// Utility: Check connection
export async function checkFirebaseConnection(): Promise<boolean> {
  try {
    if (!firestoreDb) {
      console.error('Firestore not initialized');
      return false;
    }

    const testRef = doc(firestoreDb, '_connection_test_', 'test');
    await getDoc(testRef);
    console.log('Firebase connection successful');
    return true;
  } catch (error) {
    console.error('Firebase connection failed:', error);
    return false;
  }
}

// Utility: Reinitialize
export async function reinitializeFirebase() {
  try {
    console.log('Attempting to reinitialize Firebase');
    const services = initFirebase();
    firebaseApp = services.app;
    firestoreDb = services.db;
    firebaseAuth = services.auth;
    app = services.app;
    db = services.db;
    auth = services.auth;
    return await checkFirebaseConnection();
  } catch (error) {
    console.error('Failed to reinitialize Firebase:', error);
    return false;
  }
}
