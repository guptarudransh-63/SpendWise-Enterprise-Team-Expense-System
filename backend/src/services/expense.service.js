const ExpenseClaim = require('../models/ExpenseClaim');
const ExpenseCategory = require('../models/ExpenseCategory');
const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const User = require('../models/User');
const Budget = require('../models/Budget');
const BudgetReservation = require('../models/BudgetReservation');
const ApprovalPolicyService = require('./approvalPolicy.service');
const BudgetService = require('./budget.service');
const AuditService = require('./audit.service');
const NotificationService = require('./notification.service');
const { withTransaction } = require('../config/db');

class ExpenseService {
  /**
   * Generate human-readable claim number: EXP-YYYY-XXXXX
   */
  static async generateClaimNumber() {
    const year = new Date().getFullYear();
    const count = await ExpenseClaim.countDocuments();
    const sequence = String(count + 1).padStart(5, '0');
    return `EXP-${year}-${sequence}`;
  }

  /**
   * Create a draft expense claim
   */
  static async createDraft(data, user) {
    const claimNumber = await this.generateClaimNumber();

    const category = await ExpenseCategory.findById(data.categoryId);
    if (!category || category.status !== 'active') {
      const err = new Error('Selected expense category is invalid or inactive');
      err.statusCode = 400;
      throw err;
    }

    const claim = new ExpenseClaim({
      ...data,
      claimNumber,
      employeeId: user._id,
      departmentId: data.departmentId || user.departmentId,
      status: 'DRAFT',
    });

    await claim.save();

    await AuditService.log({
      actorId: user._id,
      action: 'CLAIM_CREATED_DRAFT',
      entityType: 'ExpenseClaim',
      entityId: claim._id,
      after: { claimNumber: claim.claimNumber, amount: claim.amount },
    });

    return claim;
  }

  /**
   * Edit an eligible draft claim
   */
  static async updateDraft(id, data, user) {
    const claim = await ExpenseClaim.findById(id);

    if (!claim) {
      const err = new Error('Expense claim not found');
      err.statusCode = 404;
      throw err;
    }

    // Ownership check
    if (claim.employeeId.toString() !== user._id.toString() && user.role !== 'admin') {
      const err = new Error('You do not have permission to edit this claim');
      err.statusCode = 403;
      throw err;
    }

    // Strict Draft Check: Only DRAFT claims can be edited through draft endpoints!
    if (claim.status !== 'DRAFT') {
      const err = new Error(`Only draft claims can be edited. Current status is "${claim.status}".`);
      err.statusCode = 409;
      throw err;
    }

    const beforeState = claim.toObject();
    Object.assign(claim, data);
    await claim.save();

    await AuditService.log({
      actorId: user._id,
      action: 'CLAIM_DRAFT_UPDATED',
      entityType: 'ExpenseClaim',
      entityId: claim._id,
      before: beforeState,
      after: claim.toObject(),
    });

    return claim;
  }

