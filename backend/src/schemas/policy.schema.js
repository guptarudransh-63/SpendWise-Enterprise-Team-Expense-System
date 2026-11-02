const { z } = require('zod');

const approvalStepDefSchema = z.object({
  stepNumber: z.number().int().positive(),
  stepName: z.string().min(2),
  approverRole: z.enum(['manager', 'finance', 'admin', 'specific_user']),
  specificUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
});

const createPolicySchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional().default(''),
  priority: z.number().int().default(10),
  conditions: z.object({
    minAmount: z.number().min(0).default(0),
    maxAmount: z.number().positive().nullable().optional(),
    departmentIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional().default([]),
    categoryIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional().default([]),
    requiresReceipt: z.boolean().default(true),
  }),
  approvalSteps: z.array(approvalStepDefSchema).min(1, 'At least one approval step is required'),
  allowSelfApproval: z.boolean().default(false),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional().nullable(),
});

const updatePolicySchema = createPolicySchema.partial();

module.exports = {
  createPolicySchema,
  updatePolicySchema,
};
