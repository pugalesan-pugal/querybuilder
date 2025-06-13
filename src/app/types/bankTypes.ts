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
  interestRate: number;
  tenure: number;
  currency: string;
  status: 'active' | 'closed' | 'pending';
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
  email: string;
  name: string;
  companyId: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
}

export interface BankData {
  npn_report: NpnReport;
  account_types: AccountType[];
  working_capital: WorkingCapital;
  loans: Loan[];
  finance: Finance[];
  payments: Payment[];
  letter_of_credit: LetterOfCredit[];
  bank_guarantees: BankGuarantee[];
  import_export: ImportExport[];
  credit_reports: CreditReport[];
  cash_management: CashManagement[];
  treasury_services: TreasuryService[];
}

export interface BankQueryIntent {
  primaryIntent: 'npn_report' | 'account_types' | 'working_capital' | 'loans' | 
                'finance' | 'payments' | 'letter_of_credit' | 'bank_guarantees' | 
                'import_export' | 'credit_reports' | 'cash_management' | 'treasury_services';
  subIntent?: string;
  filters?: {
    dateRange?: {
      start: Date;
      end: Date;
    };
    status?: string;
    type?: string;
    amount?: {
      min?: number;
      max?: number;
    };
  };
} 