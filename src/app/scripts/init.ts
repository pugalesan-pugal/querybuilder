import { initFirebase, db, auth } from '../utils/initFirebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

// Initial data for collections
const initialData = {
  companies: [
    {
      id: 'ABC',
      name: 'ABC Bank',
      email: 'admin@abcbank.com',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  bank_customers: [
    {
      email: 'pugalesan@gmail.com',
      name: 'Pugal',
      password: 'Test@123', // This is just for initialization, will be stored in Firebase Auth
      companyId: 'ABC',
      role: 'admin',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: null
    }
  ]
};

async function initializeCollections() {
  try {
    console.log('Starting collection initialization...');
    const { db, auth } = initFirebase();

    // Clear existing data first
    console.log('Clearing existing data...');
    
    // Clear Firebase Auth users
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await currentUser.delete();
      }
    } catch (error) {
      console.log('No existing auth user to delete');
    }

    // Clear Firestore collections
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

    // Initialize companies collection
    console.log('Initializing companies collection...');
    for (const company of initialData.companies) {
      const companyRef = doc(db, 'companies', company.id);
      await setDoc(companyRef, company);
      console.log(`Created company: ${company.name}`);
    }

    // Initialize users in both Firebase Auth and Firestore
    console.log('Initializing users...');
    for (const user of initialData.bank_customers) {
      // Create Firebase Auth user first
      try {
        console.log(`Creating Firebase Auth user: ${user.email}`);
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
        console.log(`Created Firebase Auth user: ${user.email} with UID: ${userCredential.user.uid}`);

        // Create Firestore user document without sensitive data
        const userDoc = {
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          role: user.role,
          isActive: user.isActive,
          uid: userCredential.user.uid,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLogin: user.lastLogin
        };

        await setDoc(doc(db, 'bank_customers', user.email), userDoc);
        console.log(`Created Firestore user: ${user.name} (${user.email})`);
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`Firebase Auth user already exists: ${user.email}`);
        } else {
          console.error(`Error creating user: ${user.email}`, error);
          throw error;
        }
      }
    }

    console.log('Collection initialization completed successfully');
    return true;
  } catch (error) {
    console.error('Error initializing collections:', error);
    throw error;
  }
}

// Export the function to be used in other files
export { initializeCollections, initialData }; 