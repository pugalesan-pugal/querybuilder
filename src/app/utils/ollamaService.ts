import { BasicResponse, CacheEntry, QueuedRequest } from './types';

export class OllamaService {
  private lastRequestTime: number = 0;
  private readonly BASE_DELAY = 1000; // 1 second base delay for Ollama (can be adjusted)
  private readonly MAX_RETRIES = 4;
  private readonly MAX_BACKOFF_DELAY = 60000; // 1 minute maximum delay
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour cache TTL
  private readonly OLLAMA_API_URL: string;
  
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

  constructor(ollamaUrl: string = 'http://localhost:11434') {
    this.OLLAMA_API_URL = ollamaUrl;
    console.log('Initializing Ollama service with URL:', this.OLLAMA_API_URL);
  }

  private calculateBackoffDelay(retryCount: number): number {
    const delay = this.BASE_DELAY * Math.pow(2, retryCount);
    return Math.min(delay, this.MAX_BACKOFF_DELAY);
  }

  private getBasicResponse(query: string): string | null {
    const trimmedQuery = query.trim();
    
    for (const { patterns, response } of this.basicResponses) {
      if (patterns.some(pattern => pattern.test(trimmedQuery))) {
        console.log('Using basic response for query:', trimmedQuery);
        return response;
      }
    }
    
    return null;
  }

  private getCacheKey(context: string, query: string): string {
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
      const request = this.requestQueue[0];
      const now = Date.now();

      if (request.lastErrorTime) {
        const backoffDelay = this.calculateBackoffDelay(request.retryCount);
        const timeElapsed = now - request.lastErrorTime;
        
        if (timeElapsed < backoffDelay) {
          const remainingWait = backoffDelay - timeElapsed;
          console.log(`Backoff: waiting ${remainingWait}ms before retry ${request.retryCount + 1}`);
          await new Promise(resolve => setTimeout(resolve, remainingWait));
        }
      }
      
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.BASE_DELAY) {
        const waitTime = this.BASE_DELAY - timeSinceLastRequest;
        console.log(`Rate limiting: waiting ${waitTime}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      try {
        await request.execute();
        this.requestQueue.shift();
        this.lastRequestTime = Date.now();
      } catch (error: any) {
        request.retryCount++;
        request.lastErrorTime = Date.now();
        
        if (request.retryCount >= this.MAX_RETRIES) {
          console.log('Max retries reached, removing request from queue');
          this.requestQueue.shift();
        } else {
          console.log(`Error occurred, will retry with backoff (attempt ${request.retryCount + 1}/${this.MAX_RETRIES})`);
          continue;
        }
        throw error;
      }
    }

    this.isProcessingQueue = false;
  }

  private enqueueRequest<T>(request: () => Promise<T>): Promise<T> {
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

  async callOllamaAPI(prompt: string, model: string = 'llama2'): Promise<string> {
    try {
      const response = await fetch(`${this.OLLAMA_API_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error calling Ollama API:', error);
      throw error;
    }
  }

  async generateBankingResponse(context: string, query: string): Promise<string> {
    try {
      console.log('Processing banking query:', { context, query });

      const basicResponse = this.getBasicResponse(query);
      if (basicResponse) {
        return basicResponse;
      }

      if (!context) {
        console.log('No context provided, returning default message');
        return "I apologize, but I don't have enough information to answer your query. Please try asking about specific banking services.";
      }

      const cachedResponse = this.getCachedResponse(context, query);
      if (cachedResponse) {
        return cachedResponse;
      }

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

        const response = await this.callOllamaAPI(prompt);
        this.setCachedResponse(context, query, response);
        return response;
      };

      const response = await this.enqueueRequest(generateResponse);
      console.log('Generated response:', response);
      return response;

    } catch (error) {
      console.error('Error generating banking response:', error);
      return "I apologize, but I encountered an error while processing your query. Please try again.";
    }
  }
} 