const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, collection } = require('firebase/firestore');

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

// Sample chat history data
const chatHistories = [
  {
    companyId: 'ABC123',
    userId: 'john@abcmanufacturing.com',
    userName: 'John Smith',
    timestamp: new Date('2024-03-15T10:00:00').toISOString(),
    messages: [
      {
        role: 'user',
        content: 'What is our current working capital limit?'
      },
      {
        role: 'assistant',
        content: 'Your working capital limit is 5,000,000 with current utilization of 3,500,000 as of February 15, 2024.'
      }
    ],
    metadata: {
      topic: 'Working Capital',
      department: 'Finance'
    }
  },
  {
    companyId: 'XYZ456',
    userId: 'sarah@xyztrading.com',
    userName: 'Sarah Johnson',
    timestamp: new Date('2024-03-15T11:00:00').toISOString(),
    messages: [
      {
        role: 'user',
        content: 'Show me our letter of credit limits'
      },
      {
        role: 'assistant',
        content: 'Your LC limit is 1,500,000 with current utilization of 1,000,000.'
      }
    ],
    metadata: {
      topic: 'Trade Finance',
      department: 'Treasury'
    }
  },
  {
    companyId: 'PQR789',
    userId: 'mike@pqrindustries.com',
    userName: 'Mike Wilson',
    timestamp: new Date('2024-03-15T12:00:00').toISOString(),
    messages: [
      {
        role: 'user',
        content: 'What are our current loan details?'
      },
      {
        role: 'assistant',
        content: 'You have two active loans: 1) Term Loan of 15,000,000 at 8.0% for 84 months 2) Project Finance of 20,000,000 at 8.75% for 120 months'
      }
    ],
    metadata: {
      topic: 'Loans',
      department: 'Finance'
    }
  }
];

async function initializeChatHistory() {
  try {
    console.log('Starting chat history initialization...');

    for (const chat of chatHistories) {
      // Generate a unique ID for each chat
      const chatId = `${chat.companyId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`Creating chat history for ${chat.userName} (${chat.companyId})`);
      await setDoc(doc(db, 'chatHistory', chatId), chat);
      console.log(`✅ Created chat history: ${chatId}`);
    }

    console.log('✅ Chat history initialization completed successfully');
  } catch (error) {
    console.error('❌ Error initializing chat history:', error);
    throw error;
  }
}

// Run the initialization
initializeChatHistory()
  .then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  }); 