const { z } = require('zod');

const approveStepSchema = z.object({
  comments: z.string().optional().default('Approved'),
});

const rejectStepSchema = z.object({
  reason: z.string().min(5, 'Rejection reason must be at least 5 characters long'),
});

const requestInfoSchema = z.object({
  comments: z.string().min(5, 'Please specify what additional information is required'),
});

const reassignStepSchema = z.object({
  newApproverId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  reason: z.string().min(5, 'Please provide a valid delegation/reassignment reason'),
});

module.exports = {
  approveStepSchema,
  rejectStepSchema,
  requestInfoSchema,
  reassignStepSchema,
};
