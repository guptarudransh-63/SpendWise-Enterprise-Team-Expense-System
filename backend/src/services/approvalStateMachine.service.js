const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const ExpenseClaim = require('../models/ExpenseClaim');
const ApprovalPolicy = require('../models/ApprovalPolicy');
const BudgetService = require('./budget.service');
const AuditService = require('./audit.service');
const NotificationService = require('./notification.service');

class ApprovalStateMachine {
  /**
   * Validate that actor is authorized to act on this step, including self-approval rules
   */
  static async validateActorAuthority({ workflow, step, actor, policy, session = null }) {
    // 1. Self-approval rule
    let claimQuery = ExpenseClaim.findById(workflow.claimId);
    if (session) claimQuery = claimQuery.session(session);
    const claim = await claimQuery;

    if (!claim) {
      const err = new Error('Associated expense claim not found');
      err.statusCode = 404;
      throw err;
    }

    const employeeId = (claim.employeeId?._id || claim.employeeId).toString();
    const isSelf = employeeId === actor._id.toString();
    const allowSelf = policy ? policy.allowSelfApproval : false;

    if (isSelf && !allowSelf) {
      const err = new Error('Organizational policy strictly prohibits self-approval of expense claims.');
      err.statusCode = 403;
      throw err;
    }

    // 2. Assigned approver or Admin role
    const assignedId = (step.assignedApproverId?._id || step.assignedApproverId).toString();
    const isAssigned = assignedId === actor._id.toString();
    const isAdmin = actor.role === 'admin';
    const isFinanceOnFinanceStep = actor.role === 'finance' && step.approverRole === 'finance';

    if (!isAssigned && !isAdmin && !isFinanceOnFinanceStep) {
      const err = new Error('You are not authorized to act on this approval step.');
      err.statusCode = 403;
      throw err;
    }

    return claim;
  }

  /**
   * Approve current workflow step
   */
  static async approveStep({ workflowId, stepId, actor, comments = 'Approved', session = null }) {
    // Atomic retrieval & verification of workflow and active step
    let query = ApprovalWorkflow.findById(workflowId);
    if (session) query = query.session(session);
    const workflow = await query;

    if (!workflow) {
      const err = new Error('Approval workflow not found');
      err.statusCode = 404;
      throw err;
    }

    if (workflow.status !== 'IN_PROGRESS') {
      const err = new Error(`Cannot approve step. Workflow is in "${workflow.status}" state.`);
      err.statusCode = 409;
      throw err;
    }

    const currentStep = workflow.steps[workflow.currentStepIndex];
    if (!currentStep || currentStep._id.toString() !== stepId.toString()) {
      const err = new Error('Invalid or out-of-order approval step. You may only act on the current pending step.');
      err.statusCode = 409;
      throw err;
    }

    if (currentStep.status !== 'PENDING') {
      const err = new Error(`Step has already been acted upon (Status: ${currentStep.status}).`);
      err.statusCode = 409;
      throw err;
    }

    const policy = await ApprovalPolicy.findById(workflow.policyId);
    const claim = await this.validateActorAuthority({ workflow, step: currentStep, actor, policy, session });

    // Mark current step as APPROVED
    currentStep.status = 'APPROVED';
    currentStep.decision = 'APPROVE';
    currentStep.comments = comments;
    currentStep.actionAt = new Date();
    currentStep.actedBy = actor._id;

    const isFinalStep = workflow.currentStepIndex === workflow.steps.length - 1;

    if (isFinalStep) {
      // Entire workflow is APPROVED
      workflow.status = 'APPROVED';
      workflow.completedAt = new Date();

      // Update Claim to APPROVED
      claim.status = 'APPROVED';
      if (session) {
        await claim.save({ session });
      } else {
        await claim.save();
      }

      // Notify employee & finance team
      await NotificationService.notify({
        userId: claim.employeeId,
        type: 'CLAIM_APPROVED',
        title: 'Expense Claim Approved',
        message: `Your claim "${claim.title}" (${claim.claimNumber}) has received final approval and is queued for reimbursement.`,
        relatedEntityType: 'ExpenseClaim',
        relatedEntityId: claim._id,
        session,
      });
    } else {
      // Advance to next step
      workflow.currentStepIndex += 1;
      const nextStep = workflow.steps[workflow.currentStepIndex];
      nextStep.status = 'PENDING';

      // Notify next approver
      await NotificationService.notify({
        userId: nextStep.assignedApproverId,
        type: 'APPROVAL_ASSIGNED',
        title: 'New Expense Claim for Review',
        message: `Claim "${claim.title}" (${claim.claimNumber}) requires your approval (Step: ${nextStep.stepName}).`,
        relatedEntityType: 'ExpenseClaim',
        relatedEntityId: claim._id,
        session,
      });
    }

    if (session) {
      await workflow.save({ session });
    } else {
      await workflow.save();
    }

    // Audit log
    await AuditService.log({
      actorId: actor._id,
      action: isFinalStep ? 'CLAIM_FULLY_APPROVED' : 'APPROVAL_STEP_APPROVED',
      entityType: 'ExpenseClaim',
      entityId: claim._id,
      after: {
        stepNumber: currentStep.stepNumber,
        stepName: currentStep.stepName,
        workflowStatus: workflow.status,
        claimStatus: claim.status,
      },
      reason: comments,
      session,
    });

    return { workflow, claim };
  }

