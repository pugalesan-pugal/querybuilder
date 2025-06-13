import { initFirebase } from './initFirebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword,
  deleteUser,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

export interface User {
  id: string;
  email: string;
  name: string;
  companyId: string;
  role: string;
  accessCode: string;
  lastActive?: number;
}

const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export class AuthService {
  static async validateUser(email: string, accessCode: string): Promise<User | null> {
    console.log('Starting validateUser process...', { email });
    
    // Clear any existing auth state
    await this.logout();
    
    const { db, auth } = initFirebase();
    if (!db || !auth) {
      console.error('Firebase initialization failed');
        throw new Error('Firebase not initialized');
      }

    let retryCount = 0;
    while (retryCount < MAX_RETRIES) {
      try {
        // First verify if the user exists in bank_customers collection
        console.log(`Attempt ${retryCount + 1}: Querying bank_customers collection...`);
      const customersRef = collection(db, 'bank_customers');
      const q = query(
        customersRef,
        where('email', '==', email.toLowerCase()),
        where('accessCode', '==', accessCode)
      );

        console.log('Executing Firestore query...');
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
          console.log('No matching user found in bank_customers');
        return null;
      }

        console.log('User found in bank_customers');
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Validate required fields
      if (!userData.email || !userData.companyId || !userData.name) {
          console.error('Invalid user data structure:', { 
            hasEmail: !!userData.email, 
            hasCompanyId: !!userData.companyId, 
            hasName: !!userData.name 
          });
          return null;
        }

        // Now handle Firebase Authentication
        console.log('Starting Firebase Authentication...');
        
        try {
          // Check if user exists in Firebase Auth
          console.log('Checking existing Firebase Auth account...');
          const signInMethods = await fetchSignInMethodsForEmail(auth, email.toLowerCase());
          
          if (signInMethods.length > 0) {
            // User exists, try to sign in
            console.log('Firebase Auth account exists, attempting to sign in...');
            try {
              await signInWithEmailAndPassword(
                auth,
                email.toLowerCase(),
                accessCode
              );
              console.log('Sign in successful');
            } catch (signInError) {
              // If sign in fails, recreate the account
              console.log('Sign in failed, recreating account...');
              if (auth.currentUser) {
                await deleteUser(auth.currentUser);
              }
              await createUserWithEmailAndPassword(
                auth,
                email.toLowerCase(),
                accessCode
              );
              console.log('Account recreated successfully');
            }
          } else {
            // User doesn't exist, create new account
            console.log('No Firebase Auth account found, creating new account...');
            await createUserWithEmailAndPassword(
              auth,
              email.toLowerCase(),
              accessCode
            );
            console.log('Created new Firebase Auth account');
          }
        } catch (authError) {
          console.error('Firebase Auth error:', authError);
          if (authError instanceof FirebaseError) {
            if (authError.code === 'auth/email-already-in-use') {
              // Handle race condition where account was created between our check and create
              console.log('Account exists (race condition), attempting sign in...');
              await signInWithEmailAndPassword(
                auth,
                email.toLowerCase(),
                accessCode
              );
              console.log('Sign in successful after race condition');
            } else {
              throw authError;
            }
          } else {
            throw authError;
          }
        }

        // Verify company exists and user has access
        console.log('Verifying company access...', { companyId: userData.companyId });
        const companyRef = doc(db, 'companies', userData.companyId);
        const companyDoc = await getDoc(companyRef);
        
        if (!companyDoc.exists()) {
          console.error('Company not found:', userData.companyId);
          await this.logout();
        return null;
      }

        // Create user session
        console.log('Authentication successful, creating user session...');
      const user = {
        id: userDoc.id,
          email: userData.email.toLowerCase(),
        name: userData.name,
        companyId: userData.companyId,
        role: userData.role || 'user',
        accessCode: userData.accessCode,
        lastActive: Date.now()
      };

        console.log('Storing user session...');
      localStorage.setItem('currentUser', JSON.stringify(user));
        console.log('Login process completed successfully');
      return user;

    } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error);
        if (error instanceof FirebaseError) {
          console.error('Firebase error details:', { 
            code: error.code, 
            message: error.message,
            stack: error.stack
          });
        }
        
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying in ${RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          continue;
        }
        
        await this.logout();
      throw error;
    }
    }
    
    return null;
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const userData = localStorage.getItem('currentUser');
      if (!userData) {
        console.log('No user data in localStorage');
        return null;
      }

      const user = JSON.parse(userData);
      if (!user.id || !user.email || !user.companyId || !user.lastActive) {
        console.log('Invalid user data structure in localStorage');
        localStorage.removeItem('currentUser');
        return null;
      }

      // Check session timeout
      const now = Date.now();
      if (now - user.lastActive > SESSION_TIMEOUT) {
        console.log('Session expired');
        await this.logout();
        return null;
      }

      // Update lastActive timestamp
      user.lastActive = now;
      localStorage.setItem('currentUser', JSON.stringify(user));
      return user;

    } catch (error) {
      console.error('Error getting current user:', error);
      await this.logout();
      return null;
    }
  }

  static async logout(): Promise<void> {
    console.log('Starting logout process...');
    try {
      // Clear local storage first
      localStorage.clear();
      console.log('Cleared local storage');

      // Get Firebase Auth instance
      const { auth } = initFirebase();
      if (!auth) {
        console.error('Firebase Auth not initialized');
        return;
      }

      // Sign out if there's a current user
      if (auth.currentUser) {
        console.log('Found current user, signing out...');
        await signOut(auth);
        console.log('Firebase Auth sign out successful');
      } else {
        console.log('No current user found in Firebase Auth');
      }

      // Force reload the page to clear any cached states
      console.log('Reloading page to clear cached states...');
      window.location.reload();
    } catch (error) {
      console.error('Error during logout:', error);
      if (error instanceof FirebaseError) {
        console.error('Firebase error details:', {
          code: error.code,
          message: error.message,
          stack: error.stack
        });
      }
      // Force reload even if there was an error
      window.location.reload();
    }
  }
} 