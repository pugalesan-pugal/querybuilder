interface NpnReport {
  reportId: string;
  reportDate: Date;
  totalAssets: number;
  netWorth: number;
  profitLoss: number;
  fiscalYear: string;
}

interface AccountType {
  id: string;
  type: 'savings' | 'current' | 'fixed_deposit';
  balance: number;
  currency: string;
  openDate: Date;
  status: 'active' | 'inactive';
}

interface WorkingCapital {
  id: string;
  totalAmount: number;
  utilized: number;
  available: number;
  interestRate: number;
  lastReviewDate: Date;
}

interface Loan {
  id: string;
  type: 'term' | 'overdraft' | 'line_of_credit';
  amount: number;
  interestRate: number;
  startDate: Date;
  maturityDate: Date;
  outstandingAmount: number;
  status: 'active' | 'closed' | 'defaulted';
}

interface Finance {
  id: string;
  type: 'invoice' | 'purchase_order' | 'inventory';
  amount: number;
  utilizationDate: Date;
  dueDate: Date;
  status: 'pending' | 'approved' | 'rejected';
}

interface Payment {
  id: string;
  type: 'domestic' | 'international';
  amount: number;
  currency: string;
  date: Date;
  status: 'completed' | 'pending' | 'failed';
  beneficiary: string;
}

interface LetterOfCredit {
  id: string;
  amount: number;
  currency: string;
  issueDate: Date;
  expiryDate: Date;
  beneficiary: string;
  status: 'active' | 'expired' | 'cancelled';
}

interface BankGuarantee {
  id: string;
  type: 'performance' | 'financial' | 'advance_payment';
  amount: number;
  startDate: Date;
  endDate: Date;
  beneficiary: string;
  status: 'active' | 'expired' | 'claimed';
}

interface ImportExport {
  id: string;
  type: 'import' | 'export';
  documentType: 'bill_of_lading' | 'airway_bill' | 'commercial_invoice';
  amount: number;
  date: Date;
  status: 'in_transit' | 'delivered' | 'cleared';
}

interface CreditReport {
  id: string;
  reportDate: Date;
  creditScore: number;
  riskRating: 'low' | 'medium' | 'high';
  totalExposure: number;
  reportingAgency: string;
}

interface CashManagement {
  id: string;
  service: 'collection' | 'disbursement' | 'liquidity';
  transactionVolume: number;
  lastTransactionDate: Date;
  status: 'active' | 'inactive';
}

interface TreasuryService {
  id: string;
  type: 'forex' | 'derivatives' | 'investments';
  amount: number;
  currency: string;
  date: Date;
  maturityDate?: Date;
  status: 'active' | 'matured' | 'cancelled';
}

interface CompanyData {
  [key: string]: any;  // Allow string indexing
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

export interface Company {
  id: string;
  name: string;
  data: CompanyData;
}

export type Companies = Record<string, Company>; 