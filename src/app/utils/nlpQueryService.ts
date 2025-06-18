import { db } from './initFirebase';
import { collection, query, where, getDocs, DocumentData, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { formatCurrency, formatDate } from './formatUtils';

interface QueryIntent {
  type: 'company_info' | 'npn_report' | 'financial_data' | 'working_capital' | 'general';
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

export class NLPQueryService {
  private companyId: string;

  constructor(companyId: string) {
    console.log('Initializing NLPQueryService with companyId:', companyId);
    this.companyId = companyId;
  }

  private async extractIntent(query: string): Promise<QueryIntent> {
    // Basic intent extraction based on keywords
    const lowercaseQuery = query.toLowerCase();
    
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

  private async fetchCompanyData(intent: QueryIntent): Promise<DocumentData | null> {
    try {
      console.log('Fetching company data for ID:', this.companyId);

      // Now fetch the company data using the correct companyId
      const companyRef = doc(db, 'companies', this.companyId);
      const companyDoc = await getDoc(companyRef);

      if (!companyDoc.exists()) {
        console.error('Company not found:', this.companyId);
        return null;
      }

      const companyData = companyDoc.data();
      console.log('Raw company data:', JSON.stringify(companyData, null, 2));

      // Extract services data correctly
      const services = companyData.services || {};
      console.log('Services data:', JSON.stringify(services, null, 2));
      
      // Structure the data in a more readable format for the LLM
      const structuredData = {
        company_info: {
          name: companyData.name,
          email: companyData.email,
          id: companyData.id,
          isActive: companyData.isActive,
          createdAt: companyData.createdAt,
          updatedAt: companyData.updatedAt
        },
        financial_services: {
          account_types: services.account_types || [],
          working_capital: {
            limit: services.working_capital?.limit || 0,
            utilized: services.working_capital?.utilized || 0,
            last_review_date: services.working_capital?.last_review_date || null
          },
          loans: services.loans || [],
          trade_finance: {
            bank_guarantees: services.trade_finance?.bank_guarantees || {},
            letter_of_credit: services.trade_finance?.letter_of_credit || {},
            import_export: services.trade_finance?.import_export || {}
          },
          credit_reports: services.credit_reports || {},
          payment_methods: services.payment_methods || [],
          treasury_services: services.treasury_services || {}
        }
      };

      console.log('Structured data:', JSON.stringify(structuredData, null, 2));
      return structuredData;
    } catch (error) {
      console.error('Error fetching company data:', error);
      return null;
    }
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

  async processQuery(query: string): Promise<{ data: any; context: string }> {
    try {
      console.log('NLPQueryService.processQuery started:', { query });
      
      // Get company data
      const companyRef = doc(db, 'companies', this.companyId);
      console.log('Fetching company data from path:', companyRef.path);
      
      const companyDoc = await getDoc(companyRef);
      
      if (!companyDoc.exists()) {
        console.error('Company not found:', this.companyId);
        throw new Error('Company data not found');
      }

      const companyData = companyDoc.data();
      console.log('Raw company data:', JSON.stringify(companyData, null, 2));
      console.log('Company data structure:', {
        name: companyData.name,
        id: companyData.id,
        hasServices: !!companyData.services,
        servicesKeys: companyData.services ? Object.keys(companyData.services) : [],
        hasWorkingCapital: !!companyData.services?.working_capital,
        workingCapitalData: companyData.services?.working_capital,
        hasLoans: !!companyData.loans?.length,
        loansData: companyData.loans,
        hasAccountTypes: !!companyData.account_types?.length,
        accountTypesData: companyData.account_types
      });

      // Normalize query for intent matching
      const normalizedQuery = query.toLowerCase().trim();
      
      // Handle general greeting or company overview
      if (normalizedQuery === 'hi' || normalizedQuery === 'hello' || normalizedQuery === 'hey') {
        console.log('Generating company overview...');
        const overview = this.generateCompanyOverview(companyData);
        console.log('Generated overview:', overview);
        return {
          data: companyData,
          context: overview
        };
      }

      // Check for working capital related queries
      if (normalizedQuery.includes('working capital') || 
          normalizedQuery.includes('credit limit') || 
          normalizedQuery.includes('credit utilization')) {
        
        console.log('Detected working capital query');
        
        // Check if working_capital exists
        if (!companyData.services?.working_capital) {
          console.log('No working capital data found in services:', companyData.services);
          return {
            data: null,
            context: `${companyData.name}, your working capital information is not currently available. Please contact your relationship manager.`
          };
        }

        const workingCapital = companyData.services.working_capital;
        console.log('Working capital data found:', workingCapital);
        
        // Format the working capital data
        const limit = Number(workingCapital.limit) || 0;
        const utilized = Number(workingCapital.utilized) || 0;
        const utilizationPercentage = limit > 0 ? ((utilized / limit) * 100).toFixed(1) : '0';
        const lastReviewDate = workingCapital.last_review_date;

        const formattedLimit = formatCurrency(limit);
        const formattedUtilized = formatCurrency(utilized);
        const formattedDate = formatDate(lastReviewDate);

        console.log('Formatted working capital data:', {
          limit: formattedLimit,
          utilized: formattedUtilized,
          percentage: utilizationPercentage,
          lastReviewDate: formattedDate
        });

        const context = `Dear ${companyData.name}, based on our records as of ${formattedDate}, your working capital limit is ${formattedLimit}. ` +
                       `You have utilized ${formattedUtilized} (${utilizationPercentage}% of your limit).`;

        return {
          data: {
            company_info: {
              name: companyData.name,
              id: this.companyId
            },
            financial_services: {
              working_capital: {
                limit: limit,
                utilized: utilized,
                utilization_percentage: parseFloat(utilizationPercentage),
                last_review_date: lastReviewDate
              }
            }
          },
          context
        };
      }

      // Handle other types of queries...
      console.log('Query type not recognized');
      return {
        data: null,
        context: `${companyData.name}, I'm not sure how to process this query. Could you please ask about specific banking services like working capital, loans, or trade finance?`
      };

    } catch (error) {
      console.error('Error in NLPQueryService.processQuery:', error);
      throw error;
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
} 