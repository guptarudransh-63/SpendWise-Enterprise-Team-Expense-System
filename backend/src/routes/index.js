const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const expenseRoutes = require('./expense.routes');
const approvalRoutes = require('./approval.routes');
const budgetRoutes = require('./budget.routes');
const financeRoutes = require('./finance.routes');
const adminRoutes = require('./admin.routes');
const dashboardRoutes = require('./dashboard.routes');
const notificationRoutes = require('./notification.routes');

router.use('/auth', authRoutes);
router.use('/expenses', expenseRoutes);
router.use('/approvals', approvalRoutes);
router.use('/budgets', budgetRoutes);
router.use('/finance', financeRoutes);
router.use('/admin', adminRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'SpendWise API v1',
  });
});

module.exports = router;
