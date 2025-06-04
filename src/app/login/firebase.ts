import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 👇 Conditionally get analytics only in the browser
let analytics;
if (typeof window !== 'undefined') {
  const { getAnalytics } = await import('firebase/analytics');
  analytics = getAnalytics(app);
}

export default app;
