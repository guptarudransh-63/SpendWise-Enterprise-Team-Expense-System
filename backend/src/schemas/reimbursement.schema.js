const { z } = require('zod');

const scheduleReimbursementSchema = z.object({
  scheduledAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid scheduled date',
  }),
  notes: z.string().optional().default(''),
});

const completeReimbursementSchema = z.object({
  paymentReference: z.string().min(3, 'Payment reference / transaction ID is required'),
  paidAt: z.string().optional(),
  notes: z.string().optional().default(''),
});

module.exports = {
  scheduleReimbursementSchema,
  completeReimbursementSchema,
};
