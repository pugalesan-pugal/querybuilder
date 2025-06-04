import { initializeEmployee } from './initializeEmployees';
import type { Employee } from '../types/employee';

const initialEmployees: Omit<Employee, 'id'>[] = [
  {
    email: 'admin@company.com',
    accessCode: 'admin123', // Change this in production
    role: 'Admin',
    name: 'Admin User',
    department: 'Administration',
    isActive: true,
  },
  {
    email: 'employee@company.com',
    accessCode: 'emp123', // Change this in production
    role: 'Employee',
    name: 'Test Employee',
    department: 'General',
    isActive: true,
  },
];

export async function setupInitialData() {
  try {
    console.log('Starting initial data setup...');
    
    for (const employee of initialEmployees) {
      try {
        await initializeEmployee(employee);
        console.log(`Successfully created employee: ${employee.email}`);
      } catch (error: any) {
        if (error.message === 'Employee already exists') {
          console.log(`Employee already exists: ${employee.email}`);
        } else {
          console.error(`Error creating employee ${employee.email}:`, error);
        }
      }
    }
    
    console.log('Initial data setup completed');
  } catch (error) {
    console.error('Error in initial data setup:', error);
    throw error;
  }
} 