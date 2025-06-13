const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyBVwkSdXiPx2GHWRqEhe1-ZNBboNIMbyGc",
  authDomain: "query-builder-bot.firebaseapp.com",
  projectId: "query-builder-bot",
  storageBucket: "query-builder-bot.appspot.com",
  messagingSenderId: "511571415270",
  appId: "1:511571415270:web:6e8e4f33791d04d1f1eb27"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const users = [
  {
    email: 'john@abcmanufacturing.com',
    name: 'John Smith',
    companyId: 'ABC123',
    role: 'admin',
    isActive: true,
    password: 'Test@123', // In production, use secure password generation
    department: 'Finance',
    position: 'Finance Manager'
  },
  {
    email: 'sarah@xyztrading.com',
    name: 'Sarah Johnson',
    companyId: 'XYZ456',
    role: 'admin',
    isActive: true,
    password: 'Test@123',
    department: 'Treasury',
    position: 'Treasury Manager'
  },
  {
    email: 'mike@pqrindustries.com',
    name: 'Mike Wilson',
    companyId: 'PQR789',
    role: 'admin',
    isActive: true,
    password: 'Test@123',
    department: 'Finance',
    position: 'CFO'
  },
  // Additional users for each company
  {
    email: 'alice@abcmanufacturing.com',
    name: 'Alice Brown',
    companyId: 'ABC123',
    role: 'user',
    isActive: true,
    password: 'Test@123',
    department: 'Accounts',
    position: 'Account Manager'
  },
  {
    email: 'bob@xyztrading.com',
    name: 'Bob Davis',
    companyId: 'XYZ456',
    role: 'user',
    isActive: true,
    password: 'Test@123',
    department: 'Trade Finance',
    position: 'Trade Finance Officer'
  },
  {
    email: 'emma@pqrindustries.com',
    name: 'Emma Clark',
    companyId: 'PQR789',
    role: 'user',
    isActive: true,
    password: 'Test@123',
    department: 'Credit',
    position: 'Credit Analyst'
  }
];

async function initializeUsers() {
  try {
    console.log('Starting users initialization...');

    for (const user of users) {
      console.log(`Creating user: ${user.name} (${user.email})`);
      
      try {
        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
        console.log(`✅ Created Firebase Auth user: ${user.email}`);

        // Create Firestore user document
        const userDoc = {
          ...user,
          uid: userCredential.user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: null
        };

        // Remove password from Firestore document
        delete userDoc.password;

        await setDoc(doc(db, 'bank_customers', user.email), userDoc);
        console.log(`✅ Created Firestore user document: ${user.name}`);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`⚠️ User already exists: ${user.email}`);
          // Still create/update the Firestore document without the password
          const userDoc = {
            ...user,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLogin: null
          };
          delete userDoc.password;
          
          await setDoc(doc(db, 'bank_customers', user.email), userDoc);
          console.log(`✅ Updated Firestore user document: ${user.name}`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Users initialization completed successfully');
  } catch (error) {
    console.error('❌ Error initializing users:', error);
    throw error;
  }
}

// Run the initialization
initializeUsers()
  .then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  }); 