"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = exports.db = exports.app = void 0;
exports.checkFirebaseConnection = checkFirebaseConnection;
exports.reinitializeFirebase = reinitializeFirebase;
const app_1 = require("firebase/app");
const firestore_1 = require("firebase/firestore");
const auth_1 = require("firebase/auth");
let firebaseApp = null;
let firestoreDb = null;
let firebaseAuth = null;
const firebaseConfig = {
    apiKey: "AIzaSyBVwkSdXiPx2GHWRqEhe1-ZNBboNIMbyGc",
    authDomain: "query-builder-bot.firebaseapp.com",
    projectId: "query-builder-bot",
    storageBucket: "query-builder-bot.appspot.com",
    messagingSenderId: "511571415270",
    appId: "1:511571415270:web:6e8e4f33791d04d1f1eb27"
};
function initializeFirebase() {
    try {
        // Check if Firebase is already initialized
        if (!(0, app_1.getApps)().length) {
            console.log('Initializing new Firebase app');
            firebaseApp = (0, app_1.initializeApp)(firebaseConfig);
        }
        else {
            console.log('Using existing Firebase app');
            firebaseApp = (0, app_1.getApps)()[0];
        }
        // Initialize Firestore
        if (!firestoreDb && firebaseApp) {
            console.log('Initializing Firestore');
            firestoreDb = (0, firestore_1.getFirestore)(firebaseApp);
        }
        // Initialize Auth
        if (!firebaseAuth && firebaseApp) {
            console.log('Initializing Firebase Auth');
            firebaseAuth = (0, auth_1.getAuth)(firebaseApp);
        }
        if (!firebaseApp || !firestoreDb || !firebaseAuth) {
            throw new Error('Failed to initialize one or more Firebase services');
        }
        console.log('Firebase services initialized successfully');
        return { app: firebaseApp, db: firestoreDb, auth: firebaseAuth };
    }
    catch (error) {
        console.error('Error initializing Firebase:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to initialize Firebase services: ${errorMessage}`);
    }
}
// Initialize Firebase immediately
console.log('Starting Firebase initialization');
let app = null;
exports.app = app;
let db = null;
exports.db = db;
let auth = null;
exports.auth = auth;
try {
    const services = initializeFirebase();
    exports.app = app = services.app;
    exports.db = db = services.db;
    exports.auth = auth = services.auth;
    console.log('Firebase initialization completed');
}
catch (error) {
    console.error('Critical error during Firebase initialization:', error);
}
// Export a function to check Firebase connection
async function checkFirebaseConnection() {
    try {
        if (!firestoreDb) {
            console.error('Firestore not initialized');
            return false;
        }
        // Try to access Firestore
        const testRef = (0, firestore_1.doc)(firestoreDb, '_connection_test_', 'test');
        await (0, firestore_1.getDoc)(testRef);
        console.log('Firebase connection successful');
        return true;
    }
    catch (error) {
        console.error('Firebase connection failed:', error);
        return false;
    }
}
// Export a function to reinitialize Firebase if needed
async function reinitializeFirebase() {
    try {
        console.log('Attempting to reinitialize Firebase');
        const services = initializeFirebase();
        firebaseApp = services.app;
        firestoreDb = services.db;
        firebaseAuth = services.auth;
        exports.app = app = services.app;
        exports.db = db = services.db;
        exports.auth = auth = services.auth;
        return await checkFirebaseConnection();
    }
    catch (error) {
        console.error('Failed to reinitialize Firebase:', error);
        return false;
    }
}
