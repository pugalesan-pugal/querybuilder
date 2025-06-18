export interface NpnReport {
  reportId: string;
  reportDate: Date;
  totalAssets: number;
  netWorth: number;
  profitLoss: number;
  fiscalYear: string;
}

export interface AccountType {
  id: string;
  type: 'savings' | 'current' | 'fixed_deposit';
  balance: number;
  currency: string;
  openDate: Date;
  status: 'active' | 'inactive';
}

export interface WorkingCapital {
  limit: number;
  utilization: number;
  currency: string;
}

export interface Loan {
  type: string;
  amount: number;
  interest_rate: number;
  tenure_months: number;
}

export interface Finance {
  id: string;
  type: 'invoice' | 'purchase_order' | 'bill';
  amount: number;
  utilizationDate: Date;
  dueDate: Date;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Payment {
  id: string;
  type: 'domestic' | 'international' | 'internal';
  amount: number;
  currency: string;
  date: Date;
  status: 'pending' | 'completed' | 'failed';
  beneficiary: string;
}

export interface LetterOfCredit {
  id: string;
  amount: number;
  currency: string;
  issueDate: Date;
  expiryDate: Date;
  beneficiary: string;
  status: 'active' | 'expired' | 'cancelled';
}

export interface BankGuarantee {
  id: string;
  type: 'performance' | 'financial' | 'advance_payment';
  amount: number;
  startDate: Date;
  endDate: Date;
  beneficiary: string;
  status: 'active' | 'expired' | 'claimed';
}

export interface ImportExport {
  id: string;
  type: 'import' | 'export';
  documentType: 'bill_of_lading' | 'airway_bill' | 'commercial_invoice';
  amount: number;
  date: Date;
  status: 'pending' | 'in_transit' | 'completed';
}

export interface CreditReport {
  id: string;
  reportDate: Date;
  creditScore: number;
  riskRating: 'low' | 'medium' | 'high';
  totalExposure: number;
  reportingAgency: string;
}

export interface CashManagement {
  id: string;
  service: 'collection' | 'disbursement' | 'liquidity';
  transactionVolume: number;
  lastTransactionDate: Date;
  status: 'active' | 'inactive';
}

export interface TreasuryService {
  id: string;
  type: 'forex' | 'investment' | 'hedging';
  amount: number;
  date: Date;
  status: 'active' | 'completed' | 'cancelled';
}

export interface TradeFinance {
  lcLimit: number;
  lcUtilization: number;
  bgLimit: number;
  bgUtilization: number;
  currency: string;
}

export interface CompanyData {
  id: string;
  name: string;
  workingCapital?: WorkingCapital;
  loans?: Loan[];
  tradeFinance?: TradeFinance;
  paymentMethods?: string[];
  treasuryServices?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankCustomer {
  id?: string;
  email: string;
  name: string;
  companyId: string;
  company?: CompanyData;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
}

export interface BankData {
  company_info: {
    name: string;
    id: string;
  };
  financial_services: {
    working_capital?: {
      limit: number;
      utilized: number;
      utilization_percentage?: number;
      last_review_date?: string;
    };
    trade_finance?: {
      bank_guarantees?: {
        limit: number;
        utilized: number;
      };
      letter_of_credit?: {
        limit: number;
        utilized: number;
      };
      import_export?: {
        export_credit_limit: number;
        import_lc_limit: number;
      };
    };
  };
  loans?: Loan[];
  account_types?: string[];
  payment_methods?: string[];
  treasury_services?: {
    derivatives: boolean;
    forex_dealing: boolean;
    forward_contracts: boolean;
  };
}

export interface BankQueryIntent {
  type: 'working_capital' | 'company_info' | 'npn_report' | 'financial_data';
  parameters?: {
    [key: string]: any;
  };
}

export interface CompanyData {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  services: {
    working_capital?: {
      limit: number;
      utilized: number;
      last_review_date: string;
    };
    trade_finance?: {
      bank_guarantees?: {
        limit: number;
        utilized: number;
      };
      letter_of_credit?: {
        limit: number;
        utilized: number;
      };
    };
  };
  loans?: Loan[];
  account_types?: string[];
} 