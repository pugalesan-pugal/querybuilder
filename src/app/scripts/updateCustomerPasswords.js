const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');

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

// All customers with their company IDs
const customers = [
  {
    email: 'alice@abcmanufacturing.com',
    name: 'Alice',
    companyId: 'ABC123',
    password: 'ABC123', // Password matches companyId
    role: 'user',
    isActive: true
  },
  {
    email: 'bob@xyztrading.com',
    name: 'Bob',
    companyId: 'XYZ456',
    password: 'XYZ456', // Password matches companyId
    role: 'user',
    isActive: true
  },
  {
    email: 'emma@pqrindustries.com',
    name: 'Emma',
    companyId: 'PQR789',
    password: 'PQR789', // Password matches companyId
    role: 'user',
    isActive: true
  },
  {
    email: 'john@abcmanufacturing.com',
    name: 'John',
    companyId: 'ABC123',
    password: 'ABC123', // Password matches companyId
    role: 'user',
    isActive: true
  },
  {
    email: 'mike@pqrindustries.com',
    name: 'Mike',
    companyId: 'PQR789',
    password: 'PQR789', // Password matches companyId
    role: 'user',
    isActive: true
  },
  {
    email: 'sarah@xyztrading.com',
    name: 'Sarah',
    companyId: 'XYZ456',
    password: 'XYZ456', // Password matches companyId
    role: 'user',
    isActive: true
  },
  {
    email: 'pugalesan@gmail.com',
    name: 'Pugal',
    companyId: 'ABC123',
    password: 'ABC123', // Password matches companyId
    role: 'admin',
    isActive: true
  }
];

async function updateCustomerPasswords() {
  try {
    console.log('🔧 Starting password update for all customers...');
    console.log(`📋 Total customers to update: ${customers.length}`);

    for (const customer of customers) {
      console.log(`\n👤 Processing: ${customer.name} (${customer.email})`);
      
      try {
        // Get existing customer document
        const customerDoc = await getDoc(doc(db, 'bank_customers', customer.email));
        
        if (customerDoc.exists()) {
          const existingData = customerDoc.data();
          console.log(`   📄 Found existing customer document`);
          
          // Update the document with new password
          const updatedData = {
            ...existingData,
            password: customer.password, // Set password to match companyId
            updatedAt: new Date().toISOString()
          };

          await setDoc(doc(db, 'bank_customers', customer.email), updatedData);
          console.log(`   ✅ Updated password for: ${customer.name}`);
          console.log(`   🔑 Login credentials: ${customer.email} / ${customer.password}`);
        } else {
          console.log(`   ⚠️ Customer document not found: ${customer.email}`);
          
          // Create new customer document
          const newCustomerData = {
            email: customer.email,
            name: customer.name,
            companyId: customer.companyId,
            password: customer.password,
            role: customer.role,
            isActive: customer.isActive,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLogin: null
          };

          await setDoc(doc(db, 'bank_customers', customer.email), newCustomerData);
          console.log(`   ✅ Created new customer document: ${customer.name}`);
          console.log(`   🔑 Login credentials: ${customer.email} / ${customer.password}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error updating customer ${customer.email}:`, error.message);
        throw error;
      }
    }

    console.log('\n🎉 All customer passwords updated successfully!');
    console.log('\n📝 Summary:');
    console.log('   - All customers now have passwords that match their companyId');
    console.log('   - All customers can now log in with their email and companyId as password');
    console.log('\n🔑 Login Credentials:');
    customers.forEach(customer => {
      console.log(`   ${customer.email} / ${customer.password}`);
    });
    
  } catch (error) {
    console.error('❌ Error updating customer passwords:', error);
    throw error;
  }
}

// Run the script
updateCustomerPasswords()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }); 