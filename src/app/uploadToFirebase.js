const admin = require('firebase-admin');
const csv = require('csvtojson');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'firebase-adminsdk.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const csvFilePath = path.join(__dirname, 'employees_cleaned.csv');

async function uploadCSV() {
  try {
    const jsonArray = await csv().fromFile(csvFilePath);

    for (const record of jsonArray) {
      const employeeID = record.EmployeeID;
      delete record.EmployeeID;

      if (record['Experience (Years)']) {
        record.Experience = Number(record['Experience (Years)']);
        delete record['Experience (Years)'];
      }

      await db.collection('employees').doc(employeeID).set(record);
      console.log(`Uploaded EmployeeID: ${employeeID}`);
    }

    console.log('All data uploaded successfully!');
  } catch (error) {
    console.error('Error uploading data:', error);
  }
}

uploadCSV();
