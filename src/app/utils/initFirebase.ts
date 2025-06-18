import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBVwkSdXiPx2GHWRqEhe1-ZNBboNIMbyGc",
  authDomain: "query-builder-bot.firebaseapp.com",
  projectId: "query-builder-bot",
  storageBucket: "query-builder-bot.appspot.com",
  messagingSenderId: "511571415270",
  appId: "1:511571415270:web:6e8e4f33791d04d1f1eb27"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Set environment variables
if (typeof window !== 'undefined') {
  (window as any).process = {
    ...((window as any).process || {}),
    env: {
      ...((window as any).process?.env || {}),
      NEXT_PUBLIC_GEMINI_API_KEY: "AIzaSyDPl7JHgiBFrQ6qGUP1prtaHlupgoHPldg"
    }
  };
}

export { db, auth };
export default app; 