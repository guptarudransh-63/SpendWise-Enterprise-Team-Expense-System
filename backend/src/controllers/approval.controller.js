const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const ExpenseClaim = require('../models/ExpenseClaim');
const ApprovalStateMachine = require('../services/approvalStateMachine.service');

exports.getApprovalInbox = async (req, res, next) => {
  try {
    const filter = { status: 'IN_PROGRESS' };

    // For non-admin, filter workflows where the step is pending for this user or finance role
    if (req.user.role === 'finance') {
      filter.$or = [
        { 'steps.assignedApproverId': req.user._id, 'steps.status': 'PENDING' },
        { 'steps.approverRole': 'finance', 'steps.status': 'PENDING' },
      ];
    } else if (req.user.role !== 'admin') {
      filter.$or = [
        { 'steps.assignedApproverId': req.user._id, 'steps.status': 'PENDING' },
      ];
    }

    const workflows = await ApprovalWorkflow.find(filter)
      .populate({
        path: 'claimId',
        populate: [
          { path: 'employeeId', select: 'name email role departmentId' },
          { path: 'categoryId', select: 'name code' },
          { path: 'departmentId', select: 'name costCenter' },
          { path: 'receiptIds' },
        ],
      })
      .populate('steps.assignedApproverId', 'name email role')
      .populate('policyId', 'name priority allowSelfApproval')
      .sort({ createdAt: -1 });

    // Filter down to workflows where the active step belongs to this user (or user is admin or finance on finance step)
    const inboxItems = workflows.filter((wf) => {
      if (!wf.claimId) return false;
      if (req.user.role === 'admin') return true;
      const currentStep = wf.steps[wf.currentStepIndex];
      if (!currentStep || currentStep.status !== 'PENDING') return false;

      const approverId = (currentStep.assignedApproverId?._id || currentStep.assignedApproverId)?.toString();
      const isAssigned = approverId === req.user._id.toString();
      const isFinanceRole = req.user.role === 'finance' && currentStep.approverRole === 'finance';

      return isAssigned || isFinanceRole;
    });

    res.status(200).json({
      success: true,
      count: inboxItems.length,
      data: inboxItems,
    });
  } catch (error) {
    next(error);
  }
};

exports.getWorkflowById = async (req, res, next) => {
  try {
    const workflow = await ApprovalWorkflow.findById(req.params.workflowId)
      .populate('claimId')
      .populate('policyId')
      .populate('steps.assignedApproverId', 'name email role')
      .populate('steps.actedBy', 'name email role');

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Approval workflow not found',
      });
    }

    res.status(200).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
};

exports.approveStep = async (req, res, next) => {
  try {
    const { workflowId, stepId } = req.params;
    const { comments } = req.body;

    const result = await ApprovalStateMachine.approveStep({
      workflowId,
      stepId,
      actor: req.user,
      comments,
    });

    res.status(200).json({
      success: true,
      message: 'Approval step approved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectStep = async (req, res, next) => {
  try {
    const { workflowId, stepId } = req.params;
    const { reason } = req.body;

    const result = await ApprovalStateMachine.rejectStep({
      workflowId,
      stepId,
      actor: req.user,
      reason,
    });

    res.status(200).json({
      success: true,
      message: 'Claim has been rejected and budget reservation released.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.requestInformation = async (req, res, next) => {
  try {
    const { workflowId, stepId } = req.params;
    const { comments } = req.body;

    const result = await ApprovalStateMachine.requestInfo({
      workflowId,
      stepId,
      actor: req.user,
      comments,
    });

    res.status(200).json({
      success: true,
      message: 'Additional information requested from employee.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.reassignStep = async (req, res, next) => {
  try {
    const { workflowId, stepId } = req.params;
    const { newApproverId, reason } = req.body;

    const result = await ApprovalStateMachine.reassignStep({
      workflowId,
      stepId,
      actor: req.user,
      newApproverId,
      reason,
    });

    res.status(200).json({
      success: true,
      message: 'Approval step reassigned successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
