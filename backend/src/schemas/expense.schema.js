const { z } = require('zod');

const createExpenseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(150),
  description: z.string().optional().default(''),
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
  expenseDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid expense date',
  }),
  merchant: z.string().min(2, 'Merchant must be at least 2 characters').max(100),
  amount: z.number().positive('Amount must be greater than zero'),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
  departmentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID'),
  costCenterId: z.string().optional(),
  paymentMethod: z.enum(['corporate_card', 'personal_card', 'cash', 'bank_transfer']).default('personal_card'),
  businessPurpose: z.string().min(5, 'Business purpose must be at least 5 characters'),
  submissionNotes: z.string().optional().default(''),
  receiptIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid receipt ID')).optional().default([]),
});

const updateExpenseSchema = createExpenseSchema.partial();

const resubmitExpenseSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  description: z.string().optional(),
  amount: z.number().positive().optional(),
  merchant: z.string().min(2).max(100).optional(),
  businessPurpose: z.string().min(5).optional(),
  submissionNotes: z.string().optional(),
  receiptIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
});

module.exports = {
  createExpenseSchema,
  updateExpenseSchema,
  resubmitExpenseSchema,
};
