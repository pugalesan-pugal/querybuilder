const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

async function resetUser() {
  const email = 'pugalesan@gmail.com';
  
  try {
    // Try to get the user by email
    const userRecord = await auth.getUserByEmail(email);
    console.log('Found user:', userRecord.uid);
    
    // Delete the user
    await auth.deleteUser(userRecord.uid);
    console.log('Deleted user:', userRecord.uid);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('User not found, nothing to delete');
    } else {
      console.error('Error:', error);
    }
  }
}

resetUser()
  .then(() => {
    console.log('Reset completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Reset failed:', error);
    process.exit(1);
  }); 