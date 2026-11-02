const Budget = require('../models/Budget');
const BudgetReservation = require('../models/BudgetReservation');
const ExpenseClaim = require('../models/ExpenseClaim');
const BudgetService = require('../services/budget.service');
const AuditService = require('../services/audit.service');

exports.getBudgets = async (req, res, next) => {
  try {
    const { scopeType, status = 'active' } = req.query;
    const filter = {};
    if (scopeType) filter.scopeType = scopeType;
    if (status) filter.status = status;

    const budgets = await Budget.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: budgets,
    });
  } catch (error) {
    next(error);
  }
};

exports.getBudgetById = async (req, res, next) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found',
      });
    }

    res.status(200).json({
      success: true,
      data: budget,
    });
  } catch (error) {
    next(error);
  }
};

exports.createBudget = async (req, res, next) => {
  try {
    const budget = new Budget(req.body);
    await budget.save();

    await AuditService.log({
      actorId: req.user._id,
      action: 'BUDGET_CREATED',
      entityType: 'Budget',
      entityId: budget._id,
      after: budget.toObject(),
    });

    res.status(201).json({
      success: true,
      data: budget,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateBudget = async (req, res, next) => {
  try {
    const beforeState = await Budget.findById(req.params.id);
    if (!beforeState) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found',
      });
    }

    const updated = await Budget.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await AuditService.log({
      actorId: req.user._id,
      action: 'BUDGET_UPDATED',
      entityType: 'Budget',
      entityId: updated._id,
      before: beforeState.toObject(),
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

exports.getBudgetUtilization = async (req, res, next) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found',
      });
    }

    // Fetch active reservations
    const reservations = await BudgetReservation.find({
      budgetId: budget._id,
      status: 'ACTIVE',
    }).populate({
      path: 'claimId',
      select: 'claimNumber title amount employeeId status',
      populate: { path: 'employeeId', select: 'name email' },
    });

    res.status(200).json({
      success: true,
      data: {
        budget,
        metrics: {
          allocated: budget.allocatedAmount,
          committed: budget.committedAmount,
          actual: budget.actualAmount,
          available: budget.availableAmount,
          utilizationPercentage: budget.utilizationPercentage,
        },
        activeReservations: reservations,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getBudgetAlerts = async (req, res, next) => {
  try {
    const budgets = await Budget.find({ status: 'active' });
    const alerts = [];

    for (const b of budgets) {
      const utilization = b.utilizationPercentage;
      const threshold = b.policy.warningThresholdPercentage || 80;
      if (utilization >= threshold) {
        alerts.push({
          budgetId: b._id,
          name: b.name,
          scopeType: b.scopeType,
          allocatedAmount: b.allocatedAmount,
          utilizedAmount: b.committedAmount + b.actualAmount,
          utilizationPercentage: utilization,
          threshold,
          status: utilization >= 100 ? 'EXCEEDED' : 'WARNING',
        });
      }
    }

    res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
};

exports.applyOverride = async (req, res, next) => {
  try {
    const { claimId, reason } = req.body;
    const claim = await ExpenseClaim.findById(claimId);

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Expense claim not found',
      });
    }

    const reservation = await BudgetService.reserveBudgetForClaim({
      claim,
      actorId: req.user._id,
      override: true,
      overrideReason: reason,
    });

    res.status(200).json({
      success: true,
      message: 'Budget override authorized and committed.',
      data: reservation,
    });
  } catch (error) {
    next(error);
  }
};
