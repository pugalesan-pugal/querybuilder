import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API with API key
const GEMINI_API_KEY = 'AIzaSyA49DQREkIs1w_-tG1-JjVW01-W7v9Dd60';

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequestsPerMinute: 60,
  maxTokensPerMinute: 60000,
  retryDelay: 60000, // 1 minute in milliseconds
  maxRetries: 3
};

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private requestCount: number;
  private lastRequestTime: number;
  private tokenCount: number;

  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.tokenCount = 0;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private resetCounters(): void {
    const now = Date.now();
    if (now - this.lastRequestTime >= 60000) {
      this.requestCount = 0;
      this.tokenCount = 0;
      this.lastRequestTime = now;
    }
  }

  private async waitForQuota(): Promise<void> {
    this.resetCounters();
    if (this.requestCount >= RATE_LIMIT.maxRequestsPerMinute) {
      const waitTime = 60000 - (Date.now() - this.lastRequestTime);
      if (waitTime > 0) {
        await this.sleep(waitTime);
        this.resetCounters();
      }
    }
  }

  private async retryWithBackoff(operation: () => Promise<any>, retryCount = 0): Promise<any> {
    try {
      await this.waitForQuota();
      const result = await operation();
      this.requestCount++;
      this.lastRequestTime = Date.now();
      return result;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('429') && retryCount < RATE_LIMIT.maxRetries) {
          const delay = RATE_LIMIT.retryDelay * Math.pow(2, retryCount);
          console.log(`Rate limited. Retrying in ${delay / 1000} seconds...`);
          await this.sleep(delay);
          return this.retryWithBackoff(operation, retryCount + 1);
        }
      }
      throw error;
    }
  }

  async generateBankingResponse(context: string, query: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash", // Using the faster model with lower quota impact
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 1024, // Reduced token limit to help with quota
        }
      });

      const prompt = `
You are a banking assistant with access to the following company financial data:
${context}

User Query: ${query}

Please provide a clear and concise response based on the available data. If specific information is not available in the context, mention that politely.

Format your response in a professional and easy-to-read manner. Use bullet points or sections if it helps organize the information better.
`;

      const generateResponse = async () => {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      };

      return await this.retryWithBackoff(generateResponse);
    } catch (error) {
      console.error('Error generating banking response:', error);
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('blocked')) {
        return new Error('AI service configuration error: API key is not properly set up or has insufficient permissions.');
      }
      if (error.message.includes('429') || error.message.includes('quota')) {
        return new Error('AI service is currently busy. Please try again in a minute.');
      }
      if (error.message.includes('not found') || error.message.includes('404')) {
        return new Error('The AI service is temporarily unavailable. Please try again in a few moments.');
      }
      return error;
    }
    return new Error('An unexpected error occurred. Please try again.');
  }
} 