const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const controller = require('../controllers/analyticsController');

router.get('/cases', authenticate, authorize(['Admin']), controller.casesByStatus);
router.get('/evidence', authenticate, authorize(['Admin']), controller.evidenceByTypeAndStatus);
router.get('/transfers', authenticate, authorize(['Admin']), controller.monthlyTransfers);
router.get('/logs', authenticate, authorize(['Admin']), controller.accessLogs);

module.exports = router;
