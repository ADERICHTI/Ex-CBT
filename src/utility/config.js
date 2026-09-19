// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB4filSStkgOTW15Y4rxE6u6yo00SFvAtY",
  authDomain: "quick-cbt.firebaseapp.com",
  databaseURL: "https://quick-cbt-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "quick-cbt",
  storageBucket: "quick-cbt.firebasestorage.app",
  messagingSenderId: "584031052691",
  appId: "1:584031052691:web:1327cb86be5b7cfbaf7e66",
  measurementId: "G-JG9QHEP53N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ex-cbt");
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const functions = getFunctions(app);

let analytics = null;
try {
  analytics = getAnalytics(app);
} catch {
  // analytics unsupported in this environment (e.g. some dev/incognito contexts) - non-fatal
}

// Point the SDK at the local emulator suite instead of production when developing.
// Guarded against Vite HMR re-running this module and trying to connect twice.
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
  if (!globalThis.__EXAMINER_EMULATORS_CONNECTED__) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    globalThis.__EXAMINER_EMULATORS_CONNECTED__ = true;
  }
}

export { db, auth, googleProvider, analytics, functions };