import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API with your API key
const genAI = new GoogleGenerativeAI('AIzaSyAn3gpVHkV1Hix5UocuihdMlQNpWuKiThM');

// Create a reusable model instance
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using 1.5-flash for better rate limits

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Rate limiter class
class RateLimiter {
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private readonly resetInterval: number = 60000; // 1 minute
  private readonly maxRequestsPerMinute: number = 10; // Conservative limit

  constructor() {
    // Reset counter every minute
    setInterval(() => {
      this.requestCount = 0;
    }, this.resetInterval);
  }

  async waitForNextRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // If we've hit the rate limit, wait until the next minute
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const waitTime = this.resetInterval - (now % this.resetInterval);
      await delay(waitTime);
      this.requestCount = 0;
    }
    
    // Ensure minimum 3 second gap between requests
    if (timeSinceLastRequest < 3000) {
      await delay(3000 - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }
}

const rateLimiter = new RateLimiter();

// Test function to verify API connection
export async function testGeminiConnection(): Promise<{ success: boolean; message: string }> {
  try {
    await rateLimiter.waitForNextRequest();
    const result = await model.generateContent('Hi');
    const response = await result.response;
    const text = response.text();
    return { success: true, message: 'Connection successful!' };
  } catch (error: any) {
    console.error('Gemini connection test failed:', error);
    return { 
      success: false, 
      message: error.message?.includes('429') 
        ? 'Rate limit reached. Please try again in a minute.'
        : `Connection failed: ${error.message}`
    };
  }
}

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export class GeminiChat {
  private history: Message[] = [];
  private readonly maxHistoryAge = 30 * 60 * 1000; // 30 minutes
  private readonly maxHistoryLength = 10; // Keep only last 10 messages

  constructor() {
    this.history = [];
  }

  private cleanHistory() {
    const now = Date.now();
    // Remove old messages and limit history length
    this.history = this.history
      .filter(msg => (now - msg.timestamp) < this.maxHistoryAge)
      .slice(-this.maxHistoryLength);
  }

  async sendMessage(message: string): Promise<string> {
    try {
      await rateLimiter.waitForNextRequest();

      // Clean old messages before adding new one
      this.cleanHistory();

      // Add user message to history
      this.history.push({ 
        role: 'user', 
        content: message,
        timestamp: Date.now()
      });

      // Create a minimal context from recent messages
      const recentMessages = this.history.slice(-4);
      const prompt = recentMessages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Add model response to history
      this.history.push({ 
        role: 'model', 
        content: text,
        timestamp: Date.now()
      });

      return text;
    } catch (error: any) {
      console.error('Error sending message to Gemini:', error);
      
      if (error.message?.includes('429')) {
        return 'I need a short break to respect rate limits. Please try again in about a minute.';
      }
      
      return 'Sorry, I encountered an error. Please try again.';
    }
  }

  getHistory(): Message[] {
    this.cleanHistory(); // Clean before returning
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
  }
} 