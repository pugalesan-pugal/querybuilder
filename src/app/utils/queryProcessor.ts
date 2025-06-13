import { GeminiService } from './gemini';

export class QueryProcessor {
  private static geminiService: GeminiService | null = null;

  private static initializeGemini() {
    if (!this.geminiService) {
      this.geminiService = new GeminiService();
    }
  }

  static async processQuery(query: string, companyId: string): Promise<string> {
    try {
      this.initializeGemini();

      if (!this.geminiService) {
        throw new Error('Failed to initialize chat service');
      }

      // Add company context to the query
      const contextualizedQuery = `[Company ID: ${companyId}] ${query}`;
      
      // Process the query through Gemini
      const response = await this.geminiService.sendMessage(contextualizedQuery);
      
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