import { initFirebase } from '../utils/initFirebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

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
    console.log('Starting collection creation...');
    const { db } = initFirebase();

    // Clear existing data first
    console.log('Clearing existing data...');
    
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

    // Create companies
    console.log('Creating companies collection...');
    for (const company of data.companies) {
      await setDoc(doc(db, 'companies', company.id), company);
      console.log(`Created company: ${company.name}`);
    }

    // Create bank_customers
    console.log('Creating bank_customers collection...');
    for (const customer of data.bank_customers) {
      await setDoc(doc(db, 'bank_customers', customer.email), customer);
      console.log(`Created customer: ${customer.name} (${customer.email})`);
    }

    console.log('Collections created successfully!');
    return true;
  } catch (error) {
    console.error('Error creating collections:', error);
    throw error;
  }
}

// Export the function to be used in other files
export { createCollections, data }; 