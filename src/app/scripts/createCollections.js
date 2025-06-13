const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Initial data
const data = {
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
      companyId: 'ABC',
      role: 'admin',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: null
    }
  ]
};

async function createCollections() {
  try {
    // Create companies
    console.log('Creating companies collection...');
    for (const company of data.companies) {
      await db.collection('companies').doc(company.id).set(company);
      console.log(`Created company: ${company.name}`);
    }

    // Create bank_customers
    console.log('Creating bank_customers collection...');
    for (const customer of data.bank_customers) {
      await db.collection('bank_customers').doc(customer.email).set(customer);
      console.log(`Created customer: ${customer.name} (${customer.email})`);
    }

    console.log('Collections created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating collections:', error);
    process.exit(1);
  }
}

createCollections(); 