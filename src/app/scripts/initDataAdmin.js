const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = require(path.join(__dirname, '../firebase-adminsdk.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Company data
const companies = [
  {
    id: 'ABC',
    name: 'ABC Corporation',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'XYZ',
    name: 'XYZ Industries',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// Bank customer data
const bankCustomers = [
  {
    id: 'pugal',
    email: 'pugal@example.com',
    name: 'Pugal',
    companyId: 'ABC',
    role: 'user',
    accessCode: 'ABC123',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'madhu',
    email: 'madhu@example.com',
    name: 'Madhu',
    companyId: 'XYZ',
    role: 'user',
    accessCode: 'XYZ456',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

async function initializeData() {
  try {
    console.log('Starting data initialization...');

    // Initialize companies
    for (const company of companies) {
      await db.collection('companies').doc(company.id).set(company);
      console.log(`Company ${company.name} initialized`);
    }

    // Initialize bank customers
    for (const customer of bankCustomers) {
      await db.collection('bank_customers').doc(customer.id).set(customer);
      console.log(`Bank customer ${customer.name} initialized`);
    }

    console.log('Data initialization completed successfully');
  } catch (error) {
    console.error('Error initializing data:', error);
  } finally {
    process.exit();
  }
}

initializeData(); 