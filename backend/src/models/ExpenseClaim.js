const mongoose = require('mongoose');

const expenseClaimSchema = new mongoose.Schema(
  {
    claimNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Claim title is required'],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: [true, 'Expense category is required'],
      index: true,
    },
    expenseDate: {
      type: Date,
      required: [true, 'Expense date is required'],
    },
    merchant: {
      type: String,
      required: [true, 'Merchant / vendor is required'],
      trim: true,
      maxlength: 100,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      default: 'INR',
      uppercase: true,
      enum: ['INR', 'USD', 'EUR', 'GBP'],
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
      index: true,
    },
    costCenterId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    paymentMethod: {
      type: String,
      enum: ['corporate_card', 'personal_card', 'cash', 'bank_transfer'],
      default: 'personal_card',
    },
    businessPurpose: {
      type: String,
      required: [true, 'Business purpose is required'],
      trim: true,
    },
    submissionNotes: {
      type: String,
      trim: true,
      default: '',
    },
    receiptIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ReceiptAttachment',
      },
    ],
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'CHANGES_REQUESTED',
        'APPROVED',
        'REJECTED',
        'WITHDRAWN',
        'SCHEDULED',
        'PAID',
      ],
      default: 'DRAFT',
      index: true,
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalPolicy',
      default: null,
    },
    policyVersion: {
      type: Number,
      default: 1,
    },
    activeWorkflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalWorkflow',
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
expenseClaimSchema.index({ employeeId: 1, status: 1 });
expenseClaimSchema.index({ departmentId: 1, status: 1 });
expenseClaimSchema.index({ createdAt: -1 });

expenseClaimSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('ExpenseClaim', expenseClaimSchema);