  /**
   * Submit a claim for approval
   */
  static async submitClaim(id, user, options = {}) {
    return withTransaction(async (session) => {
      let query = ExpenseClaim.findById(id);
      if (session) query = query.session(session);
      const claim = await query;

      if (!claim) {
        const err = new Error('Expense claim not found');
        err.statusCode = 404;
        throw err;
      }

      if (claim.employeeId.toString() !== user._id.toString() && user.role !== 'admin') {
        const err = new Error('You cannot submit another employee\'s claim');
        err.statusCode = 403;
        throw err;
      }

      if (claim.status !== 'DRAFT') {
        const err = new Error(`Claim cannot be submitted from current status "${claim.status}".`);
        err.statusCode = 409;
        throw err;
      }

      // 1. Enforce Category Receipt Requirements
      const category = await ExpenseCategory.findById(claim.categoryId);
      if (category && category.receiptRequired && (!claim.receiptIds || claim.receiptIds.length === 0)) {
        const err = new Error(`Category "${category.name}" requires at least one receipt attachment before submission.`);
        err.statusCode = 400;
        throw err;
      }

      // 2. Find and pin applicable Approval Policy
      const policy = await ApprovalPolicyService.matchPolicy(claim, session);
      if (!policy) {
        const err = new Error('No applicable approval policy found for this expense claim amount and department.');
        err.statusCode = 422;
        throw err;
      }

      const employeeUser = await User.findById(claim.employeeId);
      const steps = await ApprovalPolicyService.instantiateSteps({
        policy,
        claim,
        employeeUser,
        session,
      });

      // 3. Atomically Reserve Budget
      await BudgetService.reserveBudgetForClaim({
        claim,
        actorId: user._id,
        override: options.override || false,
        overrideReason: options.overrideReason || '',
        session,
      });

      // 4. Create Approval Workflow
      const workflow = new ApprovalWorkflow({
        claimId: claim._id,
        policyId: policy._id,
        policyVersion: policy.version,
        status: 'IN_PROGRESS',
        currentStepIndex: 0,
        steps: steps,
      });

      if (session) {
        await workflow.save({ session });
      } else {
        await workflow.save();
      }

      // 5. Update Claim State
      claim.status = 'UNDER_REVIEW';
      claim.policyId = policy._id;
      claim.policyVersion = policy.version;
      claim.activeWorkflowId = workflow._id;
      claim.submittedAt = new Date();

      if (session) {
        await claim.save({ session });
      } else {
        await claim.save();
      }

      // 6. Notify first assigned approver
      const firstStep = steps[0];
      if (firstStep && firstStep.assignedApproverId) {
        await NotificationService.notify({
          userId: firstStep.assignedApproverId,
          type: 'APPROVAL_ASSIGNED',
          title: 'New Expense Claim Pending Approval',
          message: `${user.name} submitted claim "${claim.title}" (${claim.claimNumber}) for ${claim.currency} ${claim.amount.toFixed(2)}.`,
          relatedEntityType: 'ExpenseClaim',
          relatedEntityId: claim._id,
          session,
        });
      }

      // 7. Audit Log
      await AuditService.log({
        actorId: user._id,
        action: 'CLAIM_SUBMITTED',
        entityType: 'ExpenseClaim',
        entityId: claim._id,
        after: {
          status: claim.status,
          policyId: policy._id,
          workflowId: workflow._id,
        },
        session,
      });

      return { claim, workflow };
    });
  }

  /**
   * Withdraw an eligible claim
   */
  static async withdrawClaim(id, user, reason = '') {
    return withTransaction(async (session) => {
      let query = ExpenseClaim.findById(id);
      if (session) query = query.session(session);
      const claim = await query;

      if (!claim) {
        const err = new Error('Expense claim not found');
        err.statusCode = 404;
        throw err;
      }

      if (claim.employeeId.toString() !== user._id.toString() && user.role !== 'admin') {
        const err = new Error('You do not have permission to withdraw this claim');
        err.statusCode = 403;
        throw err;
      }

      const withdrawableStates = ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED'];
      if (!withdrawableStates.includes(claim.status)) {
        const err = new Error(`Cannot withdraw claim in "${claim.status}" status.`);
        err.statusCode = 409;
        throw err;
      }

      // Cancel workflow
      if (claim.activeWorkflowId) {
        let wfQuery = ApprovalWorkflow.findById(claim.activeWorkflowId);
        if (session) wfQuery = wfQuery.session(session);
        const workflow = await wfQuery;
        if (workflow) {
          workflow.status = 'WITHDRAWN';
          if (session) await workflow.save({ session });
          else await workflow.save();
        }
      }

      // Atomically release reserved budget
      await BudgetService.releaseBudgetForClaim({
        claim,
        actorId: user._id,
        reason: reason || 'Withdrawn by employee',
        session,
      });

      claim.status = 'WITHDRAWN';
      if (session) await claim.save({ session });
      else await claim.save();

      await AuditService.log({
        actorId: user._id,
        action: 'CLAIM_WITHDRAWN',
        entityType: 'ExpenseClaim',
        entityId: claim._id,
        reason,
        session,
      });

      return claim;
    });
  }

