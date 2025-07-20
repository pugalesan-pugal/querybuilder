import { collection, doc, getDocs, query, where, writeBatch, updateDoc, setDoc, orderBy, Timestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { NLPQueryService } from './nlpQueryService';
import { OllamaService } from './ollamaService';
import { FAQService } from './faqService';
import { DataResolver } from './dataResolver';

export class BankQueryService {
  private nlpService: NLPQueryService;
  private ollamaService: OllamaService;
  private faqService: FAQService;
  private readonly companyId: string;
  private readonly userId: string;
  private companyData: any;
  private isInitialized: boolean = false;

  constructor(companyId: string, userId: string) {
    if (!companyId) {
      throw new Error('Company ID is required');
    }
    this.companyId = companyId;
    this.userId = userId;
    this.nlpService = new NLPQueryService(companyId);
    this.ollamaService = new OllamaService();
    this.faqService = new FAQService();
    console.log('Initializing BankQueryService with:', { companyId, userId });
    
    // Initialize data immediately
    this.initialize().catch(console.error);
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadCompanyData();
      this.isInitialized = true;
      console.log('BankQueryService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BankQueryService:', error);
      throw error;
    }
  }

  private async loadCompanyData(): Promise<void> {
    try {
      console.log('Loading company data for:', this.companyId);
      
      // First check if user exists in bank_customers
      const customerRef = doc(db, 'bank_customers', this.userId);
      const customerDoc = await getDoc(customerRef);
      console.log('Customer document check:', {
        userId: this.userId,
        exists: customerDoc.exists(),
        data: customerDoc.exists() ? customerDoc.data() : null
      });

      // Get company data from Firestore
      const companyRef = doc(db, 'companies', this.companyId);
      const companyDoc = await getDoc(companyRef);
      
      if (!companyDoc.exists()) {
        console.error('Company document not found:', this.companyId);
        throw new Error('Company data not found');
      }

      this.companyData = companyDoc.data();
      console.log('Raw Firebase data:', {
        customerId: this.userId,
        companyId: this.companyId,
        fullData: this.companyData,
        dataKeys: Object.keys(this.companyData),
        hasIndividualDetails: !!this.companyData.Individual_Details,
        individualDetails: this.companyData.Individual_Details
      });

      // Initialize NLP service with company data
      console.log('Setting company data in NLP service');
      this.nlpService.setCompanyData(this.companyData);
      console.log('Company data set in NLP service');
    } catch (error) {
      console.error('Error loading company data:', error);
      // Retry loading data
      await this.retryLoadData();
    }
  }

  private async retryLoadData(attempts: number = 3, delay: number = 1000): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      try {
        console.log(`Retrying data load attempt ${i + 1}/${attempts}`);
        
        // First check if user exists in bank_customers
        const customerRef = doc(db, 'bank_customers', this.userId);
        const customerDoc = await getDoc(customerRef);
        console.log('Customer document check (retry):', {
          userId: this.userId,
          exists: customerDoc.exists(),
          data: customerDoc.exists() ? customerDoc.data() : null
        });

        const companyRef = doc(db, 'companies', this.companyId);
        const companyDoc = await getDoc(companyRef);
        
        if (companyDoc.exists()) {
          this.companyData = companyDoc.data();
          console.log('Successfully loaded data on retry:', {
            customerId: this.userId,
            companyId: this.companyId,
            hasIndividualDetails: !!this.companyData.Individual_Details,
            dataKeys: Object.keys(this.companyData)
          });
          this.nlpService.setCompanyData(this.companyData);
          return;
        }
      } catch (error) {
        console.error(`Retry attempt ${i + 1} failed:`, error);
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
    }
    throw new Error('Failed to load company data after retries');
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      console.log('Service not initialized, waiting for initialization...');
      await this.initialize();
    }
  }

  async processQuery(queryText: string, chatId: string): Promise<string> {
    console.log('BankQueryService.processQuery started:', { 
      queryText, 
      chatId, 
      companyId: this.companyId, 
      userId: this.userId,
      isInitialized: this.isInitialized,
      hasCompanyData: !!this.companyData,
      companyDataPreview: this.companyData ? {
        dataKeys: Object.keys(this.companyData),
        hasAuthorizedSignatory: !!this.companyData.Authorized_Signatory,
        hasResidentialAddress: !!this.companyData.Authorized_Signatory?.Residential_Address,
        residentialAddress: this.companyData.Authorized_Signatory?.Residential_Address,
        hasIndividualDetails: !!this.companyData.Individual_Details,
        individualDetails: this.companyData.Individual_Details
      } : null
    });

    try {
      // Ensure service is initialized
      await this.ensureInitialized();

      // Verify we have company data
      if (!this.companyData) {
        console.log('No company data, attempting to load...');
        await this.loadCompanyData();
      }

      // Store user message
      await this.storeUserMessage(chatId, queryText);

      // Process with NLP service
      console.log('Calling NLP service with company data:', {
        hasCompanyData: !!this.companyData,
        hasAuthorizedSignatory: !!this.companyData.Authorized_Signatory,
        hasResidentialAddress: !!this.companyData.Authorized_Signatory?.Residential_Address,
        residentialAddress: this.companyData.Authorized_Signatory?.Residential_Address,
        dataKeys: Object.keys(this.companyData)
      });
      
      const nlpResponse = await this.nlpService.processQuery(queryText);
      console.log('NLP service response:', {
        hasData: nlpResponse.hasData,
        data: nlpResponse.data,
        metadata: nlpResponse.metadata,
        context: nlpResponse.context
      });

      // Format context for Ollama service
      const context = {
        nlpResponse,
        companyId: this.companyId,
        userId: this.userId
      };

      // Generate response
      const response = await this.ollamaService.generateBankingResponse(JSON.stringify(context), queryText);

      // Store AI response
      await this.storeAIResponse(chatId, response);
      console.log('AI response stored successfully');

      return response;

    } catch (error) {
      console.error('Error in processQuery:', error);
      return "I'm having trouble accessing your information right now. Please try again in a moment.";
    }
  }

  private formatDataResponse(data: any, query: string): string {
    if (!data) return "I couldn't find the specific information you requested.";

    // Handle different types of data
    if (typeof data === 'string') {
      // For simple string data (like passport numbers, PAN, etc.)
      return `Here is the information you requested: ${data}`;
    }

    if (Array.isArray(data)) {
      // For array data (like transactions, accounts)
      return `I found ${data.length} items. Here are the details:\n` +
             data.map((item, index) => `${index + 1}. ${JSON.stringify(item)}`).join('\n');
    }

    if (typeof data === 'object') {
      // For object data (like account details, personal info)
      return Object.entries(data)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    }

    return JSON.stringify(data);
  }

  async createNewChat(): Promise<string> {
    try {
      const chatRef = doc(collection(db, 'chatHistory'));
      await setDoc(chatRef, {
        title: 'New Chat',
      lastMessage: '',
      lastMessageTimestamp: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      userId: this.userId,
      companyId: this.companyId
    });
      return chatRef.id;
    } catch (error) {
      console.error('Error creating new chat:', error);
      throw error;
    }
  }

  async renameChat(chatId: string, newTitle: string): Promise<void> {
    try {
      const chatRef = doc(db, 'chatHistory', chatId);
      await updateDoc(chatRef, {
        title: newTitle,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    try {
      // Get all messages for this chat
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, where('chatId', '==', chatId));
      const messagesDocs = await getDocs(q);

      // Delete all messages and the chat in a batch
      const batch = writeBatch(db);

      messagesDocs.forEach(doc => {
        batch.delete(doc.ref);
      });

      const chatRef = doc(db, 'chatHistory', chatId);
      batch.delete(chatRef);

      await batch.commit();
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }

  async storeUserMessage(chatId: string, content: string): Promise<void> {
    try {
      // Store message
      const messageRef = doc(collection(db, 'messages'));
      await setDoc(messageRef, {
        chatId,
        content,
        isUser: true,
        timestamp: Timestamp.now(),
        userId: this.userId,
        companyId: this.companyId
      });

      // Update chat history
      const chatRef = doc(db, 'chatHistory', chatId);
      await updateDoc(chatRef, {
        lastMessage: content,
        lastMessageTimestamp: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Update chat title if this is the first message
      const chatDoc = await getDoc(chatRef);
      const chatData = chatDoc.data();
      if (chatData && chatData.title === 'New Chat') {
        const title = await this.ollamaService.generateChatTitle([{ content, isUser: true }]);
        await updateDoc(chatRef, { title });
      }
    } catch (error) {
      console.error('Error storing user message:', error);
      throw error;
    }
  }

  async storeAIResponse(chatId: string, content: string): Promise<void> {
    try {
      // Store message
      const messageRef = doc(collection(db, 'messages'));
      await setDoc(messageRef, {
        chatId,
        content,
        isUser: false,
        timestamp: Timestamp.now(),
        userId: this.userId,
        companyId: this.companyId
      });

      // Update chat history
      const chatRef = doc(db, 'chatHistory', chatId);
      await updateDoc(chatRef, {
        lastMessage: content,
        lastMessageTimestamp: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error storing AI response:', error);
      throw error;
    }
  }

  async updateChatTitle(chatId: string): Promise<void> {
    try {
      // Get all messages for this chat
      const messagesQuery = query(
        collection(db, 'messages'),
        where('chatId', '==', chatId),
        orderBy('timestamp', 'asc')
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      const messages = messagesSnapshot.docs.map(doc => ({
        content: doc.data().content,
        isUser: doc.data().isUser
      }));

      // Generate new title
      const title = await this.ollamaService.generateChatTitle(messages);

      // Update chat title
      const chatRef = doc(db, 'chatHistory', chatId);
      await updateDoc(chatRef, { title });
    } catch (error) {
      console.error('Error updating chat title:', error);
      throw error;
    }
  }

  async generateChatTitle(messages: { content: string, isUser: boolean }[]): Promise<string> {
    try {
      // Use the last message as the title
      const lastMessage = messages[messages.length - 1];
      return lastMessage ? lastMessage.content.substring(0, 50) + '...' : 'New Chat';
    } catch (error) {
      console.error('Error generating chat title:', error);
      return 'New Chat';
    }
  }
} 