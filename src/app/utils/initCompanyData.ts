import { db } from './initFirebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import type { CompanyData } from '../types/bankTypes';

const generateId = () => Math.random().toString(36).substring(2, 15);

const createCompanyData = (companyName: string): CompanyData => {
  const currentDate = new Date().toISOString();
  
  return {
    id: generateId(),
    name: companyName,
    isActive: true,
    createdAt: currentDate,
    updatedAt: currentDate,
    services: {
      working_capital: {
        limit: 5000000,
        utilized: 3500000,
        last_review_date: '2024-02-15'
      },
      trade_finance: {
        bank_guarantees: {
          limit: 1000000,
          utilized: 800000
        },
        letter_of_credit: {
          limit: 2000000,
          utilized: 1500000
        }
      }
    },
    loans: [
      {
        type: 'Term Loan',
        amount: 10000000,
        interest_rate: 8.5,
        tenure_months: 60
      },
      {
        type: 'Equipment Loan',
        amount: 2500000,
        interest_rate: 9,
        tenure_months: 36
      }
    ],
    account_types: ['Current', 'Savings', 'Term Deposits']
  };
};

export const initializeCompanyData = async () => {
  try {
    const companiesCollection = collection(db, 'companies');

    // Create ABC Company data
    const abcCompany = createCompanyData('ABC Manufacturing Ltd');
    await setDoc(doc(companiesCollection, 'ABC123'), abcCompany);

    // Create XYZ Company data
    const xyzCompany = createCompanyData('XYZ Industries');
    await setDoc(doc(companiesCollection, 'XYZ456'), xyzCompany);

    console.log('Company data initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing company data:', error);
    return false;
  }
}; 