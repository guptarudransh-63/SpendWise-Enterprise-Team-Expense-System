const User = require('../models/User');
const Department = require('../models/Department');
const ExpenseCategory = require('../models/ExpenseCategory');
const ApprovalPolicy = require('../models/ApprovalPolicy');
const AuditLog = require('../models/AuditLog');
const AuditService = require('../services/audit.service');

// Users
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .populate('departmentId', 'name costCenter')
      .populate('managerId', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { password, ...userData } = req.body;
    const passwordHash = await User.hashPassword(password);

    const user = new User({
      ...userData,
      passwordHash,
    });

    await user.save();

    await AuditService.log({
      actorId: req.user._id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user._id,
      after: user.toObject(),
    });

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const beforeUser = await User.findById(req.params.id);
    if (!beforeUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const updates = { ...req.body };
    if (updates.password) {
      updates.passwordHash = await User.hashPassword(updates.password);
      delete updates.password;
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('departmentId managerId');

    await AuditService.log({
      actorId: req.user._id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: updatedUser._id,
      before: beforeUser.toObject(),
      after: updatedUser.toObject(),
    });

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// Departments
exports.getDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find()
      .populate('managerId', 'name email role')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: departments,
    });
  } catch (error) {
    next(error);
  }
};

exports.createDepartment = async (req, res, next) => {
  try {
    const department = new Department(req.body);
    await department.save();

    await AuditService.log({
      actorId: req.user._id,
      action: 'DEPARTMENT_CREATED',
      entityType: 'Department',
      entityId: department._id,
      after: department.toObject(),
    });

    res.status(201).json({
      success: true,
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateDepartment = async (req, res, next) => {
  try {
    const beforeDept = await Department.findById(req.params.id);
    if (!beforeDept) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }

    const updated = await Department.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await AuditService.log({
      actorId: req.user._id,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'Department',
      entityId: updated._id,
      before: beforeDept.toObject(),
      after: updated.toObject(),
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Expense Categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await ExpenseCategory.find().sort({ name: 1 });
    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const category = new ExpenseCategory(req.body);
    await category.save();

    await AuditService.log({
      actorId: req.user._id,
      action: 'EXPENSE_CATEGORY_CREATED',
      entityType: 'ExpenseCategory',
      entityId: category._id,
      after: category.toObject(),
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const beforeCat = await ExpenseCategory.findById(req.params.id);
    if (!beforeCat) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const updated = await ExpenseCategory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await AuditService.log({
      actorId: req.user._id,
      action: 'EXPENSE_CATEGORY_UPDATED',
      entityType: 'ExpenseCategory',
      entityId: updated._id,
      before: beforeCat.toObject(),
      after: updated.toObject(),
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Approval Policies
exports.getApprovalPolicies = async (req, res, next) => {
  try {
    const policies = await ApprovalPolicy.find()
      .populate('conditions.departmentIds', 'name costCenter')
      .populate('conditions.categoryIds', 'name')
      .populate('createdBy', 'name email')
      .sort({ priority: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: policies,
    });
  } catch (error) {
    next(error);
  }
};

exports.createApprovalPolicy = async (req, res, next) => {
  try {
    const policy = new ApprovalPolicy({
      ...req.body,
      createdBy: req.user._id,
      version: 1,
    });

    await policy.save();

    await AuditService.log({
      actorId: req.user._id,
      action: 'APPROVAL_POLICY_CREATED',
      entityType: 'ApprovalPolicy',
      entityId: policy._id,
      after: policy.toObject(),
    });

    res.status(201).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateApprovalPolicy = async (req, res, next) => {
  try {
    const currentPolicy = await ApprovalPolicy.findById(req.params.id);
    if (!currentPolicy) {
      return res.status(404).json({ success: false, error: 'Approval policy not found' });
    }

    // Version increment on update (Section 12.D: Policy Versioning)
    const newVersion = (currentPolicy.version || 1) + 1;

    const updated = await ApprovalPolicy.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        version: newVersion,
      },
      { new: true, runValidators: true }
    );

    await AuditService.log({
      actorId: req.user._id,
      action: 'APPROVAL_POLICY_UPDATED',
      entityType: 'ApprovalPolicy',
      entityId: updated._id,
      before: currentPolicy.toObject(),
      after: updated.toObject(),
      reason: `Policy updated to version ${newVersion}`,
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Audit Logs
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { action, entityType, entityId, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('actorId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AuditLog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};
