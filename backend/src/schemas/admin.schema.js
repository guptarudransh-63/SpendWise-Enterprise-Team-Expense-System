const { z } = require('zod');

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['employee', 'manager', 'finance', 'admin']).default('employee'),
  departmentId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
  managerId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
});

const updateUserSchema = createUserSchema.partial();

const createDepartmentSchema = z.object({
  name: z.string().min(2).max(100),
  managerId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
  costCenter: z.string().min(2).max(20),
  status: z.enum(['active', 'inactive']).default('active'),
});

const updateDepartmentSchema = createDepartmentSchema.partial();

const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).optional(),
  description: z.string().optional().default(''),
  receiptRequired: z.boolean().default(true),
  spendingLimit: z.number().min(0).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
});

const updateCategorySchema = createCategorySchema.partial();

module.exports = {
  createUserSchema,
  updateUserSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createCategorySchema,
  updateCategorySchema,
};
