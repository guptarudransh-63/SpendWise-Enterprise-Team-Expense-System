const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'CLAIM_SUBMITTED',
        'APPROVAL_ASSIGNED',
        'CLAIM_APPROVED',
        'CLAIM_REJECTED',
        'INFO_REQUESTED',
        'CLAIM_RESUBMITTED',
        'REIMBURSEMENT_SCHEDULED',
        'REIMBURSEMENT_COMPLETED',
        'BUDGET_WARNING',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedEntityType: {
      type: String,
      enum: ['ExpenseClaim', 'ApprovalWorkflow', 'Budget', 'Reimbursement'],
      default: 'ExpenseClaim',
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Notification', notificationSchema);
