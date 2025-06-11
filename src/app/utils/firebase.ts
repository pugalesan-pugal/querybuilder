import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { firebaseConfig } from '../login/firebase-config';

// Initialize Firebase with the correct config
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Types for our collections
export interface Absentee {
  empId: string;
  name: string;
  department: string;
  absentDates: string[];
  totalAbsentDays: number;
}

export interface NewJoiner {
  empId: string;
  name: string;
  department: string;
  joinedOn: string;
  designation: string;
}

export interface WorkLog {
  empId: string;
  name: string;
  department: string;
  totalHoursWorked: number;
  requiredHours: number;
  logs: {
    date: string;
    hoursWorked: number;
  }[];
}

// Helper functions to fetch data
export async function getAbsentees(startDate: string, endDate: string): Promise<Absentee[]> {
  const absenteesRef = collection(db, 'absentees');
  const q = query(
    absenteesRef,
    where('absentDates', 'array-contains-any', [startDate, endDate])
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), empId: doc.id } as Absentee));
}

export async function getNewJoiners(startDate: string, endDate: string): Promise<NewJoiner[]> {
  const newJoinersRef = collection(db, 'new_joiners');
  const q = query(
    newJoinersRef,
    where('joinedOn', '>=', startDate),
    where('joinedOn', '<=', endDate)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), empId: doc.id } as NewJoiner));
}

export async function getWorkLogs(empId: string, startDate: string, endDate: string): Promise<WorkLog | null> {
  const workLogsRef = collection(db, 'work_logs');
  const q = query(workLogsRef, where('empId', '==', empId));
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const workLog = snapshot.docs[0].data() as WorkLog;
  
  // Filter logs within date range
  workLog.logs = workLog.logs.filter(log => 
    log.date >= startDate && log.date <= endDate
  );
  
  return workLog;
}

// Helper function to format dates
export function getDateRange(months: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

export { db }; 