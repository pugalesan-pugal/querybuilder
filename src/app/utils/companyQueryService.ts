import { db } from './initFirebase';
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { formatCurrency, formatDate } from './formatUtils';

interface LoanData {
  id: string;
  type: string;
  amount: {
    sanctioned: number;
    disbursed: number;
    outstanding: number;
  };
  interest: number;
  tenure: number;
  status: string;
  purpose: string;
}

interface UserData {
  Name: string;
  Role: string;
  Email: string;
  TwoFA_Enabled: boolean;
  Status: string;
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

export class CompanyQueryService {
  private companyId: string;
  private companyData: any;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  async initialize() {
    const companyRef = doc(db, 'companies', this.companyId);
    const companySnap = await getDoc(companyRef);
    if (companySnap.exists()) {
      this.companyData = companySnap.data();
    } else {
      throw new Error('Company not found');
    }
  }

  private formatResponse(data: any, context: string): { data: any; response: string } {
    return {
      data,
      response: context
    };
  }

  async getCompanyOverview(): Promise<{ data: any; response: string }> {
    const { Personal_Details, Contact_Communication } = this.companyData;
    
    const overview = {
      name: Personal_Details.Company_Name,
      legalName: Personal_Details.Legal_Name,
      brandName: Personal_Details.Brand_Name,
      type: Personal_Details.Company_Type,
      incorporation: {
        date: Personal_Details.Date_of_Incorporation,
        country: Personal_Details.Country_of_Incorporation
      },
      operations: Personal_Details.Country_of_Operation,
      industry: {
        sector: Personal_Details.Industry_Sector,
        subSector: Personal_Details.Sub_sector
      },
      contact: {
        email: Contact_Communication.Primary_Email_Address,
        phone: Contact_Communication.Official_Phone_Number,
        website: Contact_Communication.Website_URL,
        locations: Contact_Communication.Operating_Locations
      }
    };

    const response = `${overview.name} (Brand: ${overview.brandName}) is a ${overview.type} company in the ${overview.industry.sector} sector, specifically ${overview.industry.subSector}. 
    Founded on ${formatDate(overview.incorporation.date)} in ${overview.incorporation.country}, they operate in ${overview.operations.join(' and ')}. 
    They can be reached at ${overview.contact.email} or ${overview.contact.phone}, and have offices in ${overview.contact.locations.join(', ')}.`;

    return this.formatResponse(overview, response);
  }

  async getFinancialOverview(): Promise<{ data: any; response: string }> {
    const { Bank_Accounts, Working_Capital_Facility, Credit_Reports } = this.companyData;
    
    const overview = {
      totalBalance: Bank_Accounts.reduce((sum: number, acc: any) => sum + acc.Current_Balance, 0),
      accounts: Bank_Accounts.length,
      workingCapital: {
        sanctioned: Working_Capital_Facility.Sanctioned_Limit,
        utilized: Working_Capital_Facility.Utilized_Limit,
        available: Working_Capital_Facility.Available_Limit
      },
      creditScore: Credit_Reports.Credit_Score,
      creditRating: Credit_Reports.Credit_Rating
    };

    const response = `Financial Overview:
    - Total Balance across ${overview.accounts} accounts: ${formatCurrency(overview.totalBalance)}
    - Working Capital: Sanctioned ${formatCurrency(overview.workingCapital.sanctioned)}, Utilized ${formatCurrency(overview.workingCapital.utilized)} (${Math.round(overview.workingCapital.utilized/overview.workingCapital.sanctioned*100)}% utilization)
    - Credit Score: ${overview.creditScore} (Rating: ${overview.creditRating})`;

    return this.formatResponse(overview, response);
  }

