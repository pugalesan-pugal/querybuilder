import { initFirebase } from './initFirebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import type { BankCustomer } from '../types/bankCustomer';

const bankCustomers: BankCustomer[] = [
  {
    id: 'pugal',
    email: 'pugal@example.com',
    name: 'Pugal',
    companyId: 'ABC',
    role: 'user',
    accessCode: 'ABC123',
    createdAt: new Date()
  },
  {
    id: 'madhu',
    email: 'madhu@example.com',
    name: 'Madhu',
    companyId: 'XYZ',
    role: 'user',
    accessCode: 'XYZ456',
    createdAt: new Date()
  }
];

export const initializeBankCustomerData = async () => {
  try {
    const { db } = initFirebase();
    const customersCollection = collection(db, 'bank_customers');

    // Create bank customers
    for (const customer of bankCustomers) {
      await setDoc(doc(customersCollection, customer.id), customer);
    }

    console.log('Bank customer data initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing bank customer data:', error);
    return false;
  }
}; 