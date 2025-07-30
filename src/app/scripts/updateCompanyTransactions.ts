import { CompanyQueryService } from '../utils/companyQueryService';

const transactions = [
  {
    transaction_id: "DCAPR001",
    date: "2025-04-03",
    amount: 2599.99,
    merchant: "Amazon",
    currency: "INR",
    status: "Completed",
    card_number: "XXXX-XXXX-XXXX-4521",
    category: "Shopping",
    remarks: "Purchase of electronics"
  },
  {
    transaction_id: "DCAPR002",
    date: "2025-04-11",
    amount: 749.5,
    merchant: "Zomato",
    currency: "INR",
    status: "Completed",
    card_number: "XXXX-XXXX-XXXX-4521",
    category: "Food & Dining",
    remarks: "Dinner order"
  },
  {
    transaction_id: "DCAPR003",
    date: "2025-04-21",
    amount: 1200.0,
    merchant: "HP Petrol Bunk",
    currency: "INR",
    status: "Completed",
    card_number: "XXXX-XXXX-XXXX-4521",
    category: "Fuel",
    remarks: "Petrol refill"
  }
];

async function updateTransactions() {
  try {
    console.log('Starting transaction update for all companies...');
    await CompanyQueryService.updateAllCompaniesTransactions(transactions, {}); // ✅ Fixed
    console.log('Successfully updated transactions for all companies');
  } catch (error) {
    console.error('Error updating transactions:', error);
    process.exit(1);
  }
}

updateTransactions();
