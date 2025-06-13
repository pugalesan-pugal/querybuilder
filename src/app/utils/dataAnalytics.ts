import { collection, query as firestoreQuery, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { initFirebase } from './initFirebase';
import * as XLSX from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format, subMonths, startOfWeek, endOfWeek, parseISO, isWithinInterval, addDays } from 'date-fns';
import nlp from 'compromise';
import { QueryTemplateManager } from './queryTemplates';
import { DataMasking } from './dataMasking';
import { SQLGenerator } from './sqlGenerator';

// Add custom lexicon for our domain
nlp.extend({
  words: {
    // Employee names
    madhu: 'FirstName',
    pugalesan: 'FirstName',
    arunima: 'FirstName',
    
    // Departments
    finance: 'Department',
    marketing: 'Department',
    sales: 'Department',
    hr: 'Department',
    it: 'Department',
    
    // Status terms
    active: 'Status',
    inactive: 'Status',
    current: 'Status',
    former: 'Status',
    present: 'Status',
    past: 'Status',
    
    // Employee attributes
    designation: 'Attribute',
    email: 'Attribute',
    contact: 'Attribute',
    phone: 'Attribute',
    number: 'Attribute',
    address: 'Attribute',
    role: 'Attribute',
    position: 'Attribute',
    salary: 'Attribute',
    details: 'Attribute',
    info: 'Attribute',
    information: 'Attribute',
    
    // Work metrics
    overtime: 'WorkMetric',
    attendance: 'WorkMetric',
    hours: 'WorkMetric',
    working: 'WorkMetric',
    work: 'WorkMetric',
    worked: 'WorkMetric',
    shift: 'WorkMetric',
    schedule: 'WorkMetric',
    time: 'WorkMetric',
    duration: 'WorkMetric',
    
    // Leave terms
    leave: 'LeaveMetric',
    leaves: 'LeaveMetric',
    absent: 'LeaveMetric',
    absence: 'LeaveMetric',
    holiday: 'LeaveMetric',
    vacation: 'LeaveMetric',
    off: 'LeaveMetric',
    
    // Time terms
    today: 'TimeFrame',
    yesterday: 'TimeFrame',
    tomorrow: 'TimeFrame',
    week: 'TimeFrame',
    month: 'TimeFrame',
    year: 'TimeFrame',
    now: 'TimeFrame',
    last: 'TimeFrame',
    next: 'TimeFrame',
    previous: 'TimeFrame'
  }
});

const genAI = new GoogleGenerativeAI('AIzaSyAn3gpVHkV1Hix5UocuihdMlQNpWuKiThM');
const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });

interface QueryIntent {
  primaryIntent: 'employee_search' | 'department_info' | 'attendance' | 'work_hours' | 'joining_info' | 'performance' | 'unknown' | 'personal_info';
  subIntent?: string;
  entities: {
    department?: string;
    employeeName?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
    timeFrame?: 'day' | 'week' | 'month' | 'year';
    status?: 'active' | 'inactive' | 'all';
    attributes?: string[];
  };
  filters: {
    sortBy?: string;
    limit?: number;
    includeInactive?: boolean;
  };
}

interface AnalyticsResponse {
  text: string;
  data?: any;
  error?: string;
  downloadOptions?: {
    excel: boolean;
    pdf: boolean;
  };
  queryInfo?: {
    sql: string;
    firebase: string;
    template: string | null;
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
  DateOfJoining?: string;
  'Contact Number'?: string;
  [key: string]: any;
}

interface DepartmentTrends {
  [department: string]: EmployeeData[];
}

interface MonthlyTrends {
  [month: string]: EmployeeData[];
}

interface JoiningTrendsData {
  departmentTrends: DepartmentTrends;
  monthlyTrends: MonthlyTrends;
}

interface TimeFrameInfo {
  timeFrame?: 'day' | 'week' | 'month' | 'year';
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface ConversationContext {
  lastIntent?: string;
  lastQuery?: string;
  followUpCount: number;
  messages: Array<{
    text: string;
    timestamp: Date;
    type: 'user' | 'bot';
  }>;
}

interface User {
  accessCode: string;
  role: 'HR' | 'EMPLOYEE';
  name?: string;
  department?: string;
}

export class DataAnalytics {
  private db;
  private templateManager: QueryTemplateManager;
  private dataMasking: DataMasking;
  private sqlGenerator: SQLGenerator;
  private genAI: GoogleGenerativeAI;
  private model: any;
  private conversationContext: ConversationContext;
  private currentUser: User | null = null;

  constructor() {
    const { db } = initFirebase();
    this.db = db;
    this.templateManager = new QueryTemplateManager();
    this.dataMasking = new DataMasking();
    this.sqlGenerator = new SQLGenerator();
    this.genAI = new GoogleGenerativeAI('AIzaSyAn3gpVHkV1Hix5UocuihdMlQNpWuKiThM');
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
    this.conversationContext = {
      followUpCount: 0,
      messages: []
    };
  }

  public setCurrentUser(user: User) {
    this.currentUser = user;
  }

  private async checkAccess(requestedAccessCode: string): Promise<boolean> {
    if (!this.currentUser) return false;
    
    // HR can access all records
    if (this.currentUser.role === 'HR') return true;
    
    // Employees can only access their own records
    return this.currentUser.accessCode === requestedAccessCode;
  }

  private async handleUnauthorizedAccess(): Promise<AnalyticsResponse> {
    return {
      text: "I apologize, but you don't have permission to access this information. Please contact HR if you need assistance.",
      error: 'Unauthorized access'
    };
  }

