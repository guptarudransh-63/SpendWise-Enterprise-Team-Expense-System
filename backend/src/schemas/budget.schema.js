const { z } = require('zod');

const createBudgetSchema = z.object({
  name: z.string().min(3).max(100),
  scopeType: z.enum(['department', 'team', 'project', 'category']),
  scopeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid scope ID'),
  periodStart: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid period start date',
  }),
  periodEnd: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid period end date',
  }),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
  allocatedAmount: z.number().positive('Allocated amount must be positive'),
  policy: z
    .object({
      allowOverrun: z.boolean().default(false),
      requireOverride: z.boolean().default(true),
      warningThresholdPercentage: z.number().min(50).max(100).default(80),
    })
    .default({}),
});

const updateBudgetSchema = createBudgetSchema.partial();

const budgetOverrideSchema = z.object({
  claimId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid claim ID'),
  reason: z.string().min(10, 'Override reason must be detailed (min 10 characters)'),
});

module.exports = {
  createBudgetSchema,
  updateBudgetSchema,
  budgetOverrideSchema,
};
