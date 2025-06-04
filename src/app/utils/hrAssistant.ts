import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAbsentees, getNewJoiners, getWorkLogs, getDateRange } from './firebase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const genAI = new GoogleGenerativeAI('AIzaSyAn3gpVHkV1Hix5UocuihdMlQNpWuKiThM');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

interface QueryResult {
  text: string;
  data: any;
  downloadOptions: {
    excel: boolean;
    pdf: boolean;
  };
}

export class HRAssistant {
  private static async analyzeQuery(query: string): Promise<{
    intent: string;
    timeRange: number;
    employeeId?: string;
  }> {
    const systemPrompt = `
      You are an HR assistant. Analyze the query and identify:
      1. Intent (absentees, new_joiners, work_logs)
      2. Time range in months (default to 1 if not specified)
      3. Employee ID if mentioned
      
      Respond in JSON format:
      {
        "intent": "absentees|new_joiners|work_logs",
        "timeRange": number,
        "employeeId": "string or null"
      }
    `;

    try {
      const result = await model.generateContent([systemPrompt, query]);
      const response = await result.response;
      return JSON.parse(response.text());
    } catch (error) {
      console.error('Error analyzing query:', error);
      return {
        intent: 'unknown',
        timeRange: 1
      };
    }
  }

  private static async generateResponse(data: any, query: string): Promise<string> {
    const prompt = `
      Generate a natural response to the query: "${query}"
      Using this data: ${JSON.stringify(data)}
      
      Make it conversational but professional.
      Include relevant numbers and statistics.
      If it's empty data, mention that no records were found.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  private static generateExcel(data: any, filename: string): Blob {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  private static generatePDF(data: any, filename: string): Blob {
    const doc = new jsPDF();
    
    if (Array.isArray(data)) {
      const headers = Object.keys(data[0]);
      const rows = data.map(obj => headers.map(key => obj[key]));
      
      doc.autoTable({
        head: [headers],
        body: rows
      });
    } else {
      const rows = Object.entries(data).map(([key, value]) => [key, value]);
      doc.autoTable({
        body: rows
      });
    }
    
    return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
  }

  public static async processQuery(query: string): Promise<QueryResult> {
    const analysis = await this.analyzeQuery(query);
    const { startDate, endDate } = getDateRange(analysis.timeRange);
    let data: any = null;
    
    switch (analysis.intent) {
      case 'absentees':
        data = await getAbsentees(startDate, endDate);
        break;
        
      case 'new_joiners':
        data = await getNewJoiners(startDate, endDate);
        break;
        
      case 'work_logs':
        if (!analysis.employeeId) {
          return {
            text: "Please specify an employee ID for work log queries.",
            data: null,
            downloadOptions: { excel: false, pdf: false }
          };
        }
        data = await getWorkLogs(analysis.employeeId, startDate, endDate);
        break;
        
      default:
        return {
          text: "I'm not sure how to process that query. Try asking about absentees, new joiners, or work logs.",
          data: null,
          downloadOptions: { excel: false, pdf: false }
        };
    }

    const response = await this.generateResponse(data, query);
    
    return {
      text: response,
      data,
      downloadOptions: {
        excel: true,
        pdf: true
      }
    };
  }

  public static async downloadData(data: any, format: 'excel' | 'pdf', filename: string): Promise<Blob> {
    if (format === 'excel') {
      return this.generateExcel(data, filename);
    } else {
      return this.generatePDF(data, filename);
    }
  }
} 