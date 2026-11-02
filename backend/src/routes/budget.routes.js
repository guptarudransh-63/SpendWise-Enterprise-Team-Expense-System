const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budget.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const idempotency = require('../middleware/idempotency');
const {
  createBudgetSchema,
  updateBudgetSchema,
  budgetOverrideSchema,
} = require('../schemas/budget.schema');

router.use(authenticate);

router.get('/alerts', requireRole('manager', 'finance', 'admin'), budgetController.getBudgetAlerts);
router.get('/', budgetController.getBudgets);
router.post('/', requireRole('finance', 'admin'), validate(createBudgetSchema), budgetController.createBudget);
router.get('/:id', budgetController.getBudgetById);
router.patch('/:id', requireRole('finance', 'admin'), validate(updateBudgetSchema), budgetController.updateBudget);
router.get('/:id/utilization', budgetController.getBudgetUtilization);
router.post('/overrides', requireRole('finance', 'admin'), validate(budgetOverrideSchema), idempotency, budgetController.applyOverride);

module.exports = router;
