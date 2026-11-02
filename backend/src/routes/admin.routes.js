const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const {
  createUserSchema,
  updateUserSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createCategorySchema,
  updateCategorySchema,
} = require('../schemas/admin.schema');
const {
  createPolicySchema,
  updatePolicySchema,
} = require('../schemas/policy.schema');

router.use(authenticate);

// Publicly read categories & departments for dropdowns across the app
router.get('/categories', adminController.getCategories);
router.get('/departments', adminController.getDepartments);
router.get('/approval-policies', adminController.getApprovalPolicies);

// Management restricted to Admin
router.post('/categories', requireRole('admin'), validate(createCategorySchema), adminController.createCategory);
router.patch('/categories/:id', requireRole('admin'), validate(updateCategorySchema), adminController.updateCategory);

router.post('/departments', requireRole('admin'), validate(createDepartmentSchema), adminController.createDepartment);
router.patch('/departments/:id', requireRole('admin'), validate(updateDepartmentSchema), adminController.updateDepartment);

router.get('/users', requireRole('admin', 'manager', 'finance'), adminController.getUsers);
router.post('/users', requireRole('admin'), validate(createUserSchema), adminController.createUser);
router.patch('/users/:id', requireRole('admin'), validate(updateUserSchema), adminController.updateUser);

router.post('/approval-policies', requireRole('admin'), validate(createPolicySchema), adminController.createApprovalPolicy);
router.patch('/approval-policies/:id', requireRole('admin'), validate(updatePolicySchema), adminController.updateApprovalPolicy);

router.get('/audit-logs', requireRole('admin'), adminController.getAuditLogs);

module.exports = router;
