import { OllamaService } from './ollamaService';
import { formatCurrency, formatDate, maskSensitiveData } from './formatUtils';

interface CompanyData {
  [key: string]: any;
}

interface Transaction {
  category: string;
  date: string;
  amount: number;
  merchant: string;
  remarks: string;
  status: string;
  transaction_id: string;
}

interface TransactionAnalysis {
  total: number;
  count: number;
  transactions: Transaction[];
  category?: string;
  timeFrame: string;
  merchantAnalysis?: {
    [merchant: string]: {
      total: number;
      count: number;
      lastTransaction: string;
    };
  };
  categoryAnalysis?: {
    [category: string]: {
      total: number;
      count: number;
      percentage: number;
    };
  };
  trends?: {
    highestAmount: number;
    lowestAmount: number;
    averageAmount: number;
    mostFrequentMerchant: string;
    mostExpensiveCategory: string;
  };
}

interface DataField {
  path: string[];
  keywords: string[];
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
}

export class QueryProcessor {
  private ollamaService: OllamaService;
  private companyData: CompanyData;
  
  // Define data field mappings for all Firebase data
  private readonly dataFields: { [key: string]: DataField } = {
    // Personal & Company Information
    companyName: { path: ['Personal_Details', 'Company_Name'], keywords: ['company', 'organization', 'business name'], type: 'string' },
    brandName: { path: ['Personal_Details', 'Brand_Name'], keywords: ['brand'], type: 'string' },
    incorporation: { path: ['Personal_Details', 'Date_of_Incorporation'], keywords: ['incorporated', 'establishment date'], type: 'date' },
    industry: { path: ['Personal_Details', 'Industry_Sector'], keywords: ['industry', 'sector', 'business type'], type: 'string' },
    
    // Individual Details
    fullName: { path: ['Individual_Details', 'Full_Name'], keywords: ['name', 'full name', 'person name'], type: 'string' },
    email: { path: ['Individual_Details', 'Email_Address'], keywords: ['email', 'mail'], type: 'string' },
    phone: { path: ['Individual_Details', 'Phone_Number'], keywords: ['phone', 'contact', 'mobile'], type: 'string' },
    address: { path: ['Individual_Details', 'Residential_Address'], keywords: ['address', 'residence', 'location'], type: 'string' },
    
    // Bank Accounts
    accountNumbers: { path: ['Bank_Accounts'], keywords: ['account', 'bank account'], type: 'array' },
    balances: { path: ['Bank_Accounts'], keywords: ['balance', 'account balance', 'bank balance'], type: 'array' },
    
    // Loans
    loanDetails: { path: ['Loans'], keywords: ['loan', 'borrowing', 'credit'], type: 'array' },
    emiDetails: { path: ['Loans'], keywords: ['emi', 'installment', 'loan payment'], type: 'array' },
    
    // Trade Finance
    tradeFinance: { path: ['Trade_Finance'], keywords: ['trade', 'finance', 'trade finance'], type: 'object' },
    letterOfCredit: { path: ['Trade_Finance', 'Letters_of_Credit'], keywords: ['lc', 'letter of credit'], type: 'array' },
    
    // KYC & Compliance
    kycStatus: { path: ['KYC_Compliance', 'KYC_Status'], keywords: ['kyc', 'verification status'], type: 'string' },
    kycDocuments: { path: ['KYC_Compliance', 'Documents_Submitted'], keywords: ['kyc documents', 'verification documents'], type: 'array' },
    
    // Credit Reports
    creditScore: { path: ['Credit_Reports', 'Credit_Score'], keywords: ['credit score', 'cibil'], type: 'number' },
    creditRating: { path: ['Credit_Reports', 'Credit_Rating'], keywords: ['credit rating', 'rating'], type: 'string' },
    
    // Digital Access
    loginHistory: { path: ['Digital_Access_Security', 'Login_History'], keywords: ['login', 'access history'], type: 'array' },
    securitySettings: { path: ['Digital_Access_Security'], keywords: ['security', '2fa', 'two factor'], type: 'object' },
    
    // Support & Communication
    supportTickets: { path: ['Support_Tickets'], keywords: ['support', 'ticket', 'issue'], type: 'array' },
    communications: { path: ['Communication_Relationship'], keywords: ['communication', 'contact preference'], type: 'object' },
    
    // Transactions
    transactions: { path: ['transactions'], keywords: ['transaction', 'payment', 'spent', 'received'], type: 'array' },
    
    // Working Capital
    workingCapital: { path: ['Working_Capital_Facility'], keywords: ['working capital', 'capital facility'], type: 'object' }
  };

  constructor(ollamaService: OllamaService, companyData: CompanyData) {
    this.ollamaService = ollamaService;
    this.companyData = companyData;
  }

