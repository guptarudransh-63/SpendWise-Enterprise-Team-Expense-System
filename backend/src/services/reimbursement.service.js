const Reimbursement = require('../models/Reimbursement');
const ExpenseClaim = require('../models/ExpenseClaim');
const BudgetService = require('./budget.service');
const AuditService = require('./audit.service');
const NotificationService = require('./notification.service');
const { withTransaction } = require('../config/db');

class ReimbursementService {
  /**
   * Schedule reimbursement for an approved claim
   */
  static async scheduleReimbursement({ claimId, scheduledAt, notes = '', actor }) {
    return withTransaction(async (session) => {
      let query = ExpenseClaim.findById(claimId);
      if (session) query = query.session(session);
      const claim = await query;

      if (!claim) {
        const err = new Error('Expense claim not found');
        err.statusCode = 404;
        throw err;
      }

      if (claim.status !== 'APPROVED') {
        const err = new Error(`Cannot schedule reimbursement. Claim status is "${claim.status}", expected "APPROVED".`);
        err.statusCode = 409;
        throw err;
      }

      let reimbQuery = Reimbursement.findOne({ claimId });
      if (session) reimbQuery = reimbQuery.session(session);
      let reimbursement = await reimbQuery;

      if (!reimbursement) {
        reimbursement = new Reimbursement({
          claimId: claim._id,
          amount: claim.amount,
          currency: claim.currency,
          status: 'SCHEDULED',
          scheduledAt: new Date(scheduledAt),
          processedBy: actor._id,
          notes,
        });
      } else {
        reimbursement.status = 'SCHEDULED';
        reimbursement.scheduledAt = new Date(scheduledAt);
        reimbursement.processedBy = actor._id;
        reimbursement.notes = notes;
      }

      claim.status = 'SCHEDULED';

      if (session) {
        await reimbursement.save({ session });
        await claim.save({ session });
      } else {
        await reimbursement.save();
        await claim.save();
      }

      await NotificationService.notify({
        userId: claim.employeeId,
        type: 'REIMBURSEMENT_SCHEDULED',
        title: 'Reimbursement Scheduled',
        message: `Reimbursement for claim "${claim.title}" (${claim.claimNumber}) is scheduled for ${new Date(scheduledAt).toLocaleDateString()}.`,
        relatedEntityType: 'Reimbursement',
        relatedEntityId: reimbursement._id,
        session,
      });

      await AuditService.log({
        actorId: actor._id,
        action: 'REIMBURSEMENT_SCHEDULED',
        entityType: 'Reimbursement',
        entityId: reimbursement._id,
        after: { scheduledAt, status: 'SCHEDULED' },
        reason: notes,
        session,
      });

      return reimbursement;
    });
  }

  /**
   * Mark reimbursement as completed (PAID) - Idempotent
   */
  static async completeReimbursement({ claimId, paymentReference, paidAt = new Date(), notes = '', actor }) {
    return withTransaction(async (session) => {
      let query = ExpenseClaim.findById(claimId);
      if (session) query = query.session(session);
      const claim = await query;

      if (!claim) {
        const err = new Error('Expense claim not found');
        err.statusCode = 404;
        throw err;
      }

      // Check for idempotency: if already PAID, return existing completed reimbursement
      let reimbQuery = Reimbursement.findOne({ claimId });
      if (session) reimbQuery = reimbQuery.session(session);
      let reimbursement = await reimbQuery;

      if (reimbursement && reimbursement.status === 'PAID') {
        // Idempotent return: already marked as paid
        return reimbursement;
      }

      if (claim.status !== 'APPROVED' && claim.status !== 'SCHEDULED') {
        const err = new Error(`Cannot complete reimbursement. Claim status is "${claim.status}". Only APPROVED or SCHEDULED claims can be paid.`);
        err.statusCode = 409;
        throw err;
      }

      if (!reimbursement) {
        reimbursement = new Reimbursement({
          claimId: claim._id,
          amount: claim.amount,
          currency: claim.currency,
          status: 'PAID',
          paymentReference,
          paidAt: new Date(paidAt),
          processedBy: actor._id,
          notes,
        });
      } else {
        reimbursement.status = 'PAID';
        reimbursement.paymentReference = paymentReference;
        reimbursement.paidAt = new Date(paidAt);
        reimbursement.processedBy = actor._id;
        if (notes) reimbursement.notes = notes;
      }

      claim.status = 'PAID';

      if (session) {
        await reimbursement.save({ session });
        await claim.save({ session });
      } else {
        await reimbursement.save();
        await claim.save();
      }

      // Atomically fulfill budget reservation: committedAmount -> actualAmount (NO double counting)
      await BudgetService.fulfillBudgetForClaim({
        claim,
        actorId: actor._id,
        session,
      });

      await NotificationService.notify({
        userId: claim.employeeId,
        type: 'REIMBURSEMENT_COMPLETED',
        title: 'Reimbursement Completed',
        message: `Reimbursement of ${claim.currency} ${claim.amount.toFixed(2)} for "${claim.title}" has been paid (Ref: ${paymentReference}).`,
        relatedEntityType: 'Reimbursement',
        relatedEntityId: reimbursement._id,
        session,
      });

      await AuditService.log({
        actorId: actor._id,
        action: 'REIMBURSEMENT_COMPLETED',
        entityType: 'Reimbursement',
        entityId: reimbursement._id,
        after: { paymentReference, paidAt, status: 'PAID' },
        reason: notes || `Payment completed by ${actor.name}`,
        session,
      });

      return reimbursement;
    });
  }
}

module.exports = ReimbursementService;
