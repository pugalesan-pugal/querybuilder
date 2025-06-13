import { initFirebase, clearFirebaseInstance } from './initFirebase';
import { doc, setDoc, getDoc, collection, getDocs, query, limit, Firestore } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { setupFirebase } from './setupFirebase';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyFirestoreConnection(db: Firestore, retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1} of ${retries} to verify Firestore connection...`);
      
      // Try to read from bank_customers collection
      const bankCustomersQuery = query(collection(db, 'bank_customers'), limit(1));
      const snapshot = await getDocs(bankCustomersQuery);
      console.log('Firestore connection verified via bank_customers collection');
      return true;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i < retries - 1) {
        console.log('Waiting before next attempt...');
        await delay(1000); // Wait 1 second between attempts
      }
    }
  }
  return false;
}

export async function initializeTestData() {
  console.log('Starting test data initialization...');
  
  try {
    // Clear any existing Firebase instance
    clearFirebaseInstance();
    
    // Initialize and setup Firebase
    console.log('Setting up Firebase...');
    await setupFirebase();
    
    // Initialize Firebase again to ensure clean state
    const { db } = initFirebase();
    console.log('Firebase initialized');

    // Verify Firestore connection with retries
    const isConnected = await verifyFirestoreConnection(db);
    if (!isConnected) {
      throw new Error('Could not establish Firestore connection after multiple attempts');
    }
    console.log('Firestore connection verified successfully');

    // Initialize test user in bank_customers collection
    console.log('Creating test user...');
    const testUser = {
      email: 'pugal@example.com',
      accessCode: 'ABC123',
      isActive: true,
      lastLogin: new Date(),
      companyId: 'demo_company',
      role: 'user',
      created: new Date(),
      name:'pugal'
    };

    try {
      const userDocRef = doc(db, 'bank_customers', 'pugal@example.com');
      
      // First try to get existing user
      const existingUser = await getDoc(userDocRef);
      if (existingUser.exists()) {
        console.log('Updating existing test user...');
      } else {
        console.log('Creating new test user...');
      }
      
      await setDoc(userDocRef, testUser, { merge: true });
      console.log('Test user data written');
      
      // Verify the user was created
      const createdUser = await getDoc(userDocRef);
      if (!createdUser.exists()) {
        throw new Error('User document was not created successfully');
      }
      console.log('Test user verified successfully');
    } catch (error) {
      console.error('Error with user operations:', error);
      if (error instanceof FirebaseError && error.code === 'permission-denied') {
        throw new Error('Permission denied while creating user. Please check Firestore rules.');
      }
      throw error;
    }

    // Initialize demo company
    console.log('Creating demo company...');
    const demoCompany = {
      name: 'Demo Company',
      isActive: true,
      createdAt: new Date(),
      created: new Date()
    };

    try {
      const companyDocRef = doc(db, 'companies', 'demo_company');
      
      // First try to get existing company
      const existingCompany = await getDoc(companyDocRef);
      if (existingCompany.exists()) {
        console.log('Updating existing demo company...');
      } else {
        console.log('Creating new demo company...');
      }
      
      await setDoc(companyDocRef, demoCompany, { merge: true });
      console.log('Company data written');
      
      // Verify the company was created
      const createdCompany = await getDoc(companyDocRef);
      if (!createdCompany.exists()) {
        throw new Error('Company document was not created successfully');
      }
      console.log('Demo company verified successfully');
    } catch (error) {
      console.error('Error with company operations:', error);
      if (error instanceof FirebaseError && error.code === 'permission-denied') {
        throw new Error('Permission denied while creating company. Please check Firestore rules.');
      }
      throw error;
    }

    console.log('All test data initialized successfully');
    return true;
  } catch (error) {
    console.error('Error in initializeTestData:', error);
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'permission-denied':
          throw new Error('Firebase permission denied. Please check Firestore rules and try again.');
        case 'not-found':
          throw new Error('Firebase project not found. Please check your configuration.');
        case 'failed-precondition':
          throw new Error('Firebase operation failed. Database may not be initialized.');
        default:
          throw new Error(`Firebase error: ${error.message}`);
      }
    }
    throw error;
  }
} 