  private analyzeTransactions(transactions: Transaction[]): TransactionAnalysis {
    const analysis: TransactionAnalysis = {
      total: 0,
      count: transactions.length,
      transactions: transactions.slice(0, 5),
      timeFrame: 'analyzed',
      merchantAnalysis: {},
      categoryAnalysis: {},
      trends: {
        highestAmount: 0,
        lowestAmount: Number.MAX_VALUE,
        averageAmount: 0,
        mostFrequentMerchant: '',
        mostExpensiveCategory: ''
      }
    };

    let totalAmount = 0;
    const merchantMap: { [key: string]: { total: number; count: number; lastTransaction: string } } = {};
    const categoryMap: { [key: string]: { total: number; count: number } } = {};

    // Analyze each transaction
    transactions.forEach(t => {
      totalAmount += t.amount;
      
      // Merchant analysis
      if (!merchantMap[t.merchant]) {
        merchantMap[t.merchant] = { total: 0, count: 0, lastTransaction: t.date };
      }
      merchantMap[t.merchant].total += t.amount;
      merchantMap[t.merchant].count += 1;
      if (new Date(t.date) > new Date(merchantMap[t.merchant].lastTransaction)) {
        merchantMap[t.merchant].lastTransaction = t.date;
      }

      // Category analysis
      if (!categoryMap[t.category]) {
        categoryMap[t.category] = { total: 0, count: 0 };
      }
      categoryMap[t.category].total += t.amount;
      categoryMap[t.category].count += 1;

      // Update trends
      if (t.amount > analysis.trends!.highestAmount) {
        analysis.trends!.highestAmount = t.amount;
      }
      if (t.amount < analysis.trends!.lowestAmount) {
        analysis.trends!.lowestAmount = t.amount;
      }
    });

    // Calculate averages and percentages
    analysis.total = totalAmount;
    analysis.trends!.averageAmount = totalAmount / transactions.length;

    // Find most frequent merchant and expensive category
    let maxMerchantCount = 0;
    let maxCategoryAmount = 0;

    Object.entries(merchantMap).forEach(([merchant, data]) => {
      if (data.count > maxMerchantCount) {
        maxMerchantCount = data.count;
        analysis.trends!.mostFrequentMerchant = merchant;
      }
    });

    Object.entries(categoryMap).forEach(([category, data]) => {
      if (data.total > maxCategoryAmount) {
        maxCategoryAmount = data.total;
        analysis.trends!.mostExpensiveCategory = category;
      }
    });

    // Add merchant and category analysis to result
    analysis.merchantAnalysis = merchantMap;
    analysis.categoryAnalysis = Object.entries(categoryMap).reduce((acc, [category, data]) => {
      acc[category] = {
        ...data,
        percentage: (data.total / totalAmount) * 100
      };
      return acc;
    }, {} as { [key: string]: any });

    return analysis;
  }

