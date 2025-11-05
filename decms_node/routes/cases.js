const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const controller = require('../controllers/caseController');

// Public listing for UI
router.get('/public', controller.getCasesPublic);
// Public create case for dev convenience
router.post('/public', controller.createCasePublic);
router.get('/', authenticate, authorize(['Admin']), controller.getCases);
router.post('/', authenticate, authorize(['Admin', 'Investigator']), controller.createCase);
router.get('/:id', authenticate, authorize(['Admin', 'Investigator', 'Lab Staff']), controller.getCase);
router.put('/:id', authenticate, authorize(['Admin', 'Investigator']), controller.updateCase);

module.exports = router;