  private async handleError(error: any, context: string): Promise<AnalyticsResponse> {
    console.error(`Error in ${context}:`, error);
    return {
      text: `I apologize, but I encountered an issue while processing your ${context} request. Please try again or contact support if the issue persists.`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  public clearChat(): void {
    this.conversationContext = {
      followUpCount: 0,
      messages: []
    };
  }

  private async processPersonalInfo(intent: QueryIntent, query: string): Promise<AnalyticsResponse> {
    try {
      if (!this.currentUser?.accessCode) {
        return {
          text: "I couldn't find your information. Please ensure you're properly logged in.",
          error: 'No access code'
        };
      }

      // Handle basic personal info that we already have
      if (intent.entities.attributes?.includes('name') || query.toLowerCase().includes('my name')) {
        if (this.currentUser.name) {
          return {
            text: `Your name is ${this.currentUser.name}.`
          };
        }
      }

      // If we need to fetch from database
      const employeesRef = collection(this.db, 'employees');
      const q = firestoreQuery(employeesRef, where('accessCode', '==', this.currentUser.accessCode));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return {
          text: "I couldn't find your employee record in the database. Please contact HR.",
          error: 'No employee record found'
        };
      }

      const employeeData = snapshot.docs[0].data();

      // Handle different types of personal info queries
      if (intent.entities.attributes?.includes('name') || query.toLowerCase().includes('my name')) {
        return {
          text: `Your name is ${employeeData.Name || 'not recorded in the system'}.`
        };
      } else if (intent.entities.attributes?.includes('department') || query.toLowerCase().includes('my department')) {
        return {
          text: `You work in the ${employeeData.Department || 'department information not recorded'} department.`
        };
      } else if (intent.entities.attributes?.includes('designation') || query.toLowerCase().includes('my designation')) {
        return {
          text: `Your designation is ${employeeData.Designation || 'not recorded in the system'}.`
        };
      } else if (intent.entities.attributes?.includes('contact') || 
                 intent.entities.attributes?.includes('email') || 
                 query.toLowerCase().includes('my contact') ||
                 query.toLowerCase().includes('my email')) {
        return {
          text: `Here are your contact details:\n` +
                `Email: ${employeeData.Email || 'Not recorded'}\n` +
                `Contact Number: ${employeeData['Contact Number'] || 'Not recorded'}`
        };
      } else {
        // Show all basic info
        const maskedData = {
          ...employeeData,
          'Contact Number': this.maskPhoneNumber(employeeData['Contact Number']),
          Email: this.maskEmail(employeeData.Email)
        };

        return {
          text: `Here's your personal information:\n\n` +
                `Name: ${employeeData.Name || 'Not recorded'}\n` +
                `Department: ${employeeData.Department || 'Not recorded'}\n` +
                `Designation: ${employeeData.Designation || 'Not recorded'}\n` +
                `Email: ${employeeData.Email || 'Not recorded'}\n` +
                `Contact: ${employeeData['Contact Number'] || 'Not recorded'}\n` +
                `Joined: ${employeeData.DateOfJoining || 'Not recorded'}`,
          data: maskedData,
          downloadOptions: { excel: true, pdf: true }
        };
      }
    } catch (err) {
      console.error('Error in processPersonalInfo:', err);
      const error = err instanceof Error ? err : new Error('Unknown error in personal info processing');
      return {
        text: `I encountered an issue while retrieving your personal information. The error has been logged.\n\n` +
              `Error details: ${error.message}\n\n` +
              `Please try again or contact support if the issue persists.`,
        error: error.message
      };
    }
  }

  private maskPhoneNumber(phone: string | undefined): string {
    if (!phone) return 'Not recorded';
    return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
  }

  private maskEmail(email: string | undefined): string {
    if (!email) return 'Not recorded';
    const [username, domain] = email.split('@');
    return `${username[0]}${username.slice(1).replace(/./g, '*')}@${domain}`;
  }

  async processQuery(userQuery: string, user: any): Promise<AnalyticsResponse> {
    try {
      // Convert the existing user object to our User interface
      if (user) {
        this.currentUser = {
          accessCode: user.accessCode,
          role: user.role || 'EMPLOYEE',
          name: user.name,
          department: user.department
        };
      }

      if (!this.currentUser) {
        return {
          text: "Please log in to access the system.",
          error: 'No user context'
        };
      }

      // Handle chat management commands
      if (userQuery.toLowerCase().trim() === 'clear chat' || 
          userQuery.toLowerCase().trim() === 'delete chat' ||
          userQuery.toLowerCase().trim() === 'clear history') {
        this.clearChat();
        return {
          text: "Chat history has been cleared."
        };
      }

      // Store the message
      this.conversationContext.messages.push({
        text: userQuery,
        timestamp: new Date(),
        type: 'user'
      });

      // First, try to understand if this is a follow-up question
      const isFollowUp = this.isFollowUpQuestion(userQuery);
      
      // If it's a follow-up, maintain context
      if (isFollowUp && this.conversationContext.lastIntent) {
        userQuery = this.enrichQueryWithContext(userQuery);
      }

      // For greeting messages, bypass intent analysis
      if (this.isGreeting(userQuery.toLowerCase())) {
        const response = {
          text: this.generateGreeting()
        };
        this.conversationContext.messages.push({
          text: response.text,
          timestamp: new Date(),
          type: 'bot'
        });
        return response;
      }

      // For help messages, bypass intent analysis
      if (this.isHelpRequest(userQuery.toLowerCase())) {
        const response = {
          text: this.generateHelpMessage()
        };
        this.conversationContext.messages.push({
          text: response.text,
          timestamp: new Date(),
          type: 'bot'
        });
        return response;
      }

      // Try to understand the query intent
      const intent = await this.analyzeQueryIntent(userQuery);
      
      // Log query understanding for debugging
      this.demonstrateQueryUnderstanding(userQuery, nlp(userQuery.toLowerCase()), intent);

      let response: AnalyticsResponse;

      // Process based on user role and intent
      switch (intent.primaryIntent) {
        case 'employee_search':
          if (this.currentUser.role !== 'HR' && 
              (!intent.entities.employeeName || 
               intent.entities.employeeName.toLowerCase() !== this.currentUser.name?.toLowerCase())) {
            response = await this.handleUnauthorizedAccess();
          } else {
            response = await this.processEmployeeSearch(intent);
          }
          break;

        case 'work_hours':
          response = await this.processWorkHours(intent);
          break;

        case 'attendance':
          response = await this.processAttendance(intent);
          break;

        case 'department_info':
          if (this.currentUser.role !== 'HR' && 
              (!intent.entities.department || 
               intent.entities.department !== this.currentUser.department)) {
            response = await this.handleUnauthorizedAccess();
          } else {
            response = await this.processDepartmentInfo(intent);
          }
          break;

        case 'personal_info':
          response = await this.processPersonalInfo(intent, userQuery);
          break;

        default:
          // Try to handle personal info queries even if not explicitly detected
          if (userQuery.toLowerCase().includes('my name') ||
              userQuery.toLowerCase().includes('my department') ||
              userQuery.toLowerCase().includes('my designation') ||
              userQuery.toLowerCase().includes('my details')) {
            response = await this.processPersonalInfo(intent, userQuery);
          } else {
            response = {
              text: "I'm not sure I understood that. Could you please rephrase your question? You can ask about:\n" +
                   "• Your work hours\n" +
                   "• Your attendance/leave records\n" +
                   "• Your personal information\n" +
                   (this.currentUser.role === 'HR' ? 
                    "• Employee information\n" +
                    "• Department details\n" +
                    "• Company-wide analytics" : "")
            };
          }
      }

      // Store the bot's response
      const resolvedResponse = await response;
      this.conversationContext.messages.push({
        text: resolvedResponse.text,
        timestamp: new Date(),
        type: 'bot'
      });

      return resolvedResponse;
    } catch (err) {
      const errorResponse = this.handleError(err, 'query');
      this.conversationContext.messages.push({
        text: errorResponse.text,
        timestamp: new Date(),
        type: 'bot'
      });
      return errorResponse;
    }
  }

  private isGreeting(query: string): boolean {
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
    return greetings.some(greeting => query.includes(greeting));
  }

  private isHelpRequest(query: string): boolean {
    const helpTerms = ['help', 'what can you do', 'how does this work', 'what do you do'];
    return helpTerms.some(term => query.includes(term));
  }

  private async processWorkHours(intent: QueryIntent): Promise<AnalyticsResponse> {
    try {
        if (!this.currentUser?.accessCode) {
            return {
                text: "Please log in to view your work hours.",
                error: 'No access code'
            };
        }

        const currentDate = new Date();
        const workhoursRef = collection(this.db, 'workhours');
        
        // Get current month in YYYY-MM format
        const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Get previous month in YYYY-MM format
        const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        // Query for documents matching the access code and last two months
        const q = firestoreQuery(workhoursRef, 
            where('accessCode', '==', this.currentUser.accessCode),
            where('month', 'in', [currentMonth, prevMonth])
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return {
                text: `I couldn't find any work hours records for the period ${prevMonth} to ${currentMonth}. ` +
                      `Try asking for a different time period, or contact HR if you think this is incorrect.`,
                error: 'No records found'
            };
        }

        // Process and format the results
        const records = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                month: data.month,
                hoursWorked: data.hoursWorked,
                totalHours: data.totalHours
            };
        }).sort((a, b) => a.month.localeCompare(b.month));

        let responseText = "Here are your working hours for the past two months:\n\n";
        
