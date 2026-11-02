const mongoose = require('mongoose');

const delegationRecordSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    delegatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const workflowStepInstanceSchema = new mongoose.Schema(
  {
    stepNumber: {
      type: Number,
      required: true,
    },
    stepName: {
      type: String,
      required: true,
    },
    approverRole: {
      type: String,
      enum: ['manager', 'finance', 'admin', 'specific_user'],
      required: true,
    },
    assignedApproverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['WAITING', 'PENDING', 'APPROVED', 'REJECTED', 'INFO_REQUESTED', 'SKIPPED'],
      default: 'WAITING',
      index: true,
    },
    decision: {
      type: String,
      enum: ['APPROVE', 'REJECT', 'REQUEST_INFO', null],
      default: null,
    },
    comments: {
      type: String,
      default: '',
    },
    actionAt: {
      type: Date,
      default: null,
    },
    actedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    delegationHistory: [delegationRecordSchema],
  },
  { _id: true }
);

const approvalWorkflowSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseClaim',
      required: true,
      unique: true, // One active workflow per claim
      index: true,
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalPolicy',
      required: true,
    },
    policyVersion: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'],
      default: 'IN_PROGRESS',
      index: true,
    },
    currentStepIndex: {
      type: Number,
      default: 0,
    },
    steps: [workflowStepInstanceSchema],
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

approvalWorkflowSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('ApprovalWorkflow', approvalWorkflowSchema);