  /**
   * Reject workflow step
   */
  static async rejectStep({ workflowId, stepId, actor, reason, session = null }) {
    let query = ApprovalWorkflow.findById(workflowId);
    if (session) query = query.session(session);
    const workflow = await query;

    if (!workflow) {
      const err = new Error('Approval workflow not found');
      err.statusCode = 404;
      throw err;
    }

    if (workflow.status !== 'IN_PROGRESS') {
      const err = new Error(`Cannot reject step. Workflow is in "${workflow.status}" state.`);
      err.statusCode = 409;
      throw err;
    }

    const currentStep = workflow.steps[workflow.currentStepIndex];
    if (!currentStep || currentStep._id.toString() !== stepId.toString()) {
      const err = new Error('Invalid or out-of-order approval step.');
      err.statusCode = 409;
      throw err;
    }

    if (currentStep.status !== 'PENDING') {
      const err = new Error(`Step has already been acted upon (Status: ${currentStep.status}).`);
      err.statusCode = 409;
      throw err;
    }

    const policy = await ApprovalPolicy.findById(workflow.policyId);
    const claim = await this.validateActorAuthority({ workflow, step: currentStep, actor, policy, session });

    // Mark step rejected
    currentStep.status = 'REJECTED';
    currentStep.decision = 'REJECT';
    currentStep.comments = reason;
    currentStep.actionAt = new Date();
    currentStep.actedBy = actor._id;

    // Workflow marked REJECTED
    workflow.status = 'REJECTED';
    workflow.completedAt = new Date();

    // Claim marked REJECTED
    claim.status = 'REJECTED';

    if (session) {
      await workflow.save({ session });
      await claim.save({ session });
    } else {
      await workflow.save();
      await claim.save();
    }

    // Release budget reservation atomically
    await BudgetService.releaseBudgetForClaim({
      claim,
      actorId: actor._id,
      reason: `Claim rejected by ${actor.name}: ${reason}`,
      session,
    });

    // Notify employee
    await NotificationService.notify({
      userId: claim.employeeId,
      type: 'CLAIM_REJECTED',
      title: 'Expense Claim Rejected',
      message: `Your claim "${claim.title}" (${claim.claimNumber}) was rejected by ${actor.name}. Reason: ${reason}`,
      relatedEntityType: 'ExpenseClaim',
      relatedEntityId: claim._id,
      session,
    });

    // Audit log
    await AuditService.log({
      actorId: actor._id,
      action: 'CLAIM_REJECTED',
      entityType: 'ExpenseClaim',
      entityId: claim._id,
      after: {
        workflowStatus: 'REJECTED',
        claimStatus: 'REJECTED',
        stepNumber: currentStep.stepNumber,
      },
      reason,
      session,
    });

    return { workflow, claim };
  }

