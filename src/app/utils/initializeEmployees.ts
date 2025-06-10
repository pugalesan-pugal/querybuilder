import { db, auth } from '../login/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import type { Employee } from '../types/employee';

// Optional utility to map employee data to Firestore format
function mapEmployeeToFirestore(employee: Omit<Employee, 'id'>) {
  return {
    Email: employee.Email,
    Name: employee.Name,
    Department: employee.Department,
    Designation: employee.Designation,
    Age: employee.Age,
    City: employee.City,
    'Contact Number': employee['Contact Number'],
    DateOfJoining: employee.DateOfJoining,
    Experience: employee.Experience,
    Gender: employee.Gender,
    Salary: employee.Salary,
    accessCode: employee.accessCode,
    role: employee.role,
    isActive: true,
  };
}

export async function initializeEmployee(employee: Omit<Employee, 'id'>) {
  try {
    // Create a secure password for Firebase Auth (email + accessCode)
    const securePassword = btoa(`${employee.Email}:${employee.accessCode}`);

    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      employee.Email,
      securePassword
    );

    // Add employee data to Firestore with the UID as the document ID
    const employeeRef = doc(db, 'employees', userCredential.user.uid);
    await setDoc(employeeRef, mapEmployeeToFirestore(employee));

    return userCredential.user.uid;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Employee already exists');
    }
    throw error;
  }
}
