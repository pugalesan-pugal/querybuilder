import { initFirebase } from './initFirebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { generateAuthPassword } from './authUtils';

const testCompanies = [
  {
    id: 'ABC',
    name: 'ABC Bank',
    email: 'admin@abcbank.com',
    accessCode: 'ABC123',
    isActive: true
  },
  {
    id: 'XYZ',
    name: 'XYZ Bank',
    email: 'admin@xyzbank.com',
    accessCode: 'XYZ123',
    isActive: true
  }
];

const testUsers = [
  {
    email: 'pugal@example.com',
    name: 'Pugal',
    accessCode: 'ABC123',
    companyId: 'ABC',
    role: 'admin',
    isActive: true
  },
  {
    email: 'john@example.com',
    name: 'John',
    accessCode: 'XYZ123',
    companyId: 'XYZ',
    role: 'user',
    isActive: true
  }
];

export async function initializeTestData() {
  try {
    console.log('Starting test data initialization...');
    const { db, auth } = initFirebase();

    // Clear existing data
    console.log('Clearing existing data...');
    
    // Clear Firebase Auth users
    console.log('Clearing Firebase Auth users...');
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await deleteUser(currentUser);
      }
    } catch (error) {
      console.log('No existing auth user to delete');
    }

    // Delete existing bank customers
    console.log('Clearing Firestore data...');
    const bankCustomersRef = collection(db, 'bank_customers');
    const companiesRef = collection(db, 'companies');

    const existingCustomers = await getDocs(bankCustomersRef);
    for (const doc of existingCustomers.docs) {
      await deleteDoc(doc.ref);
    }
    console.log('Cleared bank_customers collection');

    const existingCompanies = await getDocs(companiesRef);
    for (const doc of existingCompanies.docs) {
      await deleteDoc(doc.ref);
    }
    console.log('Cleared companies collection');

    // Initialize companies
    console.log('Initializing companies...');
    for (const company of testCompanies) {
      await setDoc(doc(db, 'companies', company.id), {
        ...company,
        createdAt: new Date().toISOString()
      });
      console.log(`Created company: ${company.name}`);
    }

    // Initialize users in both Firebase Auth and Firestore
    console.log('Initializing users...');
    for (const user of testUsers) {
      // Create Firebase Auth user first
      const password = generateAuthPassword(user.email, user.accessCode);
      let firebaseUser;
      
      try {
        console.log(`Creating Firebase Auth user: ${user.email}`);
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, password);
        firebaseUser = userCredential.user;
        console.log(`Created Firebase Auth user: ${user.email} with UID: ${firebaseUser.uid}`);
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`Firebase Auth user already exists: ${user.email}`);
          continue; // Skip this user and move to the next one
        } else {
          console.error(`Error creating Firebase Auth user: ${user.email}`, error);
          throw error;
        }
      }

      // Create Firestore user document with Firebase Auth UID
      const userDoc = {
        ...user,
        uid: firebaseUser.uid,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'bank_customers', user.email), userDoc);
        console.log(`Created Firestore user: ${user.name} (${user.email}) with UID: ${firebaseUser.uid}`);
      } catch (error) {
        console.error(`Error creating Firestore user: ${user.email}`, error);
        // If Firestore creation fails, try to delete the Firebase Auth user
        try {
          await deleteUser(firebaseUser);
        } catch (deleteError) {
          console.error(`Error cleaning up Firebase Auth user after Firestore failure: ${user.email}`, deleteError);
        }
        throw error;
      }
    }

    console.log('Test data initialization completed successfully');
    return true;
  } catch (error) {
    console.error('Error initializing test data:', error);
    throw error;
  }
} 