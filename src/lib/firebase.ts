import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  initializeFirestore,
  onSnapshotsInSync
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfigData);
export const auth = getAuth(app);

// Initialize Firestore with settings to handle potential connectivity issues
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, (firebaseConfigData as any).firestoreDatabaseId || '(default)');

export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Critical Connection Test with more detail
async function testConnection() {
  try {
    // Attempt to pull a non-existent doc just to check connection
    await getDocFromServer(doc(db, '_connection_test_', 'check'));
    console.log("✅ Firestore connected successfully");
  } catch (error: any) {
    console.error("❌ Firestore connection error:", error.code, error.message);
    if (error.code === 'unavailable') {
      console.warn("Firestore backend is unreachable. This usually means:");
      console.warn("1. Your internet connection is unstable.");
      console.warn("2. The Firebase project is still being provisioned.");
      console.warn("3. The database specified in firebase-applet-config.json does not exist yet.");
    }
  }
}

// Listen for sync events to debug connectivity status changes
onSnapshotsInSync(db, () => {
  console.log("Firestore snapshots are in sync with the server.");
});

testConnection();
