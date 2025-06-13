import { useState, useEffect } from 'react';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  AuthError,
  User
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import app, { db } from './initFirebase';

export class AuthService {
  private static instance: AuthService;
  private auth;
  private db;

  private constructor() {
    this.auth = getAuth(app);
    this.db = db;
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async login(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;

      // Check if user exists in bank_customers collection
      const userDoc = await getDoc(doc(this.db, 'bank_customers', email));
      if (!userDoc.exists()) {
        await signOut(this.auth);
        throw new Error('User not found in bank_customers');
      }

      return user;
    } catch (error) {
      const authError = error as AuthError;
      throw authError;
    }
  }

  async logout() {
    await signOut(this.auth);
  }

  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(this.auth, callback);
  }
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Get additional user data from Firestore
          const userDoc = await getDoc(doc(db, 'bank_customers', user.email!));
          if (userDoc.exists()) {
            setAuthState({
              user: {
                ...user,
                ...userDoc.data()
              } as User,
              loading: false,
              error: null
            });
          } else {
            throw new Error('User not found in bank_customers');
          }
        } else {
          setAuthState({
            user: null,
            loading: false,
            error: null
          });
        }
      } catch (error) {
        setAuthState({
          user: null,
          loading: false,
          error: error as Error
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return authState;
} 