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

export interface AuthorizedSignatory {
  Aadhaar_Number: string;
  Approval_Status: string;
  Authorized_Since: string;
  Contact_Number: string;
  Date_of_Birth: string;
  Designation: string;
  Email_Address: string;
  Full_Name: string;
  Gender: string;
  KYC_Documents_Provided: string[];
  KYC_Status: string;
  Nationality: string;
  PAN_Number: string;
  Passport_Number: string;
  Residential_Address: string;
  Signature_Specimen: string;
  Signing_Authority_Limit: string;
  Type_of_Signatory: string;
}

export interface WorkingCapitalFacility {
  Associated_Account_Number: string;
  Available_Limit: number;
  Banking_Relationship_Manager: string;
  Collateral_Type: string;
  Collateral_Value: number;
  Drawing_Power: number;
  Facility_ID: string;
  Interest_Payment_Frequency: string;
  Interest_Rate: number;
  Last_Review_Date: string;
  Moratorium_Period: number;
  Next_Review_Due: string;
  Renewal_Date: string;
  Repayment_Terms: string;
  Review_Notes: string;
  Sanctioned_Limit: number;
  Security_Margin: number;
  Utilization_Pattern: string;
  Utilized_Limit: number;
  WC_Facility_Status: string;
  WC_Notes: string;
  Working_Capital_Type: string;
}

export interface PersonalDetails {
  Brand_Name: string;
  Client_ID: string;
  Company_Name: string;
  Company_Type: string;
  Country_of_Incorporation: string;
  Country_of_Operation: string[];
  Currency_Preference: string;
  Date_of_Incorporation: string;
  Industry_Sector: string;
  Language_Preferences: string[];
  Legal_Name: string;
  Sub_sector: string;
}

export interface IndividualDetails {
  User_ID: string;
  Mother_Name: string;
  Maternal_Status: string;
  Primary_Point_of_Contact: string;
  Full_Name: string;
}

export interface ExtendedCompanyData {
  Authorized_Signatory: AuthorizedSignatory;
  Bank_Accounts: any[];
  Communication_Relationship: any;
  Contact_Communication: any;
  Credit_Reports: any;
  Digital_Access_Security: any;
  Individual_Details: IndividualDetails;
  KYC_Compliance: any;
  Loans: any[];
  Personal_Details: PersonalDetails;
  Personal_KYC_ID: any;
  Registration_Tax_IDs: any;
  Regulatory_Audit_Trail: any;
  System_Metadata: any;
  Trade_Finance: any;
  Working_Capital_Facility: WorkingCapitalFacility;
  createdAt: string;
  email: string;
  id: string;
  isActive: boolean;
  name: string;
  services: any;
  transactions: any[];
  updatedAt: string;
} 