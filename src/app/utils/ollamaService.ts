import { BasicResponse, CacheEntry, QueuedRequest } from './types';

export class OllamaService {
  private lastRequestTime: number = 0;
  private readonly BASE_DELAY = 100;
  private readonly MAX_RETRIES = 3;
  private readonly MAX_BACKOFF_DELAY = 5000;
  private readonly API_TIMEOUT = 60000; // Increased timeout
  private readonly RATE_LIMIT_WINDOW = 2000; // Increased window
  private readonly MAX_REQUESTS_PER_WINDOW = 2; // More conservative
  private readonly DEFAULT_MODEL = 'llama2:7b';  // Updated to use installed model
  private readonly DEFAULT_PORT = 11434;  // Updated to correct Ollama port
  private readonly OLLAMA_API_URL: string;
  private readonly DEFAULT_ERROR_MESSAGE = "I apologize, but I'm currently experiencing technical difficulties. Please try again in a moment.";
  private isRecovering: boolean = false;
  private recoveryTimeout: number = 0;
  private readonly MAX_RECOVERY_TIME = 60000;
  private windowStartTime: number = Date.now();
  private requestsInWindow: number = 0;
  private readonly CACHE_TTL = 1000 * 60 * 60;
  private cache: Map<string, { response: string; timestamp: number }> = new Map();
  private isInitialized: boolean = false;

  private readonly BASIC_RESPONSE_PATTERNS = [
    {
      trigger: 'hello',
      response: 'Hello! How can I assist you with your banking needs today?'
    },
    {
      trigger: 'hi',
      response: 'Hi! How can I help you with your banking today?'
    },
    {
      trigger: 'bye',
      response: 'Goodbye! Have a great day!'
    },
    {
      trigger: 'thank',
      response: "You're welcome! Is there anything else I can help you with?"
    }
  ];

  constructor() {
    this.OLLAMA_API_URL = `http://127.0.0.1:${this.DEFAULT_PORT}`;
    console.log('Initializing Ollama service with URL:', this.OLLAMA_API_URL);
    this.initialize().catch(console.error);
    // Reset rate limit window periodically
    setInterval(() => this.resetRateLimit(), this.RATE_LIMIT_WINDOW);
  }

  private resetRateLimit(): void {
    const now = Date.now();
    if (now - this.windowStartTime >= this.RATE_LIMIT_WINDOW) {
      this.windowStartTime = now;
      this.requestsInWindow = 0;
    }
  }

