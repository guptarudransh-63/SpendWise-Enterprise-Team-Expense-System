const mongoose = require('mongoose');

const approvalStepSchema = new mongoose.Schema(
  {
    stepNumber: {
      type: Number,
      required: true,
    },
    stepName: {
      type: String,
      required: true,
      trim: true,
    },
    approverRole: {
      type: String,
      enum: ['manager', 'finance', 'admin', 'specific_user'],
      required: true,
    },
    specificUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: true }
);

const approvalPolicySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Policy name is required'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      default: '',
    },
    priority: {
      type: Number,
      default: 10, // Lower number = higher priority
      index: true,
    },
    conditions: {
      minAmount: {
        type: Number,
        default: 0,
      },
      maxAmount: {
        type: Number,
        default: null, // null = unbounded
      },
      departmentIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Department',
        },
      ],
      categoryIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ExpenseCategory',
        },
      ],
      requiresReceipt: {
        type: Boolean,
        default: true,
      },
    },
    approvalSteps: {
      type: [approvalStepSchema],
      validate: [
        (steps) => steps.length > 0,
        'At least one approval step is required',
      ],
    },
    allowSelfApproval: {
      type: Boolean,
      default: false, // Strict default: employees/managers can never self-approve
    },
    version: {
      type: Number,
      default: 1,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

approvalPolicySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('ApprovalPolicy', approvalPolicySchema);
