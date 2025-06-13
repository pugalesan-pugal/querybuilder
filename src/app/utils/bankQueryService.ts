import { GoogleGenerativeAI } from '@google/generative-ai';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './initFirebase';
import { BankData, BankQueryIntent, CompanyData, Loan } from '../types/bankTypes';
import nlp from 'compromise';
import { GeminiService } from './gemini';

// Add custom lexicon for bank domain
nlp.extend({
  words: {
    // Financial terms
    npn: 'Report',
    report: 'Report',
    account: 'Account',
    savings: 'AccountType',
    current: 'AccountType',
    fixed: 'AccountType',
    deposit: 'AccountType',
    working: 'Capital',
    capital: 'Capital',
    loan: 'Loan',
    loans: 'Loan',
    finance: 'Finance',
    payment: 'Payment',
    payments: 'Payment',
    letter: 'LetterOfCredit',
    credit: 'LetterOfCredit',
    guarantee: 'BankGuarantee',
    guarantees: 'BankGuarantee',
    import: 'Trade',
    export: 'Trade',
    cash: 'CashManagement',
    treasury: 'Treasury',
    
    // Status terms
    active: 'Status',
    pending: 'Status',
    completed: 'Status',
    failed: 'Status',
    expired: 'Status',
    cancelled: 'Status'
  }
});

