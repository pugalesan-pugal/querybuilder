import { initializeEmployee } from './initializeEmployees';
import type { Employee } from '../types/employee';

const initialEmployees: Omit<Employee, 'id'>[] = [
  {
    Email: 'admin@company.com',
    accessCode: 'admin123', // Change this in production
    role: 'Admin',
    Name: 'Admin User',
    Department: 'Administration',
    Designation: 'Admin',
    Age: '35',
    City: 'New York',
    'Contact Number': '1234567890',
    DateOfJoining: '2024-01-01',
    Experience: 10,
    Gender: 'Other',
    Salary: '100000',
    isActive: true,
  },
  {
    Email: 'employee@company.com',
    accessCode: 'emp123', // Change this in production
    role: 'Employee',
    Name: 'Test Employee',
    Department: 'General',
    Designation: 'Employee',
    Age: '28',
    City: 'San Francisco',
    'Contact Number': '9876543210',
    DateOfJoining: '2024-01-15',
    Experience: 5,
    Gender: 'Other',
    Salary: '75000',
    isActive: true,
  },
];

export async function setupInitialData() {
  try {
    console.log('Starting initial data setup...');
    
    for (const employee of initialEmployees) {
      try {
        await initializeEmployee(employee);
        console.log(`Successfully created employee: ${employee.Email}`);
      } catch (error: any) {
        if (error.message === 'Employee already exists') {
          console.log(`Employee already exists: ${employee.Email}`);
        } else {
          console.error(`Error creating employee ${employee.Email}:`, error);
        }
      }
    }
    
    console.log('Initial data setup completed');
  } catch (error) {
    console.error('Error in initial data setup:', error);
    throw error;
  }
} 