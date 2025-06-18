import { GoogleGenerativeAI } from '@google/generative-ai';

interface CacheEntry {
  response: string;
  timestamp: number;
}

interface BasicResponse {
  patterns: RegExp[];
  response: string;
}

interface QueuedRequest {
  execute: () => Promise<any>;
  retryCount: number;
  lastErrorTime?: number;
}

export class GeminiService {
  private model: any;
  private apiKey: string;
  private lastRequestTime: number = 0;
  private readonly BASE_DELAY = 30000; // 30 seconds base delay
  private readonly MAX_RETRIES = 4;
  private readonly MAX_BACKOFF_DELAY = 240000; // 4 minutes maximum delay
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour cache TTL
  
  // Basic response patterns
  private basicResponses: BasicResponse[] = [
    {
      patterns: [/^hi$/i, /^hello$/i, /^hey$/i],
      response: "Hello! I'm your banking assistant. How can I help you today?"
    },
    {
      patterns: [/^help$/i, /^what can you do$/i],
      response: "I can help you with:\n- Checking your working capital information\n- Viewing loan details\n- Checking account balances\n- Understanding your banking services\nWhat would you like to know about?"
    },
    {
      patterns: [/^bye$/i, /^goodbye$/i, /^thank you$/i],
      response: "You're welcome! If you have any more questions, feel free to ask."
    }
  ];

  constructor() {
    // Try to get API key from environment variables
    this.apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyDPl7JHgiBFrQ6qGUP1prtaHlupgoHPldg';
    
    // If not found in env vars, use hardcoded key
    if (!this.apiKey) {
      console.warn('Gemini API key not found in environment variables, using hardcoded key');
      this.apiKey = "AIzaSyDPl7JHgiBFrQ6qGUP1prtaHlupgoHPldg";
    }
    
    console.log('Initializing Gemini service with API key:', this.apiKey.substring(0, 10) + '...');
    const genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  }

  private calculateBackoffDelay(retryCount: number): number {
    // Calculate exponential backoff: BASE_DELAY * 2^retryCount
    const delay = this.BASE_DELAY * Math.pow(2, retryCount);
    // Cap the delay at MAX_BACKOFF_DELAY
    return Math.min(delay, this.MAX_BACKOFF_DELAY);
  }

  private getBasicResponse(query: string): string | null {
    const trimmedQuery = query.trim();
    
    // Check for basic response patterns
    for (const { patterns, response } of this.basicResponses) {
      if (patterns.some(pattern => pattern.test(trimmedQuery))) {
        console.log('Using basic response for query:', trimmedQuery);
        return response;
      }
    }
    
    return null;
  }

  private getCacheKey(context: string, query: string): string {
    // Create a deterministic cache key from context and query
    return `${context.trim().toLowerCase()}_${query.trim().toLowerCase()}`;
  }

  private getCachedResponse(context: string, query: string): string | null {
    const cacheKey = this.getCacheKey(context, query);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < this.CACHE_TTL) {
        console.log('Cache hit for query:', query);
        return cached.response;
      } else {
        // Remove expired cache entry
        this.cache.delete(cacheKey);
      }
    }
    return null;
  }

  private setCachedResponse(context: string, query: string, response: string) {
    const cacheKey = this.getCacheKey(context, query);
    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue[0]; // Peek at the first request
      const now = Date.now();

      // If this is a retry, check if we need to wait based on the backoff delay
      if (request.lastErrorTime) {
        const backoffDelay = this.calculateBackoffDelay(request.retryCount);
        const timeElapsed = now - request.lastErrorTime;
        
        if (timeElapsed < backoffDelay) {
          const remainingWait = backoffDelay - timeElapsed;
          console.log(`Backoff: waiting ${remainingWait}ms before retry ${request.retryCount + 1}`);
          await new Promise(resolve => setTimeout(resolve, remainingWait));
        }
      }
      
      // Check regular rate limiting
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.BASE_DELAY) {
        const waitTime = this.BASE_DELAY - timeSinceLastRequest;
        console.log(`Rate limiting: waiting ${waitTime}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      try {
        await request.execute();
        this.requestQueue.shift(); // Remove the request only after successful execution
        this.lastRequestTime = Date.now();
      } catch (error: any) {
        if (error?.message?.includes('429') || error?.message?.includes('quota')) {
          request.retryCount++;
          request.lastErrorTime = Date.now();
          
          if (request.retryCount >= this.MAX_RETRIES) {
            console.log('Max retries reached, removing request from queue');
            this.requestQueue.shift();
          } else {
            console.log(`Rate limit hit, will retry with backoff (attempt ${request.retryCount + 1}/${this.MAX_RETRIES})`);
            // Keep the request in queue for retry
            continue;
          }
        } else {
          // For non-rate-limit errors, remove the request
          this.requestQueue.shift();
        }
        throw error; // Re-throw to be handled by the caller
      }
    }

    this.isProcessingQueue = false;
  }

  private async enqueueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        execute: async () => {
          try {
            const result = await request();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
        retryCount: 0
      };
      
      this.requestQueue.push(queuedRequest);
      this.processQueue();
    });
  }

  async generateBankingResponse(context: string, query: string): Promise<string> {
    try {
      console.log('Processing banking query:', { context, query });

      // Check for basic responses first
      const basicResponse = this.getBasicResponse(query);
      if (basicResponse) {
        return basicResponse;
      }

      if (!context) {
        console.log('No context provided, returning default message');
        return "I apologize, but I don't have enough information to answer your query. Please try asking about specific banking services.";
      }

      // Check cache first
      const cachedResponse = this.getCachedResponse(context, query);
      if (cachedResponse) {
        return cachedResponse;
      }

      // If queue is too long, return a busy message
      if (this.requestQueue.length >= 3) {
        return "I apologize, but the service is currently very busy. Please try again in a minute.";
      }

      const generateResponse = async () => {
        const prompt = `
          You are a banking assistant. Please respond to the user's query based on the following context:
          ${context}

          User's query: ${query}

          Please provide a clear and professional response based only on the information available in the context.
          If specific information is not available in the context, politely inform the user.
        `;

        const result = await this.model.generateContent(prompt);
        const response = result.response.text();
        
        // Cache the successful response
        this.setCachedResponse(context, query, response);
        
        return response;
      };

      const response = await this.enqueueRequest(generateResponse);
      console.log('Generated response:', response);
      return response;

    } catch (error: any) {
      console.error('Error generating banking response:', error);
      
      // Handle rate limit errors specifically
      if (error?.message?.includes('429') || error?.message?.includes('quota')) {
        const retryCount = this.requestQueue[0]?.retryCount || 0;
        const backoffDelay = this.calculateBackoffDelay(retryCount) / 1000; // Convert to seconds
        return `I apologize, but we've reached our API rate limit. Please wait ${backoffDelay} seconds before trying again. For basic queries like account information or service details, you can continue to chat.`;
      }
      
      return "I apologize, but I encountered an error while processing your query. Please try again.";
    }
  }
} 