const { admin, db, mockMode } = require('./src/config/firebase');
const path = require('path');

async function runFirebaseCheck() {
  console.log('--- Running Firebase Connection Diagnostic ---');

  if (mockMode) {
    console.error('\n❌ ERROR: Running in Mock Mode. This means your .env file is missing or incomplete.');
    console.log('Please ensure your `your-backend-folder/.env` file contains correct values for:');
    console.log(' - FIREBASE_PROJECT_ID');
    console.log(' - FIREBASE_CLIENT_EMAIL');
    console.log(' - FIREBASE_PRIVATE_KEY or FIREBASE_PRIVATE_KEY_B64');
    console.log('-------------------------------------------\n');
    return;
  }

  if (!db) {
    console.error('\n❌ ERROR: Firebase was initialized, but the database object (db) is null.');
    console.log('This can happen if there was an error during `admin.initializeApp`.');
    console.log('-------------------------------------------\n');
    return;
  }

  // Check if we are using the direct file path method and verify it
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credsPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log(`\nAttempting to use credentials file at absolute path:`);
    console.log(`   -> ${credsPath}`);
    try {
      require('fs').accessSync(credsPath);
      console.log('   ✅ Credentials file was found at this path.');
    } catch (e) {
      console.error(`\n❌ CRITICAL ERROR: The credentials file was NOT FOUND at the path specified in your .env file.`);
      console.error('   Please verify the GOOGLE_APPLICATION_CREDENTIALS path in your .env file is correct and the file exists.\n');
      return;
    }
  }

  const projectId = admin.app().options.projectId;
  console.log('\n✅ Firebase SDK Initialized Successfully.');
  console.log(`   Using Project ID: "${projectId}"`);
  console.log('   Attempting to connect to Firestore database...');

  try {
    const collections = await db.listCollections();
    console.log('\n✅ SUCCESS: Successfully connected to Firestore!');
    
    if (collections.length === 0) {
      console.log('   Database is empty (no collections found), which is normal for a new project.');
    } else {
      console.log(`   Found ${collections.length} collections:`);
      collections.forEach(collection => {
        console.log(`    - ${collection.id}`);
      });
    }
    console.log('\nConclusion: Your credentials and database are correctly configured!');
    console.log('-------------------------------------------\n');

  } catch (error) {
    console.error('\n❌ FAILED: Could not connect to Firestore database.');
    console.error('   Error Code:', error.code);
    console.error('   Error Message:', error.details || error.message);
    console.log('\n   This confirms the `5 NOT_FOUND` error. The most likely causes are:');
    console.log('   1. The Firestore database was not created in the "ev-p2p" project, or was not named `(default)`.');
    console.log('   2. The Service Account (identified by FIREBASE_CLIENT_EMAIL) does not have "Editor" or "Firebase Admin" permissions in Google Cloud IAM.');
    console.log('   3. The `FIREBASE_PRIVATE_KEY_B64` value is corrupted or incorrect.');
    console.log('-------------------------------------------\n');
  }
}

runFirebaseCheck();