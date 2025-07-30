'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { initFirebase, app, db, auth } from '../utils/initFirebase';

import { updateEmployeeAccessCodes } from '../utils/updateEmployeeAccessCodes';
import { setupInitialEmployees } from '../utils/setupInitialEmployees';
import styles from './page.module.css';

interface EmployeeUpdate {
  id: string;
  Email: string;
  Name: string;
  accessCode: string;
}

interface Employee {
  id: string;
  Email: string;
  Name: string;
  Department: string;
  Designation: string;
  accessCode?: string;
}

export default function Setup() {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [updates, setUpdates] = useState<EmployeeUpdate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Load existing employees
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const { db } = initFirebase();
        const employeesRef = collection(db, 'employees');
        const snapshot = await getDocs(employeesRef);
        const employeesList: Employee[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          employeesList.push({
            id: doc.id,
            Email: data.Email,
            Name: data.Name,
            Department: data.Department,
            Designation: data.Designation,
            accessCode: data.accessCode
          });
        });
        
        setEmployees(employeesList);
      } catch (error) {
        console.error('Error loading employees:', error);
        setError('Failed to load employees. Check console for details.');
      }
    };

    loadEmployees();
  }, []);

  const handleInitializeEmployees = async () => {
    setIsInitializing(true);
    setError(null);
    setStatus('Initializing employees...');

    try {
      await setupInitialEmployees();
      setStatus('Successfully initialized employees!');
      
      // Reload the employee list
      const { db } = initFirebase();
      const employeesRef = collection(db, 'employees');
      const snapshot = await getDocs(employeesRef);
      const employeesList: Employee[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        employeesList.push({
          id: doc.id,
          Email: data.Email,
          Name: data.Name,
          Department: data.Department,
          Designation: data.Designation,
          accessCode: data.accessCode
        });
      });
      
      setEmployees(employeesList);
    } catch (error) {
      console.error('Initialization error:', error);
      setError('Failed to initialize employees. Check console for details.');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSetup = async () => {
    setIsLoading(true);
    setError(null);
    setStatus('Starting to add access codes...');
    setUpdates([]);

    try {
      const employeeUpdates = await updateEmployeeAccessCodes();
      setUpdates(employeeUpdates);
      setStatus('Successfully added access codes to all employees!');
    } catch (error) {
      console.error('Setup error:', error);
      setError('Failed to add access codes. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.setupBox}>
        <h1 className={styles.title}>Employee Access Setup</h1>
        
        {/* Existing Employees Section */}
        <div className={styles.section}>
          <h2>Existing Employees</h2>
          {employees.length > 0 ? (
            <div className={styles.employeeList}>
              {employees.map((employee) => (
                <div key={employee.id} className={styles.employeeItem}>
                  <h3>{employee.Name}</h3>
                  <p><strong>Email:</strong> {employee.Email}</p>
                  <p><strong>Department:</strong> {employee.Department}</p>
                  <p><strong>Role:</strong> {employee.Designation}</p>
                  {employee.accessCode && (
                    <p><strong>Access Code:</strong> {employee.accessCode}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noData}>
              <p>No employees found in the database.</p>
              <button 
                className={`${styles.button} ${styles.initButton}`}
                onClick={handleInitializeEmployees}
                disabled={isInitializing}
              >
                {isInitializing ? 'Initializing...' : 'Initialize Test Employees'}
              </button>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h2>Generate Access Codes</h2>
          <p className={styles.description}>
            Click below to generate new access codes for all employees.
            Make sure to save these codes as they will be needed for login.
          </p>

          {status && <p className={styles.status}>{status}</p>}
          {error && <p className={styles.error}>{error}</p>}
          
          <button 
            className={styles.button}
            onClick={handleSetup}
            disabled={isLoading || employees.length === 0}
          >
            {isLoading ? 'Generating Access Codes...' : 'Generate Access Codes'}
          </button>

          {updates.length > 0 && (
            <div className={styles.results}>
              <h2>New Access Codes:</h2>
              <div className={styles.codeList}>
                {updates.map((update) => (
                  <div key={update.id} className={styles.codeItem}>
                    <h3 className={styles.name}>{update.Name}</h3>
                    <p className={styles.email}>{update.Email}</p>
                    <p className={styles.code}>Access Code: {update.accessCode}</p>
                  </div>
                ))}
              </div>
              <p className={styles.warning}>
                ⚠️ Make sure to save these codes! They will be needed for employees to log in.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 