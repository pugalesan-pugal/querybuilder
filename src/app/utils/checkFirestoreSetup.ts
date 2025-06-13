import { initFirebase } from './initFirebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

export async function checkFirestoreSetup() {
  console.log('Checking Firestore setup...');
  const { db } = initFirebase();

  try {
    // Check bank_customers collection
    console.log('Checking bank_customers collection...');
    const customersQuery = query(collection(db, 'bank_customers'), limit(1));
    try {
      const customersSnapshot = await getDocs(customersQuery);
      console.log('bank_customers collection exists:', !customersSnapshot.empty);
      console.log('bank_customers documents count:', customersSnapshot.size);
    } catch (error: any) {
      console.error('Error accessing bank_customers:', error.message);
      if (error.code === 'permission-denied') {
        console.error('Permission denied for bank_customers collection. Check Firestore rules.');
      }
    }

    // Check companies collection
    console.log('Checking companies collection...');
    const companiesQuery = query(collection(db, 'companies'), limit(1));
    try {
      const companiesSnapshot = await getDocs(companiesQuery);
      console.log('companies collection exists:', !companiesSnapshot.empty);
      console.log('companies documents count:', companiesSnapshot.size);
    } catch (error: any) {
      console.error('Error accessing companies:', error.message);
      if (error.code === 'permission-denied') {
        console.error('Permission denied for companies collection. Check Firestore rules.');
      }
    }

    return true;
  } catch (error: any) {
    console.error('Error checking Firestore setup:', error);
    throw error;
  }
} 