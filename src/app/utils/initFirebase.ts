import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBVwkSdXiPx2GHWRqEhe1-ZNBboNIMbyGc",
  authDomain: "query-builder-bot.firebaseapp.com",
  projectId: "query-builder-bot",
  storageBucket: "query-builder-bot.appspot.com",
  messagingSenderId: "511571415270",
  appId: "1:511571415270:web:6e8e4f33791d04d1f1eb27"
};

// Initialize Firebase services
function initFirebase() {
  try {
    let firebaseApp: FirebaseApp;
    
    if (!getApps().length) {
      console.log('Initializing new Firebase app');
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      console.log('Using existing Firebase app');
      firebaseApp = getApps()[0];
    }

    console.log('Initializing Firestore and Auth');
    const firestoreDb = getFirestore(firebaseApp);
    const firebaseAuth = getAuth(firebaseApp);

    console.log('Firebase services initialized successfully');
    return { app: firebaseApp, db: firestoreDb, auth: firebaseAuth };
  } catch (error: unknown) {
    console.error('Error initializing Firebase:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to initialize Firebase services: ${errorMessage}`);
  }
}

// Initialize Firebase services immediately
console.log('Starting Firebase initialization');
const { app, db, auth } = initFirebase();
console.log('Firebase initialization completed');

// Export the initialized services
export { app, db, auth };

// Export the initialization function for manual re-initialization if needed
export { initFirebase };

// Utility: Check connection
export async function checkFirebaseConnection(): Promise<boolean> {
  try {
    if (!db) {
      console.error('Firestore not initialized');
      return false;
    }

    const testRef = doc(db, '_connection_test_', 'test');
    await getDoc(testRef);
    console.log('Firebase connection successful');
    return true;
  } catch (error) {
    console.error('Firebase connection failed:', error);
    return false;
  }
}

// Utility: Get services (for components that need guaranteed non-null values)
export function getFirebaseServices() {
  if (!app || !db || !auth) {
    throw new Error('Firebase services not properly initialized');
  }
  return { app, db, auth };
}