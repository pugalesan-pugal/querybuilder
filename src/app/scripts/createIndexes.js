const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createIndexes() {
  try {
    console.log('Creating indexes...');

    // Create composite index for chatHistory collection
    const collectionGroup = db.collection('chatHistory');
    
    await db.collection('chatHistory').doc('_').set({
      companyId: 'dummy',
      timestamp: new Date(),
      userId: 'dummy@example.com'
    });

    // Create the index
    const index = {
      collectionGroup: 'chatHistory',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'companyId', order: 'ASCENDING' },
        { fieldPath: 'timestamp', order: 'DESCENDING' }
      ]
    };

    await admin.firestore().collection('chatHistory').doc('_').delete();

    console.log('✅ Index creation initiated');
    console.log('Please wait a few minutes for the index to be ready');
    console.log('You can check the status in the Firebase Console');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
}

// Run the index creation
createIndexes()
  .then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  }); 