  /**
   * Resubmit claim after changes requested
   */
  static async resubmitClaim(id, updates, user) {
    return withTransaction(async (session) => {
      let query = ExpenseClaim.findById(id);
      if (session) query = query.session(session);
      const claim = await query;

      if (!claim) {
        const err = new Error('Expense claim not found');
        err.statusCode = 404;
        throw err;
      }

      if (claim.employeeId.toString() !== user._id.toString()) {
        const err = new Error('Only the claim owner can resubmit');
        err.statusCode = 403;
        throw err;
      }

      if (claim.status !== 'CHANGES_REQUESTED') {
        const err = new Error(`Cannot resubmit claim. Status is "${claim.status}", expected "CHANGES_REQUESTED".`);
        err.statusCode = 409;
        throw err;
      }

      // Apply modifications
      if (updates.title) claim.title = updates.title;
      if (updates.description !== undefined) claim.description = updates.description;
      if (updates.merchant) claim.merchant = updates.merchant;
      if (updates.businessPurpose) claim.businessPurpose = updates.businessPurpose;
      if (updates.submissionNotes) claim.submissionNotes = updates.submissionNotes;
      if (updates.receiptIds) claim.receiptIds = updates.receiptIds;

      // Adjust budget reservation if amount is updated
      if (updates.amount && Number(updates.amount) !== claim.amount) {
        const newAmount = Number(updates.amount);
        const delta = newAmount - claim.amount;

        let resQuery = BudgetReservation.findOne({ claimId: claim._id, status: 'ACTIVE' });
        if (session) resQuery = resQuery.session(session);
        const reservation = await resQuery;

        if (reservation) {
          if (delta > 0) {
            let bQuery = Budget.findById(reservation.budgetId);
            if (session) bQuery = bQuery.session(session);
            const budget = await bQuery;
            if (budget && !budget.policy.allowOverrun) {
              const available = budget.allocatedAmount - (budget.committedAmount + budget.actualAmount);
              if (available < delta) {
                const err = new Error(
                  `Insufficient budget in "${budget.name}" for increased amount. Available: ${budget.currency} ${available.toFixed(2)}.`
                );
                err.statusCode = 409;
                throw err;
              }
            }
          }

          const updateOpts = { new: true };
          if (session) updateOpts.session = session;
          await Budget.findByIdAndUpdate(
            reservation.budgetId,
            { $inc: { committedAmount: delta } },
            updateOpts
          );

          reservation.amount = newAmount;
          if (session) await reservation.save({ session });
          else await reservation.save();
        }

        claim.amount = newAmount;
      }

      claim.status = 'UNDER_REVIEW';

      // Reset current workflow step to PENDING
      if (claim.activeWorkflowId) {
        let wfQuery = ApprovalWorkflow.findById(claim.activeWorkflowId);
        if (session) wfQuery = wfQuery.session(session);
        const workflow = await wfQuery;

        if (workflow) {
          const step = workflow.steps[workflow.currentStepIndex];
          if (step) {
            step.status = 'PENDING';
            step.decision = null;
          }
          if (session) await workflow.save({ session });
          else await workflow.save();

          // Notify approver
          await NotificationService.notify({
            userId: step.assignedApproverId,
            type: 'CLAIM_RESUBMITTED',
            title: 'Expense Claim Resubmitted',
            message: `${user.name} responded to requested changes for "${claim.title}" (${claim.claimNumber}).`,
            relatedEntityType: 'ExpenseClaim',
            relatedEntityId: claim._id,
            session,
          });
        }
      }

      if (session) await claim.save({ session });
      else await claim.save();

      await AuditService.log({
        actorId: user._id,
        action: 'CLAIM_RESUBMITTED',
        entityType: 'ExpenseClaim',
        entityId: claim._id,
        after: { status: claim.status, amount: claim.amount },
        session,
      });

      return claim;
    });
  }
}

module.exports = ExpenseService;
