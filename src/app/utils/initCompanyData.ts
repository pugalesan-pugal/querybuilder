import { initFirebase } from './initFirebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import type { Company } from '../types/company';

const generateId = () => Math.random().toString(36).substring(2, 15);

const createCompanyData = (companyName: string): Company => {
  const currentDate = new Date();
  const futureDate = new Date();
  futureDate.setFullYear(currentDate.getFullYear() + 1);

  return {
    id: generateId(),
    name: companyName,
    data: {
      npn_report: {
        reportId: generateId(),
        reportDate: currentDate,
        totalAssets: Math.random() * 1000000000,
        netWorth: Math.random() * 500000000,
        profitLoss: Math.random() * 100000000,
        fiscalYear: '2023-24',
      },
      account_types: [
        {
          id: generateId(),
          type: 'savings',
          balance: Math.random() * 1000000,
          currency: 'USD',
          openDate: currentDate,
          status: 'active',
        },
        {
          id: generateId(),
          type: 'current',
          balance: Math.random() * 5000000,
          currency: 'USD',
          openDate: currentDate,
          status: 'active',
        },
      ],
      working_capital: {
        id: generateId(),
        totalAmount: Math.random() * 10000000,
        utilized: Math.random() * 5000000,
        available: Math.random() * 5000000,
        interestRate: 7.5,
        lastReviewDate: currentDate,
      },
      loans: [
        {
          id: generateId(),
          type: 'term',
          amount: Math.random() * 10000000,
          interestRate: 8.5,
          startDate: currentDate,
          maturityDate: futureDate,
          outstandingAmount: Math.random() * 8000000,
          status: 'active',
        },
      ],
      finance: [
        {
          id: generateId(),
          type: 'invoice',
          amount: Math.random() * 500000,
          utilizationDate: currentDate,
          dueDate: futureDate,
          status: 'approved',
        },
      ],
      payments: [
        {
          id: generateId(),
          type: 'international',
          amount: Math.random() * 1000000,
          currency: 'USD',
          date: currentDate,
          status: 'completed',
          beneficiary: 'International Supplier Ltd',
        },
      ],
      letter_of_credit: [
        {
          id: generateId(),
          amount: Math.random() * 2000000,
          currency: 'USD',
          issueDate: currentDate,
          expiryDate: futureDate,
          beneficiary: 'Global Trade Partner Inc',
          status: 'active',
        },
      ],
      bank_guarantees: [
        {
          id: generateId(),
          type: 'performance',
          amount: Math.random() * 1000000,
          startDate: currentDate,
          endDate: futureDate,
          beneficiary: 'Project Client Corp',
          status: 'active',
        },
      ],
      import_export: [
        {
          id: generateId(),
          type: 'import',
          documentType: 'bill_of_lading',
          amount: Math.random() * 500000,
          date: currentDate,
          status: 'in_transit',
        },
      ],
      credit_reports: [
        {
          id: generateId(),
          reportDate: currentDate,
          creditScore: Math.floor(Math.random() * 300 + 700),
          riskRating: 'low',
          totalExposure: Math.random() * 10000000,
          reportingAgency: 'Standard & Poor\'s',
        },
      ],
      cash_management: [
        {
          id: generateId(),
          service: 'collection',
          transactionVolume: Math.random() * 10000000,
          lastTransactionDate: currentDate,
          status: 'active',
        },
      ],
      treasury_services: [
        {
          id: generateId(),
          type: 'forex',
          amount: Math.random() * 5000000,
          currency: 'EUR',
          date: currentDate,
          maturityDate: futureDate,
          status: 'active',
        },
      ],
    },
  };
};

export const initializeCompanyData = async () => {
  try {
    const { db } = initFirebase();
    const companiesCollection = collection(db, 'companies');

    // Create ABC Company data
    const abcCompany = createCompanyData('ABC Corporation');
    await setDoc(doc(companiesCollection, 'ABC'), abcCompany);

    // Create XYZ Company data
    const xyzCompany = createCompanyData('XYZ Industries');
    await setDoc(doc(companiesCollection, 'XYZ'), xyzCompany);

    console.log('Company data initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing company data:', error);
    return false;
  }
}; 