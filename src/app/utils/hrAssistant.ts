import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAbsentees, getNewJoiners, getWorkLogs, getDateRange } from './firebase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { initFirebase } from './initFirebase';

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

interface EmployeeData {
  id?: string;
  department?: string;
  Name?: string;
  Email?: string;
  Department?: string;
  Designation?: string;
  accessCode?: string;
  [key: string]: any;
}

export class HRAssistant {
  private static async analyzeQuery(query: string): Promise<{
    intent: string;
    timeRange: number;
    employeeId?: string;
    department?: string;
    queryType?: string;
  }> {
    const systemPrompt = `
      You are an HR assistant. Analyze the query and identify:
      1. Intent (absentees, new_joiners, work_logs, department_info, employee_lookup)
      2. Time range in months (default to 1 if not specified)
      3. Department if mentioned (HR, IT, Finance, Sales, Marketing)
      4. Query type (count, list, analysis)
      5. Employee ID or name if mentioned
      
      Respond in JSON format:
      {
        "intent": "absentees|new_joiners|work_logs|department_info|employee_lookup",
        "timeRange": number,
        "department": "string or null",
        "queryType": "count|list|analysis",
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
        timeRange: 1,
        queryType: 'list'
      };
    }
  }

  private static async generateResponse(data: any, query: string, analysis: any): Promise<string> {
    const prompt = `
      Generate a natural response to the query: "${query}"
      Query type: ${analysis.queryType}
      Department: ${analysis.department || 'All'}
      Using this data: ${JSON.stringify(data)}
      
      Make it conversational but professional.
      Include relevant numbers and statistics.
      If it's empty data, mention that no records were found.
      For counts, start with the number.
      For lists, use bullet points.
      For analysis, include trends and patterns.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  private static async getEmployeeDetails(accessCode: string): Promise<{ name: string; email: string }> {
    const { db } = initFirebase();
    const employeesRef = collection(db, 'employees');
    const q = query(employeesRef, where('accessCode', '==', accessCode));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const employeeData = snapshot.docs[0].data();
      return {
        name: employeeData.Name || 'Unknown Employee',
        email: employeeData.Email || 'No Email'
      };
    }
    return {
      name: 'Unknown Employee',
      email: 'No Email'
    };
  }

  private static async processDataForExport(data: any[]): Promise<any[]> {
    const processedData = [];
    for (const item of data) {
      let newItem = { ...item };
      
      // Handle access code to employee details conversion
      if (item.accessCode) {
        const employeeDetails = await this.getEmployeeDetails(item.accessCode);
        newItem.employeeName = employeeDetails.name;
        newItem.employeeEmail = employeeDetails.email;
        delete newItem.accessCode;
      }

      // Handle absentee dates array
      if (newItem.absentDates && Array.isArray(newItem.absentDates)) {
        newItem.absentDates = newItem.absentDates.join(', ');
        newItem.totalDays = item.absentDates.length;
      }

      // Calculate utilization if work hours data
      if (newItem.hoursWorked && newItem.totalHours) {
        newItem.utilization = ((newItem.hoursWorked / newItem.totalHours) * 100).toFixed(2) + '%';
      }

      processedData.push(newItem);
    }

    return processedData;
  }

