const express = require('express');
const multer = require('multer');
const { db, mockMode } = require('../../lib/firestore');
const { uploadImage } = require('../../storage');
const logger = require('../../lib/logger');
const { requireAuth } = require('../../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed for KYC documents.'));
  }
});

function defaultKyc() {
  return {
    status: 'UNVERIFIED',
    documentType: null,
    frontUrl: '',
    backUrl: '',
    submittedAt: null,
    reviewedAt: null,
    rejectionReason: null
  };
}

function normalizeStatus(value) {
  return String(value || 'UNVERIFIED').toUpperCase();
}

async function getKycStatus(req, res) {
  try {
    const userId = String(req.query?.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    if (!db || mockMode) {
      return res.json({ success: true, kyc: defaultKyc() });
    }

    const userSnap = await db.collection('users').doc(userId).get();
    const existing = userSnap.exists ? userSnap.data()?.kyc : null;
    const kyc = existing ? { ...defaultKyc(), ...existing, status: normalizeStatus(existing.status) } : defaultKyc();

    return res.json({ success: true, kyc });
  } catch (error) {
    logger.error('kyc.getStatus failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'Failed to fetch KYC status' });
  }
}

async function submitKyc(req, res) {
  try {
    const userId = String(req.body?.userId || '').trim();
    const documentType = String(req.body?.documentType || '').trim();

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    if (!['aadhaar', 'driving_licence'].includes(documentType)) {
      return res.status(400).json({ success: false, error: 'documentType must be aadhaar or driving_licence' });
    }

    const frontFile = req.files?.front?.[0] || null;
    const backFile = req.files?.back?.[0] || null;

    if (!frontFile) {
      return res.status(400).json({ success: false, error: 'Front document image is required' });
    }

    if (documentType === 'aadhaar' && !backFile) {
      return res.status(400).json({ success: false, error: 'Back document image is required for Aadhaar' });
    }

    if (!db || mockMode) {
      return res.json({
        success: true,
        kyc: {
          ...defaultKyc(),
          status: 'PENDING',
          documentType,
          frontUrl: 'https://storage.googleapis.com/mock-bucket/kyc/mock-front.jpg',
          backUrl: backFile ? 'https://storage.googleapis.com/mock-bucket/kyc/mock-back.jpg' : '',
          submittedAt: new Date(),
          reviewedAt: null,
          rejectionReason: null
        }
      });
    }

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    const currentKyc = userSnap.exists ? (userSnap.data()?.kyc || {}) : {};
    const currentStatus = normalizeStatus(currentKyc.status);

    if (currentStatus === 'PENDING') {
      return res.status(409).json({ success: false, error: 'KYC is already pending review' });
    }

    if (currentStatus === 'VERIFIED') {
      return res.status(409).json({ success: false, error: 'User is already verified' });
    }

    const frontUrl = await uploadImage(frontFile, `kyc/${userId}/`);
    const backUrl = backFile ? await uploadImage(backFile, `kyc/${userId}/`) : '';

    const kyc = {
      status: 'PENDING',
      documentType,
      frontUrl,
      backUrl,
      submittedAt: new Date(),
      reviewedAt: null,
      rejectionReason: null
    };

    await userRef.set({
      kyc,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return res.status(201).json({ success: true, kyc });
  } catch (error) {
    logger.error('kyc.submit failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'Failed to submit KYC documents' });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.get('/kyc/status', requireAuth, getKycStatus);
  router.post('/kyc/submit', requireAuth, upload.fields([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }]), submitKyc);
  app.use('/api', router);
}

module.exports = { registerRoutes };
