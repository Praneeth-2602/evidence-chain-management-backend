const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const controller = require('../controllers/evidenceController');
const path = require('path');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.post('/', authenticate, authorize(['Investigator', 'Admin']), upload.single('file'), controller.createEvidence);
// Public listing endpoint for UI
router.get('/public', controller.getAllEvidencePublic);
// Public create endpoint (multipart/form-data). Accepts collected_by_email or collected_by_name
router.post('/public', upload.single('file'), controller.createEvidencePublic);
router.get('/:id', authenticate, controller.getEvidence);
router.get('/case/:caseId', authenticate, controller.getEvidenceByCase);
// Allow Lab Staff to mark items as "Under Analysis"
router.put('/:id', authenticate, authorize(['Investigator', 'Admin', 'Lab Staff']), controller.updateEvidence);
router.delete('/:id', authenticate, authorize(['Admin']), controller.deleteEvidence);

module.exports = router;
