import { collection, doc, getDocs, query, where, writeBatch, updateDoc, setDoc, orderBy, Timestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { NLPQueryService } from './nlpQueryService';
import { OllamaService } from './ollamaService';

export class BankQueryService {
  private nlpService: NLPQueryService;
  private ollamaService: OllamaService;
  private readonly companyId: string;
  private readonly userId: string;
  private companyData: any;

  constructor(companyId: string, userId: string) {
    if (!companyId) {
      throw new Error('Company ID is required');
    }
    this.companyId = companyId;
    this.userId = userId;
    this.nlpService = new NLPQueryService(companyId);
    this.ollamaService = new OllamaService();
    console.log('Initializing BankQueryService with:', { companyId, userId });
  }

  private async loadCompanyData(): Promise<void> {
    try {
      // Get company data from Firestore
      const companyRef = doc(db, 'companies', this.companyId);
      const companyDoc = await getDoc(companyRef);
      
      if (!companyDoc.exists()) {
        throw new Error('Company data not found');
      }

      this.companyData = companyDoc.data();
      // Initialize NLP service with company data
      this.nlpService.setCompanyData(this.companyData);
    } catch (error) {
      console.error('Error loading company data:', error);
      throw error;
    }
  }

  async processQuery(queryText: string, chatId: string): Promise<string> {
    console.log('BankQueryService.processQuery started:', { queryText, chatId, companyId: this.companyId, userId: this.userId });

    try {
      // Load company data if not already loaded
      if (!this.companyData) {
        await this.loadCompanyData();
      }

      // Store user message
      await this.storeUserMessage(chatId, queryText);

      // Process with NLP service
      console.log('Calling NLP service...');
      const nlpResponse = await this.nlpService.processQuery(queryText);
      console.log('NLP service response:', nlpResponse);

      let response: string;
      
      if (nlpResponse.hasData) {
        // If NLP service found specific data, use its formatted response
        response = nlpResponse.context;
      } else {
        // If no specific data found, use Ollama for general response
        console.log('Calling Ollama service with context:', nlpResponse.context);
        response = await this.ollamaService.generateBankingResponse(nlpResponse.context, queryText);
      }

      // Store AI response
      await this.storeAIResponse(chatId, response);
      console.log('AI response stored successfully');

      // Generate and update chat title
      await this.updateChatTitle(chatId);

      return response;

    } catch (error) {
      console.error('Error in processQuery:', error);
      const errorMessage = "I apologize, but I encountered an error while processing your query. Please try again or rephrase your question.";
      await this.storeAIResponse(chatId, errorMessage);
      return errorMessage;
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

  private async updateChatTitle(chatId: string): Promise<void> {
    try {
      // Get all messages for this chat
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, 
        where('chatId', '==', chatId),
        orderBy('timestamp', 'asc')
      );
      const messagesDocs = await getDocs(q);
      
      // Convert messages to format needed for title generation
      const messages = messagesDocs.docs.map(doc => {
        const data = doc.data();
        return {
          content: data.content,
          isUser: data.isUser
        };
      });

      // Generate and update the title
      const newTitle = await this.ollamaService.generateChatTitle(messages);
      await this.renameChat(chatId, newTitle);
    } catch (error) {
      console.error('Error updating chat title:', error);
    }
  }

  async createNewChat(): Promise<string> {
    try {
      const chatRef = doc(collection(db, 'chatHistory'));
      await setDoc(chatRef, {
        title: 'New Chat',
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

  private async storeUserMessage(chatId: string, content: string): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Add user message
      const userMessageRef = doc(collection(db, 'messages'));
      batch.set(userMessageRef, {
        content,
        timestamp: Timestamp.now(),
        isUser: true,
        userId: this.userId,
        companyId: this.companyId,
        chatId
      });

      // Update chat history
      const chatRef = doc(db, 'chatHistory', chatId);
      batch.update(chatRef, {
        lastMessage: content,
        lastMessageTimestamp: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      await batch.commit();
      console.log('User message stored successfully');
    } catch (error) {
      console.error('Error storing user message:', error);
    }
  }

  async storeAIResponse(chatId: string, content: string): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Add assistant response
      const assistantMessageRef = doc(collection(db, 'messages'));
      batch.set(assistantMessageRef, {
        content,
        timestamp: Timestamp.now(),
        isUser: false,
        userId: 'system',
        companyId: this.companyId,
        chatId
      });

      // Update chat history
      const chatRef = doc(db, 'chatHistory', chatId);
      batch.update(chatRef, {
        lastMessage: content,
        lastMessageTimestamp: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      await batch.commit();
      console.log('AI response stored successfully');
    } catch (error) {
      console.error('Error storing AI response:', error);
    }
  }
} 