const admin = require('firebase-admin');

let db = null;
let mockMode = true;

function parseServiceAccountFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const privateKeyB64 = process.env.FIREBASE_PRIVATE_KEY_B64;

  if (projectId && clientEmail && privateKeyRaw) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKeyRaw.replace(/\\n/g, '\n')
    };
  }

  if (privateKeyB64) {
    try {
      const decoded = JSON.parse(Buffer.from(privateKeyB64, 'base64').toString('utf8'));
      if (decoded.project_id && decoded.client_email && decoded.private_key) {
        return decoded;
      }
    } catch (e) {
      console.warn('FIREBASE_PRIVATE_KEY_B64 is not valid base64 JSON.');
    }
  }

  return null;
}

function parseServiceAccountFromFile() {
  try {
    return require('../../key.json');
  } catch (e) {
    return null;
  }
}

try {
  const envServiceAccount = parseServiceAccountFromEnv();
  const fileServiceAccount = parseServiceAccountFromFile();
  const serviceAccount = envServiceAccount || fileServiceAccount;

  if (!serviceAccount) {
    throw new Error('No Firebase credentials found in env vars or key.json');
  }

  const projectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Firebase project ID is missing');
  }

  console.log('Initializing Firebase Admin...');
  console.log(`- Project ID: ${projectId}`);
  console.log(`- Credentials source: ${envServiceAccount ? 'environment variables' : 'key.json'}`);

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
      databaseURL: `https://${projectId}.firebaseio.com`,
      storageBucket: `${projectId}.appspot.com`
    });
  }

  db = admin.firestore();
  db.settings({ databaseId: 'default' });

  mockMode = false;
  console.log('Firestore initialized successfully.');
} catch (error) {
  console.warn('--- Firebase Initialization Failed ---');
  console.warn(error.message);
  console.warn('Application will run in MOCK MODE.');
  console.warn('------------------------------------');
}

module.exports = { admin, db, mockMode };