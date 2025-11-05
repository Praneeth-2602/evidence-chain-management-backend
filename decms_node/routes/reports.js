const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const controller = require('../controllers/reportController');
const path = require('path');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const storage = multer.diskStorage({ destination: (req, file, cb) => cb(null, uploadDir), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname) });
const upload = multer({ storage });

router.post('/', authenticate, authorize(['Lab Staff','Admin']), upload.single('report_file'), controller.createReport);
// Public list of recent reports
router.get('/public', controller.getReportsPublic);
// Public report upload (accepts analyst_email)
router.post('/public', upload.single('report_file'), controller.createReportPublic);
router.get('/:evidenceId', authenticate, controller.getReportsForEvidence);

module.exports = router;
