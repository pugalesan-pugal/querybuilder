import { collection, addDoc } from 'firebase/firestore';
import { initFirebase } from './initFirebase';

interface Employee {
  Name: string;
  Email: string;
  Department: string;
  Designation: string;
  Age: string;
  City: string;
  "Contact Number": string;
  DateOfJoining: string;
  Experience: number;
  Gender: string;
  Salary: string;
}

const initialEmployees: Employee[] = [
  {
    Name: "Admin User",
    Email: "admin@company.com",
    Department: "Administration",
    Designation: "Admin",
    Age: "30",
    City: "New York",
    "Contact Number": "1234567890",
    DateOfJoining: "2024-01-01",
    Experience: 5,
    Gender: "Other",
    Salary: "80000"
  },
  {
    Name: "John Manager",
    Email: "manager@company.com",
    Department: "Sales",
    Designation: "Manager",
    Age: "35",
    City: "Los Angeles",
    "Contact Number": "9876543210",
    DateOfJoining: "2024-01-15",
    Experience: 8,
    Gender: "Male",
    Salary: "75000"
  },
  {
    Name: "Jane Employee",
    Email: "employee@company.com",
    Department: "Engineering",
    Designation: "Software Engineer",
    Age: "28",
    City: "San Francisco",
    "Contact Number": "5555555555",
    DateOfJoining: "2024-02-01",
    Experience: 3,
    Gender: "Female",
    Salary: "65000"
  }
];

export const setupInitialEmployees = async () => {
  console.log('Initializing Firebase...');
  const { db } = initFirebase();
  console.log('Firebase initialized successfully');

  const employeesRef = collection(db, 'employees');
  const results = [];

  for (const employee of initialEmployees) {
    try {
      console.log('Adding employee:', employee.Name);
      const docRef = await addDoc(employeesRef, employee);
      console.log('Added employee:', employee.Name, 'with ID:', docRef.id);
      results.push({ id: docRef.id, ...employee });
    } catch (error) {
      console.error('Error adding employee:', employee.Name, error);
      throw error; // Re-throw the error to be caught by the caller
    }
  }

  return results;
}; 