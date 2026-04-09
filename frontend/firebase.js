// Firebase config from your Firebase console.
// This project uses CDN compat scripts loaded in each HTML page.
const firebaseConfig = {
  apiKey: "AIzaSyCh-DnmVBmxHDfZOy-zOBw8jRGEUdPafeI",
  authDomain: "collab-docs-9d086.firebaseapp.com",
  projectId: "collab-docs-9d086",
  storageBucket: "collab-docs-9d086.firebasestorage.app",
  messagingSenderId: "71835516476",
  appId: "1:71835516476:web:a24c5a0de83486e1454d39",
  measurementId: "G-XLSKNQHLH0"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Expose auth globally for script.js.
window.auth = firebase.auth();