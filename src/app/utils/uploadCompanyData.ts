import { db } from './initFirebase';
import { doc, setDoc } from 'firebase/firestore';

interface CompanyDocument {
  Personal_Details: {
    Client_ID: string;
    Company_Name: string;
    Legal_Name: string;
    Brand_Name: string;
    Company_Type: string;
    Date_of_Incorporation: string;
    Country_of_Incorporation: string;
    Country_of_Operation: string[];
    Industry_Sector: string;
    Sub_sector: string;
    Currency_Preference: string;
    Language_Preferences: string[];
  };
  Registration_Tax_IDs: {
    Registration_Number: string;
    PAN_Number: string;
    GST_Number: string;
    Tax_Identification_Number: string;
    Legal_Entity_Identifier: string;
    Aadhaar_Number: string | null;
    Passport_Number: string | null;
    Residency_Status: string;
    Nationality: string;
  };
  KYC_Compliance: {
    KYC_Status: string;
    Date_of_KYC_Completion: string;
    Risk_Category: string;
    AML_CFT_Status: string;
    PEP_Flag: boolean;
    FATCA_Status: string;
    CRS_Declaration: string;
    Compliance_Notes: string | null;
  };
  Contact_Communication: {
    Registered_Office_Address: string;
    Corporate_Head_Office_Address: string;
    Operating_Locations: string[];
    Primary_Email_Address: string;
    Official_Phone_Number: string;
    Website_URL: string;
    Communication_Preference: string;
    Social_Media_Links: {
      LinkedIn?: string;
    };
  };
  Individual_Details: {
    Full_Name: string;
    Father_Name: string;
    Mother_Name: string;
    Maternal_Status: string;
    Email_Address: string;
    Phone_Number: string;
    User_ID: string;
    Contact_Preference: string;
    Preferred_Language: string;
    Primary_Point_of_Contact: string;
  };
  Personal_KYC_ID: {
    PAN_Number: string;
    Aadhaar_Number: string;
    Passport_Number: string;
    Nationality: string;
    Date_of_Birth: string;
    Residential_Address: string;
    KYC_Documents_Submitted: string[];
    KYC_Status: string;
  };
  System_Metadata: {
    Created_At: string;
    Updated_At: string;
    Created_By: string;
    Last_Updated_By: string;
  };
  Authorized_Signatory: {
    Full_Name: string;
    Designation: string;
    Email_Address: string;
    Contact_Number: string;
    Date_of_Birth: string;
    Gender: string;
    Nationality: string;
    PAN_Number: string;
    Aadhaar_Number: string;
    Passport_Number: string;
    Residential_Address: string;
    Type_of_Signatory: string;
    Signing_Authority_Limit: string;
    Authorized_Since: string;
    KYC_Status: string;
    KYC_Documents_Provided: string[];
    Signature_Specimen: string;
    Approval_Status: string;
  };
  Bank_Accounts: Array<{
    Account_Number: string;
    Account_Type: string;
    IFSC_Code: string;
    Branch_Name: string;
    Bank_Name: string;
    Currency: string;
    Account_Opening_Date: string;
    Current_Balance: number;
    Available_Balance: number;
    Average_Monthly_Balance: number;
    Minimum_Balance_Requirement: number;
    Overdraft_Limit: number;
    Lien_Amount: number;
    Auto_Sweep_Enabled: boolean;
    Interest_Rate: number;
    Interest_Payout_Frequency: string | null;
    Nominee_Info: {
      Name: string;
      Relationship: string;
    } | null;
    Account_Status: string;
    Last_Transaction_Date: string;
    Statement_Frequency: string;
    Associated_Products: string[];
    Account_Relationship_Manager: string;
    Statement_Delivery_Preference: string;
    Joint_Holder_Names: string[];
    Parent_Grouping: string;
  }>;
  Loans: Array<{
    Loan_ID: string;
    Loan_Type: string;
    Sanctioned_Amount: number;
    Disbursed_Amount: number;
    Interest_Rate: number;
    Tenure_Months: number;
    Repayment_Frequency: string;
    EMI_Amount: number | null;
    Next_Due_Date: string;
    Last_EMI_Paid_Date: string;
    Outstanding_Principal: number;
    Outstanding_Interest: number;
    Total_Outstanding_Amount: number;
    Loan_Start_Date: string;
    Loan_End_Date: string;
    Loan_Status: string;
    Overdue_Amount: number;
    Collateral_Type: string;
    Collateral_Value: number;
    Collateral_Details: string;
    Collateral_Verified: boolean;
    Security_Coverage_Ratio: number;
    Purpose_of_Loan: string;
    Sanctioning_Authority: string;
    Loan_Documents: string[];
    Associated_Account_Number: string;
    Moratorium_Period: number;
    Prepayment_Allowed: boolean;
    Prepayment_Charges: number;
  }>;
  Working_Capital_Facility: {
    Facility_ID: string;
    Working_Capital_Type: string;
    Sanctioned_Limit: number;
    Utilized_Limit: number;
    Available_Limit: number;
    Renewal_Date: string;
    Last_Review_Date: string;
    Next_Review_Due: string;
    Review_Notes: string;
    WC_Facility_Status: string;
    Collateral_Type: string;
    Collateral_Value: number;
    Security_Margin: number;
    Drawing_Power: number;
    Associated_Account_Number: string;
    Utilization_Pattern: string;
    Repayment_Terms: string;
    Interest_Rate: number;
    Interest_Payment_Frequency: string;
    Moratorium_Period: number;
    Banking_Relationship_Manager: string;
    WC_Notes: string;
  };
  Trade_Finance: {
    Letters_of_Credit: Array<{
      LC_Number: string;
      LC_Type: string;
      Limit: number;
      Utilized_Amount: number;
      Available_Amount: number;
      Currency: string;
      Issue_Date: string;
      Expiry_Date: string;
      Status: string;
      Beneficiary_Name: string;
      Issuing_Bank: string;
      Confirming_Bank: string;
      Shipment_Terms: string;
      Country_of_Origin: string;
      Purpose: string;
      Associated_Trade_Contract: string;
      Documents_Required: string[];
    }>;
    Bank_Guarantees: Array<{
      BG_Number: string;
      Limit: number;
      Utilized_Amount: number;
      Available_Amount: number;
      Type: string;
      Issue_Date: string;
      Expiry_Date: string;
      Currency: string;
      Beneficiary_Name: string;
      Status: string;
      Underlying_Contract: string;
      Terms: string;
      Auto_Renewal: boolean;
    }>;
    Trade_Limits: {
      Import_LC_Limit: number;
      Export_Credit_Limit: number;
      Documentary_Collection_Limit: number;
      Invoice_Financing_Limit: number;
    };
    Documentary_Collections: Array<{
      Collection_Type: string;
      Collection_Date: string;
      Drawee_Name: string;
      Amount: number;
      Currency: string;
      Maturity_Date: string;
      Bank_Handling_Collection: string;
      Status: string;
      Remarks: string;
    }>;
    Invoice_Financing: Array<{
      Invoice_Number: string;
      Invoice_Date: string;
      Invoice_Amount: number;
      Financed_Amount: number;
      Buyer_Name: string;
      Due_Date: string;
      Status: string;
      Financing_Date: string;
      Repayment_Date: string | null;
      Interest_Rate: number;
      Remarks: string;
    }>;
    Trade_Transaction_History: Array<{
      Transaction_ID: string;
      Date: string;
      Type: string;
      Mode: string;
      Amount: number;
      Currency: string;
      Counterparty: string;
      Status: string;
      Notes: string;
    }>;
  };
  Credit_Reports: {
    Credit_Score: number;
    Reporting_Agency: string;
    Last_Updated: string;
    Credit_Rating: string;
    Defaults_Flag: boolean;
    Credit_Utilization_Ratio: number;
    Number_of_Enquiries: number;
    Sanctioned_vs_Utilized_Ratio: number;
    Client_Risk_Score: number;
  };
  Regulatory_Audit_Trail: {
    Audit_Logs: Array<{
      Log_ID: string;
      Changed_By: string;
      Change_Description: string;
      Timestamp: string;
    }>;
    Data_Consent_Log: {
      Consent_Provided: boolean;
      Consent_Timestamp: string;
      Method: string;
      Document_Reference: string;
    };
    AML_Flags: {
      Status: string;
      Last_Checked: string;
      Triggered_Rules: string[];
      Review_Required: boolean;
    };
    FATCA_Status: string;
    CRS_Declaration: string;
    Compliance_Notes: string;
    Suspicious_Transaction_Flags: Array<{
      Transaction_ID: string;
      Flag_Reason: string;
      Review_Status: string;
      Flagged_On: string;
    }>;
    Watchlist_Hits: {
      OFAC: boolean;
      FATF: boolean;
      UN: boolean;
      Other_Watchlists: string[];
    };
  };
  Communication_Relationship: {
    Last_Meeting_Date: string;
    Meeting_Summary_Notes: string;
    Service_Rating: number;
    Custom_Pricing_Contracts: Array<{
      Contract_ID: string;
      Contract_Name: string;
      Effective_From: string;
      Expires_On: string;
      Document_Link: string;
      Negotiated_By: string;
    }>;
    Support_Tickets: Array<{
      Ticket_ID: string;
      Raised_On: string;
      Issue: string;
      Status: string;
      Resolved_On: string | null;
      Response_Time_Minutes: number | null;
      Priority: string;
    }>;
    Communication_Preferences: {
      Preferred_Channels: string[];
      Language_Preference: string[];
      Contact_Time_Window: string;
      Relationship_Manager: string;
    };
    Surveys_Feedback: Array<{
      Survey_ID: string;
      Submitted_On: string;
      Rating: number;
      Feedback_Comments: string;
    }>;
  };
  Digital_Access_Security: {
    Portal_Access_Enabled: boolean;
    Users_With_Access: Array<{
      User_ID: string;
      Name: string;
      Email: string;
      Role: string;
      Designation: string;
      TwoFA_Enabled: boolean;
      Last_Login_Time: string;
      Status: string;
    }>;
    TwoFA_Enabled: boolean;
    Login_History: Array<{
      User_ID: string;
      Timestamp: string;
      IP_Address: string;
      Location: string;
      Status: string;
    }>;
    IP_Whitelisting: string[];
    Last_Login_Time: string;
  };
}

export const uploadCompanyData = async (companyData: CompanyDocument) => {
  try {
    const companyId = companyData.Personal_Details.Client_ID;
    const companyRef = doc(db, 'companies', companyId);
    
    await setDoc(companyRef, companyData, { merge: true });
    console.log('Company data uploaded successfully');
    return true;
  } catch (error) {
    console.error('Error uploading company data:', error);
    return false;
  }
}; 