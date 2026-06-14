// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDGKWP5-2Lsi3_kCNNgB-rUYxkdyX65s9E",
  authDomain: "gersemi-ae6e5.firebaseapp.com",
  projectId: "gersemi-ae6e5",
  storageBucket: "gersemi-ae6e5.firebasestorage.app",
  messagingSenderId: "908578271790",
  appId: "1:908578271790:web:f10c4f85539f01c400a5bf",
  measurementId: "G-KEQ340H89T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const db = getFirestore(app);

export { app, analytics, db };