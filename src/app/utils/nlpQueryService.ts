import { db } from './initFirebase';
import { collection, query, where, getDocs, DocumentData, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { formatCurrency, formatDate } from './formatUtils';

interface QueryIntent {
  type: 'company_info' | 'npn_report' | 'financial_data' | 'working_capital' | 'loan' | 'payment_methods' | 
        'treasury_services' | 'trade_finance' | 'credit_reports' | 'account_types' | 'general';
  entities: {
    companyId?: string;
    reportType?: string;
    dateRange?: {
      start?: Date;
      end?: Date;
    };
    metric?: string;
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

export class NLPQueryService {
  private companyId: string;

  constructor(companyId: string) {
    console.log('Initializing NLPQueryService with companyId:', companyId);
    this.companyId = companyId;
  }

  private async extractIntent(query: string): Promise<QueryIntent> {
    // Basic intent extraction based on keywords
    const lowercaseQuery = query.toLowerCase();
    
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
    
    if (treasuryKeywords.some(keyword => lowercaseQuery.includes(keyword)) ||
        treasuryPatterns.some(pattern => pattern.test(lowercaseQuery))) {
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
    
    if (tradeKeywords.some(keyword => lowercaseQuery.includes(keyword))) {
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
    
    if (creditKeywords.some(keyword => lowercaseQuery.includes(keyword))) {
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
    
    if (accountKeywords.some(keyword => lowercaseQuery.includes(keyword))) {
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
    
    if (paymentKeywords.some(keyword => lowercaseQuery.includes(keyword)) ||
        paymentPatterns.some(pattern => pattern.test(lowercaseQuery))) {
      console.log('Detected payment methods intent with keyword/pattern match');
      return {
        type: 'payment_methods',
        entities: {
          companyId: this.companyId
        }
      };
    }
    
    // Enhanced loan detection with common misspellings, variations and patterns
    const loanKeywords = [
      'loan', 'loans', 
      'loand', 'loands',  // Common misspellings
      'borrowing', 'borrowed',
      'lend', 'lending',
      'credit', 'credits'
    ];

    const loanPatterns = [
      /what.*loan/,
      /how.*loan/,
      /loan.*amount/,
      /amount.*loan/,
      /amount.*get.*loan/,
      /amount.*got.*loan/,
      /get.*loan/,
      /got.*loan/,
      /show.*loan/,
      /tell.*loan/,
      /my.*loan/
    ];
    
    // Check if any loan-related keyword is present or pattern matches
    if (loanKeywords.some(keyword => lowercaseQuery.includes(keyword)) ||
        loanPatterns.some(pattern => pattern.test(lowercaseQuery))) {
      console.log('Detected loan intent with keyword/pattern match');
      return {
        type: 'loan',
        entities: {
          companyId: this.companyId
        }
      };
    }
    
    if (lowercaseQuery.includes('working capital') || lowercaseQuery.includes('working_capital')) {
      console.log('Detected working capital intent');
      return {
        type: 'working_capital',
        entities: {
          companyId: this.companyId
        }
      };
    }
    
    if (lowercaseQuery.includes('npn') || lowercaseQuery.includes('report')) {
      return {
        type: 'npn_report',
        entities: {
          companyId: this.companyId,
          reportType: 'npn'
        }
      };
    }

    if (lowercaseQuery.includes('company') || lowercaseQuery.includes('about')) {
      return {
        type: 'company_info',
        entities: {
          companyId: this.companyId
        }
      };
    }

    if (lowercaseQuery.includes('financial') || 
        lowercaseQuery.includes('revenue') || 
        lowercaseQuery.includes('profit')) {
      return {
        type: 'financial_data',
        entities: {
          companyId: this.companyId,
          metric: this.extractFinancialMetric(lowercaseQuery)
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

  async processQuery(query: string): Promise<QueryResult> {
    try {
      console.log('NLPQueryService.processQuery started:', { query });
      
      // Fetch company data
      const companyData = await this.fetchCompanyData();
      if (!companyData) {
        throw new Error('Failed to fetch company data');
      }

      console.log('Raw company data:', JSON.stringify(companyData, null, 2));
      
      // Log company data structure for debugging
      console.log('Company data structure:', {
        name: companyData.name,
        id: companyData.id,
        hasServices: !!companyData.services,
        servicesKeys: companyData.services ? Object.keys(companyData.services) : [],
        hasWorkingCapital: !!this.extractWorkingCapitalData(companyData.services)
      });

      // Extract intent
      const intent = await this.extractIntent(query);
      console.log('Extracted intent:', intent);

      // Process based on query type
      switch (intent.type) {
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
} 