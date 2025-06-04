const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Replace with path to your Firebase Admin SDK JSON
const serviceAccount = require(path.join(__dirname, 'firebase-adminsdk.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const absenteesData = [
  {
    accessCode: "1T3V1J",
    month: "2025-05",
    absentDates: ["2025-05-05", "2025-05-16", "2025-05-29"]
  },
  {
    accessCode: "ZDU5Z5",
    month: "2025-04",
    absentDates: ["2025-04-04", "2025-04-08"]
  },
  {
    accessCode: "8B1AA3",
    month: "2025-05",
    absentDates: ["2025-05-10", "2025-05-11", "2025-05-23"]
  },
{
    accessCode: "MQBEXO",
    month: "2025-04",
    absentDates: ["2025-04-03", "2025-04-10", "2025-04-21"]
  },
  // May (05)
  {
    accessCode: "MQBEXO",
    month: "2025-05",
    absentDates: ["2025-05-01", "2025-05-15", "2025-05-28"]
  },
  // June (06)
  {
    accessCode: "MQBEXO",
    month: "2025-06",
    absentDates: ["2025-06-03", "2025-06-02"]
  }
];

async function uploadAbsentees() {
  for (const record of absenteesData) {
    const docId = `${record.accessCode}_${record.month}`;
    try {
      await db.collection("absentees").doc(docId).set(record);
      console.log(`✅ Uploaded: ${docId}`);
    } catch (err) {
      console.error(`❌ Failed to upload ${docId}:`, err);
    }
  }
}

uploadAbsentees();
