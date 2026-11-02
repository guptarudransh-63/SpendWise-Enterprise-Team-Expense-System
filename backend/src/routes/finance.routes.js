const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const idempotency = require('../middleware/idempotency');
const {
  scheduleReimbursementSchema,
  completeReimbursementSchema,
} = require('../schemas/reimbursement.schema');

router.use(authenticate);

// Finance queue and processing (restricted to finance and admin)
router.get('/claims', requireRole('finance', 'admin'), financeController.getFinanceClaims);

router.post(
  '/claims/:id/schedule',
  requireRole('finance', 'admin'),
  validate(scheduleReimbursementSchema),
  idempotency,
  financeController.scheduleReimbursement
);

router.post(
  '/claims/:id/complete',
  requireRole('finance', 'admin'),
  validate(completeReimbursementSchema),
  idempotency,
  financeController.completeReimbursement
);

// Reimbursements history
router.get('/reimbursements', requireRole('finance', 'admin', 'manager'), financeController.getReimbursements);
router.get('/reimbursements/:id', requireRole('finance', 'admin', 'manager'), financeController.getReimbursementById);

module.exports = router;
