const Budget = require('../models/Budget');
const BudgetReservation = require('../models/BudgetReservation');
const AuditService = require('./audit.service');
const NotificationService = require('./notification.service');

class BudgetService {
  /**
   * Find matching budget for an expense claim (by department or category)
   */
  static async findApplicableBudget(claim, session = null) {
    const expenseDate = claim.expenseDate || new Date();

    // 1. Try finding department budget for the current period
    let query = Budget.findOne({
      scopeType: 'department',
      scopeId: claim.departmentId,
      status: 'active',
      periodStart: { $lte: expenseDate },
      periodEnd: { $gte: expenseDate },
    });

    if (session) query = query.session(session);
    let budget = await query;

    // 2. Fallback to category budget if no department budget
    if (!budget && claim.categoryId) {
      let catQuery = Budget.findOne({
        scopeType: 'category',
        scopeId: claim.categoryId,
        status: 'active',
        periodStart: { $lte: expenseDate },
        periodEnd: { $gte: expenseDate },
      });
      if (session) catQuery = catQuery.session(session);
      budget = await catQuery;
    }

    return budget;
  }

  /**
   * Reserve budget atomically for a submitted claim
   */
  static async reserveBudgetForClaim({ claim, actorId = null, override = false, overrideReason = '', session = null }) {
    const budget = await this.findApplicableBudget(claim, session);

    if (!budget) {
      // If no explicit budget is configured for the department, return null (unbudgeted tracking)
      return null;
    }

    // Check if an ACTIVE reservation already exists for this claim and budget
    let resQuery = BudgetReservation.findOne({
      claimId: claim._id,
      budgetId: budget._id,
      status: 'ACTIVE',
    });
    if (session) resQuery = resQuery.session(session);
    const existingReservation = await resQuery;

    if (existingReservation) {
      return existingReservation; // Already reserved
    }

    const availableAmount = budget.allocatedAmount - (budget.committedAmount + budget.actualAmount);

    if (availableAmount < claim.amount && !override && !budget.policy.allowOverrun) {
      const err = new Error(
        `Insufficient budget in "${budget.name}". Available: ${budget.currency} ${availableAmount.toFixed(2)}, Claim Amount: ${budget.currency} ${claim.amount.toFixed(2)}. Submission blocked.`
      );
      err.statusCode = 409;
      err.code = 'BUDGET_EXCEEDED';
      err.details = {
        budgetId: budget._id,
        budgetName: budget.name,
        availableAmount,
        requestedAmount: claim.amount,
      };
      throw err;
    }

    // Atomic increment of committed amount
    // If not overrun allowed and not override, use conditional query to guarantee no race condition
    let updateFilter = { _id: budget._id };
    if (!override && !budget.policy.allowOverrun) {
      updateFilter.$expr = {
        $gte: [
          { $subtract: ['$allocatedAmount', { $add: ['$committedAmount', '$actualAmount'] }] },
          claim.amount,
        ],
      };
    }

    const updateOptions = { new: true };
    if (session) updateOptions.session = session;

    const updatedBudget = await Budget.findOneAndUpdate(
      updateFilter,
      { $inc: { committedAmount: claim.amount } },
      updateOptions
    );

    if (!updatedBudget) {
      const err = new Error('Budget limit exceeded due to concurrent reservations. Please try again.');
      err.statusCode = 409;
      throw err;
    }

    // Create reservation record
    const reservation = new BudgetReservation({
      claimId: claim._id,
      budgetId: budget._id,
      amount: claim.amount,
      currency: budget.currency,
      status: 'ACTIVE',
      reservedAt: new Date(),
    });

    if (session) {
      await reservation.save({ session });
    } else {
      await reservation.save();
    }

    // Audit log
    await AuditService.log({
      actorId: actorId || claim.employeeId,
      action: override ? 'BUDGET_OVERRIDE_RESERVED' : 'BUDGET_RESERVED',
      entityType: 'Budget',
      entityId: budget._id,
      before: { committedAmount: budget.committedAmount },
      after: { committedAmount: updatedBudget.committedAmount },
      reason: override ? `Authorized Override: ${overrideReason}` : `Claim ${claim.claimNumber} submission`,
      session,
    });

    // Check threshold alert (e.g. >= 80% utilization)
    const utilization = ((updatedBudget.committedAmount + updatedBudget.actualAmount) / updatedBudget.allocatedAmount) * 100;
    if (utilization >= updatedBudget.policy.warningThresholdPercentage) {
      await NotificationService.notify({
        userId: actorId || claim.employeeId,
        type: 'BUDGET_WARNING',
        title: `Budget Alert: ${updatedBudget.name}`,
        message: `Budget "${updatedBudget.name}" has reached ${utilization.toFixed(1)}% utilization.`,
        relatedEntityType: 'Budget',
        relatedEntityId: updatedBudget._id,
        session,
      });
    }

    return reservation;
  }

  /**
   * Release reserved budget when a claim is rejected or withdrawn
   */
  static async releaseBudgetForClaim({ claim, actorId = null, reason = '', session = null }) {
    const updateOptions = { new: true };
    if (session) updateOptions.session = session;

    // Atomically transition reservation status to prevent concurrent double-release
    const reservation = await BudgetReservation.findOneAndUpdate(
      { claimId: claim._id, status: 'ACTIVE' },
      { status: 'RELEASED', releasedAt: new Date() },
      updateOptions
    );

    if (!reservation) {
      return null; // No active reservation to release
    }

    // Decrement committedAmount atomically
    const updatedBudget = await Budget.findByIdAndUpdate(
      reservation.budgetId,
      { $inc: { committedAmount: -reservation.amount } },
      updateOptions
    );

    if (updatedBudget) {
      await AuditService.log({
        actorId,
        action: 'BUDGET_RELEASED',
        entityType: 'Budget',
        entityId: updatedBudget._id,
        after: { committedAmount: updatedBudget.committedAmount },
        reason: reason || `Claim ${claim.claimNumber} released`,
        session,
      });
    }

    return reservation;
  }

  /**
   * Fulfill budget reservation upon reimbursement completion
   * Decrements committedAmount and increments actualAmount atomically (NO double-counting!)
   */
  static async fulfillBudgetForClaim({ claim, actorId = null, session = null }) {
    const updateOptions = { new: true };
    if (session) updateOptions.session = session;

    // Atomically transition reservation status to prevent concurrent double-fulfillment
    const reservation = await BudgetReservation.findOneAndUpdate(
      { claimId: claim._id, status: 'ACTIVE' },
      { status: 'FULFILLED', fulfilledAt: new Date() },
      updateOptions
    );

    if (!reservation) {
      // If unbudgeted or already fulfilled
      return null;
    }

    // Atomically transition from committed -> actual
    const updatedBudget = await Budget.findByIdAndUpdate(
      reservation.budgetId,
      {
        $inc: {
          committedAmount: -reservation.amount,
          actualAmount: reservation.amount,
        },
      },
      updateOptions
    );

    if (updatedBudget) {
      await AuditService.log({
        actorId,
        action: 'BUDGET_FULFILLED',
        entityType: 'Budget',
        entityId: updatedBudget._id,
        after: {
          committedAmount: updatedBudget.committedAmount,
          actualAmount: updatedBudget.actualAmount,
        },
        reason: `Reimbursement completed for ${claim.claimNumber}`,
        session,
      });
    }

    return reservation;
  }
}

module.exports = BudgetService;
