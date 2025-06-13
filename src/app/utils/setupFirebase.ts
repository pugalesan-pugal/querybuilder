import { initFirebase } from './initFirebase';
import { collection, doc, setDoc, getDoc, getDocs, query, limit } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

export async function setupFirebase() {
  console.log('Setting up Firebase...');

  try {
    const { db, auth } = initFirebase();

    // Step 1: Sign in anonymously
    console.log('Setting up anonymous auth...');
    try {
      await signInAnonymously(auth);
      console.log('✅ Anonymous auth successful');
    } catch (error) {
      console.error('❌ Error setting up anonymous auth:', error);
      // Continue for open rules
    }

    const user = auth.currentUser;

    // Step 2: Save user data to localStorage
    if (user) {
      const userData = {
        uid: user.uid,
        email: 'anonymous@example.com',
        companyId: 'demo_company_001'
      };
      localStorage.setItem('currentUser', JSON.stringify(userData));

      console.log('✅ User data saved to localStorage:', userData);
    } else {
      console.warn('⚠️ No current user after anonymous auth');
    }

    // Step 3: Check and initialize collections
    const collections = ['bank_customers', 'companies'];
    for (const collectionName of collections) {
      try {
        console.log(`🔍 Checking collection ${collectionName}...`);
        const querySnapshot = await getDocs(query(collection(db, collectionName), limit(1)));
        console.log(`✅ Collection ${collectionName} is accessible, documents:`, querySnapshot.size);
      } catch (error) {
        console.error(`❌ Error accessing collection ${collectionName}:`, error);
      }
    }

    // Step 4: Create a setup doc and seed data
    for (const collectionName of collections) {
      try {
        const setupDoc = doc(collection(db, collectionName), '_setup');
        const existingDoc = await getDoc(setupDoc);

        if (existingDoc.exists()) {
          await setDoc(setupDoc, {
            _updated: new Date(),
            _setup: true
          }, { merge: true });
          console.log(`♻️ Updated _setup document in ${collectionName}`);
        } else {
          await setDoc(setupDoc, {
            _created: new Date(),
            _setup: true
          });
          console.log(`🆕 Created _setup document in ${collectionName}`);
        }
      } catch (error) {
        console.error(`❌ Error initializing collection ${collectionName}:`, error);
        throw error;
      }
    }

    // Step 5: Seed a company and a bank_customer user
    const demoCompanyId = 'demo_company_001';

    await setDoc(doc(collection(db, 'companies'), demoCompanyId), {
      name: 'Demo Company',
      createdAt: new Date()
    }, { merge: true });

    if (user) {
      await setDoc(doc(collection(db, 'bank_customers'), user.uid), {
        uid: user.uid,
        email: 'anonymous@example.com',
        companyId: demoCompanyId,
        createdAt: new Date()
      }, { merge: true });
      console.log('✅ Seeded demo company and user');
    }

    console.log('🎉 Firebase setup completed successfully');
    return true;
  } catch (error) {
    console.error('🔥 Error during Firebase setup:', error);
    throw error;
  }
}
