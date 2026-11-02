const ExpenseClaim = require('../models/ExpenseClaim');
const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const Budget = require('../models/Budget');
const Reimbursement = require('../models/Reimbursement');

exports.getDashboardSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const deptId = req.user.departmentId?._id || req.user.departmentId;

    let summary = {};

    if (userRole === 'employee') {
      const [drafts, underReview, approved, paid] = await Promise.all([
        ExpenseClaim.countDocuments({ employeeId: userId, status: 'DRAFT' }),
        ExpenseClaim.countDocuments({ employeeId: userId, status: { $in: ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED'] } }),
        ExpenseClaim.countDocuments({ employeeId: userId, status: { $in: ['APPROVED', 'SCHEDULED'] } }),
        ExpenseClaim.find({ employeeId: userId, status: 'PAID' }),
      ]);

      const totalReimbursed = paid.reduce((sum, c) => sum + c.amount, 0);

      summary = {
        role: 'employee',
        draftsCount: drafts,
        inReviewCount: underReview,
        approvedCount: approved,
        paidCount: paid.length,
        totalReimbursed,
      };
    } else if (userRole === 'manager') {
      const [inboxWorkflows, deptClaims, deptBudget] = await Promise.all([
        ApprovalWorkflow.countDocuments({
          status: 'IN_PROGRESS',
          'steps.assignedApproverId': userId,
          'steps.status': 'PENDING',
        }),
        ExpenseClaim.countDocuments({ departmentId: deptId }),
        deptId ? Budget.findOne({ scopeType: 'department', scopeId: deptId, status: 'active' }) : null,
      ]);

      summary = {
        role: 'manager',
        pendingApprovalsCount: inboxWorkflows,
        departmentTotalClaims: deptClaims,
        budget: deptBudget ? {
          allocated: deptBudget.allocatedAmount,
          committed: deptBudget.committedAmount,
          actual: deptBudget.actualAmount,
          utilization: deptBudget.utilizationPercentage,
        } : null,
      };
    } else if (userRole === 'finance') {
      const [pendingApproval, approvedUnpaid, scheduled, paidThisMonth] = await Promise.all([
        ExpenseClaim.countDocuments({ status: 'UNDER_REVIEW' }),
        ExpenseClaim.countDocuments({ status: 'APPROVED' }),
        ExpenseClaim.countDocuments({ status: 'SCHEDULED' }),
        Reimbursement.find({ status: 'PAID' }),
      ]);

      const totalPaidAmount = paidThisMonth.reduce((sum, r) => sum + r.amount, 0);

      summary = {
        role: 'finance',
        pendingReviews: pendingApproval,
        approvedUnpaidCount: approvedUnpaid,
        scheduledCount: scheduled,
        totalPaidAmount,
      };
    } else if (userRole === 'admin') {
      const [totalUsers, totalClaims, totalBudgets, activeWorkflows] = await Promise.all([
        require('../models/User').countDocuments(),
        ExpenseClaim.countDocuments(),
        Budget.countDocuments({ status: 'active' }),
        ApprovalWorkflow.countDocuments({ status: 'IN_PROGRESS' }),
      ]);

      summary = {
        role: 'admin',
        totalUsers,
        totalClaims,
        activeBudgetsCount: totalBudgets,
        activeWorkflows,
      };
    }

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

exports.getExpenseReports = async (req, res, next) => {
  try {
    // Spending by category aggregation
    const categoryAggregation = await ExpenseClaim.aggregate([
      { $match: { status: { $in: ['APPROVED', 'SCHEDULED', 'PAID'] } } },
      {
        $group: {
          _id: '$categoryId',
          totalAmount: { $sum: '$amount' },
          claimsCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'expensecategories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $project: {
          categoryId: '$_id',
          name: '$category.name',
          totalAmount: 1,
          claimsCount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Spending by department aggregation
    const departmentAggregation = await ExpenseClaim.aggregate([
      { $match: { status: { $in: ['APPROVED', 'SCHEDULED', 'PAID'] } } },
      {
        $group: {
          _id: '$departmentId',
          totalAmount: { $sum: '$amount' },
          claimsCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: '$department' },
      {
        $project: {
          departmentId: '$_id',
          name: '$department.name',
          totalAmount: 1,
          claimsCount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        byCategory: categoryAggregation,
        byDepartment: departmentAggregation,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getBudgetReports = async (req, res, next) => {
  try {
    const budgets = await Budget.find({ status: 'active' });
    const report = budgets.map((b) => ({
      id: b._id,
      name: b.name,
      scopeType: b.scopeType,
      allocated: b.allocatedAmount,
      committed: b.committedAmount,
      actual: b.actualAmount,
      available: b.availableAmount,
      utilizationPercentage: b.utilizationPercentage,
    }));

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

exports.getReimbursementReports = async (req, res, next) => {
  try {
    const reimbursements = await Reimbursement.aggregate([
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: reimbursements,
    });
  } catch (error) {
    next(error);
  }
};
