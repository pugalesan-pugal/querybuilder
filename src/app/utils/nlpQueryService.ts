import { db } from './initFirebase';
import { collection, query, where, getDocs, DocumentData, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { formatCurrency, formatDate } from './formatUtils';
import { OllamaService } from './ollamaService';

interface QueryIntent {
  type: 'company_info' | 'npn_report' | 'financial_data' | 'working_capital' | 'loan' | 'payment_methods' | 
        'treasury_services' | 'trade_finance' | 'credit_reports' | 'account_types' | 'transactions' | 
        'authorized_signatory' | 'bank_accounts' | 'communication' | 'custom_pricing' | 'support_tickets' | 
        'surveys' | 'digital_access' | 'kyc_compliance' | 'individual_details' | 'regulatory_audit' | 
        'trade_finance_details' | 'personal_details' | 'registration_details' | 'general' | 'loans_info' |
        'working_capital_facility' | 'bank_guarantees' | 'letters_of_credit' | 'invoice_financing' |
        'documentary_collections' | 'trade_limits' | 'trade_transaction_history' | 'suspicious_transactions' |
        'watchlist_status' | 'regulatory_compliance' | 'audit_logs' | 'data_consent' | 'aadhaar_number';
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

interface Transaction {
  date: string;
  amount: number;
  category: string;
  merchant: string;
  status: string;
  remarks?: string | null;
  transaction_id?: string;
  card_number?: string;
  currency?: string;
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

interface BankAccount {
  Account_Number: string;
  Bank_Name: string;
  Account_Type: string;
  Joint_Holder_Names?: string[];
  Primary_Holder_Name?: string;
  Operation_Mode?: string;
  Current_Balance?: number;
  Available_Balance?: number;
  Currency?: string;
  Branch_Name?: string;
  IFSC_Code?: string;
  Account_Status?: string;
  Last_Transaction_Date?: string;
  Associated_Products?: string[];
  Nominee_Info?: {
    Name: string;
    Relationship: string;
  };
  Account_Opening_Date?: string;
  Interest_Rate?: number;
  Minimum_Balance_Requirement?: number;
  Statement_Frequency?: string;
  Statement_Delivery_Preference?: string;
  Auto_Sweep_Enabled?: boolean;
  Overdraft_Limit?: number;
  Lien_Amount?: number;
  Parent_Grouping?: string;
}

export class NLPQueryService {
  private companyId: string;
  private companyData: any;

  constructor(companyId: string) {
    this.companyId = companyId;
    console.log('Initializing NLPQueryService with companyId:', companyId);
  }

  private async fetchCompanyData(): Promise<void> {
    console.log('\n========== Fetching Company Data ==========');
    console.log('Checking Firebase connection state...');
    
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized');
        throw new Error('Firebase Firestore not initialized');
      }

      // Verify Firestore connection
      try {
        console.log('Verifying Firestore connection...');
        const testDoc = doc(db, '_health_check', 'connection_test');
        await getDoc(testDoc);
        console.log('Firestore connection verified');
      } catch (connError) {
        console.error('Firestore connection verification failed:', connError);
        throw new Error('Firestore connection verification failed');
      }

      console.log('Fetching company data from path:', `companies/${this.companyId}`);
      const companyRef = doc(db, 'companies', this.companyId);
      
      let retries = 3;
      let companyDoc;
      
      while (retries > 0) {
        try {
          companyDoc = await getDoc(companyRef);
          break;
        } catch (fetchError) {
          console.error(`Error fetching company data (${retries} retries left):`, fetchError);
          retries--;
          if (retries === 0) throw fetchError;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!companyDoc?.exists()) {
        console.error('Company document not found:', {
          companyId: this.companyId,
          path: companyRef.path,
          exists: companyDoc?.exists()
        });
        throw new Error('Company data not found');
      }

      this.companyData = companyDoc.data();
      
      if (!this.companyData) {
        console.error('Company document exists but has no data');
        throw new Error('Company data is empty');
      }

      console.log('Company data fetched successfully:', {
        dataExists: !!this.companyData,
        fields: Object.keys(this.companyData || {}),
        hasTransactions: !!this.companyData?.transactions,
        transactionCount: this.companyData?.transactions?.length || 0,
        hasBankAccounts: !!this.companyData?.Bank_Accounts,
        accountCount: this.companyData?.Bank_Accounts?.length || 0,
        hasLoans: !!this.companyData?.Loans,
        loanCount: this.companyData?.Loans?.length || 0,
        hasWorkingCapital: !!this.companyData?.Working_Capital_Facility,
        hasAuthorizedSignatory: !!this.companyData?.Authorized_Signatory
      });
      
    } catch (error) {
      console.error('Error fetching company data:', error);
      throw error;
    }
  }

  private isValidTransaction(transaction: any): boolean {
    // Check if this is a valid transaction object
    if (!transaction || typeof transaction !== 'object') {
      console.log('Invalid transaction: not an object');
      return false;
    }

    // Check for synthetic/fake transaction indicators
    if (
      transaction.category === "As there are no transactions" ||
      transaction.merchant === "Unknown Merchant" ||
      transaction.amount === 0 ||
      !transaction.date ||
      !transaction.amount ||
      !transaction.category ||
      !transaction.merchant
    ) {
      console.log('Invalid transaction detected:', transaction);
      return false;
    }

    // Validate amount is a positive number
    if (typeof transaction.amount !== 'number' || transaction.amount <= 0) {
      console.log('Invalid transaction amount:', transaction.amount);
      return false;
    }

    // Validate date format
    try {
      const date = new Date(transaction.date);
      if (isNaN(date.getTime())) {
        console.log('Invalid transaction date:', transaction.date);
        return false;
      }
    } catch (error) {
      console.log('Error parsing transaction date:', transaction.date, error);
      return false;
    }

    return true;
  }

  private async processTransactionQuery(timeframe: string | null = 'all', category?: string): Promise<QueryResult> {
    console.log('Processing transaction query:', {
      timeframe,
      category,
      hasTransactions: !!this.companyData?.transactions,
      transactionCount: this.companyData?.transactions?.length || 0
    });

    // Handle null, undefined, or empty timeframe
    if (!timeframe || timeframe.trim() === '') {
      timeframe = 'all';
      console.log('Empty timeframe detected, defaulting to "all"');
    }

    const rawTransactions = this.companyData.transactions || [];
    
    // Filter out invalid/synthetic transactions
    const validTransactions = rawTransactions.filter(this.isValidTransaction);
    
    console.log('Transaction validation:', {
      rawCount: rawTransactions.length,
      validCount: validTransactions.length,
      invalidTransactions: rawTransactions.filter((t: any) => !this.isValidTransaction(t))
    });

    if (validTransactions.length === 0) {
      return {
        hasData: false,
        context: 'No valid transactions found.',
        data: {
          transactions: [],
          total: 0,
          categories: {},
          timeframe: timeframe === 'all' ? 'all time' : timeframe,
          startDate: 'N/A',
          endDate: 'N/A',
          count: 0
        }
      };
    }

    // Get current date for relative time calculations
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let startDate: Date | null = null;
    let endDate: Date = now;
    let timeframeDescription: string = '';

    console.log('Current date for calculations:', now.toISOString());

    // Determine time range
    const normalizedTimeframe = timeframe.toLowerCase().trim().replace(/^last\s+/, '');
    console.log('Processing timeframe:', {
      original: timeframe,
      normalized: normalizedTimeframe,
      currentTime: now.toISOString()
    });
    
    switch (normalizedTimeframe) {
      case 'all':
        startDate = null;
        timeframeDescription = 'all time';
        break;
      case '1 month':
      case 'one month':
      case 'last 1 month':
      case 'last one month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        timeframeDescription = 'the last month';
        console.log('Setting timeframe for last month:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          timeframeDescription
        });
        break;
      case '1 year':
      case 'one year':
      case 'last 1 year':
      case 'last one year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        timeframeDescription = 'the last year';
        break;
      case '3 months':
      case 'three months':
      case 'last 3 months':
      case 'last three months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        timeframeDescription = 'the last three months';
        break;
      case 'last month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        timeframeDescription = 'last month';
        break;
      case 'this month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        timeframeDescription = 'this month';
        break;
      case 'last week':
      case '1 week':
      case 'one week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        timeframeDescription = 'the last week';
        break;
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        timeframeDescription = 'today';
        break;
      default:
        // Handle numeric patterns like "2 months", "30 days", etc.
        const numericMatch = normalizedTimeframe.match(/^(\d+)\s+(day|days|week|weeks|month|months|year|years)$/);
        if (numericMatch) {
          const [, amount, unit] = numericMatch;
          const timeAmount = parseInt(amount, 10);
          
          if (unit.startsWith('month')) {
            startDate = new Date(now.getTime() - (timeAmount * 30 * 24 * 60 * 60 * 1000));
            timeframeDescription = `the last ${timeAmount} month${timeAmount > 1 ? 's' : ''}`;
          } else if (unit.startsWith('week')) {
            startDate = new Date(now.getTime() - (timeAmount * 7 * 24 * 60 * 60 * 1000));
            timeframeDescription = `the last ${timeAmount} week${timeAmount > 1 ? 's' : ''}`;
          } else if (unit.startsWith('day')) {
            startDate = new Date(now.getTime() - (timeAmount * 24 * 60 * 60 * 1000));
            timeframeDescription = `the last ${timeAmount} day${timeAmount > 1 ? 's' : ''}`;
          } else if (unit.startsWith('year')) {
            startDate = new Date(now.getFullYear() - timeAmount, now.getMonth(), now.getDate());
            timeframeDescription = `the last ${timeAmount} year${timeAmount > 1 ? 's' : ''}`;
          }
          console.log('Handled numeric timeframe:', {
            amount: timeAmount,
            unit,
            startDate: startDate?.toISOString(),
            timeframeDescription
          });
        } else {
          // Default to last 30 days if no specific timeframe
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          timeframeDescription = 'the last 30 days';
          console.log('No recognized timeframe, defaulting to last 30 days');
        }
    }

    // Filter transactions by date and category
    console.log('Filtering transactions with criteria:', {
      startDate: startDate?.toISOString(),
      endDate: endDate.toISOString(),
      category,
      totalTransactions: validTransactions.length
    });

    let filteredTransactions = validTransactions.filter((t: Transaction) => {
      let transactionDate: Date;
      try {
        if (typeof t.date === 'string') {
          if (t.date.includes('/')) {
            // Handle dd/mm/yyyy format
            const [day, month, year] = t.date.split('/').map(Number);
            transactionDate = new Date(year, month - 1, day);
          } else if (t.date.includes('-')) {
            // Handle yyyy-mm-dd format
            transactionDate = new Date(t.date);
          } else {
            transactionDate = new Date(t.date);
          }
        } else {
          transactionDate = new Date(t.date);
        }

        if (isNaN(transactionDate.getTime())) {
          console.log('Invalid date:', t.date);
          return false;
        }
      } catch (error) {
        console.log('Error parsing date:', t.date, error);
        return false;
      }

      // Skip future transactions
      if (transactionDate > now) {
        console.log('Skipping future transaction:', t.date);
        return false;
      }

      // Apply date filter
      const dateMatches = startDate ? (transactionDate >= startDate && transactionDate <= endDate) : true;
      
      // Apply category filter
      const categoryMatches = category ? 
        t.category.toLowerCase().includes(category.toLowerCase()) : true;
      
      return dateMatches && categoryMatches;
    });

    console.log('Transaction filtering results:', {
      originalCount: validTransactions.length,
      filteredCount: filteredTransactions.length,
      dateRange: startDate ? `${startDate.toISOString()} to ${endDate.toISOString()}` : 'all time'
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
      startDate: startDate?.toISOString() || 'all time',
      endDate: endDate.toISOString(),
      count: filteredTransactions.length
    };

    // Format response message
    const categoryBreakdown = Object.entries(categories)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([cat, amount]) => `${cat}: ${formatCurrency(amount as number)}`)
      .join(', ');

    const context = filteredTransactions.length > 0 
      ? `Found ${filteredTransactions.length} transactions for ${timeframeDescription} totaling ${formatCurrency(total)}. Top categories: ${categoryBreakdown}`
      : `No transactions found for ${timeframeDescription}`;

    console.log('Query result:', {
      hasValidTransactions: validTransactions.length > 0,
      totalValidTransactions: validTransactions.length,
      filteredCount: filteredTransactions.length,
      timeframe,
      timeframeDescription,
      startDate: startDate?.toISOString(),
      endDate: endDate.toISOString(),
      total
    });

    return {
      hasData: filteredTransactions.length > 0,
      context,
      data: result,
      metadata: {
        type: 'transaction',
        subType: category || 'all',
        fieldName: timeframeDescription
      }
    };
  }

  private async identifyQueryType(query: string): Promise<{ type: string; subType?: string; timeframe?: string; category?: string }> {
    const lowerQuery = query.toLowerCase().trim();
    console.log('\n========== Query Type Identification ==========');
    console.log('Processing query:', lowerQuery);

    // First try using Ollama/Mistral for intent classification
    try {
      console.log('\n----- Attempting Mistral Analysis -----');
      const ollamaService = new OllamaService();
      const intentAnalysis = await ollamaService.analyzeIntent(lowerQuery);

      if (intentAnalysis && intentAnalysis.type) {
        console.log('\nMistral Analysis Results:', JSON.stringify(intentAnalysis, null, 2));
        
        return {
          type: intentAnalysis.type,
          subType: intentAnalysis.subType,
          timeframe: intentAnalysis.timeframe,
          category: intentAnalysis.accountType
        };
      }
    } catch (error) {
      console.log('\n----- Mistral Analysis Failed -----');
      console.log('Error:', error);
      console.log('Falling back to keyword matching');
    }

    // Enhanced keyword patterns for better recognition
    const patterns = {
      // Personal identification
      aadhaar_number: ['aadhaar', 'aadhar', 'aadhaar number', 'aadhar number', 'my aadhaar', 'my aadhar'],
      
      // Working capital specific
      working_capital: ['working capital', 'wc facility', 'working capital facility', 'my working capital', 'wc details', 'working capital details'],
      
      // Loan specific
      loan: ['loan', 'loan details', 'my loan', 'emi', 'interest rate', 'tenure', 'outstanding', 'principal', 'disbursement', 'prepayment', 'loan status', 'term loan'],
      
      // Joint holder specific
      joint_holder: ['joint holder', 'joint holders', 'jo', 'joint', 'my joint holder', 'give my joint holder'],
      
      // Transaction related
      transactions: ['transaction', 'spent', 'payment', 'transfer', 'expense', 'recent', 'spending', 'paid', 'received', 'purchase', 'bought', 'spend', 'money', 'cost'],
      
      // Account related
      account: ['account', 'balance', 'account details', 'bank details', 'account type', 'statement', 'primary holder', 'account holder', 'current account', 'savings account'],
      
      // Trade Finance
      trade_finance: ['trade', 'letter of credit', 'lc', 'bank guarantee', 'bg', 'export', 'import', 'invoice financing', 'documentary collection', 'trade finance'],
      
      // KYC and Compliance
      kyc: ['kyc', 'know your customer', 'document', 'verification', 'identity', 'pan', 'passport', 'compliance', 'aml', 'fatca', 'crs'],
      
      // Personal/Individual Details
      personal: ['personal details', 'contact', 'address', 'name', 'email', 'phone', 'designation', 'profile', 'individual'],
      
      // Company Details
      company: ['company details', 'business', 'incorporation', 'registration', 'gst', 'company name', 'legal name', 'industry'],
      
      // Credit Reports
      credit: ['credit card', 'credit limit', 'card details', 'credit balance', 'credit score', 'credit report', 'credit rating'],
      
      // Digital Access
      digital_access: ['login', 'access', 'security', '2fa', 'two factor', 'ip whitelist', 'users', 'portal', 'digital'],
      
      // Support and Communication
      support: ['ticket', 'issue', 'complaint', 'help', 'support', 'service request', 'communication', 'relationship manager'],
      
      // Authorized Signatory
      authorized_signatory: ['signatory', 'authorized', 'signing authority', 'signature', 'approval', 'authorization'],
      
      // Regulatory and Audit
      regulatory: ['audit', 'regulatory', 'compliance', 'suspicious', 'watchlist', 'aml flags', 'audit trail'],
      
      // Surveys and Feedback
      surveys: ['survey', 'feedback', 'rating', 'satisfaction', 'review'],
      
      // Custom Pricing
      custom_pricing: ['pricing', 'contract', 'negotiated', 'custom', 'rates', 'tariff']
    };

    // Check for specific patterns first
    if (patterns.aadhaar_number.some(keyword => lowerQuery.includes(keyword))) {
      return { type: 'aadhaar_number' };
    }

    if (patterns.working_capital.some(keyword => lowerQuery.includes(keyword))) {
      return { type: 'working_capital' };
    }

    if (patterns.joint_holder.some(keyword => lowerQuery.includes(keyword))) {
      return { type: 'account', subType: 'joint_holders' };
    }

    if (patterns.loan.some(keyword => lowerQuery.includes(keyword))) {
      let subType = '';
      if (lowerQuery.includes('emi') || lowerQuery.includes('installment')) {
        subType = 'emi_details';
      } else if (lowerQuery.includes('outstanding') || lowerQuery.includes('balance')) {
        subType = 'outstanding';
      } else if (lowerQuery.includes('status')) {
        subType = 'status';
      }
      return { type: 'loan', subType };
    }

    // Check for transaction keywords
    const transactionKeywords = patterns.transactions;
    const hasTransactionKeywords = transactionKeywords.some(keyword => lowerQuery.includes(keyword));
    
    console.log('Transaction keywords found:', hasTransactionKeywords);

    if (hasTransactionKeywords) {
      const result: any = { type: 'transactions' };

      // Enhanced timeframe detection logic
      console.log('Checking timeframe patterns...');
      
      // Check for "last X month/months" pattern
      const lastMonthMatch = lowerQuery.match(/(?:last|past)\s+(\d+)\s+(month|months)/i);
      if (lastMonthMatch) {
        const [, amount] = lastMonthMatch;
        const monthCount = parseInt(amount, 10);
        result.timeframe = monthCount === 1 ? '1 month' : `${monthCount} months`;
        console.log('Found month pattern:', result.timeframe);
      }
      // Check for other timeframe patterns
      else if (lowerQuery.match(/(?:last|past)\s+(\d+)\s+(week|weeks)/i)) {
        const weekMatch = lowerQuery.match(/(?:last|past)\s+(\d+)\s+(week|weeks)/i);
        const [, amount] = weekMatch!;
        const weekCount = parseInt(amount, 10);
        result.timeframe = weekCount === 1 ? '1 week' : `${weekCount} weeks`;
        console.log('Found week pattern:', result.timeframe);
      }
      else if (lowerQuery.match(/(?:last|past)\s+(\d+)\s+(day|days)/i)) {
        const dayMatch = lowerQuery.match(/(?:last|past)\s+(\d+)\s+(day|days)/i);
        const [, amount] = dayMatch!;
        const dayCount = parseInt(amount, 10);
        result.timeframe = dayCount === 1 ? '1 day' : `${dayCount} days`;
        console.log('Found day pattern:', result.timeframe);
      }
      else if (lowerQuery.match(/(?:last|past)\s+(\d+)\s+(year|years)/i)) {
        const yearMatch = lowerQuery.match(/(?:last|past)\s+(\d+)\s+(year|years)/i);
        const [, amount] = yearMatch!;
        const yearCount = parseInt(amount, 10);
        result.timeframe = yearCount === 1 ? '1 year' : `${yearCount} years`;
        console.log('Found year pattern:', result.timeframe);
      }
      // Check for specific timeframe keywords
      else if (lowerQuery.includes('1 year') || lowerQuery.includes('one year') || lowerQuery.match(/last\s+year/)) {
        result.timeframe = '1 year';
        console.log('Found "1 year" timeframe');
      } else if (lowerQuery.includes('3 month') || lowerQuery.includes('three month')) {
        result.timeframe = '3 months';
        console.log('Found "3 months" timeframe');
      } else if (lowerQuery.includes('1 month') || lowerQuery.includes('one month')) {
        result.timeframe = '1 month';
        console.log('Found "1 month" timeframe');
      } else if (lowerQuery.includes('last month')) {
        result.timeframe = 'last month';
        console.log('Found "last month" timeframe');
      } else if (lowerQuery.includes('this month')) {
        result.timeframe = 'this month';
        console.log('Found "this month" timeframe');
      } else if (lowerQuery.includes('last week')) {
        result.timeframe = 'last week';
        console.log('Found "last week" timeframe');
      } else if (lowerQuery.includes('today')) {
        result.timeframe = 'today';
        console.log('Found "today" timeframe');
      } else if (lowerQuery.includes('recent')) {
        result.timeframe = 'last week';
        console.log('Found "recent" timeframe, defaulting to last week');
      } else {
        console.log('No specific timeframe found, will use default');
      }

      // Category detection
      console.log('Checking transaction categories...');
      const categories = ['food', 'travel', 'shopping', 'utilities', 'entertainment', 'groceries', 'electronics', 'fuel', 'subscriptions', 'clothing', 'beauty', 'sports'];
      const foundCategory = categories.find(cat => lowerQuery.includes(cat));
      if (foundCategory) {
        result.category = foundCategory;
        console.log('Category identified:', foundCategory);
      }

      console.log('Final transaction query result:', result);
      return result;
    }

    // Check for other banking keywords
    for (const [type, keywords] of Object.entries(patterns)) {
      const matchedKeywords = keywords.filter(keyword => lowerQuery.includes(keyword));
      if (matchedKeywords.length > 0) {
        console.log(`✓ Found matches for type '${type}':`, matchedKeywords);
        
        // Determine subtype based on specific keywords
        let subType = '';
        
        switch (type) {
          case 'account':
            if (lowerQuery.match(/\b(jo|joint|joint.*holder|joint.*account)\b/)) 
              subType = 'joint_holders';
            else if (lowerQuery.match(/\b(primary|primary.*holder|who.*holder)\b/)) 
              subType = 'primary_holder';
            else if (lowerQuery.includes('balance')) 
              subType = 'balance';
            else if (lowerQuery.includes('nominee'))
              subType = 'nominee';
            else if (lowerQuery.includes('ifsc') || lowerQuery.includes('branch'))
              subType = 'bank_details';
            break;
            
          case 'company':
            if (lowerQuery.includes('name'))
              subType = 'name';
            else if (lowerQuery.includes('legal'))
              subType = 'legal_name';
            else if (lowerQuery.includes('incorporation'))
              subType = 'incorporation';
            break;
            
          case 'kyc':
            if (lowerQuery.includes('status'))
              subType = 'status';
            else if (lowerQuery.includes('document'))
              subType = 'documents';
            break;
        }
        
        return { type, subType };
      }
    }

    // Default fallback
    console.log('No specific keywords found, defaulting to general type');
    return { type: 'general' };
  }

  private maskAccountNumber(accountNumber: string): string {
    if (!accountNumber) return 'XXXXX';
    const length = accountNumber.length;
    const visibleDigits = 4;
    return 'X'.repeat(length - visibleDigits) + accountNumber.slice(-visibleDigits);
  }

  private async processAadhaarQuery(): Promise<QueryResult> {
    console.log('Processing Aadhaar query');
    
    // Check multiple possible locations for Aadhaar number
    let aadhaarNumber = null;
    
    // Check in Authorized_Signatory
    if (this.companyData.Authorized_Signatory?.Aadhaar_Number) {
      aadhaarNumber = this.companyData.Authorized_Signatory.Aadhaar_Number;
    }
    // Check in Personal_KYC_ID
    else if (this.companyData.Personal_KYC_ID?.Aadhaar_Number) {
      aadhaarNumber = this.companyData.Personal_KYC_ID.Aadhaar_Number;
    }
    // Check in Registration_Tax_IDs
    else if (this.companyData.Registration_Tax_IDs?.Aadhaar_Number) {
      aadhaarNumber = this.companyData.Registration_Tax_IDs.Aadhaar_Number;
    }

    if (aadhaarNumber) {
      const response = `Your Aadhaar number is: ${aadhaarNumber}`;
      return {
        hasData: true,
        context: response,
        data: { aadhaar_number: aadhaarNumber },
        metadata: {
          type: 'aadhaar_number'
        }
      };
    } else {
      return {
        hasData: false,
        context: 'Aadhaar number not found in your records.',
        data: null
      };
    }
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
      case 'primary_holder':
        data = accounts.map((acc: BankAccount) => ({
          account: this.maskAccountNumber(acc.Account_Number),
          bank: acc.Bank_Name,
          type: acc.Account_Type,
          primary_holder: acc.Primary_Holder_Name || '',
          operation_mode: acc.Operation_Mode || 'Not Specified'
        }));

        response = data.length === 0 
          ? 'No bank accounts found.'
          : 'Primary Account Holder Details:\n\n' +
            data.map((acc: any) => {
              let accountInfo = `${acc.bank} ${acc.type} Account ${acc.account}:\n`;
              accountInfo += `Primary Holder: ${acc.primary_holder || 'Not specified'}\n`;
              accountInfo += `Operation Mode: ${acc.operation_mode}`;
              return accountInfo;
            }).join('\n\n');
        break;

      case 'joint_holders':
        data = accounts.map((acc: BankAccount) => ({
          account: this.maskAccountNumber(acc.Account_Number),
          bank: acc.Bank_Name,
          type: acc.Account_Type,
          joint_holders: acc.Joint_Holder_Names || [],
          primary_holder: acc.Primary_Holder_Name || '',
          operation_mode: acc.Operation_Mode || 'Not Specified'
        }));

        response = 'Your Bank Account Joint Holder Details:\n\n';
        
        data.forEach((acc: any) => {
          response += `${acc.bank} ${acc.type} Account ${acc.account}:\n`;
          if (acc.joint_holders && acc.joint_holders.length > 0) {
            response += `Joint Holders: ${acc.joint_holders.join(', ')}\n`;
            response += `Operation Mode: ${acc.operation_mode}\n`;
          } else {
            response += 'No joint holders found for this account\n';
          }
          response += '\n';
        });
        break;

      case 'balance':
        data = accounts.map((acc: BankAccount) => ({
          account: this.maskAccountNumber(acc.Account_Number),
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

      case 'nominee':
        data = accounts.map((acc: BankAccount) => ({
          account: this.maskAccountNumber(acc.Account_Number),
          bank: acc.Bank_Name,
          type: acc.Account_Type,
          nominee: acc.Nominee_Info
        }));
        response = data.map((acc: any) => 
          `${acc.bank} ${acc.type} Account ${acc.account}:\n` +
          (acc.nominee ? 
            `- Nominee: ${acc.nominee.Name}\n- Relationship: ${acc.nominee.Relationship}` :
            '- No nominee information available')
        ).join('\n\n');
        break;

      case 'bank_details':
        data = accounts.map((acc: BankAccount) => ({
          account: this.maskAccountNumber(acc.Account_Number),
          bank: acc.Bank_Name,
          branch: acc.Branch_Name,
          ifsc: acc.IFSC_Code,
          type: acc.Account_Type
        }));
        response = data.map((acc: any) => 
          `${acc.bank} ${acc.type} Account ${acc.account}:\n` +
          `- Branch: ${acc.branch}\n` +
          `- IFSC Code: ${acc.ifsc}`
        ).join('\n\n');
        break;

      default:
        data = accounts.map((acc: BankAccount) => ({
          account: this.maskAccountNumber(acc.Account_Number),
          bank: acc.Bank_Name,
          type: acc.Account_Type,
          status: acc.Account_Status,
          balance: acc.Current_Balance,
          currency: acc.Currency
        }));
        response = data.map((acc: any) => 
          `${acc.bank} ${acc.type} Account ${acc.account}:\n` +
          `- Status: ${acc.status}\n` +
          `- Balance: ${formatCurrency(acc.balance)} ${acc.currency}`
        ).join('\n\n');
    }

    return {
      hasData: true,
      context: response,
      data: data,
      metadata: {
        type: 'account',
        subType: subType
      }
    };
  }

  private async processLoanQuery(subType: string): Promise<QueryResult> {
    console.log('Processing loan query:', {
      subType,
      hasLoans: !!this.companyData?.Loans,
      loanCount: this.companyData?.Loans?.length || 0
    });

    const loans = this.companyData.Loans || [];
    if (loans.length === 0) {
      return {
        hasData: false,
        context: 'No loans found in your records.',
        data: null
      };
    }

    let response = '';
    let data = null;

    switch (subType) {
      case 'emi_details':
        data = loans.map((loan: any) => ({
          loan_id: loan.Loan_ID,
          type: loan.Loan_Type,
          emi_amount: loan.EMI_Amount,
          next_due: loan.Next_Due_Date,
          frequency: loan.Repayment_Frequency
        }));
        response = 'EMI Details:\n\n' + data.map((loan: any) => 
          `${loan.type} (${loan.loan_id}):\n` +
          `- EMI Amount: ${formatCurrency(loan.emi_amount)}\n` +
          `- Next Due Date: ${formatDate(loan.next_due)}\n` +
          `- Frequency: ${loan.frequency}`
        ).join('\n\n');
        break;

      case 'outstanding':
        data = loans.map((loan: any) => ({
          loan_id: loan.Loan_ID,
          type: loan.Loan_Type,
          principal: loan.Outstanding_Principal,
          interest: loan.Outstanding_Interest,
          total: loan.Total_Outstanding_Amount,
          overdue: loan.Overdue_Amount
        }));
        response = 'Outstanding Loan Details:\n\n' + data.map((loan: any) => 
          `${loan.type} (${loan.loan_id}):\n` +
          `- Outstanding Principal: ${formatCurrency(loan.principal)}\n` +
          `- Outstanding Interest: ${formatCurrency(loan.interest)}\n` +
          `- Total Outstanding: ${formatCurrency(loan.total)}\n` +
          `- Overdue Amount: ${formatCurrency(loan.overdue)}`
        ).join('\n\n');
        break;

      case 'status':
        data = loans.map((loan: any) => ({
          loan_id: loan.Loan_ID,
          type: loan.Loan_Type,
          status: loan.Loan_Status,
          sanctioned: loan.Sanctioned_Amount,
          disbursed: loan.Disbursed_Amount,
          purpose: loan.Purpose_of_Loan
        }));
        response = 'Loan Status Details:\n\n' + data.map((loan: any) => 
          `${loan.type} (${loan.loan_id}):\n` +
          `- Status: ${loan.status}\n` +
          `- Purpose: ${loan.purpose}\n` +
          `- Sanctioned: ${formatCurrency(loan.sanctioned)}\n` +
          `- Disbursed: ${formatCurrency(loan.disbursed)}`
        ).join('\n\n');
        break;

      default:
        data = loans.map((loan: any) => ({
          loan_id: loan.Loan_ID,
          type: loan.Loan_Type,
          status: loan.Loan_Status,
          sanctioned: loan.Sanctioned_Amount,
          outstanding: loan.Total_Outstanding_Amount,
          interest_rate: loan.Interest_Rate,
          tenure: loan.Tenure_Months,
          purpose: loan.Purpose_of_Loan,
          emi_amount: loan.EMI_Amount,
          next_due: loan.Next_Due_Date
        }));
        response = 'Your Loan Details:\n\n' + data.map((loan: any) => 
          `${loan.type} (${loan.loan_id}):\n` +
          `- Purpose: ${loan.purpose}\n` +
          `- Status: ${loan.status}\n` +
          `- Sanctioned Amount: ${formatCurrency(loan.sanctioned)}\n` +
          `- Outstanding: ${formatCurrency(loan.outstanding)}\n` +
          `- Interest Rate: ${loan.interest_rate}%\n` +
          `- Tenure: ${loan.tenure} months\n` +
          `- EMI Amount: ${formatCurrency(loan.emi_amount)}\n` +
          `- Next Due Date: ${formatDate(loan.next_due)}`
        ).join('\n\n');
    }

    return {
      hasData: true,
      context: response,
      data: data,
      metadata: {
        type: 'loan',
        subType: subType
      }
    };
  }

  private async processWorkingCapitalQuery(): Promise<QueryResult> {
    console.log('Processing working capital query');
    
    const wcFacility = this.companyData.Working_Capital_Facility;
    if (!wcFacility) {
      return {
        hasData: false,
        context: 'No working capital facility information found in your records.',
        data: null
      };
    }

    const response = 'Your Working Capital Facility Details:\n\n' +
      `Facility ID: ${wcFacility.Facility_ID}\n` +
      `- Status: ${wcFacility.WC_Facility_Status}\n` +
      `- Sanctioned Limit: ${formatCurrency(wcFacility.Sanctioned_Limit)}\n` +
      `- Utilized Limit: ${formatCurrency(wcFacility.Utilized_Limit)}\n` +
      `- Available Limit: ${formatCurrency(wcFacility.Available_Limit)}\n` +
      `- Drawing Power: ${formatCurrency(wcFacility.Drawing_Power)}\n` +
      `- Interest Rate: ${wcFacility.Interest_Rate}%\n` +
      `- Interest Payment: ${wcFacility.Interest_Payment_Frequency}\n` +
      `- Working Capital Type: ${wcFacility.Working_Capital_Type}\n` +
      `- Collateral Type: ${wcFacility.Collateral_Type}\n` +
      `- Collateral Value: ${formatCurrency(wcFacility.Collateral_Value)}\n` +
      `- Next Review Due: ${formatDate(wcFacility.Next_Review_Due)}\n` +
      `- Relationship Manager: ${wcFacility.Banking_Relationship_Manager}`;

    return {
      hasData: true,
      context: response,
      data: wcFacility,
      metadata: {
        type: 'working_capital'
      }
    };
  }

  private async processCompanyQuery(subType: string): Promise<QueryResult> {
    console.log('Processing company query:', {
      subType,
      availableFields: Object.keys(this.companyData || {}),
      companyName: this.companyData?.Company_Name || this.companyData?.name || this.companyData?.Personal_Details?.Company_Name
    });

    let response = '';
    let data = null;

    switch (subType) {
      case 'name':
        const companyName = this.companyData.Personal_Details?.Company_Name || 
                           this.companyData.Company_Name || 
                           this.companyData.name ||
                           this.companyData.Personal_Details?.Brand_Name;
        
        if (companyName) {
          response = `Your company name is: ${companyName}`;
          data = { name: companyName };
        } else {
          return {
            hasData: false,
            context: "Company name information not found.",
            data: null
          };
        }
        break;

      case 'legal_name':
        const legalName = this.companyData.Personal_Details?.Legal_Name || 
                         this.companyData.Legal_Name ||
                         this.companyData.Personal_Details?.Company_Name;
        if (legalName) {
          response = `Your company's legal name is: ${legalName}`;
          data = { legal_name: legalName };
        } else {
          return {
            hasData: false,
            context: "Legal name information not found.",
            data: null
          };
        }
        break;

      case 'incorporation':
        const incorporationDate = this.companyData.Personal_Details?.Date_of_Incorporation;
        const incorporationCountry = this.companyData.Personal_Details?.Country_of_Incorporation;
        const registrationNumber = this.companyData.Registration_Tax_IDs?.Registration_Number;
        
        if (incorporationDate || incorporationCountry || registrationNumber) {
          response = 'Company Incorporation Details:\n';
          if (incorporationDate) response += `- Date of Incorporation: ${formatDate(incorporationDate)}\n`;
          if (incorporationCountry) response += `- Country of Incorporation: ${incorporationCountry}\n`;
          if (registrationNumber) response += `- Registration Number: ${registrationNumber}`;
          
          data = {
            incorporation_date: incorporationDate,
            incorporation_country: incorporationCountry,
            registration_number: registrationNumber
          };
        } else {
          return {
            hasData: false,
            context: "Incorporation details not found.",
            data: null
          };
        }
        break;

      default:
        const companyDetails = this.companyData.Personal_Details;
        if (companyDetails) {
          response = 'Company Details:\n';
          if (companyDetails.Company_Name) response += `- Company Name: ${companyDetails.Company_Name}\n`;
          if (companyDetails.Legal_Name) response += `- Legal Name: ${companyDetails.Legal_Name}\n`;
          if (companyDetails.Industry_Sector) response += `- Industry: ${companyDetails.Industry_Sector}\n`;
          if (companyDetails.Sub_sector) response += `- Sub-sector: ${companyDetails.Sub_sector}\n`;
          if (companyDetails.Company_Type) response += `- Company Type: ${companyDetails.Company_Type}\n`;
          
          data = companyDetails;
        } else {
          return {
            hasData: false,
            context: "Company details not found.",
            data: null
          };
        }
    }

    return {
      hasData: true,
      context: response,
      data: data,
      metadata: {
        type: 'company',
        subType: subType
      }
    };
  }

  private async processKYCQuery(subType: string): Promise<QueryResult> {
    console.log('Processing KYC query:', {
      subType,
      hasKYC: !!this.companyData?.KYC_Compliance,
      hasPersonalKYC: !!this.companyData?.Personal_KYC_ID
    });

    const kycCompliance = this.companyData.KYC_Compliance;
    const personalKYC = this.companyData.Personal_KYC_ID;
    
    let response = '';
    let data = null;

    switch (subType) {
      case 'status':
        if (kycCompliance) {
          response = 'KYC Compliance Status:\n';
          response += `- KYC Status: ${kycCompliance.KYC_Status}\n`;
          response += `- FATCA Status: ${kycCompliance.FATCA_Status}\n`;
          response += `- AML/CFT Status: ${kycCompliance.AML_CFT_Status}\n`;
          response += `- CRS Declaration: ${kycCompliance.CRS_Declaration}\n`;
          response += `- Risk Category: ${kycCompliance.Risk_Category}\n`;
          if (kycCompliance.Date_of_KYC_Completion) {
            response += `- KYC Completion Date: ${formatDate(kycCompliance.Date_of_KYC_Completion)}`;
          }
          
          data = kycCompliance;
        } else {
          return {
            hasData: false,
            context: "KYC status information not found.",
            data: null
          };
        }
        break;

      case 'documents':
        if (personalKYC && personalKYC.KYC_Documents_Submitted) {
          response = 'KYC Documents Submitted:\n';
          response += personalKYC.KYC_Documents_Submitted.map((doc: string) => `- ${doc}`).join('\n');
          
          data = {
            documents: personalKYC.KYC_Documents_Submitted,
            kyc_status: personalKYC.KYC_Status
          };
        } else {
          return {
            hasData: false,
            context: "KYC document information not found.",
            data: null
          };
        }
        break;

      default:
        if (kycCompliance && personalKYC) {
          response = 'Complete KYC Information:\n\n';
          response += 'Compliance Status:\n';
          response += `- KYC Status: ${kycCompliance.KYC_Status}\n`;
          response += `- FATCA Status: ${kycCompliance.FATCA_Status}\n`;
          response += `- Risk Category: ${kycCompliance.Risk_Category}\n\n`;
          
          response += 'Documents Submitted:\n';
          if (personalKYC.KYC_Documents_Submitted) {
            response += personalKYC.KYC_Documents_Submitted.map((doc: string) => `- ${doc}`).join('\n');
          }
          
          data = {
            compliance: kycCompliance,
            documents: personalKYC
          };
        } else {
          return {
            hasData: false,
            context: "KYC information not found.",
            data: null
          };
        }
    }

    return {
      hasData: true,
      context: response,
      data: data,
      metadata: {
        type: 'kyc',
        subType: subType
      }
    };
  }

  private async processTradeFinanceQuery(subType: string): Promise<QueryResult> {
    console.log('Processing trade finance query:', {
      subType,
      hasTradeFinance: !!this.companyData?.Trade_Finance
    });

    const tradeFinance = this.companyData.Trade_Finance;
    if (!tradeFinance) {
      return {
        hasData: false,
        context: 'No trade finance information found.',
        data: null
      };
    }

    let response = '';
    let data = null;

    switch (subType) {
      case 'letters_of_credit':
        const lcs = tradeFinance.Letters_of_Credit || [];
        if (lcs.length > 0) {
          response = 'Letters of Credit:\n\n';
          response += lcs.map((lc: any) => 
            `LC Number: ${lc.LC_Number}\n` +
            `- Beneficiary: ${lc.Beneficiary_Name}\n` +
            `- Amount: ${formatCurrency(lc.Utilized_Amount)} / ${formatCurrency(lc.Limit)} ${lc.Currency}\n` +
            `- Status: ${lc.Status}\n` +
            `- Expiry Date: ${formatDate(lc.Expiry_Date)}\n` +
            `- Purpose: ${lc.Purpose}`
          ).join('\n\n');
          data = lcs;
        } else {
          return {
            hasData: false,
            context: 'No letters of credit found.',
            data: null
          };
        }
        break;

      case 'bank_guarantees':
        const bgs = tradeFinance.Bank_Guarantees || [];
        if (bgs.length > 0) {
          response = 'Bank Guarantees:\n\n';
          response += bgs.map((bg: any) => 
            `BG Number: ${bg.BG_Number}\n` +
            `- Type: ${bg.Type}\n` +
            `- Beneficiary: ${bg.Beneficiary_Name}\n` +
            `- Amount: ${formatCurrency(bg.Utilized_Amount)} / ${formatCurrency(bg.Limit)} ${bg.Currency}\n` +
            `- Status: ${bg.Status}\n` +
            `- Expiry Date: ${formatDate(bg.Expiry_Date)}`
          ).join('\n\n');
          data = bgs;
        } else {
          return {
            hasData: false,
            context: 'No bank guarantees found.',
            data: null
          };
        }
        break;

      case 'invoice_financing':
        const invoices = tradeFinance.Invoice_Financing || [];
        if (invoices.length > 0) {
          response = 'Invoice Financing:\n\n';
          response += invoices.map((inv: any) => 
            `Invoice Number: ${inv.Invoice_Number}\n` +
            `- Buyer: ${inv.Buyer_Name}\n` +
            `- Invoice Amount: ${formatCurrency(inv.Invoice_Amount)}\n` +
            `- Financed Amount: ${formatCurrency(inv.Financed_Amount)}\n` +
            `- Interest Rate: ${inv.Interest_Rate}%\n` +
            `- Due Date: ${formatDate(inv.Due_Date)}\n` +
            `- Status: ${inv.Status}`
          ).join('\n\n');
          data = invoices;
        } else {
          return {
            hasData: false,
            context: 'No invoice financing records found.',
            data: null
          };
        }
        break;

      default:
        const limits = tradeFinance.Trade_Limits;
        response = 'Trade Finance Summary:\n\n';
        
        if (limits) {
          response += 'Trade Limits:\n';
          response += `- Import LC Limit: ${formatCurrency(limits.Import_LC_Limit)}\n`;
          response += `- Export Credit Limit: ${formatCurrency(limits.Export_Credit_Limit)}\n`;
          response += `- Invoice Financing Limit: ${formatCurrency(limits.Invoice_Financing_Limit)}\n`;
          response += `- Documentary Collection Limit: ${formatCurrency(limits.Documentary_Collection_Limit)}\n\n`;
        }
        
        response += `Letters of Credit: ${tradeFinance.Letters_of_Credit?.length || 0} active\n`;
        response += `Bank Guarantees: ${tradeFinance.Bank_Guarantees?.length || 0} active\n`;
        response += `Invoice Financing: ${tradeFinance.Invoice_Financing?.length || 0} active`;
        
        data = tradeFinance;
    }

    return {
      hasData: true,
      context: response,
      data: data,
      metadata: {
        type: 'trade_finance',
        subType: subType
      }
    };
  }

  private async processAuthorizedSignatoryQuery(): Promise<QueryResult> {
    console.log('Processing authorized signatory query');
    
    const signatory = this.companyData.Authorized_Signatory;
    if (!signatory) {
      return {
        hasData: false,
        context: 'No authorized signatory information found.',
        data: null
      };
    }

    const response = 'Authorized Signatory Details:\n\n' +
      `Name: ${signatory.Full_Name}\n` +
      `- Designation: ${signatory.Designation}\n` +
      `- Type: ${signatory.Type_of_Signatory}\n` +
      `- Signing Authority: ${signatory.Signing_Authority_Limit}\n` +
      `- Approval Status: ${signatory.Approval_Status}\n` +
      `- Authorized Since: ${formatDate(signatory.Authorized_Since)}\n` +
      `- Contact: ${signatory.Email_Address}, ${signatory.Contact_Number}\n` +
      `- KYC Status: ${signatory.KYC_Status}`;

    return {
      hasData: true,
      context: response,
      data: signatory,
      metadata: {
        type: 'authorized_signatory'
      }
    };
  }

  private async processSupportQuery(): Promise<QueryResult> {
    console.log('Processing support query');
    
    const tickets = this.companyData.Support_Tickets || [];
    if (tickets.length === 0) {
      return {
        hasData: false,
        context: 'No support tickets found.',
        data: null
      };
    }

    const openTickets = tickets.filter((ticket: any) => ticket.Status === 'Open');
    const resolvedTickets = tickets.filter((ticket: any) => ticket.Status === 'Resolved');

    let response = `Support Tickets Summary:\n\n`;
    response += `Total Tickets: ${tickets.length}\n`;
    response += `Open Tickets: ${openTickets.length}\n`;
    response += `Resolved Tickets: ${resolvedTickets.length}\n\n`;

    if (openTickets.length > 0) {
      response += 'Open Tickets:\n';
      response += openTickets.map((ticket: any) => 
        `- ${ticket.Ticket_ID}: ${ticket.Issue} (Priority: ${ticket.Priority})`
      ).join('\n');
    }

    return {
      hasData: true,
      context: response,
      data: { tickets, openTickets, resolvedTickets },
      metadata: {
        type: 'support'
      }
    };
  }

  private async processCreditQuery(): Promise<QueryResult> {
    console.log('Processing credit query');
    
    const creditReports = this.companyData.Credit_Reports;
    if (!creditReports) {
      return {
        hasData: false,
        context: 'No credit report information found.',
        data: null
      };
    }

    const response = 'Credit Report Summary:\n\n' +
      `Credit Score: ${creditReports.Credit_Score}\n` +
      `- Credit Rating: ${creditReports.Credit_Rating}\n` +
      `- Client Risk Score: ${creditReports.Client_Risk_Score}\n` +
      `- Credit Utilization Ratio: ${(creditReports.Credit_Utilization_Ratio * 100).toFixed(1)}%\n` +
      `- Sanctioned vs Utilized Ratio: ${(creditReports.Sanctioned_vs_Utilized_Ratio * 100).toFixed(1)}%\n` +
      `- Number of Enquiries: ${creditReports.Number_of_Enquiries}\n` +
      `- Defaults Flag: ${creditReports.Defaults_Flag ? 'Yes' : 'No'}\n` +
      `- Reporting Agency: ${creditReports.Reporting_Agency}\n` +
      `- Last Updated: ${formatDate(creditReports.Last_Updated)}`;

    return {
      hasData: true,
      context: response,
      data: creditReports,
      metadata: {
        type: 'credit'
      }
    };
  }

  private async processPersonalQuery(): Promise<QueryResult> {
    console.log('Processing personal query');
    
    const individualDetails = this.companyData.Individual_Details;
    if (!individualDetails) {
      return {
        hasData: false,
        context: 'No individual details found.',
        data: null
      };
    }

    const response = 'Individual Details:\n\n' +
      `Name: ${individualDetails.Full_Name}\n` +
      `- Email: ${individualDetails.Email_Address}\n` +
      `- Phone: ${individualDetails.Phone_Number}\n` +
      `- Father's Name: ${individualDetails.Father_Name}\n` +
      `- Mother's Name: ${individualDetails.Mother_Name}\n` +
      `- Marital Status: ${individualDetails.Maternal_Status}\n` +
      `- Preferred Language: ${individualDetails.Preferred_Language}\n` +
      `- Contact Preference: ${individualDetails.Contact_Preference}`;

    return {
      hasData: true,
      context: response,
      data: individualDetails,
      metadata: {
        type: 'personal'
      }
    };
  }

  private validateCompanyData(): boolean {
    console.log('\n========== Validating Company Data ==========');
    
    if (!this.companyData) {
      console.error('No company data available');
      return false;
    }

    const dataAnalysis = {
      fields: Object.keys(this.companyData),
      hasIndividualDetails: !!this.companyData.Individual_Details,
      hasPersonalDetails: !!this.companyData.Personal_Details,
      hasTransactions: !!this.companyData.transactions,
      transactionCount: this.companyData.transactions?.length || 0,
      hasBankAccounts: !!this.companyData.Bank_Accounts,
      bankAccountCount: this.companyData.Bank_Accounts?.length || 0
    };

    console.log('Company Data Analysis:', dataAnalysis);
    return true;
  }

  async processQuery(query: string): Promise<QueryResult> {
    try {
      console.log('\n========== Query Processing Start ==========');
      console.log('Processing query:', query);
      
      // Fetch company data if not already fetched
      if (!this.companyData) {
        await this.fetchCompanyData();
      }
      
      // Validate company data
      if (!this.validateCompanyData()) {
        return { hasData: false, context: 'Company data is not available', data: null };
      }

      // Identify query type and extract relevant information
      const queryInfo = await this.identifyQueryType(query.toLowerCase());
      const { type = 'unknown', subType = '', timeframe = '', category = '' } = queryInfo;
      console.log('Query analysis:', { type, subType, timeframe, category });

      let result: QueryResult;

      // Process based on query type
      switch (type) {
        case 'aadhaar_number':
          result = await this.processAadhaarQuery();
          break;

        case 'transactions':
          result = await this.processTransactionQuery(timeframe, category);
          break;

        case 'account':
        case 'bank_accounts':
          result = await this.processAccountQuery(subType);
          break;

        case 'loan':
        case 'loans_info':
          result = await this.processLoanQuery(subType);
          break;

        case 'working_capital':
        case 'working_capital_facility':
          result = await this.processWorkingCapitalQuery();
          break;

        case 'company':
        case 'company_info':
          result = await this.processCompanyQuery(subType);
          break;

        case 'kyc':
        case 'kyc_compliance':
          result = await this.processKYCQuery(subType);
          break;

        case 'trade_finance':
        case 'trade_finance_details':
        case 'letters_of_credit':
        case 'bank_guarantees':
        case 'invoice_financing':
        case 'documentary_collections':
          result = await this.processTradeFinanceQuery(subType);
          break;

        case 'authorized_signatory':
          result = await this.processAuthorizedSignatoryQuery();
          break;

        case 'support':
        case 'support_tickets':
          result = await this.processSupportQuery();
          break;

        case 'credit':
        case 'credit_reports':
          result = await this.processCreditQuery();
          break;

        case 'personal':
        case 'personal_details':
        case 'individual_details':
          result = await this.processPersonalQuery();
          break;

        default:
          console.log('Unhandled query type:', type);
          result = { 
            hasData: false, 
            context: `I understand you're asking about "${query}". Could you please be more specific? I can help you with information about:\n\n• Transactions and spending patterns\n• Bank account details and joint holders\n• Loan information and EMI details\n• Working capital facility\n• Company and personal details\n• KYC compliance status\n• Trade finance (LC, BG, Invoice financing)\n• Authorized signatory information\n• Support tickets\n• Credit reports\n• Aadhaar number\n\nPlease ask about any of these topics.`, 
            data: null 
          };
      }

      console.log('Query result:', result);
      return result;
    } catch (error) {
      console.error('Error processing query:', error);
      return { 
        hasData: false, 
        context: 'I encountered an error while processing your request. Please try again or rephrase your question.', 
        data: null 
      };
    }
  }

  setCompanyData(data: any): void {
    console.log('Setting company data:', {
      hasIndividualDetails: !!data.Individual_Details,
      hasPersonalDetails: !!data.Personal_Details,
      hasTransactions: !!data.transactions,
      transactionCount: data.transactions?.length || 0,
      hasBankAccounts: !!data.Bank_Accounts,
      bankAccountCount: data.Bank_Accounts?.length || 0,
      hasLoans: !!data.Loans,
      loanCount: data.Loans?.length || 0,
      hasWorkingCapital: !!data.Working_Capital_Facility,
      hasAuthorizedSignatory: !!data.Authorized_Signatory,
      dataKeys: Object.keys(data)
    });
    this.companyData = data;
  }
}