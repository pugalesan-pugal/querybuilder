const companies = [
  {
    id: 'ABC123',
    name: 'ABC Manufacturing Ltd',
    email: 'admin@abcmanufacturing.com',
    isActive: true,
    services: {
      npn_reports: {
        account_types: ['Current', 'Savings', 'Term Deposits'],
        working_capital: {
          limit: 5000000,
          utilized: 3500000,
          last_review_date: '2024-02-15'
        },
        loans: [
          {
            type: 'Term Loan',
            amount: 10000000,
            interest_rate: 8.5,
            tenure_months: 60
          },
          {
            type: 'Equipment Loan',
            amount: 2500000,
            interest_rate: 9.0,
            tenure_months: 36
          }
        ],
        payment_methods: ['RTGS', 'NEFT', 'Letter of Credit', 'Bank Guarantee'],
        trade_finance: {
          letter_of_credit: {
            limit: 2000000,
            utilized: 1500000
          },
          bank_guarantees: {
            limit: 1000000,
            utilized: 800000
          },
          import_export: {
            import_lc_limit: 3000000,
            export_credit_limit: 2000000
          }
        },
        credit_reports: {
          credit_score: 750,
          last_updated: '2024-03-01'
        },
        treasury_services: {
          forex_dealing: true,
          forward_contracts: true,
          derivatives: false
        }
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'XYZ456',
    name: 'XYZ Trading Co',
    email: 'admin@xyztrading.com',
    isActive: true,
    services: {
      npn_reports: {
        account_types: ['Current', 'Overdraft'],
        working_capital: {
          limit: 3000000,
          utilized: 2000000,
          last_review_date: '2024-01-20'
        },
        loans: [
          {
            type: 'Working Capital Loan',
            amount: 5000000,
            interest_rate: 9.5,
            tenure_months: 12
          }
        ],
        payment_methods: ['RTGS', 'NEFT', 'Bank Guarantee'],
        trade_finance: {
          letter_of_credit: {
            limit: 1500000,
            utilized: 1000000
          },
          bank_guarantees: {
            limit: 500000,
            utilized: 300000
          },
          import_export: {
            import_lc_limit: 2000000,
            export_credit_limit: 1500000
          }
        },
        credit_reports: {
          credit_score: 720,
          last_updated: '2024-02-15'
        },
        treasury_services: {
          forex_dealing: true,
          forward_contracts: false,
          derivatives: false
        }
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'PQR789',
    name: 'PQR Industries',
    email: 'admin@pqrindustries.com',
    isActive: true,
    services: {
      npn_reports: {
        account_types: ['Current', 'Savings', 'Term Deposits', 'Overdraft'],
        working_capital: {
          limit: 8000000,
          utilized: 6000000,
          last_review_date: '2024-03-01'
        },
        loans: [
          {
            type: 'Term Loan',
            amount: 15000000,
            interest_rate: 8.0,
            tenure_months: 84
          },
          {
            type: 'Project Finance',
            amount: 20000000,
            interest_rate: 8.75,
            tenure_months: 120
          }
        ],
        payment_methods: ['RTGS', 'NEFT', 'Letter of Credit', 'Bank Guarantee', 'SWIFT'],
        trade_finance: {
          letter_of_credit: {
            limit: 5000000,
            utilized: 3500000
          },
          bank_guarantees: {
            limit: 2000000,
            utilized: 1500000
          },
          import_export: {
            import_lc_limit: 6000000,
            export_credit_limit: 4000000
          }
        },
        credit_reports: {
          credit_score: 800,
          last_updated: '2024-03-10'
        },
        treasury_services: {
          forex_dealing: true,
          forward_contracts: true,
          derivatives: true
        }
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Initialize Firebase
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBVwkSdXiPx2GHWRqEhe1-ZNBboNIMbyGc",
  authDomain: "query-builder-bot.firebaseapp.com",
  projectId: "query-builder-bot",
  storageBucket: "query-builder-bot.appspot.com",
  messagingSenderId: "511571415270",
  appId: "1:511571415270:web:6e8e4f33791d04d1f1eb27"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initializeCompanies() {
  try {
    console.log('Starting companies initialization...');

    for (const company of companies) {
      console.log(`Creating company: ${company.name} (${company.id})`);
      await setDoc(doc(db, 'companies', company.id), company);
      console.log(`✅ Created company: ${company.name}`);
    }

    console.log('✅ Companies initialization completed successfully');
  } catch (error) {
    console.error('❌ Error initializing companies:', error);
    throw error;
  }
}

// Run the initialization
initializeCompanies()
  .then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  }); 