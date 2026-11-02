const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Budget name is required'],
      trim: true,
    },
    scopeType: {
      type: String,
      enum: ['department', 'team', 'project', 'category'],
      required: true,
      index: true,
    },
    scopeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
      index: true,
    },
    periodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      uppercase: true,
    },
    allocatedAmount: {
      type: Number,
      required: true,
      min: [0, 'Allocated amount cannot be negative'],
    },
    committedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Committed amount cannot be negative'],
    },
    actualAmount: {
      type: Number,
      default: 0,
      min: [0, 'Actual amount cannot be negative'],
    },
    policy: {
      allowOverrun: {
        type: Boolean,
        default: false,
      },
      requireOverride: {
        type: Boolean,
        default: true,
      },
      warningThresholdPercentage: {
        type: Number,
        default: 80, // Trigger budget alert when 80% used
      },
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'archived'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for available budget
budgetSchema.virtual('availableAmount').get(function () {
  return Math.max(0, this.allocatedAmount - (this.committedAmount + this.actualAmount));
});

// Virtual for utilization percentage
budgetSchema.virtual('utilizationPercentage').get(function () {
  if (this.allocatedAmount <= 0) return 0;
  const utilized = this.committedAmount + this.actualAmount;
  return Number(((utilized / this.allocatedAmount) * 100).toFixed(2));
});

budgetSchema.index({ scopeType: 1, scopeId: 1, periodStart: 1, periodEnd: 1 });

budgetSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Budget', budgetSchema);
