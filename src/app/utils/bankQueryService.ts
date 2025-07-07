import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, Timestamp, writeBatch, setDoc } from 'firebase/firestore';
import { db } from './initFirebase';
import { BankData, BankQueryIntent, CompanyData, Loan } from '../types/bankTypes';
import { NLPQueryService } from './nlpQueryService';
import { OllamaService } from './ollamaService';

export class BankQueryService {
  private userId: string;
  private companyId: string;
  private ollamaService: OllamaService;
  private nlpService: NLPQueryService;
  private db: any;

  constructor(companyId: string, userId: string) {
    if (!companyId) {
      throw new Error('Company ID is required');
    }
    console.log('Initializing BankQueryService with:', { companyId, userId });
    this.companyId = companyId;
    this.userId = userId;
    this.ollamaService = new OllamaService();
    this.nlpService = new NLPQueryService(companyId);
    this.db = db;
  }

  async processQuery(queryText: string, chatId: string): Promise<string> {
    try {
      console.log('BankQueryService.processQuery started:', { 
        queryText, 
        chatId,
        companyId: this.companyId,
        userId: this.userId
      });

      // First, store the user's message
      await this.storeUserMessage(chatId, queryText);

      // Process the query through NLP service
      console.log('Calling NLP service...');
      const { data, context } = await this.nlpService.processQuery(queryText);
      console.log('NLP service response:', { 
        hasData: !!data,
        context: context,
        data: JSON.stringify(data, null, 2)
      });

      let response: string;
      
      // If NLP service provided a meaningful response, use it directly
      if (data !== null) {
        response = context;
      } else {
        // Only use Ollama for queries that NLP service couldn't handle
        console.log('Calling Ollama service with context:', context);
        response = await this.ollamaService.generateBankingResponse(context, queryText);
        console.log('Ollama service responded with:', response);
      }

      // Store the AI's response separately
      await this.storeAIResponse(chatId, response);

      return response;
    } catch (error) {
      console.error('Error in BankQueryService.processQuery:', error);
      const errorMessage = error instanceof Error ? 
        `I apologize, but I encountered an error while processing your query: ${error.message}` :
        "I apologize, but I encountered an unexpected error while processing your query. Please try again.";
      
      // Store the error response
      await this.storeAIResponse(chatId, errorMessage);
      return errorMessage;
    }
  }

  async createNewChat(): Promise<string> {
    try {
      const chatRef = doc(collection(this.db, 'chatHistory'));
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
      throw new Error('Failed to create new chat');
    }
  }

  async renameChat(chatId: string, newTitle: string): Promise<void> {
    try {
      const chatRef = doc(this.db, 'chatHistory', chatId);
      await updateDoc(chatRef, {
        title: newTitle,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error renaming chat:', error);
      throw new Error('Failed to rename chat');
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    try {
      // Get all messages for this chat
      const messagesRef = collection(this.db, 'messages');
      const q = query(messagesRef, where('chatId', '==', chatId));
      const messagesDocs = await getDocs(q);

      // Delete all messages and the chat in a batch
      const batch = writeBatch(this.db);

      messagesDocs.forEach(doc => {
        batch.delete(doc.ref);
      });

      const chatRef = doc(this.db, 'chatHistory', chatId);
      batch.delete(chatRef);

      await batch.commit();
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw new Error('Failed to delete chat');
    }
  }

  private async storeUserMessage(chatId: string, query: string): Promise<void> {
    try {
      const batch = writeBatch(this.db);

      // Add user message
      const userMessageRef = doc(collection(this.db, 'messages'));
      batch.set(userMessageRef, {
        content: query,
        timestamp: Timestamp.now(),
        isUser: true,
        userId: this.userId,
        companyId: this.companyId,
        chatId: chatId
      });

      // Update chat history
      const chatRef = doc(this.db, 'chatHistory', chatId);
      batch.update(chatRef, {
        lastMessage: query,
        lastMessageTimestamp: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      await batch.commit();
      console.log('User message stored successfully');
    } catch (error) {
      console.error('Error storing user message:', error);
    }
  }

  private async storeAIResponse(chatId: string, response: string): Promise<void> {
    try {
      const batch = writeBatch(this.db);

      // Add assistant response
      const assistantMessageRef = doc(collection(this.db, 'messages'));
      batch.set(assistantMessageRef, {
        content: response,
        timestamp: Timestamp.now(),
        isUser: false,
        userId: 'system',
        companyId: this.companyId,
        chatId: chatId
      });

      // Update chat history
      const chatRef = doc(this.db, 'chatHistory', chatId);
      batch.update(chatRef, {
        lastMessage: response,
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