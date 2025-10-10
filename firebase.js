// --- FIREBASE CONFIG & INIT ---
const firebaseConfig = {
  apiKey: "AIzaSyDwIQTv37HASL1tYuNUeVi4zndA1xNWRMA",
  authDomain: "spark-survival.firebaseapp.com",
  projectId: "spark-survival",
  storageBucket: "spark-survival.firebasestorage.app",
  messagingSenderId: "1005255242395",
  appId: "1:1005255242395:web:5f6961e73885a815284c3e"
};
firebase.initializeApp(firebaseConfig);

// Define variables
const auth = firebase.auth();
const db = firebase.database();
const ServerValue = firebase.database.ServerValue;

// Export the initialized services for use in script.js
export { auth, db, ServerValue };