  /**
   * Request additional information on current step
   */
  static async requestInfo({ workflowId, stepId, actor, comments, session = null }) {
    let query = ApprovalWorkflow.findById(workflowId);
    if (session) query = query.session(session);
    const workflow = await query;

    if (!workflow) {
      const err = new Error('Approval workflow not found');
      err.statusCode = 404;
      throw err;
    }

    if (workflow.status !== 'IN_PROGRESS') {
      const err = new Error(`Cannot request info. Workflow is in "${workflow.status}" state.`);
      err.statusCode = 409;
      throw err;
    }

    const currentStep = workflow.steps[workflow.currentStepIndex];
    if (!currentStep || currentStep._id.toString() !== stepId.toString()) {
      const err = new Error('Invalid step ID.');
      err.statusCode = 409;
      throw err;
    }

    const policy = await ApprovalPolicy.findById(workflow.policyId);
    const claim = await this.validateActorAuthority({ workflow, step: currentStep, actor, policy, session });

    currentStep.status = 'INFO_REQUESTED';
    currentStep.decision = 'REQUEST_INFO';
    currentStep.comments = comments;
    currentStep.actionAt = new Date();
    currentStep.actedBy = actor._id;

    claim.status = 'CHANGES_REQUESTED';

    if (session) {
      await workflow.save({ session });
      await claim.save({ session });
    } else {
      await workflow.save();
      await claim.save();
    }

    // Notify employee
    await NotificationService.notify({
      userId: claim.employeeId,
      type: 'INFO_REQUESTED',
      title: 'Additional Information Requested',
      message: `${actor.name} requested changes on "${claim.title}": ${comments}`,
      relatedEntityType: 'ExpenseClaim',
      relatedEntityId: claim._id,
      session,
    });

    // Audit log
    await AuditService.log({
      actorId: actor._id,
      action: 'ADDITIONAL_INFO_REQUESTED',
      entityType: 'ExpenseClaim',
      entityId: claim._id,
      reason: comments,
      session,
    });

    return { workflow, claim };
  }

  /**
   * Reassign or delegate approval step to another user
   */
  static async reassignStep({ workflowId, stepId, actor, newApproverId, reason, session = null }) {
    let query = ApprovalWorkflow.findById(workflowId);
    if (session) query = query.session(session);
    const workflow = await query;

    if (!workflow) {
      const err = new Error('Approval workflow not found');
      err.statusCode = 404;
      throw err;
    }

    const currentStep = workflow.steps.find((s) => s._id.toString() === stepId.toString());
    if (!currentStep || currentStep.status !== 'PENDING') {
      const err = new Error('Can only reassign a pending approval step.');
      err.statusCode = 409;
      throw err;
    }

    // Only current assigned approver or Admin can delegate
    const currentApproverId = (currentStep.assignedApproverId?._id || currentStep.assignedApproverId).toString();
    if (currentApproverId !== actor._id.toString() && actor.role !== 'admin') {
      const err = new Error('You do not have authority to reassign this approval step.');
      err.statusCode = 403;
      throw err;
    }

    const previousApproverId = currentStep.assignedApproverId;
    currentStep.assignedApproverId = newApproverId;
    currentStep.delegationHistory.push({
      fromUserId: previousApproverId,
      toUserId: newApproverId,
      reason,
      delegatedAt: new Date(),
    });

    if (session) {
      await workflow.save({ session });
    } else {
      await workflow.save();
    }

    // Notify new approver
    await NotificationService.notify({
      userId: newApproverId,
      type: 'APPROVAL_ASSIGNED',
      title: 'Approval Delegated to You',
      message: `An expense approval was delegated to you by ${actor.name}. Reason: ${reason}`,
      relatedEntityType: 'ApprovalWorkflow',
      relatedEntityId: workflow._id,
      session,
    });

    // Audit log
    await AuditService.log({
      actorId: actor._id,
      action: 'APPROVAL_REASSIGNED',
      entityType: 'ApprovalWorkflow',
      entityId: workflow._id,
      before: { assignedApproverId: previousApproverId },
      after: { assignedApproverId: newApproverId },
      reason,
      session,
    });

    return workflow;
  }
}

module.exports = ApprovalStateMachine;
