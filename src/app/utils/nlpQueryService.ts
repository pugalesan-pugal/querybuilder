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
  private companyData: any;

  // Define identification document patterns
  private readonly ID_PATTERNS: { [key: string]: string[] } = {
    passport: ['passport', 'passport number', 'passport id'],
    pan: ['pan', 'pan number', 'pan card'],
    aadhaar: ['aadhaar', 'aadhar', 'aadhaar number', 'uid'],
    kyc: ['kyc', 'kyc status', 'verification status']
  };

  // Define data paths for different types of information
  private readonly DATA_PATHS: {
    identification: { [key: string]: string[] };
    personal: { [key: string]: string[] };
    banking: { [key: string]: string[] };
  } = {
    identification: {
      passport: ['Personal_KYC_ID', 'Passport_Number'],
      pan: ['Personal_KYC_ID', 'PAN_Number'],
      aadhaar: ['Personal_KYC_ID', 'Aadhaar_Number'],
      kyc: ['KYC_Compliance', 'KYC_Status']
    },
    personal: {
      name: ['Individual_Details', 'Full_Name'],
      email: ['Individual_Details', 'Email_Address'],
      phone: ['Individual_Details', 'Phone_Number'],
      address: ['Individual_Details', 'Residential_Address']
    },
    banking: {
      accounts: ['Bank_Accounts'],
      loans: ['Loans'],
      transactions: ['transactions']
    }
  };

  constructor(companyId: string) {
    this.companyId = companyId;
    console.log('Initializing NLPQueryService with companyId:', companyId);
  }

  private async fetchCompanyData(): Promise<void> {
    console.log('Fetching company data from path:', `companies/${this.companyId}`);
    try {
      // In your implementation, this would be a Firebase query
      // For now, we'll use the data passed to the service
      if (!this.companyData) {
        throw new Error('Company data not initialized');
      }
    } catch (error) {
      console.error('Error fetching company data:', error);
      throw error;
    }
  }

  private identifyQueryType(query: string): { type: string; subType?: string } {
    const lowerQuery = query.toLowerCase();

    // Check for ID document queries
    for (const [idType, patterns] of Object.entries(this.ID_PATTERNS)) {
      if (patterns.some(pattern => lowerQuery.includes(pattern))) {
        return { type: 'identification', subType: idType };
      }
    }

    // Check for personal information queries
    const personalKeywords = {
      name: ['name', 'called', 'who'],
      email: ['email', 'mail'],
      phone: ['phone', 'mobile', 'contact'],
      address: ['address', 'live', 'stay']
    };

    for (const [infoType, keywords] of Object.entries(personalKeywords)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        return { type: 'personal', subType: infoType };
      }
    }

    return { type: 'general' };
  }

  private extractDataByPath(paths: string[]): any {
    let current = this.companyData;
    for (const path of paths) {
      if (!current[path]) {
        return null;
      }
      current = current[path];
    }
    return current;
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

  async processQuery(query: string): Promise<{ hasData: boolean; context: string; data: any }> {
    console.log('Processing query:', query);
    
    try {
      await this.fetchCompanyData();
      const queryInfo = this.identifyQueryType(query);
      console.log('Extracted intent:', queryInfo);

      if (queryInfo.type === 'identification' && queryInfo.subType) {
        const paths = this.DATA_PATHS.identification[queryInfo.subType];
        if (paths) {
          const data = this.extractDataByPath(paths);
          if (data) {
            return {
              hasData: true,
              context: this.formatIdentificationResponse(data, queryInfo.subType),
              data: data
            };
          }
        }
      }

      // If no specific data found, return available options
      return {
        hasData: false,
        context: "I can help you with:\n" +
                "- Personal identification (passport, PAN, Aadhaar)\n" +
                "- Contact information (email, phone, address)\n" +
                "- Banking details (accounts, loans)\n" +
                "- Transaction history\n" +
                "Please specify what information you need.",
        data: null
      };
    } catch (error) {
      console.error('Error processing query:', error);
      return {
        hasData: false,
        context: "I apologize, but I encountered an error while processing your query. Please try again.",
        data: null
      };
    }
  }

  setCompanyData(data: any) {
    this.companyData = data;
  }
} 