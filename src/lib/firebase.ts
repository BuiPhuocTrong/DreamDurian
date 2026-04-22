import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  setPersistence, 
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  initializeFirestore,
  onSnapshotsInSync
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfigData);
export const auth = getAuth(app);

// Set persistence to Local to ensure sessions survive refresh in most environments
setPersistence(auth, browserLocalPersistence).catch(err => console.error("Auth persistence error:", err));

// Initialize Firestore with settings to handle potential connectivity issues
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, (firebaseConfigData as any).firestoreDatabaseId || '(default)');

export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error("Login Error:", error);
    throw error;
  }
};

export const registerWithEmail = async (email: string, pass: string, name: string) => {
  const res = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(res.user, { displayName: name });
  return res;
};

export const loginWithEmail = (email: string, pass: string) => {
  return signInWithEmailAndPassword(auth, email, pass);
};

export const logout = () => signOut(auth);

// Debug: Listen for sync events
onSnapshotsInSync(db, () => {
  console.log("Firestore snapshots are in sync with the server.");
});
