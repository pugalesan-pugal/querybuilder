import { GeminiChat } from './gemini';

export class QueryProcessor {
  private static geminiChat: GeminiChat | null = null;

  private static initializeGemini() {
    if (!this.geminiChat) {
      this.geminiChat = new GeminiChat();
    }
  }

  static async processQuery(query: string, companyId: string): Promise<string> {
    try {
      this.initializeGemini();

      if (!this.geminiChat) {
        throw new Error('Failed to initialize chat service');
      }

      // Add company context to the query
      const contextualizedQuery = `[Company ID: ${companyId}] ${query}`;
      
      // Process the query through Gemini
      const response = await this.geminiChat.sendMessage(contextualizedQuery);
      
      return response;

    } catch (error) {
      console.error('Error processing query:', error);
      if (error instanceof Error) {
        return `Error processing query: ${error.message}`;
      }
      return 'An error occurred while processing your query. Please try again.';
    }
  }
} 