export class BankQueryService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private db: any;
  private currentUser: any;
  private companyId: string;
  private userId: string;
  private geminiService: GeminiService;

  constructor(companyId: string, userId: string) {
    this.companyId = companyId;
    this.userId = userId;
    this.genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    this.geminiService = new GeminiService();
  }

  private async getBankData(companyId: string): Promise<BankData | null> {
    try {
      const companyRef = doc(this.db, 'companies', companyId);
      const companyDoc = await getDoc(companyRef);
      
      if (!companyDoc.exists()) {
        throw new Error('Company not found');
      }

      const companyData = companyDoc.data();
      return companyData.data as BankData;
    } catch (error) {
      console.error('Error fetching bank data:', error);
      return null;
    }
  }

  private async analyzeQuery(query: string): Promise<BankQueryIntent> {
    const doc = nlp(query.toLowerCase());
    let primaryIntent: BankQueryIntent['primaryIntent'] = 'npn_report'; // default
    let filters: BankQueryIntent['filters'] = {};

    // Detect primary intent
    if (doc.has('(npn|report)')) primaryIntent = 'npn_report';
    else if (doc.has('account')) primaryIntent = 'account_types';
    else if (doc.has('(working|capital)')) primaryIntent = 'working_capital';
    else if (doc.has('loan')) primaryIntent = 'loans';
    else if (doc.has('finance')) primaryIntent = 'finance';
    else if (doc.has('payment')) primaryIntent = 'payments';
    else if (doc.has('(letter|credit)')) primaryIntent = 'letter_of_credit';
    else if (doc.has('guarantee')) primaryIntent = 'bank_guarantees';
    else if (doc.has('(import|export)')) primaryIntent = 'import_export';
    else if (doc.has('credit.*report')) primaryIntent = 'credit_reports';
    else if (doc.has('cash')) primaryIntent = 'cash_management';
    else if (doc.has('treasury')) primaryIntent = 'treasury_services';

    // Extract status filters
    if (doc.has('active|pending|completed|failed|expired|cancelled')) {
      filters.status = doc.match('active|pending|completed|failed|expired|cancelled').text();
    }

    // Extract type filters
    if (doc.has('savings|current|fixed.*deposit')) {
      filters.type = doc.match('savings|current|fixed.*deposit').text();
    }

    return {
      primaryIntent,
      filters
    };
  }

  private isArrayData(data: any): data is Array<any> {
    return Array.isArray(data);
  }

  private hasStatus(item: any): item is { status: string } {
    return 'status' in item && typeof item.status === 'string';
  }

  private hasType(item: any): item is { type: string } {
    return 'type' in item && typeof item.type === 'string';
  }

  async processQuery(queryText: string, chatId: string): Promise<string> {
    try {
      // Get company data
      const companyQuery = query(
        collection(db, 'companies'),
        where('id', '==', this.companyId)
      );
      const companySnapshot = await getDocs(companyQuery);
      
      if (companySnapshot.empty) {
        throw new Error('Company not found');
      }

      const companyData = companySnapshot.docs[0].data() as BankData;

      // Safely get data with defaults
      const workingCapital = companyData.working_capital || { limit: 0, utilization: 0, currency: 'USD' };
      const loans = companyData.loans || [];
      const letterOfCredit = companyData.letter_of_credit || [];
      const bankGuarantees = companyData.bank_guarantees || [];
      const treasuryServices = companyData.treasury_services || [];
      const payments = companyData.payments || [];
      const creditReports = companyData.credit_reports || [];

      // Create context for Gemini
      const context = `
Company Financial Data:
- Working Capital: Limit ${workingCapital.limit} ${workingCapital.currency}, Utilization ${workingCapital.utilization}
- Active Loans: ${loans.filter(loan => loan.status === 'active').length}
- Letters of Credit: ${letterOfCredit.length}
- Bank Guarantees: ${bankGuarantees.length}
- Treasury Services: ${treasuryServices.length}

Additional Details:
- Total Loans: ${loans.length}
- Active Letters of Credit: ${letterOfCredit.filter(lc => lc.status === 'active').length}
- Active Bank Guarantees: ${bankGuarantees.filter(bg => bg.status === 'active').length}
- Recent Payments: ${payments.slice(0, 5).length}
- Credit Reports: ${creditReports.length}

Loan Details:
${loans.filter(loan => loan.status === 'active').map(loan => 
  `- ${loan.type}: ${loan.amount} ${loan.currency} at ${loan.interestRate}% for ${loan.tenure} months`
).join('\n')}

Recent Letters of Credit:
${letterOfCredit.filter(lc => lc.status === 'active').slice(0, 3).map(lc =>
  `- Amount: ${lc.amount} ${lc.currency}, Beneficiary: ${lc.beneficiary}, Expires: ${lc.expiryDate instanceof Timestamp ? new Date(lc.expiryDate.seconds * 1000).toLocaleDateString() : new Date(lc.expiryDate).toLocaleDateString()}`
).join('\n')}

Recent Bank Guarantees:
${bankGuarantees.filter(bg => bg.status === 'active').slice(0, 3).map(bg =>
  `- Type: ${bg.type}, Amount: ${bg.amount}, Beneficiary: ${bg.beneficiary}`
).join('\n')}`;

      // Process with Gemini
      const response = await this.geminiService.generateBankingResponse(context, queryText);

      // Store the message in chat history
      await this.storeMessage(chatId, queryText, response);

      return response;
    } catch (error) {
      console.error('Error processing bank query:', error);
      if (error instanceof Error && error.message === 'Company not found') {
        throw new Error('Unable to access company data. Please verify your company ID.');
      }
      throw new Error('Failed to process your query. Please try again.');
    }
  }

  private async storeMessage(chatId: string, userMessage: string, botResponse: string) {
    try {
      const messagesRef = collection(db, 'messages');
      const timestamp = Timestamp.now();

      // Store user message
      await addDoc(messagesRef, {
        chatId,
        content: userMessage,
        isUser: true,
        timestamp,
        userId: this.userId,
        companyId: this.companyId
      });

      // Store bot response
      await addDoc(messagesRef, {
        chatId,
        content: botResponse,
        isUser: false,
        timestamp: Timestamp.now(),
        userId: this.userId,
        companyId: this.companyId
      });

      // Update chat history
      const chatRef = doc(db, 'chatHistory', chatId);
      await updateDoc(chatRef, {
        lastMessage: botResponse,
        lastMessageTimestamp: timestamp,
        updatedAt: timestamp
      });
    } catch (error) {
      console.error('Error storing messages:', error);
      throw new Error('Failed to store chat messages');
    }
  }

  async createNewChat(): Promise<string> {
    try {
      const chatHistoryRef = collection(db, 'chatHistory');
      const timestamp = Timestamp.now();
      
      const newChat = await addDoc(chatHistoryRef, {
        title: 'New Chat',
        lastMessage: '',
        lastMessageTimestamp: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        userId: this.userId,
        companyId: this.companyId
      });

      return newChat.id;
    } catch (error) {
      console.error('Error creating new chat:', error);
      throw new Error('Failed to create new chat');
    }
  }
} 