const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approval.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const idempotency = require('../middleware/idempotency');
const {
  approveStepSchema,
  rejectStepSchema,
  requestInfoSchema,
  reassignStepSchema,
} = require('../schemas/approval.schema');

router.use(authenticate);

// Approvers are managers, finance, or admin
router.get('/inbox', requireRole('manager', 'finance', 'admin'), approvalController.getApprovalInbox);
router.get('/:workflowId', approvalController.getWorkflowById);

router.post(
  '/:workflowId/steps/:stepId/approve',
  requireRole('manager', 'finance', 'admin'),
  validate(approveStepSchema),
  idempotency,
  approvalController.approveStep
);

router.post(
  '/:workflowId/steps/:stepId/reject',
  requireRole('manager', 'finance', 'admin'),
  validate(rejectStepSchema),
  idempotency,
  approvalController.rejectStep
);

router.post(
  '/:workflowId/steps/:stepId/request-information',
  requireRole('manager', 'finance', 'admin'),
  validate(requestInfoSchema),
  idempotency,
  approvalController.requestInformation
);

router.post(
  '/:workflowId/steps/:stepId/reassign',
  requireRole('manager', 'finance', 'admin'),
  validate(reassignStepSchema),
  idempotency,
  approvalController.reassignStep
);

module.exports = router;
