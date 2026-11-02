const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticate);

router.get('/summary', dashboardController.getDashboardSummary);
router.get('/reports/expenses', requireRole('manager', 'finance', 'admin'), dashboardController.getExpenseReports);
router.get('/reports/budgets', requireRole('finance', 'admin'), dashboardController.getBudgetReports);
router.get('/reports/reimbursements', requireRole('finance', 'admin'), dashboardController.getReimbursementReports);

module.exports = router;
