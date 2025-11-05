const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const controller = require('../controllers/transfersController');

// Only Admins can perform immediate (auto-approved) transfers
router.post('/', authenticate, authorize(['Admin']), controller.createTransfer);
// Public transfer creation endpoint (resolves users by email or badge)
router.post('/public', controller.createTransferPublic);
// Public endpoint to list all transfers (joins to user names for display)
router.get('/', controller.getAllTransfers);
router.get('/:evidenceId', authenticate, controller.getTransfersForEvidence);

// Approval workflow
// Only Admins can approve/reject transfer requests
router.post('/:id/approve', authenticate, authorize(['Admin']), controller.approveTransfer);
router.post('/:id/reject', authenticate, authorize(['Admin']), controller.rejectTransfer);

module.exports = router;