  private async checkRateLimit(): Promise<boolean> {
    this.resetRateLimit();
    if (this.requestsInWindow >= this.MAX_REQUESTS_PER_WINDOW) {
      const waitTime = this.RATE_LIMIT_WINDOW - (Date.now() - this.windowStartTime);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.resetRateLimit();
      }
    }
    return this.requestsInWindow < this.MAX_REQUESTS_PER_WINDOW;
  }

  private updateRateLimit(): void {
    this.requestsInWindow++;
  }

  private getCacheKey(prompt: string, model: string): string {
    return `${model}:${prompt}`;
  }

  private getCachedResponse(prompt: string, model: string): string | null {
    const key = this.getCacheKey(prompt, model);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.response;
    }
    return null;
  }

  private setCachedResponse(prompt: string, model: string, response: string): void {
    const key = this.getCacheKey(prompt, model);
    this.cache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  private async initialize(): Promise<void> {
    try {
      // Wait for service to be available
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts && !this.isInitialized) {
        console.log(`Attempting to initialize Ollama service (attempt ${attempts + 1}/${maxAttempts})`);
        
        if (await this.checkServiceAvailability()) {
          console.log('Ollama service is available');
          
          // Check if model exists
          const modelExists = await this.checkModelAvailability();
          if (!modelExists) {
            console.log('Model not found, pulling...');
            await this.pullModel();
          }
          
          this.isInitialized = true;
          console.log('Ollama service initialized successfully');
          return;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          const delay = this.BASE_DELAY * Math.pow(2, attempts);
          console.log(`Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (!this.isInitialized) {
        const error = new Error('Failed to initialize Ollama service after multiple attempts. Please ensure Ollama is running:\n1. Open PowerShell as Administrator\n2. Run: ollama serve');
        console.error(error);
        throw error;
      }
    } catch (error) {
      console.error('Error initializing Ollama service:', error);
      throw error;
    }
  }

  private async checkServiceAvailability(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      console.log('Checking Ollama service availability at:', this.OLLAMA_API_URL);
      
      const response = await fetch(`${this.OLLAMA_API_URL}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error('Ollama service responded but with error:', response.status, response.statusText);
        return false;
      }
      
      return true;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('Could not connect to Ollama service. Please ensure Ollama is running with:\n1. Open PowerShell as Administrator\n2. Run: ollama serve');
      } else {
        console.error('Service availability check failed:', error);
      }
      return false;
    }
  }

  private async checkModelAvailability(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.OLLAMA_API_URL}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.DEFAULT_MODEL }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Model availability check failed:', error);
      return false;
    }
  }

  private async pullModel(): Promise<boolean> {
    try {
      console.log(`Pulling model ${this.DEFAULT_MODEL}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout for model pull

      const response = await fetch(`${this.OLLAMA_API_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.DEFAULT_MODEL,
          stream: false,
          insecure: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to pull model: ${errorText}`);
      }

      console.log(`Successfully pulled model ${this.DEFAULT_MODEL}`);
      return true;
    } catch (error) {
      console.error('Error pulling model:', error);
      return false;
    }
  }

  private calculateBackoffDelay(retryCount: number): number {
    const delay = this.BASE_DELAY * Math.pow(2, retryCount);
    return Math.min(delay, this.MAX_BACKOFF_DELAY);
  }

  private async processQueue() {
    // This method is no longer needed as we are not using a queue
  }

  private enqueueRequest<T>(request: () => Promise<T>): Promise<T> {
    // This method is no longer needed as we are not using a queue
    return request();
  }

  private async checkSystemMemory(): Promise<boolean> {
    try {
      const response = await fetch(`${this.OLLAMA_API_URL}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.DEFAULT_MODEL })
      });
      
      if (!response.ok) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking system memory:', error);
      return false;
    }
  }

  private async recoverModel(model: string): Promise<boolean> {
    if (this.isRecovering) {
      console.log('Recovery already in progress...');
      return false;
    }

    try {
      this.isRecovering = true;
      console.log(`Attempting to recover model: ${model}`);

      // First check system resources
      const hasMemory = await this.checkSystemMemory();
      if (!hasMemory) {
        console.error('Insufficient system resources for model recovery');
        return false;
      }

      // Try to pull the model again with conservative settings
      const response = await fetch(`${this.OLLAMA_API_URL}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: model,
          stream: false,
          insecure: true,
          options: {
            num_ctx: 512, // Very conservative context
            num_thread: 2, // Minimal threads
            num_gpu: 0, // Try CPU only first
            rope_scaling: { type: "linear", factor: 0.5 }, // Conservative scaling
            rope_freq_base: 10000,
            rope_freq_scale: 0.5,
            num_batch: 8, // Small batch size
            num_gqa: 1,
            type: "f16" // Use 16-bit precision
          }
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        console.error('Failed to pull model:', await response.text());
        return false;
      }

      // Wait for model to initialize
      await new Promise(resolve => setTimeout(resolve, 5000));

      return true;
    } catch (error) {
      console.error('Error during model recovery:', error);
      return false;
    } finally {
      this.isRecovering = false;
    }
  }

  private async checkOllamaHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.OLLAMA_API_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return Array.isArray(data.models) && data.models.length > 0;
    } catch (error) {
      console.error('Ollama health check failed:', error);
      return false;
    }
  }

  private async waitForOllama(maxAttempts: number = 3): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.checkOllamaHealth()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return false;
  }

  private shouldAttemptRecovery(error: any): boolean {
    if (this.recoveryTimeout > this.MAX_RECOVERY_TIME) {
      console.log('Maximum recovery time exceeded, giving up');
      return false;
    }

    const errorText = error?.message || error?.toString() || '';
    return errorText.includes('llama runner process has terminated') ||
           errorText.includes('exit status 2') ||
           errorText.includes('model not found');
  }

  async callOllamaAPI(prompt: string, model: string = this.DEFAULT_MODEL): Promise<string> {
    if (!this.isInitialized) {
      console.log('Service not initialized, attempting to initialize...');
      try {
        await this.initialize();
      } catch (error) {
        console.error('Failed to initialize service:', error);
        return this.DEFAULT_ERROR_MESSAGE;
      }
    }

    let attempts = 0;
    const maxAttempts = this.MAX_RETRIES;

    while (attempts < maxAttempts) {
      try {
        // Check rate limit
        if (!await this.checkRateLimit()) {
          return "I'm receiving too many requests right now. Please wait a moment and try again.";
        }
        this.updateRateLimit();

        // Add timeout to fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

        // Conservative prompt handling
        const maxPromptLength = 512;
        let processedPrompt = prompt;
        if (prompt.length > maxPromptLength) {
          processedPrompt = prompt.slice(0, maxPromptLength);
          console.log('Prompt truncated to', maxPromptLength, 'characters');
        }

        console.log('Sending request to Ollama API:', {
          url: `${this.OLLAMA_API_URL}/api/generate`,
          model,
          promptLength: processedPrompt.length,
          attempt: attempts + 1
        });

        const response = await fetch(`${this.OLLAMA_API_URL}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            prompt: processedPrompt,
            stream: false,
            options: {
              temperature: 0.5,
              top_k: 10,
              top_p: 0.75,
              num_predict: 50,
              stop: ["</response>", "User:"],
              repeat_penalty: 1.1,
              presence_penalty: 0.5,
              frequency_penalty: 0.5,
              tfs_z: 0.5,
              num_ctx: 512,
              num_thread: 2,
              num_gpu: 0,
              num_batch: 8,
              num_gqa: 1,
              rope_freq_base: 10000,
              rope_freq_scale: 0.5,
              type: "f16"
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Ollama API error:', {
            status: response.status,
            statusText: response.statusText,
            errorText
          });

          // Check if service is still available
          if (!await this.checkServiceAvailability()) {
            console.log('Service unavailable, attempting to reinitialize...');
            this.isInitialized = false;
            await this.initialize();
            attempts++;
            continue;
          }

          if (response.status === 404) {
            return "I apologize, but the AI model is not available at the moment. Please try again later.";
          } else if (response.status === 429) {
            return "I'm receiving too many requests right now. Please wait a moment and try again.";
          } else if (response.status >= 500) {
            if (attempts < maxAttempts - 1) {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, this.BASE_DELAY * Math.pow(2, attempts)));
              continue;
            }
            return "I'm experiencing some technical difficulties. Please try again in a few moments.";
          }

          throw new Error(`Ollama API error: ${response.status} ${response.statusText}\nDetails: ${errorText}`);
        }

        const data = await response.json();
        if (!data.response) {
          console.error('Invalid response format:', data);
          return this.DEFAULT_ERROR_MESSAGE;
        }

        return data.response;

      } catch (error: unknown) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.error('Request timeout:', {
              prompt: prompt.slice(0, 100) + '...',
              timeout: this.API_TIMEOUT
            });
            return "I apologize, but I'm currently experiencing high load. Please try your query again in a moment.";
          }
          console.error('Error calling Ollama API:', error);
        }
        
        if (attempts < maxAttempts - 1) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, this.BASE_DELAY * Math.pow(2, attempts)));
          continue;
        }
        return this.DEFAULT_ERROR_MESSAGE;
      }
    }

    return this.DEFAULT_ERROR_MESSAGE;
  }

  async generateBankingResponse(context: string, query: string): Promise<string> {
    try {
      // Check for basic responses first
      const basicResponse = this.getBasicResponse(query);
      if (basicResponse) {
        return basicResponse;
      }

      // Check cache first
      const cachedResponse = this.getCachedResponse(query, this.DEFAULT_MODEL);
      if (cachedResponse) {
        return cachedResponse;
      }

      // Check rate limit
      if (!await this.checkRateLimit()) {
        return "I'm receiving too many requests right now. Please wait a moment and try again.";
      }
      this.updateRateLimit();

      // Format the prompt to encourage structured responses
      const prompt = `You are a professional banking assistant for TechNova Solutions.
Instructions:
1. Answer ONLY based on the provided context
2. If data is missing, say so politely
3. Format numbers and dates consistently
4. Be concise but complete
5. For sensitive data, show only last 4 digits
6. Use bullet points for lists
7. Include relevant values in your response

Context:
${context}

Query: ${query}

Please provide a clear, professional response:`;

      const response = await this.callOllamaAPI(prompt);
      
      // Cache the successful response
      if (response && response !== this.DEFAULT_ERROR_MESSAGE) {
        this.setCachedResponse(query, this.DEFAULT_MODEL, response);
      }

      return response;

    } catch (error) {
      console.error('Error in generateBankingResponse:', error);
      return this.DEFAULT_ERROR_MESSAGE;
    }
  }

  async generateChatTitle(messages: { content: string, isUser: boolean }[]): Promise<string> {
    try {
      if (!this.isInitialized) {
        console.log('Service not initialized, attempting to initialize...');
        try {
          await this.initialize();
        } catch (error) {
          console.error('Failed to initialize service:', error);
          // Return a basic title if Ollama is not available
          const lastMessage = messages[messages.length - 1];
          return lastMessage ? lastMessage.content.substring(0, 50) + '...' : 'New Chat';
        }
      }

      // Take only the first few messages to keep the context small
      const relevantMessages = messages.slice(0, 3);
      const context = relevantMessages
        .map(msg => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const prompt = `Based on this conversation, generate a very brief title (max 5 words):
${context}

Title:`;

      try {
        const response = await this.callOllamaAPI(prompt);
        return response.substring(0, 50); // Ensure title is not too long
      } catch (error) {
        console.error('Error generating chat title:', error);
        // Fallback to using the last message as title
        const lastMessage = messages[messages.length - 1];
        return lastMessage ? lastMessage.content.substring(0, 50) + '...' : 'New Chat';
      }
    } catch (error) {
      console.error('Error in generateChatTitle:', error);
      return 'New Chat';
    }
  }

  private getBasicResponse(query: string): string | null {
    const normalizedQuery = query.toLowerCase().trim();
    
    for (const pattern of this.BASIC_RESPONSE_PATTERNS) {
      if (normalizedQuery.includes(pattern.trigger)) {
        return pattern.response;
      }
    }

    return null;
  }
} 