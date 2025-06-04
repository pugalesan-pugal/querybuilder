const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, 'firebase-adminsdk.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const workHoursData = [
  {
    accessCode: "1T3V1J",
    month: "2025-05",
    hoursWorked: 132,
    totalHours: 160,
  },
  {
    accessCode: "ZDU5Z5",
    month: "2025-05",
    hoursWorked: 145,
    totalHours: 160,
  },
  {
    accessCode: "MQBEXO",
    month: "2025-05",
    hoursWorked: 120,
    totalHours: 160,
  }
];

async function uploadWorkHours() {
  for (const record of workHoursData) {
    const docId = `${record.accessCode}_${record.month}`;
    try {
      await db.collection("workhours").doc(docId).set(record);
      console.log(`✅ Uploaded: ${docId}`);
    } catch (err) {
      console.error(`❌ Failed to upload ${docId}:`, err);
    }
  }
}

uploadWorkHours();
