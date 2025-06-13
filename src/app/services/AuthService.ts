import { initFirebase } from '../utils/initFirebase';
import { User, signInAnonymously, updateEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface UserData {
  email: string;
  accessCode: string;
  lastLogin: Date;
  isActive: boolean;
  companyId: string;
  role: string;
}

export class AuthService {
  static async validateUser(email: string, accessCode: string): Promise<User | null> {
    console.log('Starting user validation...', { email });
    const { auth, db } = initFirebase();

    try {
      // Check if user exists in Firestore
      const userDocRef = doc(db, 'bank_customers', email);
      console.log('Checking user document:', userDocRef.path);
      
      const userDoc = await getDoc(userDocRef);
      console.log('User document exists:', userDoc.exists());

      if (!userDoc.exists()) {
        console.log('User document not found in bank_customers collection');
        return null;
      }

      const userData = userDoc.data() as UserData;
      console.log('User data retrieved:', { ...userData, accessCode: '***' });
      
      // Verify access code
      if (userData.accessCode !== accessCode) {
        console.log('Invalid access code provided');
        return null;
      }

      // Verify user is active
      if (!userData.isActive) {
        console.log('User account is not active');
        return null;
      }

      // Get or create Firebase Auth user (anonymous sign in)
      let user = auth.currentUser;
      console.log('Current Firebase Auth user:', user?.email);
      
      if (!user) {
        try {
          console.log('Creating new anonymous Firebase Auth user...');
          const { user: newUser } = await signInAnonymously(auth);
          if (!newUser) throw new Error('Failed to create anonymous user');
          user = newUser;

          console.log('Updating user email...');
          await updateEmail(user, email);
          console.log('User email updated successfully');
        } catch (error) {
          console.error('Error creating/updating auth user:', error);
          return null;
        }
      }

      // Update last login in Firestore
      console.log('Updating last login timestamp in Firestore...');
      await setDoc(userDocRef, {
        ...userData,
        lastLogin: new Date(),
      }, { merge: true });

      if (!user) throw new Error('User is null after authentication');

      const sessionData = {
        email,
        uid: user.uid,
        lastLogin: new Date(),
        companyId: userData.companyId,
        role: userData.role,
      };

      console.log('Storing session data locally');
      localStorage.setItem('currentUser', JSON.stringify(sessionData));

      console.log('User validation successful');
      return user;
      
    } catch (error) {
      console.error('Error in validateUser:', error);
      throw error;
    }
  }

  static async checkSession(): Promise<boolean> {
    const { auth, db } = initFirebase();
    console.log('Checking session...');

    try {
      const storedUser = localStorage.getItem('currentUser');
      if (!storedUser) {
        console.log('No stored user session found');
        return false;
      }

      const { email } = JSON.parse(storedUser);

      // Verify Firebase auth state
      const currentUser = auth.currentUser;
      console.log('Current Firebase Auth user:', currentUser?.email);
      
      if (!currentUser) {
        console.log('No Firebase Auth user found');
        localStorage.removeItem('currentUser');
        return false;
      }

      // Verify user in Firestore
      const userDoc = await getDoc(doc(db, 'bank_customers', email));
      console.log('User document exists in Firestore:', userDoc.exists());
      
      if (!userDoc.exists()) {
        console.log('User document not found in Firestore');
        localStorage.removeItem('currentUser');
        return false;
      }

      const userData = userDoc.data() as UserData;
      if (!userData.isActive) {
        console.log('User account is not active');
        localStorage.removeItem('currentUser');
        return false;
      }

      console.log('Session check successful');
      return true;

    } catch (error) {
      console.error('Error during session check:', error);
      return false;
    }
  }

  static async logout(): Promise<void> {
    const { auth } = initFirebase();
    try {
      await auth.signOut();
      localStorage.removeItem('currentUser');
      console.log('Logout successful');
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  }
}
