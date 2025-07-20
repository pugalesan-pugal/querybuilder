import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './initFirebase';
import { formatCurrency, formatDate } from './formatUtils';

interface QueryIntent {
  type: string;
  subType?: string;
  timeframe?: string;
  category?: string;
}

interface ResolvedData {
  hasData: boolean;
  data: any;
  formattedResponse: string;
}

interface BankAccount {
  Account_Number: string;
  Bank_Name: string;
  Account_Type: string;
  Current_Balance: number;
  Available_Balance: number;
  Currency: string;
  Joint_Holder_Names?: string[];
  Branch_Name: string;
  IFSC_Code: string;
}

interface Transaction {
  date: string;
  amount: number;
  merchant: string;
  category: string;
  remarks: string;
  status: string;
  transaction_id: string;
}

interface JointHolderData {
  account: string;
  bank: string;
  type: string;
  joint_holders: string[];
}

interface BalanceData {
  account: string;
  bank: string;
  type: string;
  current_balance: number;
  available_balance: number;
  currency: string;
}

interface CategoryTotal {
  [category: string]: number;
}

interface TransactionData {
  transactions: Transaction[];
  total: number;
  byCategory: CategoryTotal;
}

export class DataResolver {
  private readonly companyId: string;
  private readonly userId: string;
  private companyData: any = null;

  constructor(companyId: string, userId: string) {
    this.companyId = companyId;
    this.userId = userId;
  }

  private async loadCompanyData(): Promise<void> {
    if (!this.companyData) {
      const companyRef = doc(db, 'companies', this.companyId);
      const companyDoc = await getDoc(companyRef);
      if (!companyDoc.exists()) {
        throw new Error('Company data not found');
      }
      this.companyData = companyDoc.data();
    }
  }

  private async resolvePersonalInfo(subType: string): Promise<ResolvedData> {
    const paths = {
      name: ['Individual_Details', 'Full_Name'],
      email: ['Individual_Details', 'Email_Address'],
      phone: ['Individual_Details', 'Phone_Number'],
      address: ['Individual_Details', 'Residential_Address']
    };

    const path = paths[subType as keyof typeof paths];
    if (!path) {
      return { hasData: false, data: null, formattedResponse: 'Could not find the requested personal information.' };
    }

    let current = this.companyData;
    for (const key of path) {
      if (!current[key]) {
        return { hasData: false, data: null, formattedResponse: `${subType} information not found.` };
      }
      current = current[key];
    }

    return {
      hasData: true,
      data: current,
      formattedResponse: `Your ${subType} is: ${current}`
    };
  }

  private async resolveAccountInfo(subType: string): Promise<ResolvedData> {
    const accounts = this.companyData.Bank_Accounts || [] as BankAccount[];
    if (accounts.length === 0) {
      return { hasData: false, data: null, formattedResponse: 'No bank accounts found.' };
    }

    switch (subType) {
      case 'joint_holders':
        const jointHolderData = accounts.map((acc: BankAccount): JointHolderData => ({
          account: acc.Account_Number,
          bank: acc.Bank_Name,
          type: acc.Account_Type,
          joint_holders: acc.Joint_Holder_Names || []
        }));

        const response = jointHolderData
          .map((acc: JointHolderData) => `${acc.bank} ${acc.type} Account ${acc.account}:\n` +
            (acc.joint_holders.length > 0 
              ? `Joint holders: ${acc.joint_holders.join(', ')}`
              : 'No joint holders'))
          .join('\n\n');

        return {
          hasData: true,
          data: jointHolderData,
          formattedResponse: response
        };

      case 'balance':
        const balanceData = accounts.map((acc: BankAccount): BalanceData => ({
          account: acc.Account_Number,
          bank: acc.Bank_Name,
          type: acc.Account_Type,
          current_balance: acc.Current_Balance,
          available_balance: acc.Available_Balance,
          currency: acc.Currency
        }));

        const balanceResponse = balanceData
          .map((acc: BalanceData) => `${acc.bank} ${acc.type} Account ${acc.account}:\n` +
            `Current Balance: ${formatCurrency(acc.current_balance)}\n` +
            `Available Balance: ${formatCurrency(acc.available_balance)}\n` +
            `Currency: ${acc.currency}`)
          .join('\n\n');

        return {
          hasData: true,
          data: balanceData,
          formattedResponse: balanceResponse
        };

      default:
        return { 
          hasData: false, 
          data: null, 
          formattedResponse: 'Could not understand what account information you need.' 
        };
    }
  }

  private async resolveTransactionInfo(timeframe: string, category?: string): Promise<ResolvedData> {
    const transactions = this.companyData.transactions || [] as Transaction[];
    if (transactions.length === 0) {
      return { 
        hasData: false, 
        data: null, 
        formattedResponse: 'No transactions found.' 
      };
    }

    // Filter transactions by timeframe
    const now = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case 'last month':
        startDate.setMonth(now.getMonth() - 1, 1);
        now.setMonth(now.getMonth(), 0);
        break;
      case 'this month':
        startDate.setDate(1);
        break;
      case 'last week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'this week':
        startDate.setDate(now.getDate() - now.getDay());
        break;
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        now.setDate(now.getDate() - 1);
        now.setHours(23, 59, 59, 999);
        break;
    }

    let filteredTransactions = transactions.filter((t: Transaction) => {
      const txDate = new Date(t.date);
      return txDate >= startDate && txDate <= now;
    });

    // Apply category filter if specified
    if (category) {
      filteredTransactions = filteredTransactions.filter((t: Transaction) => 
        t.category.toLowerCase() === category.toLowerCase() ||
        t.remarks.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (filteredTransactions.length === 0) {
      return {
        hasData: false,
        data: null,
        formattedResponse: `No ${category || ''} transactions found for ${timeframe}.`
      };
    }

    // Calculate totals and format response
    const total = filteredTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    const byCategory = filteredTransactions.reduce((acc: CategoryTotal, t: Transaction) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as CategoryTotal);

    let response = `Found ${filteredTransactions.length} transactions for ${timeframe}\n`;
    response += `Total amount: ${formatCurrency(total)}\n\n`;

    if (category) {
      response += `${category} transactions:\n`;
      filteredTransactions
        .sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .forEach((t: Transaction) => {
          response += `${formatDate(t.date)}: ${formatCurrency(t.amount)} at ${t.merchant}\n`;
          response += `  ${t.remarks}\n`;
        });
    } else {
      response += 'Breakdown by category:\n';
      (Object.entries(byCategory) as [string, number][])
        .sort(([, a], [, b]) => b - a)
        .forEach(([cat, amount]) => {
          response += `${cat}: ${formatCurrency(amount)}\n`;
        });
    }

    return {
      hasData: true,
      data: {
        transactions: filteredTransactions,
        total,
        byCategory
      } as TransactionData,
      formattedResponse: response
    };
  }

  async resolveQuery(intent: QueryIntent): Promise<ResolvedData> {
    try {
      await this.loadCompanyData();

      switch (intent.type) {
        case 'personal':
          return this.resolvePersonalInfo(intent.subType || '');

        case 'account':
          return this.resolveAccountInfo(intent.subType || '');

        case 'transactions':
          return this.resolveTransactionInfo(intent.timeframe || 'all', intent.category);

        default:
          return {
            hasData: false,
            data: null,
            formattedResponse: 'Could not understand what information you need.'
          };
      }
    } catch (error) {
      console.error('Error resolving query:', error);
      return {
        hasData: false,
        data: null,
        formattedResponse: 'An error occurred while fetching your information.'
      };
    }
  }
} 