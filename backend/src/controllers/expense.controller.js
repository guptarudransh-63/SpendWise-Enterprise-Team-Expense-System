const fs = require('fs');
const path = require('path');
const ExpenseClaim = require('../models/ExpenseClaim');
const ReceiptAttachment = require('../models/ReceiptAttachment');
const ExpenseService = require('../services/expense.service');
const AuditService = require('../services/audit.service');

exports.getExpenses = async (req, res, next) => {
  try {
    const { status, categoryId, departmentId, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    // Role-based visibility
    if (req.user.role === 'employee') {
      filter.employeeId = req.user._id;
    } else if (req.user.role === 'manager') {
      // Manager can see personal claims or their department's claims
      const managerDeptId = req.user.departmentId?._id || req.user.departmentId;
      if (req.query.scope === 'personal' || !managerDeptId) {
        filter.employeeId = req.user._id;
      } else {
        if (departmentId && departmentId.toString() === managerDeptId.toString()) {
          filter.departmentId = managerDeptId;
        } else {
          filter.$or = [
            { employeeId: req.user._id },
            { departmentId: managerDeptId },
          ];
        }
      }
    }

    if (status) filter.status = status;
    if (categoryId) filter.categoryId = categoryId;
    if (departmentId && req.user.role !== 'employee' && req.user.role !== 'manager') {
      filter.departmentId = departmentId;
    }

    if (search) {
      const searchOr = [
        { claimNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { merchant: { $regex: search, $options: 'i' } },
      ];
      if (filter.$or) {
        const existingOr = filter.$or;
        delete filter.$or;
        filter.$and = [{ $or: existingOr }, { $or: searchOr }];
      } else {
        filter.$or = searchOr;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      ExpenseClaim.find(filter)
        .populate('employeeId', 'name email role')
        .populate('categoryId', 'name code receiptRequired')
        .populate('departmentId', 'name costCenter')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ExpenseClaim.countDocuments(filter),
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

exports.getExpenseById = async (req, res, next) => {
  try {
    const claim = await ExpenseClaim.findById(req.params.id)
      .populate('employeeId', 'name email role')
      .populate('categoryId', 'name code receiptRequired spendingLimit')
      .populate('departmentId', 'name costCenter managerId')
      .populate('receiptIds')
      .populate({
        path: 'activeWorkflowId',
        populate: [
          { path: 'steps.assignedApproverId', select: 'name email role' },
          { path: 'steps.actedBy', select: 'name email role' },
          { path: 'steps.delegationHistory.fromUserId', select: 'name email' },
          { path: 'steps.delegationHistory.toUserId', select: 'name email' },
        ],
      });

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Expense claim not found',
      });
    }

    // Role-based authorization check
    const ownerId = (claim.employeeId?._id || claim.employeeId)?.toString();
    const isOwner = ownerId === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isFinance = req.user.role === 'finance';

    const userDeptId = (req.user.departmentId?._id || req.user.departmentId)?.toString();
    const claimDeptId = (claim.departmentId?._id || claim.departmentId)?.toString();
    const isManagerOfDept =
      req.user.role === 'manager' &&
      ((claim.departmentId &&
        claim.departmentId.managerId &&
        claim.departmentId.managerId.toString() === req.user._id.toString()) ||
        (userDeptId && claimDeptId && userDeptId === claimDeptId));

    // Check if user is an assigned approver on this claim's workflow
    let isAssignedApprover = false;
    if (claim.activeWorkflowId && claim.activeWorkflowId.steps) {
      isAssignedApprover = claim.activeWorkflowId.steps.some((s) => {
        const stepApproverId = (s.assignedApproverId?._id || s.assignedApproverId)?.toString();
        return stepApproverId === req.user._id.toString();
      });
    }

    if (!isOwner && !isAdmin && !isFinance && !isManagerOfDept && !isAssignedApprover) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this expense claim.',
      });
    }

    res.status(200).json({
      success: true,
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};

exports.createDraft = async (req, res, next) => {
  try {
    const claim = await ExpenseService.createDraft(req.body, req.user);
    res.status(201).json({
      success: true,
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateDraft = async (req, res, next) => {
  try {
    const claim = await ExpenseService.updateDraft(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};

exports.submitExpense = async (req, res, next) => {
  try {
    const result = await ExpenseService.submitClaim(req.params.id, req.user, req.body);
    res.status(200).json({
      success: true,
      message: 'Expense claim submitted successfully for approval.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.withdrawExpense = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const claim = await ExpenseService.withdrawClaim(req.params.id, req.user, reason);
    res.status(200).json({
      success: true,
      message: 'Expense claim withdrawn.',
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};

exports.resubmitExpense = async (req, res, next) => {
  try {
    const claim = await ExpenseService.resubmitClaim(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      message: 'Expense claim resubmitted for approval review.',
      data: claim,
    });
  } catch (error) {
    next(error);
  }
};

exports.getExpenseTimeline = async (req, res, next) => {
  try {
    const timeline = await AuditService.getEntityTimeline('ExpenseClaim', req.params.id);
    res.status(200).json({
      success: true,
      data: timeline,
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadReceipt = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please select a receipt file to upload.',
      });
    }

    const attachment = new ReceiptAttachment({
      storageKey: req.file.path,
      originalFilename: req.file.originalname,
      contentType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
    });

    await attachment.save();

    res.status(201).json({
      success: true,
      data: attachment,
    });
  } catch (error) {
    next(error);
  }
};

exports.getReceiptFile = async (req, res, next) => {
  try {
    const attachment = await ReceiptAttachment.findById(req.params.id).select('+storageKey');

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Receipt attachment not found.',
      });
    }

    // Permission check: uploader, admin, or finance
    const isUploader = attachment.uploadedBy.toString() === req.user._id.toString();
    const isStaff = ['admin', 'finance', 'manager'].includes(req.user.role);

    if (!isUploader && !isStaff) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to access this receipt file.',
      });
    }

    if (!fs.existsSync(attachment.storageKey)) {
      return res.status(404).json({
        success: false,
        error: 'Physical receipt file missing from storage.',
      });
    }

    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.originalFilename}"`);
    fs.createReadStream(attachment.storageKey).pipe(res);
  } catch (error) {
    next(error);
  }
};
