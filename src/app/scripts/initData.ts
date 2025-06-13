import { initializeCompanyData } from '../utils/initCompanyData';
import { initializeBankCustomerData } from '../utils/initBankCustomerData';

const initData = async () => {
  console.log('Starting data initialization...');
  
  try {
    // Initialize company data
    const companySuccess = await initializeCompanyData();
    if (companySuccess) {
      console.log('Company data initialization completed successfully');
    } else {
      console.error('Company data initialization failed');
      return;
    }

    // Initialize bank customer data
    const customerSuccess = await initializeBankCustomerData();
    if (customerSuccess) {
      console.log('Bank customer data initialization completed successfully');
    } else {
      console.error('Bank customer data initialization failed');
    }
  } catch (error) {
    console.error('Error during data initialization:', error);
  }
};

// Run the initialization
initData(); 