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

// All customers from your database
const users = [
  {
    email: 'alice@abcmanufacturing.com',
    name: 'Alice',
    companyId: 'ABC123',
    role: 'user',
    isActive: true,
    password: 'ABC123', // Using the same password pattern as pugalesan
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: null
  },
  {
    email: 'bob@xyztrading.com',
    name: 'Bob',
    companyId: 'XYZ456',
    role: 'user',
    isActive: true,
    password: 'ABC123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: null
  },
  {
    email: 'emma@pqrindustries.com',
    name: 'Emma',
    companyId: 'PQR789',
    role: 'user',
    isActive: true,
    password: 'ABC123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: null
  },
  {
    email: 'john@abcmanufacturing.com',
    name: 'John',
    companyId: 'ABC123',
    role: 'user',
    isActive: true,
    password: 'ABC123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: null
  },
  {
    email: 'mike@pqrindustries.com',
    name: 'Mike',
    companyId: 'PQR789',
    role: 'user',
    isActive: true,
    password: 'ABC123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: null
  },
  {
    email: 'sarah@xyztrading.com',
    name: 'Sarah',
    companyId: 'XYZ456',
    role: 'user',
    isActive: true,
    password: 'ABC123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: null
  }
  // Note: pugalesan@gmail.com is already working, so not included here
];

async function createAllUsers() {
  try {
    console.log('🚀 Starting Firebase Auth user creation for all customers...');
    console.log(`📋 Total users to process: ${users.length}`);

    for (const user of users) {
      console.log(`\n👤 Processing: ${user.name} (${user.email})`);
      
      try {
        // Create Firebase Auth user
        console.log(`   🔐 Creating Firebase Auth account...`);
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
        console.log(`   ✅ Created Firebase Auth user: ${user.email} (UID: ${userCredential.user.uid})`);

        // Create/Update Firestore user document
        const userDoc = {
          ...user,
          uid: userCredential.user.uid
        };

        // Remove password from Firestore document for security
        delete userDoc.password;

        await setDoc(doc(db, 'bank_customers', user.email), userDoc);
        console.log(`   📄 Created/Updated Firestore document: ${user.name}`);
        console.log(`   🎯 Login credentials: ${user.email} / ${user.password}`);
        
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`   ⚠️ Firebase Auth user already exists: ${user.email}`);
          
          // Still create/update the Firestore document
          const userDoc = {
            ...user
          };
          delete userDoc.password;
          
          await setDoc(doc(db, 'bank_customers', user.email), userDoc);
          console.log(`   📄 Updated Firestore document: ${user.name}`);
          console.log(`   🎯 Login credentials: ${user.email} / ${user.password}`);
        } else {
          console.error(`   ❌ Error creating user ${user.email}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n🎉 All users processed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - All customers now have Firebase Auth accounts');
    console.log('   - All customers have Firestore documents in bank_customers collection');
    console.log('   - All customers can now log in with their email and password: ABC123');
    console.log('\n🔑 Login Credentials:');
    users.forEach(user => {
      console.log(`   ${user.email} / ABC123`);
    });
    
  } catch (error) {
    console.error('❌ Error creating users:', error);
    throw error;
  }
}

// Run the script
createAllUsers()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }); 