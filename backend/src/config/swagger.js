const swaggerUi = require('swagger-ui-express');

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'SpendWise API',
    version: '1.0.0',
    description: 'Enterprise Team Expense & Approval Management System REST API',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Base',
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'token',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    { cookieAuth: [] },
    { bearerAuth: [] },
  ],
  paths: {
    '/auth/login': {
      post: {
        summary: 'Log in with email and password',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'dev1@spendwise.local' },
                  password: { type: 'string', example: 'Password123!' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Successful login, sets HttpOnly cookie and returns token' },
          401: { description: 'Invalid email or password' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current authenticated user profile',
        tags: ['Authentication'],
        responses: {
          200: { description: 'Current user profile' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/expenses': {
      get: {
        summary: 'List expense claims (filtered by role and parameters)',
        tags: ['Expense Claims'],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'List of claims with pagination' } },
      },
      post: {
        summary: 'Create a draft expense claim',
        tags: ['Expense Claims'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'categoryId', 'expenseDate', 'merchant', 'amount', 'businessPurpose', 'departmentId'],
                properties: {
                  title: { type: 'string', example: 'AWS Cloud Hosting - Oct 2026' },
                  description: { type: 'string', example: 'EC2 instances and RDS clusters' },
                  categoryId: { type: 'string' },
                  expenseDate: { type: 'string', format: 'date-time' },
                  merchant: { type: 'string', example: 'Amazon Web Services' },
                  amount: { type: 'number', example: 12500 },
                  currency: { type: 'string', example: 'INR' },
                  departmentId: { type: 'string' },
                  businessPurpose: { type: 'string', example: 'Production infrastructure workloads' },
                  paymentMethod: { type: 'string', example: 'corporate_card' },
                  receiptIds: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Draft claim created' } },
      },
    },
    '/expenses/{id}/submit': {
      post: {
        summary: 'Submit an expense claim for approval (evaluates policy, reserves budget)',
        tags: ['Expense Claims'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Claim submitted and workflow initiated' },
          409: { description: 'Budget exceeded or invalid claim status' },
        },
      },
    },
    '/approvals/inbox': {
      get: {
        summary: 'Get assigned pending approval requests for current approver',
        tags: ['Approval Engine'],
        responses: { 200: { description: 'Pending approval inbox items' } },
      },
    },
    '/approvals/{workflowId}/steps/{stepId}/approve': {
      post: {
        summary: 'Approve an assigned approval step',
        tags: ['Approval Engine'],
        parameters: [
          { name: 'workflowId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'stepId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Step approved and workflow advanced' },
          403: { description: 'Unauthorized or self-approval prohibited' },
          409: { description: 'Step already decided or invalid transition' },
        },
      },
    },
    '/budgets': {
      get: {
        summary: 'Get budgets and current utilization',
        tags: ['Budgets'],
        responses: { 200: { description: 'List of budgets with metrics' } },
      },
    },
    '/finance/claims': {
      get: {
        summary: 'Get approved claims queue for finance reimbursement',
        tags: ['Finance'],
        responses: { 200: { description: 'Claims ready for reimbursement processing' } },
      },
    },
  },
};

const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};

module.exports = setupSwagger;
