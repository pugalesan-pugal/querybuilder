import { db } from './initFirebase';
import { collection, query, where, getDocs, DocumentData, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { formatCurrency, formatDate } from './formatUtils';

interface QueryIntent {
  type: 'company_info' | 'npn_report' | 'financial_data' | 'working_capital' | 'loan' | 'payment_methods' | 
        'treasury_services' | 'trade_finance' | 'credit_reports' | 'account_types' | 'transactions' | 
        'authorized_signatory' | 'bank_accounts' | 'communication' | 'custom_pricing' | 'support_tickets' | 
        'surveys' | 'digital_access' | 'kyc_compliance' | 'individual_details' | 'regulatory_audit' | 
        'trade_finance_details' | 'personal_details' | 'registration_details' | 'general' | 'loans_info' |
        'working_capital_facility' | 'bank_guarantees' | 'letters_of_credit' | 'invoice_financing' |
        'documentary_collections' | 'trade_limits' | 'trade_transaction_history' | 'suspicious_transactions' |
        'watchlist_status' | 'regulatory_compliance' | 'audit_logs' | 'data_consent';
  entities: {
    companyId?: string;
    reportType?: string;
    dateRange?: {
      start?: Date;
      end?: Date;
    };
    metric?: string;
    category?: string;
    userId?: string;
    accountNumber?: string;
    ticketId?: string;
    documentType?: string;
    transactionType?: string;
    loanId?: string;
    lcNumber?: string;
    bgNumber?: string;
    tradeTransactionId?: string;
    auditLogId?: string;
  };
}

interface QueryResult {
  hasData: boolean;
  context: string;
  data: any;
  metadata?: {
    type: string;
    subType?: string;
    fieldName?: string;
  };
}

interface CompanyData {
  name: string;
  id: string;
  services?: {
    npn_reports?: {
      working_capital?: {
        limit: number;
        utilized: number;
        last_review_date?: string;
      };
    };
    working_capital?: {
      limit: number;
      utilized: number;
      last_review_date?: string;
    };
  };
}

interface Transaction {
  date: string;
  amount: number;
  category: string;
  merchant: string;
  status: string;
  remarks?: string | null;
}

interface TransactionResult {
  transactions: Transaction[];
  total: number;
  categories: { [key: string]: number };
  timeframe: string;
  startDate: string;
  endDate: string;
  count: number;
}

interface QueryMetadata {
  type: string;
  subType?: string;
  fieldName?: string;
  timeframe?: string;
}

interface CategoryTotals {
  [category: string]: number;
}

interface BankAccount {
  Account_Number: string;
  Bank_Name: string;
  Account_Type: string;
  Joint_Holder_Names?: string[];
  Current_Balance?: number;
  Available_Balance?: number;
  Currency?: string;
  Branch_Name?: string;
  IFSC_Code?: string;
  Account_Status?: string;
  Last_Transaction_Date?: string;
  Associated_Products?: string[];
}

interface SupportTicket {
  Ticket_ID: string;
  Issue: string;
  Status: string;
  Priority: string;
  Raised_On: string;
}

interface User {
  Name: string;
  Role: string;
  Status: string;
  TwoFA_Enabled: boolean;
}

interface KYCCompliance {
  Compliance_Status: string;
  Last_Audit_Date: string;
  Documents_Required: string[];
  Documents_Submitted: string[];
}

interface AccountData {
  account: string;
  bank: string;
  type: string;
  joint_holders?: string[];
  balance?: number;
  available?: number;
  currency?: string;
  branch?: string;
  ifsc?: string;
  status?: string;
  lastTransaction?: string;
  features?: string[];
}

interface QueryPattern {
  keywords: string[];
  subTypes?: {
    [key: string]: string[];
  };
  timeframes?: {
    [key: string]: string[];
  };
}

interface QueryPatterns {
  [key: string]: QueryPattern;
}

export class NLPQueryService {
  private companyId: string;
  private companyData: any;

  // Define identification document patterns
  private readonly ID_PATTERNS: { [key: string]: string[] } = {
    passport: ['passport', 'passport number', 'passport id'],
    pan: ['pan', 'pan number', 'pan card'],
    aadhaar: ['aadhaar', 'aadhar', 'aadhaar number', 'uid'],
    kyc: ['kyc', 'kyc status', 'verification status']
  };

  // Define data paths for different types of information
  private readonly DATA_PATHS = {
    company: {
      name: ['Personal_Details', 'Company_Name'],
      legal_name: ['Personal_Details', 'Legal_Name'],
      brand_name: ['Personal_Details', 'Brand_Name'],
      type: ['Personal_Details', 'Company_Type']
    },
    identification: {
      passport: ['Personal_KYC_ID', 'Passport_Number'],
      pan: ['Personal_KYC_ID', 'PAN_Number'],
      aadhaar: ['Registration_Tax_IDs', 'Aadhaar_Number'],
      kyc: ['KYC_Compliance', 'KYC_Status']
    },
    personal: {
      name: ['Individual_Details', 'Full_Name'],
      email: ['Individual_Details', 'Email_Address'],
      phone: ['Individual_Details', 'Contact_Number'],
      address: ['Authorized_Signatory', 'Residential_Address']
    },
    banking: {
      accounts: ['Bank_Accounts'],
      loans: ['Loans'],
      transactions: ['transactions']
    },
    account: {
      joint_holders: ['Bank_Accounts', 'Joint_Holder_Names'],
      balance: ['Bank_Accounts', 'Current_Balance'],
      type: ['Bank_Accounts', 'Account_Type'],
      status: ['Bank_Accounts', 'Account_Status'],
      branch: ['Bank_Accounts', 'Branch_Name']
    }
  };

  constructor(companyId: string) {
    this.companyId = companyId;
    console.log('Initializing NLPQueryService with companyId:', companyId);
  }

  private async fetchCompanyData(): Promise<void> {
    console.log('Fetching company data from path:', `companies/${this.companyId}`);
    try {
      if (!this.companyData && db) {
        const companyRef = doc(db, 'companies', this.companyId);
        const companyDoc = await getDoc(companyRef);
        
        if (!companyDoc.exists()) {
          console.error('Company document not found:', this.companyId);
          throw new Error('Company data not found');
        }

        this.companyData = companyDoc.data();
        console.log('Successfully fetched company data:', {
          id: this.companyId,
          dataKeys: Object.keys(this.companyData)
        });
      }
    } catch (error) {
      console.error('Error fetching company data:', error);
      throw error;
    }
  }

  private async processTransactionQuery(timeframe: string = 'all', category?: string): Promise<QueryResult> {
    console.log('Processing transaction query:', {
      timeframe,
      category,
      hasTransactions: !!this.companyData?.transactions,
      transactionCount: this.companyData?.transactions?.length || 0
    });

    const transactions = (this.companyData.transactions || []) as Transaction[];
    if (transactions.length === 0) {
      return {
        hasData: false,
        context: 'No transactions found.',
        data: null
      };
    }

    // Get current date for relative time calculations
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date = now;
    let timeframeDescription: string = '';

    // Determine time range
    switch (timeframe.toLowerCase()) {
      case '1 year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        timeframeDescription = 'the last year';
        break;
      case '3 months':
      case 'three months':
      case 'last 3 months':
      case 'last three months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        timeframeDescription = 'the last three months';
        break;
      case 'last month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
        timeframeDescription = 'last month';
        break;
      case 'this month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        timeframeDescription = 'this month';
        break;
      case 'last week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        timeframeDescription = 'the last 7 days';
        break;
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        timeframeDescription = 'today';
        break;
      default:
        // Default to last 30 days if no specific timeframe
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        timeframeDescription = 'the last 30 days';
    }

    // Filter transactions by date and category
    let filteredTransactions = transactions.filter((t: Transaction) => {
      const transactionDate = new Date(t.date);
      // Ensure the transaction date is not in the future
      if (transactionDate > now) {
        return false;
      }
      const dateMatches = startDate ? (transactionDate >= startDate && transactionDate <= endDate) : true;
      const categoryMatches = category ? 
        t.category.toLowerCase().includes(category.toLowerCase()) : true;
      return dateMatches && categoryMatches;
    });

    // Sort transactions by date (most recent first)
    filteredTransactions = filteredTransactions.sort((a: Transaction, b: Transaction) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Calculate total amount
    const total = filteredTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);

    // Group transactions by category
    const categories = filteredTransactions.reduce((acc: { [key: string]: number }, t: Transaction) => {
      const cat = t.category;
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += t.amount;
      return acc;
    }, {});

    const result: TransactionResult = {
      transactions: filteredTransactions,
      total,
      categories,
      timeframe: timeframeDescription,
      startDate: startDate?.toISOString() || '',
      endDate: endDate.toISOString(),
      count: filteredTransactions.length
    };

    const metadata: QueryMetadata = {
      type: 'transaction',
      subType: category || 'all',
      timeframe: timeframeDescription
    };

    return {
      hasData: filteredTransactions.length > 0,
      context: 'transaction details',
      data: result,
      metadata
    };
  }

  private identifyQueryType(query: string): { type: string; subType?: string; timeframe?: string; category?: string } {
    const lowerQuery = query.toLowerCase().trim();
    console.log('========== Query Type Identification ==========');
    console.log('Processing query:', lowerQuery);

    // Check for transaction-related queries first
    const transactionKeywords = ['transaction', 'spent', 'payment', 'transfer', 'expense', 'recent'];
    const hasTransactionKeywords = transactionKeywords.some(keyword => lowerQuery.includes(keyword));
    console.log('Transaction keywords found:', hasTransactionKeywords);

    if (hasTransactionKeywords) {
      const result: any = { type: 'transaction' };

      // Check for timeframe
      console.log('Checking timeframe patterns...');
      if (lowerQuery.includes('1 year') || lowerQuery.includes('one year') || lowerQuery.match(/last\s+year/)) {
        result.timeframe = '1 year';
        console.log('Timeframe identified: 1 year');
      } else if (lowerQuery.includes('3 month') || lowerQuery.includes('three month')) {
        result.timeframe = '3 months';
        console.log('Timeframe identified: 3 months');
      } else if (lowerQuery.includes('last month')) {
        result.timeframe = 'last month';
        console.log('Timeframe identified: last month');
      } else if (lowerQuery.includes('this month')) {
        result.timeframe = 'this month';
        console.log('Timeframe identified: this month');
      } else if (lowerQuery.includes('last week')) {
        result.timeframe = 'last week';
        console.log('Timeframe identified: last week');
      } else if (lowerQuery.includes('today')) {
        result.timeframe = 'today';
        console.log('Timeframe identified: today');
      } else if (lowerQuery.includes('recent')) {
        result.timeframe = 'last week';
        console.log('Timeframe identified: recent (defaulting to last week)');
      } else {
        console.log('No specific timeframe found, will use default');
      }

      // Check for categories
      console.log('Checking transaction categories...');
      const categories = ['food', 'travel', 'shopping', 'utilities', 'entertainment', 'groceries'];
      const foundCategory = categories.find(cat => lowerQuery.includes(cat));
      if (foundCategory) {
        result.category = foundCategory;
        console.log('Category identified:', foundCategory);
      }

      console.log('Final query type result:', result);
      return result;
    }

    // Check for KYC queries
    if (lowerQuery.includes('kyc') || lowerQuery.includes('know your customer') || 
        lowerQuery.includes('verification') || lowerQuery.includes('documents')) {
      return { type: 'individual', subType: 'kyc' };
    }

    // Check for name queries
    if (lowerQuery.includes('name') || lowerQuery.includes('who am i')) {
      return { type: 'individual', subType: 'name' };
    }

    // Check for address queries
    if (lowerQuery.includes('address') || lowerQuery.includes('where') || 
        lowerQuery.includes('location') || lowerQuery.includes('residence')) {
      return { type: 'individual', subType: 'address' };
    }

    // Default to general query
    return { type: 'general' };
  }

  private extractDataByPath(paths: string[]): any {
    try {
      let current = this.companyData;
      for (const path of paths) {
        if (!current || !current[path]) {
          console.log('Path not found:', path, 'in current data:', current);
          return null;
        }
        current = current[path];
      }
      return current;
    } catch (error) {
      console.error('Error extracting data by path:', error);
      return null;
    }
  }

  private formatResponse(data: any, type: string, subType?: string): string {
    if (!data) return "I couldn't find the requested information.";

    switch (type) {
      case 'working_capital':
        const wcf = data.Working_Capital_Facility;
        if (!wcf) return "Working capital facility information is not available.";
        
        return `Working Capital Facility Details:
- Sanctioned Limit: ₹${wcf.Sanctioned_Limit.toLocaleString('en-IN')}
- Utilized Limit: ₹${wcf.Utilized_Limit.toLocaleString('en-IN')}
- Available Limit: ₹${wcf.Available_Limit.toLocaleString('en-IN')}
- Facility Status: ${wcf.WC_Facility_Status}
- Last Review: ${wcf.Last_Review_Date}
- Next Review Due: ${wcf.Next_Review_Due}`;

      case 'company_info':
        const pd = data.Personal_Details;
        if (!pd) return "Company information is not available.";
        
        return `Company Information:
- Name: ${pd.Company_Name}
- Legal Name: ${pd.Legal_Name}
- Type: ${pd.Company_Type}
- Industry: ${pd.Industry_Sector}
- Sub-sector: ${pd.Sub_sector}
- Incorporation Date: ${pd.Date_of_Incorporation}
- Operating Countries: ${pd.Country_of_Operation.join(', ')}`;

      case 'individual':
        const id = data.Individual_Details;
        const as = data.Authorized_Signatory;
        if (!id && !as) return "Individual information is not available.";
        
        let response = 'Individual Details:\n';
        if (id) {
          response += `- Name: ${id.Full_Name}\n`;
          response += `- User ID: ${id.User_ID}\n`;
        }
        if (as) {
          response += `- Designation: ${as.Designation}\n`;
          response += `- Authority Level: ${as.Signing_Authority_Limit}\n`;
          response += `- KYC Status: ${as.KYC_Status}\n`;
        }
        return response;

      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private formatIdentificationResponse(data: any, type: string): string {
    if (!data) {
      return `I couldn't find the ${type} information in the records.`;
    }

    switch (type) {
      case 'passport':
        return `Your passport number is: ****${data.slice(-4)}`;
      case 'pan':
        return `Your PAN number is: ****${data.slice(-4)}`;
      case 'aadhaar':
        return `Your Aadhaar number is: ****${data.slice(-4)}`;
      case 'kyc':
        return `Your KYC status is: ${data}`;
      default:
        return `The requested information is: ${data}`;
    }
  }

  private getTransactionsByTimeframe(transactions: Transaction[], timeframe: string, category?: string): Transaction[] {
    const now = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case 'last month':
        startDate.setMonth(now.getMonth() - 1, 1);
        now.setMonth(now.getMonth(), 0); // Last day of previous month
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
      default:
        return transactions;
    }

    let filtered = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startDate && txDate <= now;
    });

    // Apply category filter if specified
    if (category) {
      filtered = filtered.filter(t => 
        t.category.toLowerCase().includes(category.toLowerCase()) ||
        t.remarks?.toLowerCase().includes(category.toLowerCase())
      );
    }

    return filtered;
  }

  private formatTransactionResponse(transactions: Transaction[], timeframe: string, category?: string): string {
    if (!transactions || transactions.length === 0) {
      return `No ${category ? category + ' ' : ''}transactions found for ${timeframe}.`;
    }

    // Calculate total amount and categorize transactions
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const categories: { [key: string]: number } = {};
    transactions.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });

    // Format response
    let response = `For ${timeframe}, I found ${transactions.length} ${category ? category + ' ' : ''}transactions totaling ${formatCurrency(total)}.\n\n`;
    
    if (category) {
      response += `Details of ${category} transactions:\n`;
      transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .forEach(t => {
          response += `- ${formatDate(t.date)}: ${formatCurrency(t.amount)} at ${t.merchant}\n`;
          if (t.remarks) {
            response += `  ${t.remarks}\n`;
          }
        });
    } else {
      response += 'Breakdown by category:\n';
      Object.entries(categories)
        .sort(([, a], [, b]) => b - a)
        .forEach(([category, amount]) => {
          const categoryTransactions = transactions.filter(t => t.category === category);
          const latestTransaction = categoryTransactions.reduce((latest, current) => 
            new Date(current.date) > new Date(latest.date) ? current : latest
          );
          response += `${category}: ${formatCurrency(amount)}\n`;
          response += `  Latest: ${formatDate(latestTransaction.date)} - ${latestTransaction.merchant}\n`;
        });
    }

    return response;
  }

  private async processAccountQuery(subType: string): Promise<QueryResult> {
    console.log('Processing account query:', {
      subType,
      hasAccounts: !!this.companyData?.Bank_Accounts,
      accountCount: this.companyData?.Bank_Accounts?.length || 0
    });

    const accounts = this.companyData.Bank_Accounts || [];
    if (accounts.length === 0) {
      return {
        hasData: false,
        context: 'No bank accounts found.',
        data: null
      };
    }

    let response = '';
    let data = null;

    switch (subType) {
      case 'joint_holders':
        data = accounts.map((acc: BankAccount): AccountData => ({
          account: acc.Account_Number,
          bank: acc.Bank_Name,
          type: acc.Account_Type,
          joint_holders: acc.Joint_Holder_Names || []
        }));

        console.log('Joint holder data:', {
          accountCount: data.length,
          hasJointHolders: data.some((acc: AccountData) => Array.isArray(acc.joint_holders) && acc.joint_holders.length > 0)
        });

        response = data
          .map((acc: AccountData) => `${acc.bank} ${acc.type} Account ${acc.account}:\n` +
            (acc.joint_holders && acc.joint_holders.length > 0 
              ? `Joint holders: ${acc.joint_holders.join(', ')}`
              : 'No joint holders'))
          .join('\n\n');

        return {
          hasData: true,
          context: response,
          data: data
        };

      case 'balance':
        data = accounts.map((acc: any) => ({
          account: acc.Account_Number,
          bank: acc.Bank_Name,
          balance: acc.Current_Balance,
          available: acc.Available_Balance,
          type: acc.Account_Type,
          currency: acc.Currency
        }));
        response = data.map((acc: any) => 
          `${acc.bank} ${acc.type} Account ${acc.account}:\n` +
          `- Current balance: ${formatCurrency(acc.balance)}\n` +
          `- Available balance: ${formatCurrency(acc.available)}\n` +
          `- Currency: ${acc.currency}`
        ).join('\n\n');
        break;

      case 'type':
        data = accounts.map((acc: any) => ({
          account: acc.Account_Number,
          bank: acc.Bank_Name,
          type: acc.Account_Type,
          features: acc.Associated_Products || []
        }));
        response = data.map((acc: any) => 
          `${acc.bank} Account ${acc.account} is a ${acc.type} account\n` +
          (acc.features.length > 0 ? `Features: ${acc.features.join(', ')}` : '')
        ).join('\n\n');
        break;

      case 'status':
        data = accounts.map((acc: any) => ({
          account: acc.Account_Number,
          bank: acc.Bank_Name,
          status: acc.Account_Status,
          lastTransaction: acc.Last_Transaction_Date
        }));
        response = data.map((acc: any) => 
          `${acc.bank} Account ${acc.account}:\n` +
          `- Status: ${acc.status}\n` +
          `- Last transaction: ${formatDate(acc.lastTransaction)}`
        ).join('\n\n');
        break;

      case 'branch':
        data = accounts.map((acc: any) => ({
          account: acc.Account_Number,
          bank: acc.Bank_Name,
          branch: acc.Branch_Name,
          ifsc: acc.IFSC_Code
        }));
        response = data.map((acc: any) => 
          `${acc.bank} Account ${acc.account}:\n` +
          `- Branch: ${acc.branch}\n` +
          `- IFSC Code: ${acc.ifsc}`
        ).join('\n\n');
        break;

      default:
        return {
          hasData: false,
          context: "I couldn't find specific account information. Please try asking in a different way.",
          data: null
        };
    }

            return {
              hasData: true,
      context: response,
              data: data
            };
          }

  private async processCompanyQuery(subType: string): Promise<QueryResult> {
    console.log('Processing company query:', {
      subType,
      availableFields: Object.keys(this.companyData || {}),
      companyName: this.companyData?.Company_Name || this.companyData?.name
    });

    let companyInfo;
    switch (subType) {
      case 'name':
        // Try different possible fields for company name
        companyInfo = this.companyData.Company_Name || 
                     this.companyData.name ||
                     this.companyData.Legal_Name ||
                     this.companyData.Brand_Name;
        
        if (companyInfo) {
          console.log('Found company name:', companyInfo);
          return {
            hasData: true,
            context: `Your company name is: ${companyInfo}`,
            data: { name: companyInfo }
          };
        }
        break;

      case 'legal_name':
        companyInfo = this.companyData.Legal_Name || this.companyData.Company_Name;
        if (companyInfo) {
          return {
            hasData: true,
            context: `Your company's legal name is: ${companyInfo}`,
            data: { legal_name: companyInfo }
          };
        }
        break;

      case 'brand_name':
        companyInfo = this.companyData.Brand_Name || this.companyData.name;
        if (companyInfo) {
          return {
            hasData: true,
            context: `Your company's brand name is: ${companyInfo}`,
            data: { brand_name: companyInfo }
          };
        }
        break;

      case 'type':
        companyInfo = this.companyData.Company_Type;
        if (companyInfo) {
          return {
            hasData: true,
            context: `Your company type is: ${companyInfo}`,
            data: { type: companyInfo }
          };
        }
        break;
    }

    // If we couldn't find the specific information
    console.log('Company information not found:', {
      subType,
      availableFields: Object.keys(this.companyData || {}),
      dataPreview: JSON.stringify(this.companyData).substring(0, 100) + '...'
    });
      return {
        hasData: false,
      context: `I couldn't find the requested company information. Please check if the information is available in your company profile.`,
        data: null
      };
  }

  private validateCompanyData(): boolean {
    if (!this.companyData) {
      console.error('No company data available');
      return false;
    }

    // Log available fields
    console.log('Available company data fields:', {
      fields: Object.keys(this.companyData),
      hasIndividualDetails: !!this.companyData.Individual_Details,
      individualDetailsKeys: this.companyData.Individual_Details ? Object.keys(this.companyData.Individual_Details) : [],
      hasPersonalDetails: !!this.companyData.Personal_Details,
      dataPreview: JSON.stringify(this.companyData).substring(0, 200)
    });

    return true;
  }

  private calculateTransactionTotals(transactions: Transaction[]): { [key: string]: number } {
    return transactions.reduce((acc: Record<string, number>, transaction: Transaction) => {
      const category = transaction.category || 'uncategorized';
      acc[category] = (acc[category] || 0) + transaction.amount;
      return acc;
    }, {} as Record<string, number>);
  }

  async processQuery(query: string): Promise<QueryResult> {
    try {
      console.log('Processing query:', query);
      
      // Validate company data
      if (!this.validateCompanyData()) {
        console.error('Invalid or missing company data');
        return { hasData: false, context: 'Company data is not available', data: null };
      }

      // Identify query type and extract relevant information
      const queryInfo = this.identifyQueryType(query.toLowerCase());
      const { type = 'unknown', subType = '', timeframe = '', category = '' } = queryInfo;
      console.log('Query analysis:', { type, subType, timeframe, category });

      let result: QueryResult;

      // Process based on query type
      switch (type) {
        case 'individual':
          if (subType === 'kyc') {
            console.log('Processing KYC query, available data:', {
              kycCompliance: this.companyData.KYC_Compliance,
              personalKYC: this.companyData.Personal_KYC_ID,
              kycStatus: this.companyData.KYC_Compliance?.KYC_Status,
              kycDocs: this.companyData.Personal_KYC_ID?.KYC_Documents_Submitted
            });

            const kycStatus = this.companyData.KYC_Compliance?.KYC_Status;
            const kycDocs = this.companyData.Personal_KYC_ID?.KYC_Documents_Submitted || [];
            const fatcaStatus = this.companyData.KYC_Compliance?.FATCA_Status;
            const crsDeclaration = this.companyData.KYC_Compliance?.CRS_Declaration;

            result = {
              hasData: !!kycStatus,
              context: 'KYC status information',
              data: {
                status: kycStatus,
                documents: kycDocs,
                fatca: fatcaStatus,
                crs: crsDeclaration
              },
              metadata: { 
                type: 'personal', 
                subType: 'kyc',
                fieldName: 'KYC_Status'
              }
            };

            console.log('KYC query result:', result);
            break;
          }
          switch (subType) {
            case 'name':
              const fullName = this.companyData.Individual_Details?.Full_Name;
              result = {
                hasData: !!fullName,
                context: 'individual name',
                data: fullName,
                metadata: { type: 'personal', subType: 'name' }
              };
              break;
            case 'contact':
              const contactInfo = {
                email: this.companyData.Individual_Details?.Email_Address,
                phone: this.companyData.Individual_Details?.Contact_Number,
                address: this.companyData.Authorized_Signatory?.Residential_Address
              };
              result = {
                hasData: !!(contactInfo.email || contactInfo.phone || contactInfo.address),
                context: 'contact information',
                data: contactInfo,
                metadata: { type: 'personal', subType: 'contact' }
              };
              break;
            default:
              const individualDetails = {
                ...this.companyData.Individual_Details,
                address: this.companyData.Authorized_Signatory?.Residential_Address
              };
              result = {
                hasData: !!individualDetails,
                context: 'individual details',
                data: individualDetails,
                metadata: { type: 'personal', subType: 'details' }
              };
          }
          break;

        case 'address':
          const address = this.extractDataByPath(['Authorized_Signatory', 'Residential_Address']);
          console.log('Found address:', address);
          result = {
            hasData: !!address,
            context: 'residential address',
            data: address,
            metadata: { type: 'personal', subType: 'address', fieldName: 'Residential_Address' }
          };
          break;

        case 'company':
          result = await this.processCompanyQuery(subType);
          break;

        case 'account':
          result = await this.processAccountQuery(subType);
          break;

        case 'transaction':
          result = await this.processTransactionQuery(timeframe, category);
          break;

        default:
          console.log('Unhandled query type:', type);
          result = { hasData: false, context: 'Unknown query type', data: null };
      }

      console.log('Query result:', result);
      return result;
    } catch (error) {
      console.error('Error processing query:', error);
      return { hasData: false, context: 'Error processing query', data: null };
    }
  }

  setCompanyData(data: any): void {
    console.log('Setting company data:', {
      fullData: data,
      hasIndividualDetails: !!data.Individual_Details,
      individualDetails: data.Individual_Details,
      hasPersonalDetails: !!data.Personal_Details,
      personalDetails: data.Personal_Details,
      dataKeys: Object.keys(data)
    });
    this.companyData = data;
  }

  private formatAccountResponse(accounts: BankAccount[]): string {
    return accounts.map((acc: BankAccount) => {
      return `Account ${acc.Account_Number}:
- Bank: ${acc.Bank_Name}
- Type: ${acc.Account_Type}
- Balance: ${acc.Current_Balance}
- Status: ${acc.Account_Status}`;
    }).join('\n\n');
  }
} 