        records.forEach(record => {
            const completion = ((record.hoursWorked / record.totalHours) * 100).toFixed(1);
            responseText += `📅 ${record.month}:\n`;
            responseText += `   • Hours Worked: ${record.hoursWorked} hours\n`;
            responseText += `   • Target Hours: ${record.totalHours} hours\n`;
            responseText += `   • Completion: ${completion}%\n\n`;
        });

        return {
            text: responseText,
            data: records,
            downloadOptions: { excel: true, pdf: true }
        };

    } catch (err) {
        console.error('Error in processWorkHours:', err);
        const error = err instanceof Error ? err : new Error('Unknown error in work hours processing');
        return {
            text: `I encountered an issue while retrieving your work hours. The error has been logged.\n\n` +
                  `Error details: ${error.message}\n\n` +
                  `Please try again or contact support if the issue persists.`,
            error: error.message
        };
    }
}

  private async processAttendance(intent: QueryIntent): Promise<AnalyticsResponse> {
    try {
        if (!this.currentUser?.accessCode) {
            console.error('Attendance query - No access code found:', this.currentUser);
            return {
                text: "I couldn't find your employee information. Please ensure you're properly logged in.",
                error: 'No access code'
            };
        }

        console.log('Processing attendance query for user:', {
            accessCode: this.currentUser.accessCode,
            timeFrame: intent.entities.timeFrame,
            dateRange: intent.entities.dateRange
        });

        const absenteesRef = collection(this.db, 'absentees');
        let q = firestoreQuery(absenteesRef, where('accessCode', '==', this.currentUser.accessCode));

        // Default to current month if no date range specified
        if (!intent.entities.dateRange) {
            const now = new Date();
            const currentMonth = format(now, 'yyyy-MM');
            q = firestoreQuery(q, where('month', '==', currentMonth));
        } else {
            const startMonth = format(intent.entities.dateRange.start, 'yyyy-MM');
            const endMonth = format(intent.entities.dateRange.end, 'yyyy-MM');
            if (startMonth === endMonth) {
                q = firestoreQuery(q, where('month', '==', startMonth));
            } else {
                q = firestoreQuery(q, 
                    where('month', '>=', startMonth),
                    where('month', '<=', endMonth)
                );
            }
        }

        console.log('Executing Firestore query for attendance');
        const snapshot = await getDocs(q);
        console.log('Attendance query result:', {
            empty: snapshot.empty,
            size: snapshot.size
        });

        if (snapshot.empty) {
            return {
                text: `I couldn't find any leave records for the specified period. This could mean either:\n` +
                      `1. You haven't taken any leaves during this period\n` +
                      `2. The time period you asked for doesn't have any records\n\n` +
                      `Try asking for a different time period, or contact HR if you think this is incorrect.`,
                data: []
            };
        }

        const records = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                month: data.month,
                absentDates: Array.isArray(data.absentDates) ? data.absentDates : [],
                totalDays: Array.isArray(data.absentDates) ? data.absentDates.length : 0,
                status: data.status || 'Unknown'
            };
        });

        const totalDays = records.reduce((sum, record) => sum + record.totalDays, 0);

        let response = `Here's your leave records summary:\n\n`;
        response += `Total Leave Days: ${totalDays}\n\n`;
        response += `Detailed Breakdown:\n`;
        response += records.map(record => 
            `Period: ${record.month}\n` +
            `Dates: ${record.absentDates.join(', ') || 'None'}\n` +
            `Total Days: ${record.totalDays}`
        ).join('\n\n');

        return {
            text: response,
            data: records,
            downloadOptions: { excel: true, pdf: true }
        };
    } catch (err) {
        console.error('Error in processAttendance:', err);
        const error = err instanceof Error ? err : new Error('Unknown error in attendance processing');
        return {
            text: `I encountered an issue while retrieving your attendance records. The error has been logged.\n\n` +
                  `Error details: ${error.message}\n\n` +
                  `Please try again or contact support if the issue persists.`,
            error: error.message
        };
    }
  }

  private extractTimeFrame(doc: any): TimeFrameInfo {
    const dates = doc.match('(last|this|next) (day|week|month|year)');
    if (dates.found) {
      const [relative, unit] = dates.text().split(' ');
      const now = new Date();
      
      try {
        switch (relative) {
          case 'last':
            switch (unit) {
              case 'day':
                return {
                  timeFrame: 'day',
                  dateRange: {
                    start: addDays(now, -1),
                    end: now
                  }
                };
              case 'week':
                const lastWeekStart = startOfWeek(addDays(now, -7));
                const lastWeekEnd = endOfWeek(addDays(now, -7));
                return {
                  timeFrame: 'week',
                  dateRange: {
                    start: lastWeekStart,
                    end: lastWeekEnd
                  }
                };
              case 'month':
                const lastMonth = subMonths(now, 1);
                return {
                  timeFrame: 'month',
                  dateRange: {
                    start: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
                    end: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)
                  }
                };
              case 'year':
                return {
                  timeFrame: 'year',
                  dateRange: {
                    start: new Date(now.getFullYear() - 1, 0, 1),
                    end: new Date(now.getFullYear() - 1, 11, 31)
                  }
                };
              default:
                return {};
            }
          case 'this':
            switch (unit) {
              case 'week':
                return {
                  timeFrame: 'week',
                  dateRange: {
                    start: startOfWeek(now),
                    end: endOfWeek(now)
                  }
                };
              case 'month':
                return {
                  timeFrame: 'month',
                  dateRange: {
                    start: new Date(now.getFullYear(), now.getMonth(), 1),
                    end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
                  }
                };
              case 'year':
                return {
                  timeFrame: 'year',
                  dateRange: {
                    start: new Date(now.getFullYear(), 0, 1),
                    end: new Date(now.getFullYear(), 11, 31)
                  }
                };
              default:
                return {};
            }
          default:
            return {};
        }
      } catch (error) {
        console.error('Error processing date range:', error instanceof Error ? error.message : error);
        return {};
      }
    }
    return {};
  }

  private async analyzeQueryIntent(query: string): Promise<QueryIntent> {
    const doc = nlp(query.toLowerCase());
    let primaryIntent: QueryIntent['primaryIntent'] = 'unknown';
    let subIntent = 'details';

    // Define patterns for different query types
    const patterns = {
      leave: [
        '(leave|leaves|took leave|taken leave|absent|absence|holiday|holidays|off|time off|on leave)',
        'how many days.*leave',
        'when.*(leave|absent)',
        'show.*leave.*record'
      ],
      workHours: [
        '(what|how|show|tell|get|display).*(work|working|worked|shift|schedule|time|duration).*(hours|time)',
        'my.*(work|working|worked|shift|schedule).*(hours|time)',
        '(work|working|worked|shift|schedule).*(hours|time)',
        'how (long|much).*(work|working|worked)',
        'when.*(work|working|worked)'
      ],
      employeeSearch: [
        'who is.*',
        'find.*person',
        'search.*employee',
        'look.*for.*employee',
        'get.*details.*of',
        'show.*information.*about',
        'tell.*me.*about',
        '(contact|email|phone).*details'
      ],
      departmentInfo: [
        'show.*department',
        'display.*department',
        'who.*(work|works).*in',
        'how many.*people.*in',
        'list.*employees.*in',
        'department.*strength',
        'team.*size'
      ],
      joiningInfo: [
        'when.*join(ed)?',
        'joining.*date',
        'start.*date',
        'how long.*working',
        'experience',
        'tenure'
      ]
    };

    // Check patterns for each intent type
    if (patterns.leave.some(p => doc.match(p).found || query.toLowerCase().match(p)) || doc.has('#LeaveMetric')) {
      primaryIntent = 'attendance';
      subIntent = doc.has('how many') || doc.has('total') ? 'count' : 'details';
    }
    else if (patterns.workHours.some(p => doc.match(p).found || query.toLowerCase().match(p)) || doc.has('#WorkMetric')) {
      primaryIntent = 'work_hours';
      subIntent = doc.has('how many') || doc.has('total') ? 'total' : 
                 doc.has('average') || doc.has('avg') ? 'average' : 'details';
    }
    else if (patterns.employeeSearch.some(p => doc.match(p).found || query.toLowerCase().match(p)) || 
             doc.has('#FirstName') || doc.has('#Attribute')) {
      primaryIntent = 'employee_search';
      subIntent = doc.has('contact') || doc.has('email') || doc.has('phone') ? 'contact' : 'details';
    }
    else if (patterns.departmentInfo.some(p => doc.match(p).found || query.toLowerCase().match(p)) || 
             doc.has('#Department')) {
      primaryIntent = 'department_info';
      subIntent = doc.has('how many') || doc.has('count') ? 'count' : 'list';
    }
    else if (patterns.joiningInfo.some(p => doc.match(p).found || query.toLowerCase().match(p))) {
      primaryIntent = 'joining_info';
    }

    // Extract entities with enhanced time frame detection
    const entities: QueryIntent['entities'] = {
      status: 'all',
      attributes: []
    };

    // Enhanced time frame extraction
    const timeInfo = this.extractTimeFrame(doc);
    if (!timeInfo.dateRange) {
      const now = new Date();
      if (doc.has('today')) {
        entities.dateRange = {
          start: now,
          end: now
        };
        entities.timeFrame = 'day';
      } else if (doc.has('yesterday')) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        entities.dateRange = {
          start: yesterday,
          end: yesterday
        };
        entities.timeFrame = 'day';
      } else {
        // Default to current month
      entities.dateRange = {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
      };
      entities.timeFrame = 'month';
      }
    } else {
      entities.dateRange = timeInfo.dateRange;
      entities.timeFrame = timeInfo.timeFrame;
    }

    // Extract department with fuzzy matching
    const departmentMatch = doc.match('#Department').text() || 
                          doc.match('(in|at|from) (the )?(finance|marketing|sales|hr|it)').groups('2');
    if (departmentMatch && typeof departmentMatch === 'string') {
      entities.department = departmentMatch.charAt(0).toUpperCase() + departmentMatch.slice(1);
    }

    // Enhanced employee name extraction
    const nameMatch = doc.match('#FirstName').text() || 
                     doc.match('(of|about|for) [#Noun+]').groups('2') ||
                     doc.match('(named|called) [#Noun+]').groups('2');
    if (nameMatch && typeof nameMatch === 'string') {
      entities.employeeName = nameMatch.charAt(0).toUpperCase() + nameMatch.slice(1);
    }

    // Enhanced status extraction
    if (doc.has('active') || doc.has('current') || doc.has('present')) {
      entities.status = 'active';
    } else if (doc.has('inactive') || doc.has('former') || doc.has('past')) {
      entities.status = 'inactive';
    }

    // Enhanced attribute extraction
    const attributeMatches = doc.match('#Attribute').out('array');
    entities.attributes = attributeMatches.filter((attr: unknown): attr is string => typeof attr === 'string');

    // Extract filters with enhanced sorting
    const filters: QueryIntent['filters'] = {
      includeInactive: doc.has('all') || doc.has('inactive') || doc.has('everyone')
    };

    // Enhanced sorting preferences
    if (doc.has('sort by') || doc.has('order by')) {
      const sortMatch = doc.match('(sort|order) by [#Noun+]').groups('3');
      if (sortMatch && typeof sortMatch === 'string') {
        filters.sortBy = sortMatch;
      }
    }

    // Enhanced limit extraction
    const limitMatch = doc.match('(top|first|latest|recent) [0-9]+ ').text();
    if (limitMatch) {
      const matches = limitMatch.match(/\d+/);
      if (matches) {
        filters.limit = parseInt(matches[0], 10);
      }
    }

    return {
      primaryIntent,
      subIntent,
      entities,
      filters
    };
  }

  private async processEmployeeSearch(intent: QueryIntent): Promise<AnalyticsResponse> {
    const employeesRef = collection(this.db, 'employees');
    let query = firestoreQuery(employeesRef);

    // Apply filters
    if (intent.entities.employeeName) {
      const name = intent.entities.employeeName.toLowerCase();
      const snapshot = await getDocs(query);
      const matchingDocs = snapshot.docs.filter(doc => {
        const empName = doc.data().Name?.toLowerCase() || '';
        return empName.includes(name) || 
               empName.split(' ').some((part: string) => part === name) ||
               name.split(' ').some((part: string) => empName.includes(part));
      });

      if (matchingDocs.length === 0) {
        return {
          text: `No employees found matching "${intent.entities.employeeName}".`,
          data: null
        };
      }

      // Process matches
      const employees = matchingDocs.map(doc => {
        const data = doc.data();
        const result: any = {
          Name: data.Name,
          Department: data.Department,
          Designation: data.Designation,
          Status: data.Status
        };

        // Only include requested attributes or all if none specified
        if (!intent.entities.attributes || intent.entities.attributes.length === 0) {
          result.Email = data.Email;
          result['Contact Number'] = data['Contact Number'];
          result.DateOfJoining = data.DateOfJoining;
        } else {
          intent.entities.attributes.forEach(attr => {
            switch (attr.toLowerCase()) {
              case 'email':
                result.Email = data.Email;
                break;
              case 'contact':
                result['Contact Number'] = data['Contact Number'];
                break;
              case 'designation':
                result.Designation = data.Designation;
                break;
            }
          });
        }

        return result;
      });

      // Handle single exact match
      const exactMatch = employees.find(emp => 
        emp.Name?.toLowerCase() === name
      );

      if (exactMatch || employees.length === 1) {
        const emp = exactMatch || employees[0];
        return {
          text: this.formatEmployeeDetails(emp, intent.entities.attributes),
          data: emp,
          downloadOptions: { excel: true, pdf: true }
        };
      }

      return {
        text: this.formatEmployeeList(employees, intent.entities.attributes),
        data: employees,
        downloadOptions: { excel: true, pdf: true }
      };
    }

    return {
      text: "Please provide an employee name to search.",
      data: null
    };
  }

  private formatEmployeeList(employees: any[], attributes?: string[]): string {
    if (attributes && attributes.length > 0) {
      // Detailed format with specific attributes
      return `Found ${employees.length} matching employees:\n\n${
        employees.map(emp => this.formatEmployeeDetails(emp, attributes)).join('\n\n')
      }`;
    } else {
      // Simple format
      return employees.map(emp => 
        `${emp.Name}\n` +
        `${emp.Designation || 'No Designation'}\n` +
        `Email: ${emp.Email || 'No Email'}\n` +
        `Contact: ${emp['Contact Number'] || 'No Contact'}`
      ).join('\n\n');
    }
  }

  private formatEmployeeDetails(emp: any, attributes?: string[]): string {
    let details = `Name: ${emp.Name}\nDepartment: ${emp.Department || 'No Department'}\n`;
    
    if (!attributes || attributes.length === 0) {
      // Show all details
      if (emp.Designation) details += `Designation: ${emp.Designation}\n`;
      if (emp.Email) details += `Email: ${emp.Email}\n`;
      if (emp['Contact Number']) details += `Contact: ${emp['Contact Number']}\n`;
      if (emp.DateOfJoining) details += `Joined: ${emp.DateOfJoining}\n`;
      if (emp.Status) details += `Status: ${emp.Status}\n`;
    } else {
      // Show only requested attributes
      attributes.forEach(attr => {
        switch (attr.toLowerCase()) {
          case 'email':
            if (emp.Email) details += `Email: ${emp.Email}\n`;
            break;
          case 'contact':
            if (emp['Contact Number']) details += `Contact: ${emp['Contact Number']}\n`;
            break;
          case 'designation':
            if (emp.Designation) details += `Designation: ${emp.Designation}\n`;
            break;
        }
      });
    }

    return details.trim();
  }

  private formatEmployeeProfiles(employees: any[]): string {
    return employees.map(emp => 
      `Employee Profile:\n` +
      `Name: ${emp.Name || 'No Name'}\n` +
      `Department: ${emp.Department || 'No Department'}\n` +
      `Designation: ${emp.Designation || 'No Designation'}\n` +
      `Experience: ${emp.Experience ? `${emp.Experience} years` : 'Not specified'}\n` +
      `Email: ${emp.Email || 'No Email'}\n` +
      `Contact: ${emp['Contact Number'] || 'No Contact'}\n` +
      `Joined: ${emp.DateOfJoining || 'Not specified'}`
    ).join('\n\n');
  }

  private async processDepartmentInfo(intent: QueryIntent): Promise<AnalyticsResponse> {
    const employeesRef = collection(this.db, 'employees');
    let query = firestoreQuery(employeesRef);

    // Apply department filter
    if (intent.entities.department) {
      query = firestoreQuery(query, where('Department', '==', intent.entities.department));
    }

    // Apply status filter
    if (intent.entities.status === 'active') {
      query = firestoreQuery(query, where('Status', '==', 'Active'));
    }

    const snapshot = await getDocs(query);
    let employees = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        Name: data.Name,
        Department: data.Department,
        Designation: data.Designation,
        Email: data.Email,
        'Contact Number': data['Contact Number'],
        DateOfJoining: data.DateOfJoining,
        Status: data.Status
      };
    });

    // Apply sorting
    if (intent.filters.sortBy) {
      employees.sort((a, b) => {
        switch (intent.filters.sortBy) {
          case 'name':
            return (a.Name || '').localeCompare(b.Name || '');
          case 'designation':
            return (a.Designation || '').localeCompare(b.Designation || '');
          case 'date':
            return new Date(a.DateOfJoining || 0).getTime() - new Date(b.DateOfJoining || 0).getTime();
          default:
            return 0;
        }
      });
    }

    // Apply limit
    if (intent.filters.limit) {
      employees = employees.slice(0, intent.filters.limit);
    }

    // Generate response based on subIntent
    let response = '';
    if (intent.subIntent === 'count') {
      response = `${intent.entities.department || 'All departments'} has ${employees.length} ${
        intent.entities.status === 'active' ? 'active ' : ''
      }employees.`;
    } else {
      response = `${intent.entities.department || 'All departments'} - ${employees.length} employees:\n\n${
        employees.map(emp => 
          `- ${emp.Name} (${emp.Designation || 'No Designation'})\n` +
          `  Department: ${emp.Department}\n` +
          `  Email: ${emp.Email || 'No Email'}\n` +
          `  Contact: ${emp['Contact Number'] || 'No Contact'}\n` +
          `  Status: ${emp.Status}\n` +
          `  Joined: ${emp.DateOfJoining || 'No Join Date'}`
        ).join('\n\n')
      }`;
    }

    return {
      text: response,
      data: employees,
      downloadOptions: { excel: true, pdf: true }
    };
  }

  private mapIntentToCategory(intent: string): 'attendance' | 'employee' | 'department' | 'performance' | 'general' {
    switch (intent) {
      case 'employee_search':
        return 'employee';
      case 'department_info':
        return 'department';
      case 'attendance':
        return 'attendance';
      case 'work_hours':
      case 'joining_info':
        return 'performance';
      default:
        return 'general';
    }
  }

  private async handleGeneralQuery(query: string): Promise<AnalyticsResponse> {
    try {
      // First, try to classify the query type
      const queryType = await this.classifyGeneralQuery(query);
      
      switch (queryType) {
        case 'greeting':
          return {
            text: this.generateGreeting()
          };
        
        case 'help':
          return {
            text: this.generateHelpMessage()
          };
        
        case 'clarification':
          return {
            text: this.generateClarificationRequest(query)
          };
        
        default:
          // Use Gemini for general conversation
          const prompt = `
            As an HR assistant, respond to this query: "${query}"
            Context: This is a workplace HR system.
            Keep the response professional and concise.
            If you're not sure, ask for clarification.
          `;
          
          const result = await this.model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          return {
            text
          };
      }
    } catch (err) {
      console.error('Error handling general query:', err instanceof Error ? err.message : 'Unknown error');
      return {
        text: "I'm not sure I understood that. Could you try asking in a different way or be more specific about what you need?"
      };
    }
  }

  private async classifyGeneralQuery(query: string): Promise<string> {
    const normalizedQuery = query.toLowerCase();
    
    // Check for greetings
    if (normalizedQuery.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
      return 'greeting';
    }
    
    // Check for help requests
    if (normalizedQuery.match(/(help|what can you do|what do you do|how does this work)/)) {
      return 'help';
    }
    
    // Check for clarification needs
    if (normalizedQuery.match(/(what|why|how|when|where|who|which|whose|whom)/)) {
      return 'clarification';
    }
    
    return 'general';
  }

  private generateGreeting(): string {
    const hour = new Date().getHours();
    let timeOfDay = 'day';
    if (hour < 12) timeOfDay = 'morning';
    else if (hour < 17) timeOfDay = 'afternoon';
    else timeOfDay = 'evening';
    
    const name = this.currentUser?.name ? `, ${this.currentUser.name}` : '';
    let greeting = `Good ${timeOfDay}${name}! How can I help you today?\n\n`;
    
    if (this.currentUser?.role === 'HR') {
      greeting += `As an HR member, you can ask about:\n`;
      greeting += `• Employee information and searches\n`;
      greeting += `• Department details and analytics\n`;
      greeting += `• Company-wide attendance records\n`;
      greeting += `• Work hours and performance metrics\n`;
      greeting += `• Leave management\n`;
    } else {
      greeting += `You can ask about:\n`;
      greeting += `• Your work hours and schedule\n`;
      greeting += `• Your attendance and leave records\n`;
      greeting += `• Your personal information\n`;
      greeting += `• Your department information\n`;
    }
    
    return greeting;
  }

  private generateHelpMessage(): string {
    if (this.currentUser?.role === 'HR') {
      return `As an HR member, here are some example queries you can use:\n\n` +
             `Employee Information:\n` +
             `• "Find employee John's contact details"\n` +
             `• "Show me all employees in HR department"\n` +
             `• "How many active employees are there?"\n\n` +
             `Attendance & Leave:\n` +
             `• "Show leave records for marketing team"\n` +
             `• "Who is on leave today?"\n` +
             `• "Department-wise attendance report"\n\n` +
             `Work Hours & Performance:\n` +
             `• "Show work hours for IT team"\n` +
             `• "Who worked overtime last week?"\n` +
             `• "Department performance metrics"\n\n` +
             `Just ask your question naturally, and I'll help you find the information!`;
    } else {
      return `Here are some example queries you can use:\n\n` +
             `Work Hours:\n` +
             `• "What are my working hours today?"\n` +
             `• "Show my work schedule this week"\n` +
             `• "How many hours did I work last month?"\n\n` +
             `Leave & Attendance:\n` +
             `• "Show my leave records"\n` +
             `• "How many leaves did I take this month?"\n` +
             `• "My attendance report"\n\n` +
             `Personal Info:\n` +
             `• "Show my details"\n` +
             `• "Update my contact information"\n` +
             `• "My department information"\n\n` +
             `Just ask your question naturally, and I'll help you find the information!`;
    }
  }

  private generateClarificationRequest(query: string): string {
    const doc = nlp(query);
    let response = "I'll try to help. ";
    
    if (doc.has('why')) {
      response += "Could you provide more context about what specific information you're looking for?";
    } else if (doc.has('how')) {
      response += "What specific process or information would you like to know about?";
    } else if (doc.has('what')) {
      response += "Could you be more specific about what information you need?";
    } else {
      response += "Could you rephrase your question with more details?";
    }
    
    return response;
  }

  private isFollowUpQuestion(query: string): boolean {
    const normalizedQuery = query.toLowerCase();
    return normalizedQuery.match(/^(what about|how about|and|then|also|what if|why|how)/i) !== null;
  }

  private enrichQueryWithContext(query: string): string {
    if (!this.conversationContext.lastQuery) return query;
    
    // Extract relevant context from last query
    const lastQueryDoc = nlp(this.conversationContext.lastQuery);
    const currentQueryDoc = nlp(query);
    
    // If current query lacks subject but has predicate, borrow subject from last query
    if (!currentQueryDoc.match('#Noun').found && lastQueryDoc.match('#Noun').found) {
      const subject = lastQueryDoc.match('#Noun').text();
      return `${subject} ${query}`;
    }
    
    return query;
  }

  private async processIntentBasedQuery(intent: QueryIntent, query: string, user: any): Promise<AnalyticsResponse> {
    switch (intent.primaryIntent) {
      case 'employee_search':
        return await this.processEmployeeSearch(intent);
      case 'department_info':
        return await this.processDepartmentInfo(intent);
      case 'attendance':
        return user.role === 'HR' ? 
          await this.handleHRLeaveQuery(query) :
          await this.handleEmployeeLeaveQuery(query, user);
      case 'work_hours':
        return user.role === 'HR' ? 
          await this.handleHRWorkHoursQuery(query) :
          await this.handleEmployeeWorkHoursQuery(query, user);
      case 'joining_info':
        return await this.handleJoiningTrends();
      default:
        return {
          text: "I'm not sure I understood that. Could you please be more specific about what information you need?"
        };
    }
  }

  private extractParameters(intent: QueryIntent): string[] {
    const parameters: string[] = [];
    
    if (intent.entities.employeeName) parameters.push('employeeName');
    if (intent.entities.department) parameters.push('department');
    if (intent.entities.timeFrame) parameters.push('timeFrame');
    if (intent.entities.status) parameters.push('status');
    if (intent.entities.dateRange) parameters.push('dateRange');
    if (intent.filters.sortBy) parameters.push('sortBy');
    if (intent.filters.limit) parameters.push('limit');

    return parameters;
  }

  private async handlePersonalInfoQuery(query: string, user: any): Promise<AnalyticsResponse> {
    const employeesRef = collection(this.db, 'employees');
    const q = firestoreQuery(employeesRef, where('accessCode', '==', user.accessCode));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { text: "Sorry, I couldn't find your employee information." };
    }

    const employeeData = snapshot.docs[0].data();
    let response = '';

    if (query.includes('designation')) {
      response = `Your current designation is: ${employeeData.Designation}`;
    } else if (query.includes('join')) {
      response = `You joined the company on: ${employeeData.DateOfJoining}`;
    } else if (query.includes('contact') || query.includes('email')) {
      response = `Your registered contact details are:\nEmail: ${employeeData.Email}\nContact Number: ${employeeData['Contact Number']}`;
    } else if (query.includes('salary')) {
      response = `Your current salary is: ${employeeData.Salary}`;
    } else if (query.includes('experience')) {
      response = `You have ${employeeData.Experience} years of experience`;
    }

    return { text: response };
  }

  private async handleEmployeeLeaveQuery(query: string, user: any): Promise<AnalyticsResponse> {
    try {
      const absenteesRef = collection(this.db, 'absentees');
      let q = firestoreQuery(absenteesRef, where('accessCode', '==', user.accessCode));

      // Default to current month if no specific time is mentioned
      const now = new Date();
      const currentMonth = format(now, 'yyyy-MM');
      
      // Add time-based filters
      if (query.includes('last month')) {
        const lastMonth = format(subMonths(now, 1), 'yyyy-MM');
        q = firestoreQuery(q, where('month', '==', lastMonth));
      } else if (query.includes('last week')) {
        const lastWeekStart = format(startOfWeek(addDays(now, -7)), 'yyyy-MM-dd');
        const lastWeekEnd = format(endOfWeek(addDays(now, -7)), 'yyyy-MM-dd');
        q = firestoreQuery(q, 
          where('date', '>=', lastWeekStart),
          where('date', '<=', lastWeekEnd)
        );
      } else {
        // Default to current month
        q = firestoreQuery(q, where('month', '==', currentMonth));
      }

      const snapshot = await getDocs(q);
      const leaves: any[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.absentDates && Array.isArray(data.absentDates)) {
          leaves.push({
            month: data.month,
            absentDates: data.absentDates,
            totalDays: data.absentDates.length
          });
        }
      });

      if (leaves.length === 0) {
        return { 
          text: `No leave records found ${query.includes('last month') ? 'for last month' : 
                query.includes('last week') ? 'for last week' : 'for this month'}.`,
          data: [],
          downloadOptions: { excel: false, pdf: false }
        };
      }

      // Calculate total leave days
      const totalDays = leaves.reduce((acc, curr) => acc + curr.totalDays, 0);
      const formattedDates = leaves.map(leave => {
        return {
          month: leave.month,
          dates: leave.absentDates.join(', '),
          totalDays: leave.totalDays
        };
      });

      return {
        text: `You have taken ${totalDays} day${totalDays === 1 ? '' : 's'} of leave${
          query.includes('last month') ? ' last month' : 
          query.includes('last week') ? ' last week' : ' this month'}.\n\n` +
          formattedDates.map(item => 
            `Period: ${item.month}\nDates: ${item.dates}\nTotal Days: ${item.totalDays}`
          ).join('\n\n'),
        data: formattedDates,
        downloadOptions: { excel: true, pdf: true }
      };

    } catch (err) {
      console.error('Error processing leave query:', err instanceof Error ? err.message : 'Unknown error');
      return {
        text: "Sorry, there was an error processing your leave query. Please try again.",
        data: null
      };
    }
  }

  private async handleEmployeeWorkHoursQuery(query: string, user: any): Promise<AnalyticsResponse> {
    try {
      // First demonstrate query understanding
      const doc = nlp(query.toLowerCase());
      const tokens = doc.terms().out('array');
      const tags = doc.terms().out('tags');
      
      console.log('Query Understanding:', {
        originalQuery: query,
        tokens: tokens,
        tags: tags,
        hasWorkMetric: doc.has('#WorkMetric'),
        timeFrame: this.extractTimeFrame(doc)
      });

      // Rest of the work hours processing logic
    const workhoursRef = collection(this.db, 'workhours');
    let timeFilter: any = {};

    // Determine time range from query
    if (query.includes('this month')) {
      const currentMonth = format(new Date(), 'yyyy-MM');
      timeFilter = where('month', '==', currentMonth);
    } else if (query.includes('this week')) {
      const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
      timeFilter = where('date', '>=', weekStart);
    } else if (query.includes('june 2')) {
      timeFilter = where('date', '==', '2024-06-02');
    }

    const q = firestoreQuery(workhoursRef,
      where('accessCode', '==', user.accessCode),
      timeFilter
    );

    const snapshot = await getDocs(q);
    const hours: any[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const employeeName = await this.getEmployeeName(data.accessCode);
      hours.push({
        date: data.date,
        hoursWorked: data.hoursWorked,
        targetHours: data.targetHours,
        employeeName,
        completion: ((data.hoursWorked / data.targetHours) * 100).toFixed(2) + '%'
      });
    }

    if (hours.length === 0) {
      return {
        text: "No work hours records found for the specified period.",
        data: [],
        downloadOptions: { excel: false, pdf: false }
      };
    }

    return {
      text: this.formatWorkHoursResponse(query, hours),
      data: hours,
      downloadOptions: { excel: true, pdf: true }
    };
    } catch (err) {
      console.error('Error processing work hours query:', err instanceof Error ? err.message : 'Unknown error');
      return {
        text: "I encountered an error processing your work hours query. Could you try rephrasing it?",
        data: null
      };
    }
  }

  private async handleHRLeaveQuery(query: string): Promise<AnalyticsResponse> {
    const absenteesRef = collection(this.db, 'absentees');
    let q = firestoreQuery(absenteesRef);

    // Add specific filters based on query
    if (query.includes('may')) {
      q = firestoreQuery(absenteesRef, where('month', '==', '2024-05'));
    } else if (query.includes('last week')) {
      const lastWeekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
      const lastWeekEnd = format(endOfWeek(new Date()), 'yyyy-MM-dd');
      q = firestoreQuery(absenteesRef, 
        where('absentDates', 'array-contains-any', [lastWeekStart, lastWeekEnd]));
    }

    if (query.includes('hr employees')) {
      q = firestoreQuery(q, where('department', '==', 'HR'));
    }

    const snapshot = await getDocs(q);
    const leaves: any[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const employeeDetails = await this.getEmployeeDetails(data.accessCode);
      leaves.push({
        employeeName: employeeDetails.name,
        employeeEmail: employeeDetails.email,
        department: data.department,
        month: data.month,
        absentDates: data.absentDates.join(', '),
        totalDays: data.absentDates.length
      });
    }

    // Sort by total days for "most absent" queries
    if (query.includes('most')) {
      leaves.sort((a, b) => b.totalDays - a.totalDays);
    }

    return {
      text: this.formatHRLeaveAnalysis(leaves),
      data: leaves,
      downloadOptions: { excel: true, pdf: true }
    };
  }

  private async handleHRWorkHoursQuery(query: string): Promise<AnalyticsResponse> {
    const workhoursRef = collection(this.db, 'workhours');
    let q = firestoreQuery(workhoursRef);

    // Add specific filters based on query
    if (query.includes('this month')) {
      const currentMonth = format(new Date(), 'yyyy-MM');
      q = firestoreQuery(q, where('month', '==', currentMonth));
    } else if (query.includes('this week')) {
      const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
      q = firestoreQuery(q, where('date', '>=', weekStart));
    }

    const snapshot = await getDocs(q);
    const hours: any[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const employeeDetails = await this.getEmployeeDetails(data.accessCode);
      hours.push({
        employeeName: employeeDetails.name,
        employeeEmail: employeeDetails.email,
        department: data.department,
        date: data.date,
        hoursWorked: data.hoursWorked,
        targetHours: data.targetHours,
        overtime: Math.max(0, data.hoursWorked - data.targetHours),
        completion: ((data.hoursWorked / data.targetHours) * 100).toFixed(2) + '%'
      });
    }

    // Sort by hours worked for "most hours" queries
    if (query.includes('most')) {
      hours.sort((a, b) => b.hoursWorked - a.hoursWorked);
    }

    // Filter overtime records
    let filteredHours = hours;
    if (query.includes('overtime')) {
      filteredHours = hours.filter(h => h.overtime > 0);
    }

    return {
      text: this.formatHRWorkHoursAnalysis(filteredHours),
      data: filteredHours,
      downloadOptions: { excel: true, pdf: true }
    };
  }

  private async handleJoiningTrends(): Promise<AnalyticsResponse> {
    const employeesRef = collection(this.db, 'employees');
    const snapshot = await getDocs(employeesRef);
    
    const joinings = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        Name: data.Name,
        Department: data.Department,
        DateOfJoining: data.DateOfJoining
      } as EmployeeData;
    });

    // Sort by joining date
    joinings.sort((a, b) => {
      const dateA = a.DateOfJoining ? new Date(a.DateOfJoining).getTime() : 0;
      const dateB = b.DateOfJoining ? new Date(b.DateOfJoining).getTime() : 0;
      return dateA - dateB;
    });

    // Group by department and month
    const departmentTrends: DepartmentTrends = {};
    const monthlyTrends: MonthlyTrends = {};
    
    joinings.forEach(emp => {
      // Department grouping
      if (emp.Department) {
        if (!departmentTrends[emp.Department]) {
          departmentTrends[emp.Department] = [];
        }
        departmentTrends[emp.Department].push(emp);
      }

      // Monthly grouping
      if (emp.DateOfJoining) {
        const joinDate = new Date(emp.DateOfJoining);
        const monthKey = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyTrends[monthKey]) {
          monthlyTrends[monthKey] = [];
        }
        monthlyTrends[monthKey].push(emp);
      }
    });

    let response = 'Company Joining Trends:\n\n';
    
    // Monthly summary
    response += 'Monthly Trends:\n';
    const sortedMonths = Object.keys(monthlyTrends).sort((a, b) => b.localeCompare(a));
    for (const month of sortedMonths.slice(0, 6)) { // Show last 6 months
      response += `${month}: ${monthlyTrends[month].length} new joiners\n`;
    }
    response += '\n';

    // Department summary
    for (const [dept, employees] of Object.entries(departmentTrends)) {
      response += `${dept} Department (${employees.length} employees):\n`;
      // Show only the last 5 joiners per department
      const recentJoiners = employees.slice(-5);
      response += recentJoiners.map(emp => 
        `- ${emp.Name} (Joined: ${emp.DateOfJoining})`
      ).join('\n');
      response += '\n\n';
    }

    const trendsData: JoiningTrendsData = {
      departmentTrends,
      monthlyTrends
    };

    return {
      text: response,
      data: trendsData,
      downloadOptions: { excel: true, pdf: true }
    };
  }

  // Helper methods for formatting responses
  private formatLeaveResponse(query: string, leaves: any[]): string {
    if (query.includes('how many days')) {
      const totalDays = leaves.reduce((acc, curr) => acc + curr.totalDays, 0);
      return `You were absent for ${totalDays} days in the specified period.`;
    } else {
      return leaves.map(leave => 
        `Month: ${leave.month}\nAbsent Dates: ${leave.absentDates}\nTotal Days: ${leave.totalDays}`
      ).join('\n\n');
    }
  }

  private formatWorkHoursResponse(query: string, hours: any[]): string {
    const total = hours.reduce((acc, curr) => acc + curr.hoursWorked, 0);
    if (query.includes('total')) {
      return `Total work hours: ${total} hours`;
    } else {
      return hours.map(h => 
        `Date: ${h.date}\nHours Worked: ${h.hoursWorked}\nCompletion: ${h.completion}`
      ).join('\n\n');
    }
  }

  private formatHRLeaveAnalysis(leaves: any[]): string {
    const totalEmployees = leaves.length;
    const totalDays = leaves.reduce((acc, curr) => acc + curr.totalDays, 0);
    const avgDays = totalDays / totalEmployees || 0;

    return `Analysis of ${totalEmployees} employees:\n` +
           `Total Leave Days: ${totalDays}\n` +
           `Average Days per Employee: ${avgDays.toFixed(2)}\n\n` +
           `Detailed Breakdown:\n` +
           leaves.map(l => 
             `${l.employeeName} (${l.department})\n` +
             `Dates: ${l.absentDates}\n` +
             `Total Days: ${l.totalDays}`
           ).join('\n\n');
  }

  private formatHRWorkHoursAnalysis(hours: any[]): string {
    const totalHours = hours.reduce((acc, curr) => acc + curr.hoursWorked, 0);
    const avgHours = totalHours / hours.length || 0;
    const overtimeCount = hours.filter(h => h.overtime > 0).length;

    return `Analysis of ${hours.length} employees:\n` +
           `Total Hours: ${totalHours}\n` +
           `Average Hours: ${avgHours.toFixed(2)}\n` +
           `Employees with Overtime: ${overtimeCount}\n\n` +
           `Detailed Breakdown:\n` +
           hours.map(h => 
             `${h.employeeName} (${h.department})\n` +
             `Hours Worked: ${h.hoursWorked}\n` +
             `Completion: ${h.completion}`
           ).join('\n\n');
  }

  // Helper method to get employee name
  private async getEmployeeName(accessCode: string): Promise<string> {
    const employeesRef = collection(this.db, 'employees');
    const q = firestoreQuery(employeesRef, where('accessCode', '==', accessCode));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const employeeData = snapshot.docs[0].data();
      return employeeData.Name || 'Unknown Employee';
    }
    return 'Unknown Employee';
  }

  // Helper method to get employee details
  private async getEmployeeDetails(accessCode: string): Promise<{ name: string; email: string }> {
    const employeesRef = collection(this.db, 'employees');
    const q = firestoreQuery(employeesRef, where('accessCode', '==', accessCode));
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

  async generateExcel(data: any[]): Promise<Blob> {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  async demonstrateQueryConversion(userQuery: string): Promise<string> {
    try {
      const intent = await this.analyzeQueryIntent(userQuery);
      
      let explanation = 'Query Analysis:\n\n';
      explanation += `Primary Intent: ${intent.primaryIntent}\n`;
      if (intent.subIntent) {
        explanation += `Sub Intent: ${intent.subIntent}\n`;
      }
      
      explanation += '\nExtracted Entities:\n';
      if (intent.entities.employeeName) {
        explanation += `- Employee: ${intent.entities.employeeName}\n`;
      }
      if (intent.entities.department) {
        explanation += `- Department: ${intent.entities.department}\n`;
      }
      if (intent.entities.timeFrame) {
        explanation += `- Time Frame: ${intent.entities.timeFrame}\n`;
      }
      if (intent.entities.dateRange) {
        try {
          const startDate = intent.entities.dateRange.start instanceof Date ? 
            format(new Date(intent.entities.dateRange.start), 'yyyy-MM-dd') : 
            'Invalid Date';
          const endDate = intent.entities.dateRange.end instanceof Date ? 
            format(new Date(intent.entities.dateRange.end), 'yyyy-MM-dd') : 
            'Invalid Date';
          explanation += `- Date Range: ${startDate} to ${endDate}\n`;
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Date formatting error');
          console.error('Error formatting dates:', error.message);
          explanation += `- Date Range: Could not format dates\n`;
        }
      }
      if (intent.entities.status) {
        explanation += `- Status Filter: ${intent.entities.status}\n`;
      }
      if (intent.entities.attributes && intent.entities.attributes.length > 0) {
        explanation += `- Requested Attributes: ${intent.entities.attributes.join(', ')}\n`;
      }
      
      explanation += '\nApplied Filters:\n';
      if (intent.filters.sortBy) {
        explanation += `- Sort by: ${intent.filters.sortBy}\n`;
      }
      if (intent.filters.limit) {
        explanation += `- Limit results to: ${intent.filters.limit}\n`;
      }
      if (intent.filters.includeInactive !== undefined) {
        explanation += `- Include inactive: ${intent.filters.includeInactive}\n`;
      }
      
      explanation += '\nEquivalent Firebase Query:\n';
      explanation += this.generateFirebaseQueryString(intent);
      
      return explanation;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Query conversion failed');
      console.error('Error in query conversion:', error.message);
      return `Error converting query: ${error.message}`;
    }
  }

  private generateFirebaseQueryString(intent: QueryIntent): string {
    try {
      let query = 'const q = query(collection(db, ';
      
      switch (intent.primaryIntent) {
        case 'employee_search':
          query += "'employees'";
          if (intent.entities.employeeName) {
            query += `,\n  where('Name', '>=', '${intent.entities.employeeName}'),\n  where('Name', '<=', '${intent.entities.employeeName}\\uf8ff')`;
          }
          break;
        case 'department_info':
          query += "'employees'";
          if (intent.entities.department) {
            query += `,\n  where('Department', '==', '${intent.entities.department}')`;
          }
          break;
        case 'attendance':
          query += "'absentees'";
          if (intent.entities.dateRange && 
              intent.entities.dateRange.start instanceof Date && 
              intent.entities.dateRange.end instanceof Date) {
            try {
              const startDate = format(new Date(intent.entities.dateRange.start), 'yyyy-MM-dd');
              const endDate = format(new Date(intent.entities.dateRange.end), 'yyyy-MM-dd');
              query += `,\n  where('date', '>=', '${startDate}'),\n  where('date', '<=', '${endDate}')`;
            } catch (err) {
              const error = err instanceof Error ? err : new Error('Date formatting error');
              console.error('Error formatting dates in query:', error.message);
            }
          }
          break;
        default:
          query += "'employees'";
      }
      
      if (intent.entities.status === 'active') {
        query += ",\n  where('Status', '==', 'Active')";
      }
      
      if (intent.filters.sortBy) {
        query += `,\n  orderBy('${intent.filters.sortBy}')`;
      }
      
      if (intent.filters.limit) {
        query += `,\n  limit(${intent.filters.limit})`;
      }
      
      query += '\n);';
      return query;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate Firebase query');
      console.error('Error in query conversion:', error.message);
      throw error;
    }
  }

  // Add debug method to demonstrate query understanding
  private demonstrateQueryUnderstanding(query: string, doc: any, intent: QueryIntent): void {
    console.log('Query Understanding Analysis:', {
      originalQuery: query,
      tokens: doc.terms().out('array'),
      tags: doc.terms().out('tags'),
      patterns: {
        hasWorkMetric: doc.has('#WorkMetric'),
        hasLeaveMetric: doc.has('#LeaveMetric'),
        hasTimeFrame: doc.has('#TimeFrame'),
        hasAttribute: doc.has('#Attribute'),
        hasDepartment: doc.has('#Department'),
        hasFirstName: doc.has('#FirstName')
      },
      extractedIntent: {
        primary: intent.primaryIntent,
        sub: intent.subIntent
      },
      extractedEntities: intent.entities,
      appliedFilters: intent.filters
    });
  }
} 