import { GeminiService } from './geminiService';
import { CompanyQueryService } from './companyQueryService';

export class QueryProcessor {
  private static geminiService: GeminiService | null = null;
  private static companyQueryServices: Map<string, CompanyQueryService> = new Map();

  private static initializeGemini() {
    if (!this.geminiService) {
      this.geminiService = new GeminiService();
    }
  }

  private static async getCompanyQueryService(companyId: string): Promise<CompanyQueryService> {
    if (!this.companyQueryServices.has(companyId)) {
      const service = new CompanyQueryService(companyId);
      await service.initialize();
      this.companyQueryServices.set(companyId, service);
    }
    return this.companyQueryServices.get(companyId)!;
  }

  static async processQuery(query: string, companyId: string): Promise<string> {
    try {
      // First try to get a direct answer from the company query service
      const companyService = await this.getCompanyQueryService(companyId);
      const directResponse = await companyService.processQuery(query);
      
      // If we got a meaningful response, return it
      if (directResponse && !directResponse.includes('I apologize')) {
        return directResponse;
      }

      // If no direct answer, fall back to Gemini
      this.initializeGemini();

      if (!this.geminiService) {
        throw new Error('Failed to initialize chat service');
      }

      // Add company context to the query
      const contextualizedQuery = `[Company ID: ${companyId}] ${query}`;
      
      // Process the query through Gemini
      const response = await this.geminiService.generateBankingResponse(companyId, contextualizedQuery);
      
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