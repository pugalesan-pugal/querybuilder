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
  data: any;
  context: string;
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
  transaction_id: string;
  date: string;
  amount: number;
  merchant: string;
  currency: string;
  status: string;
  card_number: string;
  category: string;
  remarks: string;
}

interface CategoryTotals {
  [category: string]: number;
}

interface BankAccount {
  Account_Number: string;
  Bank_Name: string;
  Account_Type: string;
  Current_Balance: number;
  Account_Status: string;
  Branch_Name: string;
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

export class NLPQueryService {
  private companyId: string;

  constructor(companyId: string) {
    console.log('Initializing NLPQueryService with companyId:', companyId);
    this.companyId = companyId;
  }

  private async extractIntent(query: string): Promise<QueryIntent> {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Move KYC patterns before other patterns for higher priority
    const kycPatterns = [
      /kyc/i,
      /know.*customer/i,
      /kyc.*detail/i,
      /kyc.*status/i,
      /kyc.*info/i,
      /my.*kyc/i,
      /compliance.*status/i,
      /document.*verification/i,
      /identity.*verification/i,
      /verification.*status/i
    ];
    
    if (kycPatterns.some(pattern => pattern.test(normalizedQuery))) {
      console.log('Detected KYC compliance query');
      return {
        type: 'kyc_compliance',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Add working capital facility patterns
    const workingCapitalPatterns = [
      /working.*capital.*facility/i,
      /wc.*facility/i,
      /working.*capital.*limit/i,
      /wc.*limit/i,
      /working.*capital.*utilization/i,
      /wc.*utilization/i,
      /drawing.*power/i
    ];

    if (workingCapitalPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'working_capital_facility',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Add bank guarantee patterns
    const bgPatterns = [
      /bank.*guarantee/i,
      /bg.*detail/i,
      /guarantee.*status/i,
      /bg.*status/i,
      /active.*guarantee/i,
      /guarantee.*limit/i
    ];

    if (bgPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'bank_guarantees',
        entities: {
          companyId: this.companyId,
          bgNumber: this.extractBGNumber(normalizedQuery)
        }
      };
    }

    // Add letter of credit patterns
    const lcPatterns = [
      /letter.*credit/i,
      /lc.*detail/i,
      /lc.*status/i,
      /active.*lc/i,
      /import.*lc/i,
      /export.*lc/i
    ];

    if (lcPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'letters_of_credit',
        entities: {
          companyId: this.companyId,
          lcNumber: this.extractLCNumber(normalizedQuery)
        }
      };
    }

    // Add invoice financing patterns
    const invoicePatterns = [
      /invoice.*financ/i,
      /bill.*financ/i,
      /invoice.*discount/i,
      /invoice.*status/i,
      /financed.*invoice/i
    ];

    if (invoicePatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'invoice_financing',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Add documentary collections patterns
    const docCollectionPatterns = [
      /documentary.*collection/i,
      /doc.*collection/i,
      /collection.*status/i,
      /document.*against.*payment/i,
      /document.*against.*acceptance/i
    ];

    if (docCollectionPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'documentary_collections',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Add trade limits patterns
    const tradeLimitPatterns = [
      /trade.*limit/i,
      /export.*credit.*limit/i,
      /import.*lc.*limit/i,
      /invoice.*financing.*limit/i,
      /documentary.*collection.*limit/i
    ];

    if (tradeLimitPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'trade_limits',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Add suspicious transaction patterns
    const suspiciousPatterns = [
      /suspicious.*transaction/i,
      /unusual.*transaction/i,
      /flagged.*transaction/i,
      /transaction.*flag/i,
      /transaction.*alert/i
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'suspicious_transactions',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Add watchlist status patterns
    const watchlistPatterns = [
      /watchlist/i,
      /sanction.*list/i,
      /ofac/i,
      /fatf/i,
      /un.*list/i
    ];

    if (watchlistPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'watchlist_status',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Add regulatory compliance patterns
    const regulatoryPatterns = [
      /regulatory.*compliance/i,
      /compliance.*status/i,
      /aml.*status/i,
      /cft.*status/i,
      /fatca.*status/i,
      /crs.*status/i
    ];

    if (regulatoryPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'regulatory_compliance',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Add audit log patterns
    const auditPatterns = [
      /audit.*log/i,
      /compliance.*log/i,
      /change.*history/i,
      /modification.*history/i,
      /update.*history/i
    ];

    if (auditPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'audit_logs',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Add data consent patterns
    const consentPatterns = [
      /data.*consent/i,
      /consent.*status/i,
      /consent.*log/i,
      /data.*permission/i,
      /data.*sharing.*consent/i
    ];

    if (consentPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'data_consent',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Add transaction detection
    const transactionKeywords = [
      'transaction', 'transactions', 'spend', 'spending',
      'purchase', 'purchases', 'payment', 'payments',
      'expense', 'expenses', 'history', 'activities'
    ];
    
    const transactionPatterns = [
      /show.*transaction/,
      /my.*transaction/,
      /recent.*transaction/,
      /last.*transaction/,
      /transaction.*history/,
      /spending.*history/,
      /payment.*history/,
      /expense.*history/
    ];
    
    if (transactionKeywords.some(keyword => normalizedQuery.includes(keyword)) ||
        transactionPatterns.some(pattern => pattern.test(normalizedQuery))) {
      console.log('Detected transactions intent');
      return {
        type: 'transactions',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Handle common typos and variations for loan queries
    const loanPatterns = [
      /\b(loan|loadn|lona|laon)\b/,
      /\b(loan|loadn|lona|laon)\s*(detail|info|status|balance)/,
      /my\s*(loan|loadn|lona|laon)/,
      /show\s*(loan|loadn|lona|laon)/,
      /give\s*(loan|loadn|lona|laon)/,
      /loan\s*amount/,
      /loan\s*balance/,
      /loan\s*status/,
      /loan\s*details?/,
      /loan\s*information/
    ];

    if (loanPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'loan',
        entities: {}
      };
    }

    // Treasury services detection
    const treasuryKeywords = [
      'treasury', 'treasuries',
      'forward contract', 'forward contracts',
      'derivative', 'derivatives',
      'forex', 'foreign exchange'
    ];
    
    const treasuryPatterns = [
      /treasury.*service/,
      /service.*treasury/,
      /show.*treasury/,
      /tell.*treasury/,
      /my.*treasury/,
      /give.*treasury/
    ];
    
    if (treasuryKeywords.some(keyword => normalizedQuery.includes(keyword)) ||
        treasuryPatterns.some(pattern => pattern.test(normalizedQuery))) {
      console.log('Detected treasury services intent with keyword/pattern match');
      return {
        type: 'treasury_services',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Trade finance detection
    const tradeKeywords = [
      'trade finance', 'trade financing',
      'letter of credit', 'lc',
      'bank guarantee', 'bg',
      'import', 'export'
    ];
    
    if (tradeKeywords.some(keyword => normalizedQuery.includes(keyword))) {
      console.log('Detected trade finance intent');
      return {
        type: 'trade_finance',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Credit reports detection
    const creditKeywords = [
      'credit report', 'credit score',
      'credit rating', 'credit history'
    ];
    
    if (creditKeywords.some(keyword => normalizedQuery.includes(keyword))) {
      console.log('Detected credit reports intent');
      return {
        type: 'credit_reports',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Account types detection
    const accountKeywords = [
      'account type', 'account types',
      'type of account', 'types of account',
      'banking account', 'bank account'
    ];
    
    if (accountKeywords.some(keyword => normalizedQuery.includes(keyword))) {
      console.log('Detected account types intent');
      return {
        type: 'account_types',
        entities: {
          companyId: this.companyId
        }
      };
    }

    // Payment methods detection
    const paymentKeywords = [
      'payment', 'payments',
      'pay', 'paying',
      'method', 'methods',
      'transfer', 'transfers'
    ];
    
    const paymentPatterns = [
      /how.*pay/,
      /payment.*method/,
      /methods.*payment/,
      /ways.*pay/,
      /can.*pay/,
      /show.*payment/,
      /tell.*payment/,
      /my.*payment/,
      /give.*payment/
    ];
    
    if (paymentKeywords.some(keyword => normalizedQuery.includes(keyword)) ||
        paymentPatterns.some(pattern => pattern.test(normalizedQuery))) {
      console.log('Detected payment methods intent with keyword/pattern match');
      return {
        type: 'payment_methods',
        entities: {
          companyId: this.companyId
        }
      };
    }
    
    // Enhanced loan detection with common misspellings, variations and patterns
    // Remove the duplicate loanPatterns declaration and its related check
    // Check if any loan-related keyword is present
    const loanKeywords = ['loan', 'credit', 'borrowing', 'debt'];
    
    if (loanKeywords.some(keyword => normalizedQuery.includes(keyword))) {
      console.log('Detected loan intent with keyword match');
      return {
        type: 'loan',
        entities: {}
      };
    }
    
    if (normalizedQuery.includes('working capital') || normalizedQuery.includes('working_capital')) {
      console.log('Detected working capital intent');
      return {
        type: 'working_capital',
        entities: {
          companyId: this.companyId
        }
      };
    }
    
    if (normalizedQuery.includes('npn') || normalizedQuery.includes('report')) {
      return {
        type: 'npn_report',
        entities: {
          companyId: this.companyId,
          reportType: 'npn'
        }
      };
    }

    if (normalizedQuery.includes('company') || 
        normalizedQuery.includes('about') || 
        normalizedQuery.includes('name') || 
        /what.*company.*name/.test(normalizedQuery) ||
        /what.*name.*company/.test(normalizedQuery) ||
        /my.*company.*name/.test(normalizedQuery) ||
        /my.*company/.test(normalizedQuery)) {
      return {
        type: 'company_info',
        entities: {
          companyId: this.companyId
        }
      };
    }

    if (normalizedQuery.includes('financial') || 
        normalizedQuery.includes('revenue') || 
        normalizedQuery.includes('profit')) {
      return {
        type: 'financial_data',
        entities: {
          companyId: this.companyId,
          metric: this.extractFinancialMetric(normalizedQuery)
        }
      };
    }

    // Add patterns for new intents
    const signatoryPatterns = [
      /authorized.*signatory/,
      /signatory.*details/,
      /signing.*authority/,
      /who.*sign/,
      /authority.*sign/
    ];
    
    if (signatoryPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'authorized_signatory',
        entities: {
          companyId: this.companyId
        }
      };
    }

    const bankAccountPatterns = [
      /bank.*account/,
      /account.*details/,
      /account.*balance/,
      /account.*statement/,
      /account.*info/
    ];
    
    if (bankAccountPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'bank_accounts',
        entities: {
          companyId: this.companyId
        }
      };
    }

    const supportTicketPatterns = [
      /support.*ticket/,
      /ticket.*status/,
      /help.*desk/,
      /issue.*status/,
      /complaint.*status/
    ];
    
    if (supportTicketPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'support_tickets',
        entities: {
          companyId: this.companyId
        }
      };
    }

    const digitalAccessPatterns = [
      /digital.*access/,
      /login.*history/,
      /access.*log/,
      /user.*access/,
      /2fa|two.*factor/
    ];
    
    if (digitalAccessPatterns.some(pattern => pattern.test(normalizedQuery))) {
      return {
        type: 'digital_access',
        entities: {
          companyId: this.companyId
        }
      };
    }

    return {
      type: 'general',
      entities: {
        companyId: this.companyId
      }
    };
  }

  private extractFinancialMetric(query: string): string {
    if (query.includes('revenue')) return 'revenue';
    if (query.includes('profit')) return 'profit';
    if (query.includes('margin')) return 'margin';
    if (query.includes('growth')) return 'growth';
    return 'general';
  }

  private async fetchCompanyData(): Promise<CompanyData> {
    const companyRef = doc(db, 'companies', this.companyId);
    console.log('Fetching company data from path:', companyRef.path);
    
    const companyDoc = await getDoc(companyRef);
    
    if (!companyDoc.exists()) {
      console.error('Company not found:', this.companyId);
      throw new Error('Company data not found');
    }

    return companyDoc.data() as CompanyData;
  }

  private async fetchNPNReport(intent: QueryIntent): Promise<DocumentData | null> {
    try {
      const reportsRef = collection(db, 'npn_reports');
      const q = query(
        reportsRef,
        where('companyId', '==', intent.entities.companyId),
        where('type', '==', 'npn')
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      return querySnapshot.docs[0].data();
    } catch (error) {
      console.error('Error fetching NPN report:', error);
      return null;
    }
  }

  private async fetchFinancialData(intent: QueryIntent): Promise<DocumentData | null> {
    try {
      const financialsRef = collection(db, 'financials');
      const q = query(
        financialsRef,
        where('companyId', '==', intent.entities.companyId)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      return querySnapshot.docs[0].data();
    } catch (error) {
      console.error('Error fetching financial data:', error);
      return null;
    }
  }

  private async processPaymentMethodsQuery(companyData: any): Promise<{ data: any; context: string }> {
    console.log('Processing payment methods query');
    
    // Check if payment methods exist in the correct path
    const paymentMethods = companyData.services?.npn_reports?.payment_methods;
    
    if (!paymentMethods || paymentMethods.length === 0) {
      return {
        data: null,
        context: `${companyData.name}, I couldn't find any payment methods information in your profile. Please contact your relationship manager for information about available payment options.`
      };
    }

    return {
      data: paymentMethods,
      context: `${companyData.name}, here are your available payment methods:\n\n• ${paymentMethods.join('\n• ')}`
    };
  }

  private async processTreasuryServicesQuery(companyData: any): Promise<QueryResult> {
    console.log('Processing treasury services query');
    
    const treasuryServices = companyData.services?.npn_reports?.treasury_services;
    
    if (!treasuryServices) {
      return {
        data: null,
        context: `${companyData.name}, I couldn't find any treasury services information in your profile. Please contact your relationship manager for information about available services.`
      };
    }

    const servicesList = Object.entries(treasuryServices)
      .map(([key, value]) => `${key.replace(/_/g, ' ').split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')}: ${value ? '✅ Enabled' : '❌ Not available'}`)
      .join('\n\n');

    return {
      data: treasuryServices,
      context: `Here are your available treasury services:\n\n${servicesList}`
    };
  }

  private async processTradeFinanceQuery(companyData: any): Promise<{ data: any; context: string }> {
    console.log('Processing trade finance query');
    
    const tradeFinance = companyData.services?.npn_reports?.trade_finance;
    
    if (!tradeFinance) {
      return {
        data: null,
        context: `${companyData.name}, I couldn't find any trade finance information in your profile. Please contact your relationship manager for information about trade finance services.`
      };
    }

    let response = `${companyData.name}, here are your trade finance details:\n\n`;

    if (tradeFinance.letter_of_credit) {
      const lc = tradeFinance.letter_of_credit;
      response += `Letter of Credit:\n`;
      response += `• Limit: ${this.formatCurrency(lc.limit)}\n`;
      response += `• Utilized: ${this.formatCurrency(lc.utilized)} (${((lc.utilized/lc.limit)*100).toFixed(1)}%)\n\n`;
    }

    if (tradeFinance.bank_guarantees) {
      const bg = tradeFinance.bank_guarantees;
      response += `Bank Guarantees:\n`;
      response += `• Limit: ${this.formatCurrency(bg.limit)}\n`;
      response += `• Utilized: ${this.formatCurrency(bg.utilized)} (${((bg.utilized/bg.limit)*100).toFixed(1)}%)\n\n`;
    }

    if (tradeFinance.import_export) {
      const ie = tradeFinance.import_export;
      response += `Import/Export Facilities:\n`;
      response += `• Export Credit Limit: ${this.formatCurrency(ie.export_credit_limit)}\n`;
      response += `• Import LC Limit: ${this.formatCurrency(ie.import_lc_limit)}`;
    }

    return {
      data: tradeFinance,
      context: response
    };
  }

  private async processCreditReportsQuery(companyData: any): Promise<{ data: any; context: string }> {
    console.log('Processing credit reports query');
    
    const creditReports = companyData.services?.npn_reports?.credit_reports;
    
    if (!creditReports) {
      return {
        data: null,
        context: `${companyData.name}, I couldn't find any credit report information in your profile. Please contact your relationship manager for credit information.`
      };
    }

    const lastUpdated = new Date(creditReports.last_updated).toLocaleDateString();
    
    return {
      data: creditReports,
      context: `${companyData.name}, here is your credit information:\n\n` +
              `Credit Score: ${creditReports.credit_score}\n` +
              `Last Updated: ${lastUpdated}`
    };
  }

  private async processAccountTypesQuery(companyData: any): Promise<{ data: any; context: string }> {
    console.log('Processing account types query');
    
    const accountTypes = companyData.services?.npn_reports?.account_types;
    
    if (!accountTypes || accountTypes.length === 0) {
      return {
        data: null,
        context: `${companyData.name}, I couldn't find any account type information in your profile. Please contact your relationship manager for information about available account types.`
      };
    }

    return {
      data: accountTypes,
      context: `${companyData.name}, here are your available account types:\n\n• ${accountTypes.join('\n• ')}`
    };
  }

  private async processTransactionsQuery(companyData: any): Promise<{ data: any; context: string }> {
    try {
      const transactions: Transaction[] = companyData.transactions || [];
      
      if (!transactions || transactions.length === 0) {
        return {
          data: null,
          context: "I don't see any transaction records for your company at the moment."
        };
      }

      // Sort transactions by date in descending order
      const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Calculate some basic statistics
      const totalAmount = transactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
      const categories = [...new Set(transactions.map((t: Transaction) => t.category))];
      
      // Group transactions by category
      const categoryTotals = transactions.reduce((acc: CategoryTotals, t: Transaction) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {});

      const response = `Here's a summary of your transactions:

Total Spending: ${formatCurrency(totalAmount)}

Spending by Category:
${Object.entries(categoryTotals)
  .sort(([, a], [, b]) => b - a)
  .map(([category, amount]) => `- ${category}: ${formatCurrency(amount)}`)
  .join('\n')}

Recent Transactions:
${sortedTransactions.slice(0, 5).map((t: Transaction) => 
  `- ${t.date}: ${formatCurrency(t.amount)} at ${t.merchant} (${t.category})`
).join('\n')}`;

      return {
        data: {
          transactions: sortedTransactions,
          totalAmount,
          categoryTotals,
          categories
        },
        context: response
      };
    } catch (error) {
      console.error('Error processing transactions query:', error);
      return {
        data: null,
        context: "I apologize, but I encountered an error while processing your transaction data."
      };
    }
  }

  async processQuery(query: string): Promise<QueryResult> {
    try {
      console.log('Processing query:', query);
      const intent = await this.extractIntent(query);
      console.log('Extracted intent:', intent);

      const companyData = await this.fetchCompanyData();
      console.log('Fetched company data');

      switch (intent.type) {
        case 'kyc_compliance':
          console.log('Processing KYC compliance query');
          return await this.processKYCComplianceQuery(companyData);
        case 'company_info':
          console.log('Detected company info query');
          return {
            data: {
              name: companyData.name,
              id: companyData.id
            },
            context: `Your company name is ${companyData.name}.`
          };

        case 'loan':
        console.log('Processing loan query');
        return await this.processLoanQuery(companyData);
      
        case 'working_capital':
        console.log('Detected working capital query');
        return await this.processWorkingCapitalQuery(companyData);
        
        case 'payment_methods':
          console.log('Detected payment methods query');
          return await this.processPaymentMethodsQuery(companyData);
        
        case 'treasury_services':
          console.log('Detected treasury services query');
          return await this.processTreasuryServicesQuery(companyData);
        
        case 'trade_finance':
          console.log('Detected trade finance query');
          return await this.processTradeFinanceQuery(companyData);

        case 'credit_reports':
          console.log('Detected credit reports query');
          return await this.processCreditReportsQuery(companyData);

        case 'account_types':
          console.log('Detected account types query');
          return await this.processAccountTypesQuery(companyData);

        case 'transactions':
          console.log('Detected transactions query');
          return await this.processTransactionsQuery(companyData);
        
        case 'authorized_signatory':
          console.log('Detected authorized signatory query');
          return await this.processSignatoryQuery(companyData);
        case 'bank_accounts':
          console.log('Detected bank accounts query');
          return await this.processBankAccountsQuery(companyData);
        case 'support_tickets':
          console.log('Detected support tickets query');
          return await this.processSupportTicketsQuery(companyData);
        case 'digital_access':
          console.log('Detected digital access query');
          return await this.processDigitalAccessQuery(companyData);
        
        case 'working_capital_facility':
          return await this.processWorkingCapitalFacilityQuery(companyData);
        case 'bank_guarantees':
          return await this.processBankGuaranteesQuery(companyData);
        case 'letters_of_credit':
          return await this.processLettersOfCreditQuery(companyData);
        case 'invoice_financing':
          return await this.processInvoiceFinancingQuery(companyData);
        case 'documentary_collections':
          return await this.processDocumentaryCollectionsQuery(companyData);
        case 'trade_limits':
          return await this.processTradeLimitsQuery(companyData);
        case 'suspicious_transactions':
          return await this.processSuspiciousTransactionsQuery(companyData);
        case 'watchlist_status':
          return await this.processWatchlistStatusQuery(companyData);
        case 'regulatory_compliance':
          return await this.processRegulatoryComplianceQuery(companyData);
        case 'audit_logs':
          return await this.processAuditLogsQuery(companyData);
        case 'data_consent':
          return await this.processDataConsentQuery(companyData);
        
        default:
      // Default response if query type not recognized
      return {
        data: null,
        context: `I'm not sure how to help with that query. You can ask me about:\n` +
                `- Working capital information\n` +
                `- Loan details\n` +
                `- Account balances\n` +
                    `- Payment methods\n` +
                    `- Treasury services\n` +
                `- Banking services`
      };
      }

    } catch (error) {
      console.error('Error in NLPQueryService.processQuery:', error);
      return {
        data: null,
        context: 'I apologize, but I encountered an error while processing your query. Please try again.'
      };
    }
  }

  private generateCompanyOverview(companyData: any): string {
    console.log('Generating overview for company data:', {
      name: companyData.name,
      hasServices: !!companyData.services,
      servicesAvailable: companyData.services ? Object.keys(companyData.services) : [],
      hasLoans: !!companyData.loans?.length,
      hasAccountTypes: !!companyData.account_types?.length
    });

    const services = companyData.services || {};
    const parts = [`Dear ${companyData.name},`];
    let hasAnyService = false;

    // Working Capital
    if (services.working_capital) {
      hasAnyService = true;
      const wc = services.working_capital;
      const utilized = formatCurrency(Number(wc.utilized));
      const limit = formatCurrency(Number(wc.limit));
      const percentage = ((Number(wc.utilized) / Number(wc.limit)) * 100).toFixed(1);
      parts.push(`Your working capital facility has a limit of ${limit}, with ${utilized} (${percentage}%) utilized.`);
    }

    // Loans
    if (companyData.loans?.length > 0) {
      hasAnyService = true;
      const loanSummary = companyData.loans.map((loan: any) => 
        `${loan.type}: ${formatCurrency(loan.amount)} at ${loan.interest_rate}% for ${loan.tenure_months} months`
      );
      parts.push(`Active loans:\n• ${loanSummary.join('\n• ')}`);
    }

    // Trade Finance
    if (services.trade_finance) {
      hasAnyService = true;
      const tf = services.trade_finance;
      if (tf.bank_guarantees) {
        const bg = tf.bank_guarantees;
        const bgPercentage = ((Number(bg.utilized) / Number(bg.limit)) * 100).toFixed(1);
        parts.push(`Bank Guarantee: ${formatCurrency(bg.utilized)} utilized (${bgPercentage}% of ${formatCurrency(bg.limit)})`);
      }
      if (tf.letter_of_credit) {
        const lc = tf.letter_of_credit;
        const lcPercentage = ((Number(lc.utilized) / Number(lc.limit)) * 100).toFixed(1);
        parts.push(`Letter of Credit: ${formatCurrency(lc.utilized)} utilized (${lcPercentage}% of ${formatCurrency(lc.limit)})`);
      }
    }

    // Account Types
    if (companyData.account_types?.length > 0) {
      hasAnyService = true;
      parts.push(`Account types: ${companyData.account_types.join(', ')}`);
    }

    if (!hasAnyService) {
      return `Hi! ${companyData.name}, we don't currently have any records of your working capital, loans, or other financial services with us. Please contact us if you have any questions.`;
    }

    return parts.join('\n\n');
  }

  private extractWorkingCapitalData(services: any): any {
    if (!services) return null;
    
    // Check for working capital in npn_reports
    if (services.npn_reports?.working_capital) {
      return services.npn_reports.working_capital;
    }
    
    // Direct check (fallback)
    if (services.working_capital) {
      return services.working_capital;
    }
    
    return null;
  }

  private async processWorkingCapitalQuery(companyData: any): Promise<{ data: any; context: string }> {
    console.log('Processing working capital query');
    const services = companyData.services;
    const workingCapital = this.extractWorkingCapitalData(services);

    if (!workingCapital) {
      return {
        data: null,
        context: `${companyData.name}, your working capital information is not currently available. Please contact your relationship manager.`
      };
    }

    const utilized = Number(workingCapital.utilized);
    const limit = Number(workingCapital.limit);
    const utilizationPercentage = ((utilized / limit) * 100).toFixed(1);
    const lastReviewDate = workingCapital.last_review_date 
      ? new Date(workingCapital.last_review_date).toLocaleDateString()
      : 'not available';

    return {
      data: workingCapital,
      context: `${companyData.name}, your working capital facility has a limit of ${this.formatCurrency(limit)}, ` +
        `with ${this.formatCurrency(utilized)} (${utilizationPercentage}%) utilized. ` +
        `Last review date: ${lastReviewDate}.`
    };
  }

  private async processSignatoryQuery(companyData: any): Promise<{ data: any; context: string }> {
    const signatory = companyData.Authorized_Signatory;
    if (!signatory) {
      return {
        data: null,
        context: "I couldn't find any authorized signatory information."
      };
    }

    const response = `Authorized Signatory Details:
Name: ${signatory.Full_Name}
Designation: ${signatory.Designation}
Type: ${signatory.Type_of_Signatory}
Authority Limit: ${signatory.Signing_Authority_Limit}
Status: ${signatory.Approval_Status}
KYC Status: ${signatory.KYC_Status}
Contact: ${signatory.Contact_Number}
Email: ${signatory.Email_Address}`;

    return {
      data: signatory,
      context: response
    };
  }

  private async processBankAccountsQuery(companyData: any): Promise<{ data: any; context: string }> {
    const accounts: BankAccount[] = companyData.Bank_Accounts;
    if (!accounts || accounts.length === 0) {
      return {
        data: null,
        context: "I couldn't find any bank account information."
      };
    }

    const response = accounts.map((account: BankAccount) => `
Account Number: XXXX${account.Account_Number.slice(-4)}
Bank: ${account.Bank_Name}
Type: ${account.Account_Type}
Balance: ${formatCurrency(account.Current_Balance)}
Status: ${account.Account_Status}
Branch: ${account.Branch_Name}`).join('\n\n');

    return {
      data: accounts,
      context: `Here are your bank account details:\n${response}`
    };
  }

  private async processSupportTicketsQuery(companyData: any): Promise<{ data: any; context: string }> {
    const tickets: SupportTicket[] = companyData.Support_Tickets;
    if (!tickets || tickets.length === 0) {
      return {
        data: null,
        context: "I couldn't find any support tickets."
      };
    }

    const activeTickets = tickets.filter((t: SupportTicket) => t.Status !== 'Resolved');
    const response = `Support Tickets Summary:
Active Tickets: ${activeTickets.length}
Total Tickets: ${tickets.length}

Recent Tickets:
${tickets.slice(0, 3).map((ticket: SupportTicket) => `
ID: ${ticket.Ticket_ID}
Issue: ${ticket.Issue}
Status: ${ticket.Status}
Priority: ${ticket.Priority}
Raised: ${ticket.Raised_On}`).join('\n')}`;

    return {
      data: tickets,
      context: response
    };
  }

  private async processDigitalAccessQuery(companyData: any): Promise<{ data: any; context: string }> {
    const access = companyData.Digital_Access_Security;
    if (!access) {
      return {
        data: null,
        context: "I couldn't find any digital access information."
      };
    }

    const response = `Digital Access Status:
Portal Access: ${access.Portal_Access_Enabled ? 'Enabled' : 'Disabled'}
2FA Status: ${access.TwoFA_Enabled ? 'Enabled' : 'Disabled'}
Last Login: ${access.Last_Login_Time}

Authorized Users:
${access.Users_With_Access.map((user: User) => `
- ${user.Name} (${user.Role})
  Status: ${user.Status}
  2FA: ${user.TwoFA_Enabled ? 'Enabled' : 'Disabled'}`).join('\n')}`;

    return {
      data: access,
      context: response
    };
  }

  private async processKYCComplianceQuery(companyData: any): Promise<{ data: any; context: string }> {
    try {
      const kyc = companyData.KYC_Compliance;
      if (!kyc) {
        return {
          data: null,
          context: "I couldn't find any KYC compliance information."
        };
      }

      const response = `Here are your KYC details:

KYC Status: ${kyc.KYC_Status}
Last Updated: ${kyc.Date_of_KYC_Completion}
Risk Category: ${kyc.Risk_Category}

Compliance Status:
- AML/CFT Status: ${kyc.AML_CFT_Status}
- FATCA Status: ${kyc.FATCA_Status}
- CRS Declaration: ${kyc.CRS_Declaration}
- PEP Status: ${kyc.PEP_Flag ? 'Flagged' : 'Not Flagged'}

${kyc.Compliance_Notes ? `Additional Notes: ${kyc.Compliance_Notes}` : ''}`;

      return {
        data: kyc,
        context: response
      };
    } catch (error) {
      console.error('Error processing KYC query:', error);
      return {
        data: null,
        context: "I apologize, but I encountered an error while retrieving your KYC information."
      };
    }
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }

  private async processLoanQuery(companyData: any): Promise<{ data: any; context: string }> {
    console.log('Processing loan query');
    
    // Check if loans exist in the correct path
    let loans = companyData.services?.npn_reports?.loans;
    if (!loans && companyData.loans) {
      loans = companyData.loans;
    }
    
    if (!loans || loans.length === 0) {
      return {
        data: null,
        context: `${companyData.name}, you currently don't have any active loans with us. Please contact your relationship manager for information about loan products.`
      };
    }

    // Calculate total loan amount
    const totalAmount = loans.reduce((sum: number, loan: any) => sum + loan.amount, 0);
    
    const loanSummary = loans.map((loan: any) => 
      `${loan.type}: ${this.formatCurrency(loan.amount)} at ${loan.interest_rate}% for ${loan.tenure_months} months`
    );

    // Enhanced response with more natural language
    return {
      data: loans,
      context: `${companyData.name}, here are your loan details:\n\n` +
              `You have a total loan amount of ${this.formatCurrency(totalAmount)} across ${loans.length} loans:\n\n` +
              `Individual loans:\n• ${loanSummary.join('\n• ')}`
    };
  }

  private async processWorkingCapitalFacilityQuery(companyData: any): Promise<QueryResult> {
    const wcf = companyData.Working_Capital_Facility;
    if (!wcf) {
      return {
        data: null,
        context: "I couldn't find any working capital facility information for your company."
      };
    }

    return {
      data: wcf,
      context: `Working Capital Facility Details:
• Facility ID: ${wcf.Facility_ID}
• Available Limit: ${formatCurrency(wcf.Available_Limit)}
• Sanctioned Limit: ${formatCurrency(wcf.Sanctioned_Limit)}
• Utilized Limit: ${formatCurrency(wcf.Utilized_Limit)}
• Drawing Power: ${formatCurrency(wcf.Drawing_Power)}
• Interest Rate: ${wcf.Interest_Rate}%
• Status: ${wcf.WC_Facility_Status}
• Next Review Due: ${wcf.Next_Review_Due}
• Collateral Type: ${wcf.Collateral_Type}
• Security Margin: ${wcf.Security_Margin}%`
    };
  }

  private async processBankGuaranteesQuery(companyData: any): Promise<QueryResult> {
    const guarantees = companyData.Trade_Finance?.Bank_Guarantees;
    if (!guarantees || guarantees.length === 0) {
      return {
        data: null,
        context: "I couldn't find any bank guarantees for your company."
      };
    }

    const activeGuarantees = guarantees.filter((bg: any) => bg.Status === 'Active');
    const totalLimit = guarantees.reduce((sum: number, bg: any) => sum + bg.Limit, 0);
    const totalUtilized = guarantees.reduce((sum: number, bg: any) => sum + bg.Utilized_Amount, 0);

    return {
      data: guarantees,
      context: `Bank Guarantee Summary:
Total Limit: ${formatCurrency(totalLimit)}
Total Utilized: ${formatCurrency(totalUtilized)}
Active Guarantees: ${activeGuarantees.length}

Active Bank Guarantees:
${activeGuarantees.map((bg: any) => 
  `• ${bg.BG_Number}
   - Type: ${bg.Type}
   - Amount: ${formatCurrency(bg.Available_Amount)}
   - Beneficiary: ${bg.Beneficiary_Name}
   - Expiry: ${bg.Expiry_Date}`
).join('\n')}`
    };
  }

  private async processLettersOfCreditQuery(companyData: any): Promise<QueryResult> {
    const lcs = companyData.Trade_Finance?.Letters_of_Credit;
    if (!lcs || lcs.length === 0) {
      return {
        data: null,
        context: "I couldn't find any letters of credit for your company."
      };
    }

    const activeLCs = lcs.filter((lc: any) => lc.Status === 'Active');
    const totalLimit = lcs.reduce((sum: number, lc: any) => sum + lc.Limit, 0);
    const totalUtilized = lcs.reduce((sum: number, lc: any) => sum + lc.Utilized_Amount, 0);

    return {
      data: lcs,
      context: `Letters of Credit Summary:
Total Limit: ${formatCurrency(totalLimit)}
Total Utilized: ${formatCurrency(totalUtilized)}
Active LCs: ${activeLCs.length}

Active Letters of Credit:
${activeLCs.map((lc: any) => 
  `• ${lc.LC_Number}
   - Type: ${lc.LC_Type}
   - Available Amount: ${formatCurrency(lc.Available_Amount)}
   - Beneficiary: ${lc.Beneficiary_Name}
   - Expiry: ${lc.Expiry_Date}`
).join('\n')}`
    };
  }

  private async processInvoiceFinancingQuery(companyData: any): Promise<QueryResult> {
    const invoices = companyData.Trade_Finance?.Invoice_Financing;
    if (!invoices || invoices.length === 0) {
      return {
        data: null,
        context: "I couldn't find any invoice financing records for your company."
      };
    }

    const activeInvoices = invoices.filter((inv: any) => inv.Status === 'Active');
    const totalFinanced = activeInvoices.reduce((sum: number, inv: any) => sum + inv.Financed_Amount, 0);

    return {
      data: invoices,
      context: `Invoice Financing Summary:
Total Active Financing: ${formatCurrency(totalFinanced)}
Active Invoices: ${activeInvoices.length}

Active Invoice Financing:
${activeInvoices.map((inv: any) => 
  `• Invoice: ${inv.Invoice_Number}
   - Amount: ${formatCurrency(inv.Invoice_Amount)}
   - Financed: ${formatCurrency(inv.Financed_Amount)}
   - Due Date: ${inv.Due_Date}
   - Buyer: ${inv.Buyer_Name}`
).join('\n')}`
    };
  }

  private async processDocumentaryCollectionsQuery(companyData: any): Promise<QueryResult> {
    const collections = companyData.Trade_Finance?.Documentary_Collections;
    if (!collections || collections.length === 0) {
      return {
        data: null,
        context: "I couldn't find any documentary collections for your company."
      };
    }

    const pendingCollections = collections.filter((col: any) => col.Status === 'Pending');
    const totalAmount = collections.reduce((sum: number, col: any) => sum + col.Amount, 0);

    return {
      data: collections,
      context: `Documentary Collections Summary:
Total Amount: ${formatCurrency(totalAmount)}
Pending Collections: ${pendingCollections.length}

Collections:
${collections.map((col: any) => 
  `• Collection Date: ${col.Collection_Date}
   - Amount: ${formatCurrency(col.Amount)}
   - Type: ${col.Collection_Type}
   - Status: ${col.Status}
   - Drawee: ${col.Drawee_Name}`
).join('\n')}`
    };
  }

  private async processTradeLimitsQuery(companyData: any): Promise<QueryResult> {
    const limits = companyData.Trade_Finance?.Trade_Limits;
    if (!limits) {
      return {
        data: null,
        context: "I couldn't find any trade limit information for your company."
      };
    }

    return {
      data: limits,
      context: `Trade Limits Summary:
• Documentary Collection Limit: ${formatCurrency(limits.Documentary_Collection_Limit)}
• Export Credit Limit: ${formatCurrency(limits.Export_Credit_Limit)}
• Import LC Limit: ${formatCurrency(limits.Import_LC_Limit)}
• Invoice Financing Limit: ${formatCurrency(limits.Invoice_Financing_Limit)}`
    };
  }

  private async processSuspiciousTransactionsQuery(companyData: any): Promise<QueryResult> {
    const flags = companyData.Regulatory_Audit_Trail?.Suspicious_Transaction_Flags;
    if (!flags || flags.length === 0) {
      return {
        data: null,
        context: "There are no suspicious transaction flags on your account."
      };
    }

    return {
      data: flags,
      context: `Suspicious Transaction Flags:
${flags.map((flag: any) => 
  `• Transaction ${flag.Transaction_ID}
   - Reason: ${flag.Flag_Reason}
   - Status: ${flag.Review_Status}
   - Flagged On: ${flag.Flagged_On}`
).join('\n')}`
    };
  }

  private async processWatchlistStatusQuery(companyData: any): Promise<QueryResult> {
    const watchlist = companyData.Regulatory_Audit_Trail?.Watchlist_Hits;
    if (!watchlist) {
      return {
        data: null,
        context: "I couldn't find any watchlist information for your company."
      };
    }

    const hits = Object.entries(watchlist)
      .filter(([_, value]) => value === true)
      .map(([list, _]) => list);

    return {
      data: watchlist,
      context: hits.length > 0 ?
        `Warning: Your company has hits on the following watchlists: ${hits.join(', ')}` :
        "Your company has no hits on any watchlists (FATF, OFAC, UN, etc.)."
    };
  }

  private async processRegulatoryComplianceQuery(companyData: any): Promise<QueryResult> {
    const compliance = companyData.KYC_Compliance;
    if (!compliance) {
      return {
        data: null,
        context: "I couldn't find any regulatory compliance information for your company."
      };
    }

    return {
      data: compliance,
      context: `Regulatory Compliance Status:
• AML/CFT Status: ${compliance.AML_CFT_Status}
• FATCA Status: ${compliance.FATCA_Status}
• CRS Declaration: ${compliance.CRS_Declaration}
• Risk Category: ${compliance.Risk_Category}
• KYC Status: ${compliance.KYC_Status}
• Last KYC Update: ${compliance.Date_of_KYC_Completion}
${compliance.Compliance_Notes ? `\nNotes: ${compliance.Compliance_Notes}` : ''}`
    };
  }

  private async processAuditLogsQuery(companyData: any): Promise<QueryResult> {
    const logs = companyData.Regulatory_Audit_Trail?.Audit_Logs;
    if (!logs || logs.length === 0) {
      return {
        data: null,
        context: "I couldn't find any audit logs for your company."
      };
    }

    return {
      data: logs,
      context: `Recent Audit Logs:
${logs.map((log: any) => 
  `• ${log.Timestamp}
   - Change: ${log.Change_Description}
   - By: ${log.Changed_By}
   - Log ID: ${log.Log_ID}`
).join('\n')}`
    };
  }

  private async processDataConsentQuery(companyData: any): Promise<QueryResult> {
    const consent = companyData.Regulatory_Audit_Trail?.Data_Consent_Log;
    if (!consent) {
      return {
        data: null,
        context: "I couldn't find any data consent information for your company."
      };
    }

    return {
      data: consent,
      context: `Data Consent Status:
• Consent Status: ${consent.Consent_Provided ? 'Provided' : 'Not Provided'}
• Last Updated: ${consent.Consent_Timestamp}
• Method: ${consent.Method}
• Document Reference: ${consent.Document_Reference}`
    };
  }

  private extractBGNumber(query: string): string | undefined {
    const bgMatch = query.match(/BG[0-9\-]+/i);
    return bgMatch ? bgMatch[0] : undefined;
  }

  private extractLCNumber(query: string): string | undefined {
    const lcMatch = query.match(/LC[0-9\-]+/i);
    return lcMatch ? lcMatch[0] : undefined;
  }
} 