const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expense.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const idempotency = require('../middleware/idempotency');
const {
  createExpenseSchema,
  updateExpenseSchema,
  resubmitExpenseSchema,
} = require('../schemas/expense.schema');

router.use(authenticate);

// Receipt endpoints
router.post('/upload', upload.single('receipt'), expenseController.uploadReceipt);
router.get('/receipts/:id', expenseController.getReceiptFile);

// Expenses CRUD & workflows
router.get('/', expenseController.getExpenses);
router.post('/', validate(createExpenseSchema), expenseController.createDraft);
router.get('/:id', expenseController.getExpenseById);
router.patch('/:id', validate(updateExpenseSchema), expenseController.updateDraft);
router.post('/:id/submit', idempotency, expenseController.submitExpense);
router.post('/:id/withdraw', idempotency, expenseController.withdrawExpense);
router.post('/:id/resubmit', validate(resubmitExpenseSchema), idempotency, expenseController.resubmitExpense);
router.get('/:id/timeline', expenseController.getExpenseTimeline);

module.exports = router;
