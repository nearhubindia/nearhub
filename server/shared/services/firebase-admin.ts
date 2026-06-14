import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

let firebaseAdminApp: App | null = null;
let initAttempted = false;

function readServiceAccount(): Record<string, unknown> | null {
  const inlineJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson) as Record<string, unknown>;
    } catch (error) {
      console.error('[Firebase Admin] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', error);
      return null;
    }
  }

  const jsonPath = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
  if (!jsonPath) return null;

  try {
    return JSON.parse(readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    console.error('[Firebase Admin] Failed to read service account JSON:', error);
    return null;
  }
}

export function getFirebaseAdminMessaging(): Messaging | null {
  if (firebaseAdminApp) return getMessaging(firebaseAdminApp);
  if (initAttempted) return null;
  initAttempted = true;

  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    console.warn('[Firebase Admin] Web FCM disabled: service account env not configured.');
    return null;
  }

  try {
    firebaseAdminApp =
      getApps()[0] ||
      initializeApp({
        credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      });
    return getMessaging(firebaseAdminApp);
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error);
    firebaseAdminApp = null;
    return null;
  }
}