  async getLoanDetails(): Promise<{ data: any; response: string }> {
    const { Loans } = this.companyData;
    
    const overview = Loans.map((loan: any) => ({
      id: loan.Loan_ID,
      type: loan.Loan_Type,
      amount: {
        sanctioned: loan.Sanctioned_Amount,
        disbursed: loan.Disbursed_Amount,
        outstanding: loan.Total_Outstanding_Amount
      },
      interest: loan.Interest_Rate,
      tenure: loan.Tenure_Months,
      status: loan.Loan_Status,
      purpose: loan.Purpose_of_Loan
    } as LoanData));

    const totalOutstanding = overview.reduce((sum: number, loan: LoanData) => sum + loan.amount.outstanding, 0);
    const totalSanctioned = overview.reduce((sum: number, loan: LoanData) => sum + loan.amount.sanctioned, 0);

    const response = `Loan Portfolio Overview:
    Total Sanctioned Amount: ${formatCurrency(totalSanctioned)}
    Total Outstanding Amount: ${formatCurrency(totalOutstanding)}
    
    Active Loans:
    ${overview.map((loan: LoanData) => 
      `- ${loan.type} (${loan.id}):
       • Purpose: ${loan.purpose}
       • Sanctioned: ${formatCurrency(loan.amount.sanctioned)}
       • Outstanding: ${formatCurrency(loan.amount.outstanding)}
       • Interest Rate: ${loan.interest}%
       • Status: ${loan.status}`
    ).join('\n')}`;

    return this.formatResponse(overview, response);
  }

  async getTradeFinanceDetails(): Promise<{ data: any; response: string }> {
    const { Trade_Finance } = this.companyData;
    
    const overview = {
      limits: Trade_Finance.Trade_Limits,
      lc: Trade_Finance.Letters_of_Credit,
      bg: Trade_Finance.Bank_Guarantees,
      invoiceFinancing: Trade_Finance.Invoice_Financing
    };

    const response = `Trade Finance Overview:
    
    Limits:
    - Import LC Limit: ${formatCurrency(overview.limits.Import_LC_Limit)}
    - Export Credit Limit: ${formatCurrency(overview.limits.Export_Credit_Limit)}
    - Documentary Collection Limit: ${formatCurrency(overview.limits.Documentary_Collection_Limit)}
    - Invoice Financing Limit: ${formatCurrency(overview.limits.Invoice_Financing_Limit)}
    
    Active Facilities:
    - Letters of Credit: ${overview.lc.length} active LC(s)
    - Bank Guarantees: ${overview.bg.length} active BG(s)
    - Invoice Financing: ${overview.invoiceFinancing.length} active facility(ies)`;

    return this.formatResponse(overview, response);
  }

  async getComplianceStatus(): Promise<{ data: any; response: string }> {
    const { KYC_Compliance, Regulatory_Audit_Trail } = this.companyData;
    
    const overview = {
      kyc: {
        status: KYC_Compliance.KYC_Status,
        completionDate: KYC_Compliance.Date_of_KYC_Completion,
        riskCategory: KYC_Compliance.Risk_Category
      },
      aml: {
        status: Regulatory_Audit_Trail.AML_Flags.Status,
        lastChecked: Regulatory_Audit_Trail.AML_Flags.Last_Checked
      },
      fatca: KYC_Compliance.FATCA_Status,
      crs: KYC_Compliance.CRS_Declaration,
      watchlist: Regulatory_Audit_Trail.Watchlist_Hits
    };

    const response = `Compliance Status Overview:
    
    KYC Status: ${overview.kyc.status}
    - Completed on: ${formatDate(overview.kyc.completionDate)}
    - Risk Category: ${overview.kyc.riskCategory}
    
    AML Status: ${overview.aml.status}
    - Last checked: ${formatDate(overview.aml.lastChecked)}
    
    Other Compliance:
    - FATCA Status: ${overview.fatca}
    - CRS Declaration: ${overview.crs}
    
    Watchlist Checks:
    - OFAC: ${overview.watchlist.OFAC ? 'Hit' : 'Clear'}
    - FATF: ${overview.watchlist.FATF ? 'Hit' : 'Clear'}
    - UN: ${overview.watchlist.UN ? 'Hit' : 'Clear'}`;

    return this.formatResponse(overview, response);
  }

