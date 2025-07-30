import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../utils/initFirebase';

interface FAQItem {
  question: string;
  answer: string;
  keywords: string[];
  category: string;
  lastUpdated: string;
}

const initialFAQs: FAQItem[] = [
  {
    question: "What are my current account balances?",
    answer: "I can help you check your account balances. Your current balances are available in the Bank_Accounts section of your profile. Would you like me to show you the details?",
    keywords: ["balance", "account", "money", "available", "current balance"],
    category: "accounts",
    lastUpdated: new Date().toISOString()
  },
  {
    question: "How do I check my transaction history?",
    answer: "You can view your transaction history in several ways:\n1. Ask me about transactions for a specific time period (e.g., 'Show last month's transactions')\n2. Ask about specific categories (e.g., 'Show my recent food expenses')\n3. Check specific date ranges\nWhat would you like to know?",
    keywords: ["transaction", "history", "spending", "expenses", "payments"],
    category: "transactions",
    lastUpdated: new Date().toISOString()
  },
  {
    question: "What are my loan details?",
    answer: "I can help you check your loan information including:\n- Current outstanding amounts\n- Interest rates\n- EMI details\n- Loan terms and conditions\nWhich specific loan information would you like to know?",
    keywords: ["loan", "emi", "interest", "borrowing", "debt"],
    category: "loans",
    lastUpdated: new Date().toISOString()
  },
  {
    question: "How do I check my credit score?",
    answer: "Your current credit score and report are available in the Credit_Reports section. This includes:\n- Credit score\n- Credit history\n- Recent inquiries\n- Credit utilization\nWould you like me to show you these details?",
    keywords: ["credit", "score", "cibil", "rating"],
    category: "credit",
    lastUpdated: new Date().toISOString()
  },
  {
    question: "What are my KYC details?",
    answer: "I can help you check your KYC (Know Your Customer) details including:\n- Verification status\n- Submitted documents\n- Last verification date\n- Required updates if any\nWhich KYC information would you like to see?",
    keywords: ["kyc", "verification", "documents", "identity"],
    category: "kyc",
    lastUpdated: new Date().toISOString()
  }
];

async function initializeFAQs() {
  try {
    if (!db) {
      throw new Error("Firestore is not initialized.");
    }

    const batch = writeBatch(db);
    const faqCollection = collection(db, 'faq');

    initialFAQs.forEach((faq) => {
      const docRef = doc(faqCollection);
      batch.set(docRef, faq);
    });

    await batch.commit();
    console.log('Successfully initialized FAQ collection with', initialFAQs.length, 'items');
  } catch (error) {
    console.error('Error initializing FAQs:', error);
  }
}

// Export for use in other scripts
export { initializeFAQs, FAQItem };

// Run directly if this is the main script
if (require.main === module) {
  initializeFAQs().then(() => process.exit(0));
}
