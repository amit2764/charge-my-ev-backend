const { admin, mockMode } = require('./config/firebase');
const { v4: uuidv4 } = require('uuid');

// Get a reference to the storage service, which is used to create references in your bucket
const bucket = !mockMode ? admin.storage().bucket() : null;

/**
 * Uploads an image file to Firebase Cloud Storage.
 * @param {object} file - The file object from multer (contains buffer and mimetype).
 * @param {string} destinationPath - The path in the bucket where the file should be stored (e.g., 'profile_pictures/').
 * @returns {Promise<string>} The public URL of the uploaded file.
 */
async function uploadImage(file, destinationPath = 'images/') {
  if (!bucket) {
    console.warn('[STORAGE MOCK] Firebase Storage not initialized. Returning mock URL.');
    const mockUrl = `https://storage.googleapis.com/mock-bucket/${destinationPath}${uuidv4()}-${file.originalname}`;
    return mockUrl;
  }

  if (!file) {
    throw new Error('No file provided for upload.');
  }

  const uniqueFilename = `${uuidv4()}-${file.originalname}`;
  const filePath = `${destinationPath}${uniqueFilename}`;
  const fileUpload = bucket.file(filePath);

  const blobStream = fileUpload.createWriteStream({
    metadata: {
      contentType: file.mimetype,
    },
  });

  return new Promise((resolve, reject) => {
    blobStream.on('error', (error) => {
      console.error('Something went wrong with the upload!', error);
      reject(error);
    });

    blobStream.on('finish', async () => {
      // Make the file public to get a URL. For private access, use signed URLs.
      await fileUpload.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
}

module.exports = { uploadImage };