import { CompanyQueryService } from '../utils/companyQueryService';

const creditCardTransactions = [
  {
    "transaction_id": "CCJUN001",
    "date": "2025-06-28",
    "amount": 9190.81,
    "merchant": "Swiggy",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Utilities",
    "remarks": "Payment to Swiggy for utilities"
  },
  {
    "transaction_id": "CCJUN002",
    "date": "2025-06-24",
    "amount": 14189.88,
    "merchant": "Flipkart",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Retail",
    "remarks": "Payment to Flipkart for retail"
  },
  {
    "transaction_id": "CCJUN003",
    "date": "2025-06-23",
    "amount": 9615.46,
    "merchant": "IRCTC",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Retail",
    "remarks": "Payment to IRCTC for retail"
  },
  {
    "transaction_id": "CCJUN004",
    "date": "2025-06-27",
    "amount": 5732.35,
    "merchant": "Zomato",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Entertainment",
    "remarks": "Payment to Zomato for entertainment"
  },
  {
    "transaction_id": "CCJUN005",
    "date": "2025-06-12",
    "amount": 15321.76,
    "merchant": "Nykaa",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Travel",
    "remarks": "Payment to Nykaa for travel"
  },
  {
    "transaction_id": "CCJUN006",
    "date": "2025-06-08",
    "amount": 16364.51,
    "merchant": "IRCTC",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Retail",
    "remarks": "Payment to IRCTC for retail"
  },
  {
    "transaction_id": "CCJUN007",
    "date": "2025-06-02",
    "amount": 14141.55,
    "merchant": "Google Play",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Retail",
    "remarks": "Payment to Google Play for retail"
  },
  {
    "transaction_id": "CCJUN008",
    "date": "2025-06-06",
    "amount": 21002.53,
    "merchant": "Amazon",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Groceries",
    "remarks": "Payment to Amazon for groceries"
  },
  {
    "transaction_id": "CCJUN009",
    "date": "2025-06-16",
    "amount": 11211.48,
    "merchant": "Starbucks",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Travel",
    "remarks": "Payment to Starbucks for travel"
  },
  {
    "transaction_id": "CCJUN010",
    "date": "2025-06-26",
    "amount": 5181.14,
    "merchant": "Cleartrip",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Groceries",
    "remarks": "Payment to Cleartrip for groceries"
  },
  {
    "transaction_id": "CCJUN011",
    "date": "2025-06-01",
    "amount": 529.38,
    "merchant": "Paytm",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Travel",
    "remarks": "Payment to Paytm for travel"
  },
  {
    "transaction_id": "CCJUN012",
    "date": "2025-06-12",
    "amount": 3932.23,
    "merchant": "Reliance Digital",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Recharge",
    "remarks": "Payment to Reliance Digital for recharge"
  },
  {
    "transaction_id": "CCJUN013",
    "date": "2025-06-19",
    "amount": 16646.12,
    "merchant": "Uber",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Online Shopping",
    "remarks": "Payment to Uber for online shopping"
  },
  {
    "transaction_id": "CCJUN014",
    "date": "2025-06-06",
    "amount": 17636.24,
    "merchant": "Amazon",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Transport",
    "remarks": "Payment to Amazon for transport"
  },
  {
    "transaction_id": "CCJUN015",
    "date": "2025-06-06",
    "amount": 3699.84,
    "merchant": "Zomato",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Retail",
    "remarks": "Payment to Zomato for retail"
  },
  {
    "transaction_id": "CCJUN016",
    "date": "2025-06-01",
    "amount": 17646.68,
    "merchant": "Swiggy",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Entertainment",
    "remarks": "Payment to Swiggy for entertainment"
  },
  {
    "transaction_id": "CCJUN017",
    "date": "2025-06-22",
    "amount": 19468.76,
    "merchant": "Starbucks",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Recharge",
    "remarks": "Payment to Starbucks for recharge"
  },
  {
    "transaction_id": "CCJUN018",
    "date": "2025-06-23",
    "amount": 13175.07,
    "merchant": "Myntra",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Travel",
    "remarks": "Payment to Myntra for travel"
  },
  {
    "transaction_id": "CCJUN019",
    "date": "2025-06-08",
    "amount": 18058.93,
    "merchant": "Paytm",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Transport",
    "remarks": "Payment to Paytm for transport"
  },
  {
    "transaction_id": "CCJUN020",
    "date": "2025-06-18",
    "amount": 8127.98,
    "merchant": "Zomato",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Entertainment",
    "remarks": "Payment to Zomato for entertainment"
  }
];

const debitCardTransactions = [
  {
    "transaction_id": "DCJUN001",
    "date": "2025-06-02",
    "amount": 1500.0,
    "merchant": "ATM Withdrawal",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-3210",
    "category": "Cash",
    "remarks": "Cash withdrawn from ATM"
  },
  {
    "transaction_id": "DCJUN002",
    "date": "2025-06-05",
    "amount": 299.99,
    "merchant": "Amazon Pay",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-1234",
    "category": "Recharge",
    "remarks": "Mobile recharge"
  },
  {
    "transaction_id": "DCJUN003",
    "date": "2025-06-10",
    "amount": 1200.5,
    "merchant": "Big Bazaar",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-5566",
    "category": "Groceries",
    "remarks": "Monthly groceries purchase"
  },
  {
    "transaction_id": "DCJUN004",
    "date": "2025-06-15",
    "amount": 650.0,
    "merchant": "IRCTC",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-8877",
    "category": "Travel",
    "remarks": "Train ticket booking"
  },
  {
    "transaction_id": "DCJUN005",
    "date": "2025-06-20",
    "amount": 99.0,
    "merchant": "Google Pay",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-6677",
    "category": "Transfer",
    "remarks": "Money sent to friend"
  },
  {
    "transaction_id": "DCJUN006",
    "date": "2025-06-25",
    "amount": 2150.0,
    "merchant": "Apollo Pharmacy",
    "currency": "INR",
    "status": "Completed",
    "card_number": "XXXX-XXXX-XXXX-9012",
    "category": "Medical",
    "remarks": "Purchase of medicines"
  }
];

const updateTransactions = async () => {
  try {
    await CompanyQueryService.updateAllCompaniesTransactions(creditCardTransactions, debitCardTransactions);
    console.log('Successfully updated transactions for all companies');
  } catch (error) {
    console.error('Error updating transactions:', error);
  }
};

updateTransactions(); 