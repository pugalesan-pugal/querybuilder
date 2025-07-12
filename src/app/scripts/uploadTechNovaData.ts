import { uploadCompanyData } from '../utils/uploadCompanyData';

const techNovaData = {
  Personal_Details: {
    Client_ID: "XYZ456",
    Company_Name: "TechNova Solutions Pvt Ltd",
    Legal_Name: "TechNova Solutions Private Limited",
    Brand_Name: "TechNova",
    Company_Type: "Pvt Ltd",
    Date_of_Incorporation: "2018-05-22",
    Country_of_Incorporation: "India",
    Country_of_Operation: ["India", "USA"],
    Industry_Sector: "Information Technology",
    Sub_sector: "Software Development",
    Currency_Preference: "INR",
    Language_Preferences: ["English", "Hindi"]
  },
  Registration_Tax_IDs: {
    Registration_Number: "U72900MH2018PTC305841",
    PAN_Number: "AABCT1234M",
    GST_Number: "27AABCT1234M1Z5",
    Tax_Identification_Number: "2711223344",
    Legal_Entity_Identifier: "335800ZK5X3O9Z5ZDV74",
    Aadhaar_Number: null,
    Passport_Number: null,
    Residency_Status: "Resident",
    Nationality: "Indian"
  },
  KYC_Compliance: {
    KYC_Status: "Completed",
    Date_of_KYC_Completion: "2021-07-14",
    Risk_Category: "Low",
    AML_CFT_Status: "Compliant",
    PEP_Flag: false,
    FATCA_Status: "Compliant",
    CRS_Declaration: "Submitted",
    Compliance_Notes: null
  },
  Contact_Communication: {
    Registered_Office_Address: "701, Tech Park, Andheri East, Mumbai, Maharashtra - 400059",
    Corporate_Head_Office_Address: "Same as Registered Address",
    Operating_Locations: ["Mumbai", "Bangalore", "San Francisco"],
    Primary_Email_Address: "contact@technova.in",
    Official_Phone_Number: "+91-22-4001-1234",
    Website_URL: "https://www.technova.in",
    Communication_Preference: "Email",
    Social_Media_Links: {
      LinkedIn: "https://www.linkedin.com/company/technova"
    }
  },
  Individual_Details: {
    Full_Name: "Rohan Sharma",
    Father_Name: "Vikram Sharma",
    Mother_Name: "Anita Sharma",
    Maternal_Status: "Married",
    Email_Address: "rohan.sharma@technova.in",
    Phone_Number: "+91-9876543210",
    User_ID: "USR_TNV001",
    Contact_Preference: "Email",
    Preferred_Language: "English",
    Primary_Point_of_Contact: "Yes"
  },
  Personal_KYC_ID: {
    PAN_Number: "BNFPS5678A",
    Aadhaar_Number: "2345-6789-0123",
    Passport_Number: "M1234567",
    Nationality: "Indian",
    Date_of_Birth: "1988-09-14",
    Residential_Address: "502, Lake View Apartments, Powai, Mumbai - 400076",
    KYC_Documents_Submitted: ["PAN", "Aadhaar", "Passport", "Utility Bill"],
    KYC_Status: "Completed"
  },
  System_Metadata: {
    Created_At: "2023-01-10T10:15:30Z",
    Updated_At: "2024-03-25T12:00:00Z",
    Created_By: "admin",
    Last_Updated_By: "system"
  },
  Authorized_Signatory: {
    Full_Name: "Rohan Sharma",
    Designation: "Director",
    Email_Address: "rohan.sharma@technova.in",
    Contact_Number: "+91-9876543210",
    Date_of_Birth: "1988-09-14",
    Gender: "Male",
    Nationality: "Indian",
    PAN_Number: "BNFPS5678A",
    Aadhaar_Number: "2345-6789-0123",
    Passport_Number: "M1234567",
    Residential_Address: "502, Lake View Apartments, Powai, Mumbai - 400076",
    Type_of_Signatory: "Primary",
    Signing_Authority_Limit: "Full Access",
    Authorized_Since: "2018-05-22",
    KYC_Status: "Completed",
    KYC_Documents_Provided: ["PAN", "Aadhaar", "Passport", "Utility Bill"],
    Signature_Specimen: "https://www.technova.in/signatures/rohan-sharma.png",
    Approval_Status: "Approved"
  },
  Bank_Accounts: [
    {
      Account_Number: "123456789012",
      Account_Type: "Current",
      IFSC_Code: "HDFC0001234",
      Branch_Name: "Andheri East Branch / 1234",
      Bank_Name: "HDFC Bank",
      Currency: "INR",
      Account_Opening_Date: "2020-06-15",
      Current_Balance: 1250000.50,
      Available_Balance: 1200000.00,
      Average_Monthly_Balance: 850000.00,
      Minimum_Balance_Requirement: 10000.00,
      Overdraft_Limit: 0.00,
      Lien_Amount: 50000.00,
      Auto_Sweep_Enabled: true,
      Interest_Rate: 0.00,
      Interest_Payout_Frequency: null,
      Nominee_Info: {
        Name: "Anjali Sharma",
        Relationship: "Spouse"
      },
      Account_Status: "Active",
      Last_Transaction_Date: "2025-07-06",
      Statement_Frequency: "Monthly",
      Associated_Products: ["Debit Card", "Trade Finance"],
      Account_Relationship_Manager: "Rajiv Menon",
      Statement_Delivery_Preference: "Email",
      Joint_Holder_Names: [],
      Parent_Grouping: "TechNova Operating Accounts"
    },
    {
      Account_Number: "987654321098",
      Account_Type: "Term Deposit",
      IFSC_Code: "ICIC0005678",
      Branch_Name: "Powai Branch / 5678",
      Bank_Name: "ICICI Bank",
      Currency: "INR",
      Account_Opening_Date: "2022-01-01",
      Current_Balance: 2000000.00,
      Available_Balance: 2000000.00,
      Average_Monthly_Balance: 2000000.00,
      Minimum_Balance_Requirement: 0.00,
      Overdraft_Limit: 0.00,
      Lien_Amount: 0.00,
      Auto_Sweep_Enabled: false,
      Interest_Rate: 6.5,
      Interest_Payout_Frequency: "Quarterly",
      Nominee_Info: null,
      Account_Status: "Active",
      Last_Transaction_Date: "2025-07-01",
      Statement_Frequency: "Quarterly",
      Associated_Products: ["Fixed Deposit Certificate"],
      Account_Relationship_Manager: "Priya Iyer",
      Statement_Delivery_Preference: "Netbanking Download",
      Joint_Holder_Names: ["Kunal Sharma"],
      Parent_Grouping: "TechNova Reserve Accounts"
    }
  ],
  Loans: [
    {
      Loan_ID: "LN-TNV-001",
      Loan_Type: "Term Loan",
      Sanctioned_Amount: 5000000.00,
      Disbursed_Amount: 5000000.00,
      Interest_Rate: 9.25,
      Tenure_Months: 60,
      Repayment_Frequency: "Monthly",
      EMI_Amount: 104378.00,
      Next_Due_Date: "2025-08-05",
      Last_EMI_Paid_Date: "2025-07-05",
      Outstanding_Principal: 3450000.00,
      Outstanding_Interest: 145000.00,
      Total_Outstanding_Amount: 3595000.00,
      Loan_Start_Date: "2020-08-05",
      Loan_End_Date: "2025-08-04",
      Loan_Status: "Active",
      Overdue_Amount: 0.00,
      Collateral_Type: "Property",
      Collateral_Value: 7000000.00,
      Collateral_Details: "701, Tech Park, Andheri East, Mumbai - 400059",
      Collateral_Verified: true,
      Security_Coverage_Ratio: 1.4,
      Purpose_of_Loan: "Office Expansion",
      Sanctioning_Authority: "Priya Nair (HDFC Bank)",
      Loan_Documents: [
        "https://docs.technova.in/loan_agreement_001.pdf",
        "https://docs.technova.in/collateral_verification_001.pdf"
      ],
      Associated_Account_Number: "123456789012",
      Moratorium_Period: 6,
      Prepayment_Allowed: true,
      Prepayment_Charges: 2.0
    },
    {
      Loan_ID: "LN-TNV-002",
      Loan_Type: "Working Capital",
      Sanctioned_Amount: 10000000.00,
      Disbursed_Amount: 8500000.00,
      Interest_Rate: 11.00,
      Tenure_Months: 36,
      Repayment_Frequency: "Quarterly",
      EMI_Amount: null,
      Next_Due_Date: "2025-09-15",
      Last_EMI_Paid_Date: "2025-06-15",
      Outstanding_Principal: 6400000.00,
      Outstanding_Interest: 210000.00,
      Total_Outstanding_Amount: 6610000.00,
      Loan_Start_Date: "2022-09-15",
      Loan_End_Date: "2025-09-14",
      Loan_Status: "Active",
      Overdue_Amount: 0.00,
      Collateral_Type: "Receivables",
      Collateral_Value: 12000000.00,
      Collateral_Details: "Invoices from Tier-1 clients - SAP, Oracle, TCS",
      Collateral_Verified: true,
      Security_Coverage_Ratio: 1.2,
      Purpose_of_Loan: "Working Capital for US expansion",
      Sanctioning_Authority: "Rajeev Mehta (Axis Bank)",
      Loan_Documents: [
        "https://docs.technova.in/loan_agreement_002.pdf"
      ],
      Associated_Account_Number: "987654321098",
      Moratorium_Period: 3,
      Prepayment_Allowed: true,
      Prepayment_Charges: 1.0
    }
  ],
  Working_Capital_Facility: {
    Facility_ID: "WCF-TNV-2023-001",
    Working_Capital_Type: "Both",
    Sanctioned_Limit: 15000000.00,
    Utilized_Limit: 10250000.00,
    Available_Limit: 4750000.00,
    Renewal_Date: "2025-12-01",
    Last_Review_Date: "2024-12-01",
    Next_Review_Due: "2025-11-15",
    Review_Notes: "Facility usage consistent with business cycle. Recommend renewal with 10% enhancement due to increased US operations.",
    WC_Facility_Status: "Active",
    Collateral_Type: "Receivables and Inventory",
    Collateral_Value: 22000000.00,
    Security_Margin: 25,
    Drawing_Power: 16500000.00,
    Associated_Account_Number: "123456789012",
    Utilization_Pattern: "Seasonal",
    Repayment_Terms: "Monthly interest",
    Interest_Rate: 10.50,
    Interest_Payment_Frequency: "Monthly",
    Moratorium_Period: 0,
    Banking_Relationship_Manager: "Anita Deshmukh (ICICI Corporate Banking)",
    WC_Notes: "Inventory should be updated quarterly to reassess drawing power. Usage above 85% triggers auto-review alert."
  },
  Trade_Finance: {
    Letters_of_Credit: [
      {
        LC_Number: "LC2024IN001",
        LC_Type: "Sight",
        Limit: 5000000,
        Utilized_Amount: 3000000,
        Available_Amount: 2000000,
        Currency: "USD",
        Issue_Date: "2024-01-15",
        Expiry_Date: "2025-01-15",
        Status: "Active",
        Beneficiary_Name: "GlobalTech Exports Inc.",
        Issuing_Bank: "ICICI Bank Ltd",
        Confirming_Bank: "Citibank NA",
        Shipment_Terms: "CIF",
        Country_of_Origin: "USA",
        Purpose: "Raw Material Purchase",
        Associated_Trade_Contract: "TRD-CON-987654",
        Documents_Required: [
          "Bill of Lading",
          "Commercial Invoice",
          "Packing List"
        ]
      }
    ],
    Bank_Guarantees: [
      {
        BG_Number: "BG2024-ADV123",
        Limit: 2000000,
        Utilized_Amount: 1500000,
        Available_Amount: 500000,
        Type: "Advance",
        Issue_Date: "2024-03-10",
        Expiry_Date: "2025-03-10",
        Currency: "INR",
        Beneficiary_Name: "State Infrastructure Corp",
        Status: "Active",
        Underlying_Contract: "INFRA-AGR-7766",
        Terms: "Non-revocable",
        Auto_Renewal: true
      }
    ],
    Trade_Limits: {
      Import_LC_Limit: 10000000,
      Export_Credit_Limit: 8000000,
      Documentary_Collection_Limit: 2000000,
      Invoice_Financing_Limit: 4000000
    },
    Documentary_Collections: [
      {
        Collection_Type: "Documents Against Acceptance",
        Collection_Date: "2024-06-01",
        Drawee_Name: "Blue Ocean Textiles",
        Amount: 750000,
        Currency: "USD",
        Maturity_Date: "2024-09-01",
        Bank_Handling_Collection: "HSBC",
        Status: "Pending",
        Remarks: "Awaiting acceptance from drawee"
      }
    ],
    Invoice_Financing: [
      {
        Invoice_Number: "INV-TNV-4521",
        Invoice_Date: "2024-05-20",
        Invoice_Amount: 1250000,
        Financed_Amount: 1000000,
        Buyer_Name: "Zenith Retail LLC",
        Due_Date: "2024-08-20",
        Status: "Active",
        Financing_Date: "2024-05-25",
        Repayment_Date: null,
        Interest_Rate: 9.75,
        Remarks: "Financing approved at 80% LTV"
      }
    ],
    Trade_Transaction_History: [
      {
        Transaction_ID: "TFX20240615001",
        Date: "2024-06-15",
        Type: "LC Issuance",
        Mode: "LC",
        Amount: 3000000,
        Currency: "USD",
        Counterparty: "GlobalTech Exports Inc.",
        Status: "Completed",
        Notes: "LC issued for June raw material import"
      },
      {
        Transaction_ID: "TFX20240620002",
        Date: "2024-06-20",
        Type: "Invoice Financing",
        Mode: "Invoice Financing",
        Amount: 1000000,
        Currency: "INR",
        Counterparty: "Zenith Retail LLC",
        Status: "Completed",
        Notes: "80% of invoice INV-TNV-4521 financed"
      }
    ]
  },
  Credit_Reports: {
    Credit_Score: 782,
    Reporting_Agency: "CIBIL",
    Last_Updated: "2025-06-30",
    Credit_Rating: "AA-",
    Defaults_Flag: false,
    Credit_Utilization_Ratio: 0.64,
    Number_of_Enquiries: 5,
    Sanctioned_vs_Utilized_Ratio: 0.72,
    Client_Risk_Score: 18
  },
  Regulatory_Audit_Trail: {
    Audit_Logs: [
      {
        Log_ID: "LOG001",
        Changed_By: "admin_user",
        Change_Description: "Updated KYC status from Pending to Completed",
        Timestamp: "2024-03-25T12:00:00Z"
      },
      {
        Log_ID: "LOG002",
        Changed_By: "compliance_officer_01",
        Change_Description: "Updated FATCA status to Compliant",
        Timestamp: "2024-07-01T09:42:10Z"
      }
    ],
    Data_Consent_Log: {
      Consent_Provided: true,
      Consent_Timestamp: "2023-01-10T10:15:30Z",
      Method: "Digital Signature",
      Document_Reference: "https://secure.example.com/consents/CLT001"
    },
    AML_Flags: {
      Status: "Clear",
      Last_Checked: "2025-06-20",
      Triggered_Rules: [],
      Review_Required: false
    },
    FATCA_Status: "Compliant",
    CRS_Declaration: "Submitted",
    Compliance_Notes: "All checks passed as of last review cycle.",
    Suspicious_Transaction_Flags: [
      {
        Transaction_ID: "TXN109283",
        Flag_Reason: "Unusual cross-border fund flow",
        Review_Status: "Under Review",
        Flagged_On: "2025-06-18T11:32:00Z"
      }
    ],
    Watchlist_Hits: {
      OFAC: false,
      FATF: false,
      UN: false,
      Other_Watchlists: []
    }
  },
  Communication_Relationship: {
    Last_Meeting_Date: "2025-06-20",
    Meeting_Summary_Notes: "Discussed expansion plans in US market; client requested tailored FX services and improved SLA response times.",
    Service_Rating: 8,
    Custom_Pricing_Contracts: [
      {
        Contract_ID: "CPC001",
        Contract_Name: "FX Volume Tiered Pricing - 2025",
        Effective_From: "2025-01-01",
        Expires_On: "2025-12-31",
        Document_Link: "https://contracts.example.com/fx-tiered-2025.pdf",
        Negotiated_By: "rm_senior_01"
      }
    ],
    Support_Tickets: [
      {
        Ticket_ID: "SUP-93821",
        Raised_On: "2025-07-01T10:12:00Z",
        Issue: "Delay in fund transfer acknowledgment",
        Status: "Resolved",
        Resolved_On: "2025-07-02T14:45:00Z",
        Response_Time_Minutes: 1530,
        Priority: "Medium"
      },
      {
        Ticket_ID: "SUP-93885",
        Raised_On: "2025-07-06T08:15:00Z",
        Issue: "Request for statement format change",
        Status: "Open",
        Resolved_On: null,
        Response_Time_Minutes: null,
        Priority: "Low"
      }
    ],
    Communication_Preferences: {
      Preferred_Channels: ["Email", "Phone"],
      Language_Preference: ["English"],
      Contact_Time_Window: "09:00 - 18:00 IST",
      Relationship_Manager: "Anjali Mehta"
    },
    Surveys_Feedback: [
      {
        Survey_ID: "SRV202506",
        Submitted_On: "2025-06-25",
        Rating: 9,
        Feedback_Comments: "Very satisfied with trade finance team's responsiveness."
      },
      {
        Survey_ID: "SRV202504",
        Submitted_On: "2025-04-15",
        Rating: 7,
        Feedback_Comments: "Some delays in Escrow activation timelines."
      }
    ]
  },
  Digital_Access_Security: {
    Portal_Access_Enabled: true,
    Users_With_Access: [
      {
        User_ID: "USR_TNV001",
        Name: "Rohan Sharma",
        Email: "rohan.sharma@technova.in",
        Role: "Admin",
        Designation: "Director of Finance",
        TwoFA_Enabled: true,
        Last_Login_Time: "2025-07-08T08:42:31Z",
        Status: "Active"
      },
      {
        User_ID: "USR_TNV002",
        Name: "Neha Kapoor",
        Email: "neha.kapoor@technova.in",
        Role: "Viewer",
        Designation: "Accounts Executive",
        TwoFA_Enabled: false,
        Last_Login_Time: "2025-07-06T17:22:08Z",
        Status: "Active"
      }
    ],
    TwoFA_Enabled: true,
    Login_History: [
      {
        User_ID: "USR_TNV001",
        Timestamp: "2025-07-08T08:42:31Z",
        IP_Address: "203.112.45.67",
        Location: "Mumbai, India",
        Status: "Success"
      },
      {
        User_ID: "USR_TNV002",
        Timestamp: "2025-07-06T17:22:08Z",
        IP_Address: "198.51.100.21",
        Location: "Bangalore, India",
        Status: "Success"
      },
      {
        User_ID: "USR_TNV002",
        Timestamp: "2025-07-03T12:45:10Z",
        IP_Address: "198.51.100.21",
        Location: "Bangalore, India",
        Status: "Failed – Invalid OTP"
      }
    ],
    IP_Whitelisting: [
      "203.112.45.0/24",
      "198.51.100.21"
    ],
    Last_Login_Time: "2025-07-08T08:42:31Z"
  }
};

const uploadData = async () => {
  try {
    const result = await uploadCompanyData(techNovaData);
    if (result) {
      console.log('TechNova data uploaded successfully');
    } else {
      console.error('Failed to upload TechNova data');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

uploadData(); 