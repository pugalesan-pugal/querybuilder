import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { initFirebase } from './initFirebase';
import type { Employee } from '../types/employee';

// Function to generate a random access code
function generateAccessCode(): string {
  // Generate a 6-character code with numbers and uppercase letters
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

export async function updateEmployeeAccessCodes() {
  try {
    console.log('Starting to update employee access codes...');
    const { db } = initFirebase();
    const employeesRef = collection(db, 'employees');
    const snapshot = await getDocs(employeesRef);
    
    const updates: { id: string; Email: string; Name: string; accessCode: string }[] = [];

    // Generate and update access codes
    for (const employeeDoc of snapshot.docs) {
      const employeeData = employeeDoc.data() as Employee;
      const accessCode = generateAccessCode();
      
      await updateDoc(doc(db, 'employees', employeeDoc.id), {
        accessCode: accessCode
      });

      updates.push({
        id: employeeDoc.id,
        Email: employeeData.Email,
        Name: employeeData.Name,
        accessCode: accessCode
      });
    }

    console.log('Successfully updated all employees with access codes');
    return updates;
  } catch (error) {
    console.error('Error updating employee access codes:', error);
    throw error;
  }
} 