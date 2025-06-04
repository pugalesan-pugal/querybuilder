import { db, auth } from '../login/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import type { Employee } from '../types/employee';

export async function initializeEmployee(employeeData: Omit<Employee, 'id'>) {
  try {
    // Create a secure password for Firebase Auth (combining email and access code)
    const securePassword = btoa(`${employeeData.email}:${employeeData.accessCode}`);

    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      employeeData.email,
      securePassword
    );

    // Add employee data to Firestore
    const employeeRef = doc(db, 'employees', userCredential.user.uid);
    await setDoc(employeeRef, {
      email: employeeData.email,
      role: employeeData.role,
      name: employeeData.name,
      department: employeeData.department,
      accessCode: employeeData.accessCode, // Store access code in Firestore
      isActive: true,
    });

    return userCredential.user.uid;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Employee already exists');
    }
    throw error;
  }
} 