  private extractTransactionData(query: string): TransactionAnalysis {
    const transactions = (this.companyData.transactions || []) as Transaction[];
    const lowerQuery = query.toLowerCase();
    const currentDate = new Date();
    
    // Extract time period from query
    let timeFilter: Date | null = null;
    if (lowerQuery.includes('last month')) {
      timeFilter = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    } else if (lowerQuery.includes('this month')) {
      timeFilter = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    } else if (lowerQuery.includes('last week')) {
      timeFilter = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Extract category from query
    const categories = new Set(transactions.map(t => t.category.toLowerCase()));
    const matchingCategory = Array.from(categories).find(cat => lowerQuery.includes(cat));

    // Filter transactions
    let filteredTransactions = transactions;
    if (timeFilter) {
      filteredTransactions = filteredTransactions.filter(t => 
        new Date(t.date) >= timeFilter!
      );
    }
    if (matchingCategory) {
      filteredTransactions = filteredTransactions.filter(t => 
        t.category.toLowerCase() === matchingCategory
      );
    }

    // Perform detailed analysis
    const analysis = this.analyzeTransactions(filteredTransactions);
    analysis.category = matchingCategory || undefined;
    analysis.timeFrame = timeFilter ? 'filtered' : 'all';

    return analysis;
  }

  private extractPersonalData(query: string): any {
    const relevantData: any = {};
    const lowerQuery = query.toLowerCase();

    // Map of personal data fields and their common query terms
    const personalDataMap = {
      'name': ['name', 'called', 'full name'],
      'email': ['email', 'mail'],
      'phone': ['phone', 'mobile', 'contact'],
      'address': ['address', 'live', 'residence'],
      'dob': ['birth', 'dob', 'born'],
      'kyc': ['kyc', 'documents', 'verification'],
      'bank': ['bank', 'account', 'balance'],
      'credit': ['credit', 'score', 'rating']
    };

    // Check each field for relevance to the query
    for (const [field, terms] of Object.entries(personalDataMap)) {
      if (terms.some(term => lowerQuery.includes(term))) {
        switch (field) {
          case 'name':
            relevantData.name = this.companyData.Individual_Details?.Full_Name;
            break;
          case 'email':
            relevantData.email = this.companyData.Individual_Details?.Email_Address;
            break;
          case 'phone':
            relevantData.phone = this.companyData.Individual_Details?.Phone_Number;
            break;
          case 'address':
            relevantData.address = this.companyData.Individual_Details?.Residential_Address;
            break;
          case 'dob':
            relevantData.dob = this.companyData.Individual_Details?.Date_of_Birth;
            break;
          case 'kyc':
            relevantData.kyc = {
              status: this.companyData.KYC_Compliance?.KYC_Status,
              documents: this.companyData.Personal_KYC_ID?.KYC_Documents_Submitted
            };
            break;
          case 'bank':
            relevantData.bank = this.companyData.Bank_Accounts?.map((acc: any) => ({
              type: acc.Account_Type,
              balance: acc.Current_Balance,
              status: acc.Account_Status
            }));
            break;
          case 'credit':
            relevantData.credit = {
              score: this.companyData.Credit_Reports?.Credit_Score,
              rating: this.companyData.Credit_Reports?.Credit_Rating
            };
            break;
        }
      }
    }

    return relevantData;
  }

  private async generateStructuredResponse(data: any, query: string): Promise<string> {
    try {
    // Format the data for better readability
    const formattedData = JSON.stringify(data, null, 2);
    const lowerQuery = query.toLowerCase();

    let promptTemplate = '';
    
    // Determine the type of query and create appropriate prompt
    if (lowerQuery.includes('transaction') || lowerQuery.includes('spent') || 
        lowerQuery.includes('paid') || lowerQuery.includes('payment')) {
      promptTemplate = `You are a banking assistant. Answer the following transaction-related query using ONLY the provided data.
Follow these rules strictly:
1. Be specific about amounts and dates
2. Format all currency values in Indian format (e.g., ₹1,00,000)
3. If a category is specified, focus on that category
4. List relevant transactions with dates if available
5. For sensitive numbers, show only last 4 digits
6. Include status information when available

Query: ${query}

Available Data:
${formattedData}

Generate a clear, natural response focusing on the transaction details.`;
      } else if (lowerQuery.includes('working capital') || lowerQuery.includes('limit') || 
                 lowerQuery.includes('facility')) {
        promptTemplate = `You are a banking assistant. Answer the following working capital query using ONLY the provided data.
Follow these rules strictly:
1. Be specific about limits and utilization
2. Format all currency values in Indian format
3. Include relevant dates (review, renewal)
4. Mention collateral details if relevant
5. Include facility status and notes if available

Query: ${query}

Available Data:
${formattedData}

Generate a clear, natural response focusing on the working capital details.`;
      } else if (lowerQuery.includes('company') || lowerQuery.includes('business')) {
        promptTemplate = `You are a banking assistant. Answer the following company information query using ONLY the provided data.
Follow these rules strictly:
1. Use the official company name and type
2. Include industry and sector information
3. Mention incorporation details if relevant
4. List operating countries if available
5. Include language and currency preferences if relevant

Query: ${query}

Available Data:
${formattedData}

Generate a clear, natural response focusing on the company details.`;
    } else {
      promptTemplate = `You are a banking assistant. Answer the following query using ONLY the provided data.
Follow these rules strictly:
1. Be specific and precise
2. Format all currency values in Indian format
3. Show only last 4 digits of sensitive numbers
4. Include relevant dates in DD/MM/YYYY format
5. If data is not available, say so clearly

Query: ${query}

Available Data:
${formattedData}

Generate a clear, natural response using this data.`;
    }

    return await this.ollamaService.generateBankingResponse(promptTemplate, query);
    } catch (error) {
      console.error('Error generating structured response:', error);
      return "I apologize, but I encountered an error while processing your query. Please try again or rephrase your question.";
    }
  }

  private getValueFromPath(obj: any, path: string[]): any {
    return path.reduce((current, key) => current?.[key], obj);
  }

  private findRelevantFields(query: string): { [key: string]: any } {
    const lowerQuery = query.toLowerCase();
    const relevantData: { [key: string]: any } = {};

    // Define field mappings for common queries
    const fieldMappings = {
      // Company Information
      'company': ['Personal_Details', 'Company_Name'],
      'legal name': ['Personal_Details', 'Legal_Name'],
      'brand': ['Personal_Details', 'Brand_Name'],
      'industry': ['Personal_Details', 'Industry_Sector'],
      'sector': ['Personal_Details', 'Sub_sector'],
      'incorporation': ['Personal_Details', 'Date_of_Incorporation'],
      
      // Individual Details
      'name': ['Individual_Details', 'Full_Name'],
      'mother': ['Individual_Details', 'Mother_Name'],
      'user id': ['Individual_Details', 'User_ID'],
      
      // Working Capital
      'working capital': ['Working_Capital_Facility'],
      'limit': ['Working_Capital_Facility', 'Sanctioned_Limit'],
      'utilized': ['Working_Capital_Facility', 'Utilized_Limit'],
      'available': ['Working_Capital_Facility', 'Available_Limit'],
      'collateral': ['Working_Capital_Facility', 'Collateral_Value'],
      
      // Authorized Signatory
      'signatory': ['Authorized_Signatory'],
      'authority': ['Authorized_Signatory', 'Signing_Authority_Limit'],
      'designation': ['Authorized_Signatory', 'Designation'],
      
      // Bank Accounts
      'account': ['Bank_Accounts'],
      'balance': ['Bank_Accounts'],
      
      // Loans
      'loan': ['Loans'],
      'credit': ['Credit_Reports'],
      
      // KYC and Compliance
      'kyc': ['KYC_Compliance'],
      'compliance': ['KYC_Compliance'],
      'regulatory': ['Regulatory_Audit_Trail'],
      
      // Trade Finance
      'trade': ['Trade_Finance'],
      'finance': ['Trade_Finance'],
      
      // Transactions
      'transaction': ['transactions'],
      'payment': ['transactions']
    };

    // Check each mapping against the query
    for (const [key, paths] of Object.entries(fieldMappings)) {
      if (lowerQuery.includes(key)) {
        const value = this.getValueFromPath(this.companyData, paths);
        if (value !== undefined) {
          relevantData[key] = {
            value,
            paths: paths.join('.')
          };
        }
      }
    }

    // If no specific fields found, try to determine context
    if (Object.keys(relevantData).length === 0) {
      if (lowerQuery.includes('money') || lowerQuery.includes('financial')) {
        relevantData.financial = {
          accounts: this.companyData.Bank_Accounts,
          workingCapital: this.companyData.Working_Capital_Facility,
          loans: this.companyData.Loans
        };
      } else if (lowerQuery.includes('company') || lowerQuery.includes('business')) {
        relevantData.company = this.companyData.Personal_Details;
      } else if (lowerQuery.includes('person') || lowerQuery.includes('individual')) {
        relevantData.individual = {
          details: this.companyData.Individual_Details,
          signatory: this.companyData.Authorized_Signatory
        };
      }
    }

    return relevantData;
  }

  private formatDataForResponse(data: any, type: string): any {
    switch (type) {
      case 'date':
        return new Date(data).toLocaleDateString('en-IN');
      case 'number':
        return typeof data === 'number' ? data.toLocaleString('en-IN') : data;
      case 'array':
        return Array.isArray(data) ? data.slice(0, 5) : data; // Return only first 5 items
      case 'object':
        return typeof data === 'object' ? this.sanitizeObject(data) : data;
      default:
        return data;
    }
  }

  private sanitizeObject(obj: any): any {
    const sensitiveFields = ['password', 'secret', 'key', 'token', 'auth'];
    const sanitized = { ...obj };
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '******';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeObject(sanitized[key]);
      }
    });
    
    return sanitized;
  }

  async processQuery(query: string): Promise<string> {
    try {
      // First check for transaction-specific queries
      if (query.toLowerCase().includes('transaction') || 
          query.toLowerCase().includes('spent') ||
          query.toLowerCase().includes('paid') ||
          query.toLowerCase().includes('payment')) {
        const transactionData = this.extractTransactionData(query);
        return this.generateStructuredResponse(transactionData, query);
      }

      // Extract relevant data based on query
      const relevantData = this.findRelevantFields(query);
      
      // Format the data
      const formattedData = Object.entries(relevantData).reduce((acc, [key, value]) => {
        acc[key] = this.formatDataForResponse(value.value, value.type);
        return acc;
      }, {} as { [key: string]: any });

      // Generate response
      const prompt = `You are a banking assistant for TechNova Solutions. Answer the following query using ONLY the provided data.
Follow these rules:
1. Be specific and precise
2. Include relevant numbers and dates in Indian format
3. Mask sensitive information
4. If data is not available, say so clearly
5. Format currency values in Indian format (e.g., ₹1,00,000)
6. Use bullet points for lists
7. Keep the response concise but complete

Query: ${query}

Available Data:
${JSON.stringify(formattedData, null, 2)}

Generate a natural, professional response based on this data.`;

      return await this.ollamaService.generateBankingResponse(prompt, query);

    } catch (error) {
      console.error('Error processing query:', error);
      return "I apologize, but I encountered an error while processing your query. Please try again or contact support if the issue persists.";
    }
  }
} 