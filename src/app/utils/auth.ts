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

interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

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
      console.log('Attempting login for:', email);
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;

      // Check if user exists in bank_customers collection
      const userDoc = await getDoc(doc(this.db, 'bank_customers', email));
      console.log('User document exists:', userDoc.exists());
      
      if (!userDoc.exists()) {
        console.error('User not found in bank_customers collection');
        await signOut(this.auth);
        throw new Error('User not found in bank_customers');
      }

      const userData = userDoc.data();
      console.log('User data loaded:', {
        email: userData.email,
        companyId: userData.companyId,
        name: userData.name
      });

      // Verify company exists
      const companyDoc = await getDoc(doc(this.db, 'companies', userData.companyId));
      console.log('Company document exists:', companyDoc.exists());
      
      if (!companyDoc.exists()) {
        console.error('Company not found:', userData.companyId);
        await signOut(this.auth);
        throw new Error('Company not found');
      }

      const companyData = companyDoc.data();
      console.log('Company data loaded:', {
        name: companyData.name,
        id: companyData.id,
        hasServices: !!companyData.services
      });

      return user;
    } catch (error) {
      console.error('Login error:', error);
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
          console.log('Auth state changed - user logged in:', user.email);
          // Get additional user data from Firestore
          const userDoc = await getDoc(doc(db, 'bank_customers', user.email!));
          console.log('Bank customer document exists:', userDoc.exists());
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('Bank customer data loaded:', {
              email: userData.email,
              companyId: userData.companyId,
              name: userData.name
            });

            // Verify company exists
            const companyDoc = await getDoc(doc(db, 'companies', userData.companyId));
            console.log('Company document exists:', companyDoc.exists());
            
            if (!companyDoc.exists()) {
              console.error('Company not found:', userData.companyId);
              throw new Error('Company not found');
            }

            const companyData = companyDoc.data();
            console.log('Company data loaded:', {
              name: companyData.name,
              id: companyData.id,
              hasServices: !!companyData.services
            });
            
            setAuthState({
              user: {
                ...user,
                ...userData,
                company: companyData
              } as User,
              loading: false,
              error: null
            });
          } else {
            console.error('User not found in bank_customers');
            throw new Error('User not found in bank_customers');
          }
        } else {
          console.log('Auth state changed - user logged out');
          setAuthState({
            user: null,
            loading: false,
            error: null
          });
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
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