  private static generateExcel(data: any, filename: string): Promise<Blob> {
    return new Promise(async (resolve) => {
      const processedData = Array.isArray(data) ? await this.processDataForExport(data) : [data];
      
      // Sort data by month and employee name if they exist
      if (processedData.length > 0 && processedData[0].month) {
        processedData.sort((a, b) => {
          const monthCompare = a.month.localeCompare(b.month);
          return monthCompare !== 0 && a.employeeName ? monthCompare : a.employeeName.localeCompare(b.employeeName);
        });
      }

      // Reorder columns to show important information first
      const orderedData = processedData.map(item => {
        const ordered: any = {};
        // Define the order of columns
        const columnOrder = [
          'employeeName',
          'employeeEmail',
          'month',
          'absentDates',
          'totalDays',
          'hoursWorked',
          'totalHours',
          'utilization',
          'Department',
          'Designation',
          'DateOfJoining'
        ];
        
        // Add columns in order if they exist
        columnOrder.forEach(col => {
          if (item[col] !== undefined) {
            ordered[col] = item[col];
          }
        });
        
        // Add any remaining columns
        Object.keys(item).forEach(key => {
          if (!columnOrder.includes(key)) {
            ordered[key] = item[key];
          }
        });
        
        return ordered;
      });

      const ws = XLSX.utils.json_to_sheet(orderedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      resolve(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    });
  }

  private static generatePDF(data: any, filename: string): Promise<Blob> {
    return new Promise(async (resolve) => {
      const doc = new jsPDF();
      const processedData = Array.isArray(data) ? await this.processDataForExport(data) : [data];
      
      if (Array.isArray(processedData)) {
        const headers = Object.keys(processedData[0]);
        const rows = processedData.map(obj => headers.map(key => obj[key]));
        
        doc.autoTable({
          head: [headers],
          body: rows
        });
      } else {
        const rows = Object.entries(processedData).map(([key, value]) => [key, value]);
        doc.autoTable({
          body: rows
        });
      }
      
      resolve(new Blob([doc.output('arraybuffer')], { type: 'application/pdf' }));
    });
  }

  public static async processQuery(query: string): Promise<QueryResult> {
    const analysis = await this.analyzeQuery(query);
    const { startDate, endDate } = getDateRange(analysis.timeRange);
    let data: EmployeeData[] | EmployeeData | null = null;
    
    switch (analysis.intent) {
      case 'absentees':
        data = await getAbsentees(startDate, endDate);
        if (analysis.department && Array.isArray(data)) {
          data = data.filter((a: EmployeeData) => a.department === analysis.department);
        }
        break;
        
      case 'new_joiners':
        data = await getNewJoiners(startDate, endDate);
        if (analysis.department && Array.isArray(data)) {
          data = data.filter((j: EmployeeData) => j.Department === analysis.department);
        }
        break;
        
      case 'work_logs':
        if (analysis.employeeId) {
          data = await getWorkLogs(analysis.employeeId, startDate, endDate);
        } else {
          // Get all work logs and process them
          const { db } = initFirebase();
          const workLogsRef = collection(db, 'work_logs');
          const snapshot = await getDocs(workLogsRef);
          data = snapshot.docs.map(doc => {
            const docData = doc.data();
            return {
              id: doc.id,
              ...docData
            } as EmployeeData;
          });
        }
        break;

      case 'department_info':
        {
          const { db } = initFirebase();
          const employeesRef = collection(db, 'employees');
          const q = analysis.department ? 
            query(employeesRef, where('Department', '==', analysis.department)) :
            query(employeesRef);
          const snapshot = await getDocs(q);
          data = snapshot.docs.map(doc => {
            const docData = doc.data();
            return {
              id: doc.id,
              ...docData
            } as EmployeeData;
          });
        }
        break;

      case 'employee_lookup':
        if (analysis.employeeId) {
          const { db } = initFirebase();
          const employeeRef = doc(db, 'employees', analysis.employeeId);
          const employeeDoc = await getDoc(employeeRef);
          if (employeeDoc.exists()) {
            const docData = employeeDoc.data();
            data = {
              id: employeeDoc.id,
              ...docData
            } as EmployeeData;
          }
        }
        break;
        
      default:
        return {
          text: "I'm not sure how to process that query. Try asking about absentees, new joiners, work logs, departments, or specific employees.",
          data: null,
          downloadOptions: { excel: false, pdf: false }
        };
    }

    // Process the data before generating response
    if (Array.isArray(data)) {
      data = await this.processDataForExport(data);
    }

    const response = await this.generateResponse(data, query, analysis);
    
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