  async getDigitalAccess(): Promise<{ data: any; response: string }> {
    const { Digital_Access_Security } = this.companyData;
    
    const overview = {
      access: {
        enabled: Digital_Access_Security.Portal_Access_Enabled,
        twoFA: Digital_Access_Security.TwoFA_Enabled
      },
      users: Digital_Access_Security.Users_With_Access,
      ipWhitelist: Digital_Access_Security.IP_Whitelisting,
      lastLogin: Digital_Access_Security.Last_Login_Time
    };

    const response = `Digital Access Overview:
    
    Portal Status: ${overview.access.enabled ? 'Enabled' : 'Disabled'}
    2FA Status: ${overview.access.twoFA ? 'Enabled' : 'Disabled'}
    Last Login: ${formatDate(overview.lastLogin)}
    
    Authorized Users:
    ${overview.users.map((user: UserData) => 
      `- ${user.Name} (${user.Role})
       • Email: ${user.Email}
       • 2FA: ${user.TwoFA_Enabled ? 'Enabled' : 'Disabled'}
       • Status: ${user.Status}`
    ).join('\n')}
    
    IP Whitelist:
    ${overview.ipWhitelist.join('\n')}`;

    return this.formatResponse(overview, response);
  }

  static async updateAllCompaniesTransactions(creditCardTransactions: Transaction[], debitCardTransactions: Transaction[]): Promise<void> {
    try {
      // Combine credit and debit card transactions
      const allTransactions = [...creditCardTransactions, ...debitCardTransactions];
      
      // Get all companies
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      
      // Update each company
      const updatePromises = companiesSnapshot.docs.map(async (companyDoc) => {
        const companyRef = doc(db, 'companies', companyDoc.id);
        
        // Add or update transactions array
        await updateDoc(companyRef, {
          transactions: allTransactions
        });
        
        console.log(`Updated transactions for company: ${companyDoc.id}`);
      });
      
      // Wait for all updates to complete
      await Promise.all(updatePromises);
      console.log('Successfully updated transactions for all companies');
    } catch (error) {
      console.error('Error updating company transactions:', error);
      throw error;
    }
  }

  async processQuery(query: string): Promise<string> {
    const lowercaseQuery = query.toLowerCase();
    
    try {
      if (!this.companyData) {
        await this.initialize();
      }

      // Company overview
      if (lowercaseQuery.includes('company') || lowercaseQuery.includes('about') || 
          lowercaseQuery.includes('overview') || lowercaseQuery.includes('profile')) {
        const { response } = await this.getCompanyOverview();
        return response;
      }

      // Financial overview
      if (lowercaseQuery.includes('financial') || lowercaseQuery.includes('balance') || 
          lowercaseQuery.includes('account') || lowercaseQuery.includes('working capital')) {
        const { response } = await this.getFinancialOverview();
        return response;
      }

      // Loan details
      if (lowercaseQuery.includes('loan') || lowercaseQuery.includes('borrowing') || 
          lowercaseQuery.includes('credit')) {
        const { response } = await this.getLoanDetails();
        return response;
      }

      // Trade finance
      if (lowercaseQuery.includes('trade') || lowercaseQuery.includes('letter of credit') || 
          lowercaseQuery.includes('lc') || lowercaseQuery.includes('bank guarantee') || 
          lowercaseQuery.includes('bg')) {
        const { response } = await this.getTradeFinanceDetails();
        return response;
      }

      // Compliance
      if (lowercaseQuery.includes('compliance') || lowercaseQuery.includes('kyc') || 
          lowercaseQuery.includes('aml') || lowercaseQuery.includes('regulatory')) {
        const { response } = await this.getComplianceStatus();
        return response;
      }

      // Digital access
      if (lowercaseQuery.includes('digital') || lowercaseQuery.includes('access') || 
          lowercaseQuery.includes('portal') || lowercaseQuery.includes('login') || 
          lowercaseQuery.includes('user')) {
        const { response } = await this.getDigitalAccess();
        return response;
      }

      // Default response
      return `I can help you with information about:
      1. Company Overview
      2. Financial Overview
      3. Loan Details
      4. Trade Finance
      5. Compliance Status
      6. Digital Access
      
      Please ask about any of these topics.`;

    } catch (error) {
      console.error('Error processing query:', error);
      return 'I apologize, but I encountered an error while processing your query. Please try again.';
    }
  }
} 