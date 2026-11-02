const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const ExpenseCategory = require('../src/models/ExpenseCategory');
const ApprovalPolicy = require('../src/models/ApprovalPolicy');
const Budget = require('../src/models/Budget');
const ReceiptAttachment = require('../src/models/ReceiptAttachment');

describe('Expense Claims Management', () => {
  let employeeUser, employeeUser2, managerUser, department, categoryNoReceipt, categoryWithReceipt, token1, token2;

  beforeEach(async () => {
    department = await Department.create({
      name: 'Engineering',
      costCenter: 'ENG-001',
    });

    const passwordHash = await User.hashPassword('Password123!');

    managerUser = await User.create({
      name: 'Marcus Manager',
      email: 'marcus@spendwise.local',
      passwordHash,
      role: 'manager',
      departmentId: department._id,
    });

    employeeUser = await User.create({
      name: 'Alex Employee',
      email: 'alex@spendwise.local',
      passwordHash,
      role: 'employee',
      departmentId: department._id,
      managerId: managerUser._id,
    });

    employeeUser2 = await User.create({
      name: 'Bob Employee',
      email: 'bob@spendwise.local',
      passwordHash,
      role: 'employee',
      departmentId: department._id,
      managerId: managerUser._id,
    });

    categoryNoReceipt = await ExpenseCategory.create({
      name: 'Office Supplies',
      code: 'OFFC',
      receiptRequired: false,
    });

    categoryWithReceipt = await ExpenseCategory.create({
      name: 'Cloud Services',
      code: 'SFTW',
      receiptRequired: true,
    });

    // Create policy & budget so submissions work
    await ApprovalPolicy.create({
      name: 'Standard Policy',
      priority: 10,
      conditions: { minAmount: 0 },
      approvalSteps: [{ stepNumber: 1, stepName: 'Manager Review', approverRole: 'manager' }],
      allowSelfApproval: false,
    });

    await Budget.create({
      name: 'Eng Budget',
      scopeType: 'department',
      scopeId: department._id,
      periodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      periodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      allocatedAmount: 100000,
    });

    const login1 = await request(app).post('/api/v1/auth/login').send({
      email: 'alex@spendwise.local',
      password: 'Password123!',
    });
    token1 = login1.body.token;

    const login2 = await request(app).post('/api/v1/auth/login').send({
      email: 'bob@spendwise.local',
      password: 'Password123!',
    });
    token2 = login2.body.token;
  });

  it('creates an eligible draft expense claim', async () => {
    const res = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Ergonomic Desk Mat',
        categoryId: categoryNoReceipt._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Amazon',
        amount: 1500,
        currency: 'INR',
        businessPurpose: 'Ergonomic workstation upgrade',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.claimNumber).toMatch(/^EXP-/);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.amount).toBe(1500);
  });

  it('rejects invalid claim amounts (negative or 0)', async () => {
    const res = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Invalid Amount Claim',
        categoryId: categoryNoReceipt._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Amazon',
        amount: -500,
        businessPurpose: 'Invalid amount testing',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('enforces receipt requirement when category requires receipt', async () => {
    // 1. Create draft with category requiring receipt
    const draftRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'AWS Monthly Hosting',
        categoryId: categoryWithReceipt._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'AWS',
        amount: 4500,
        businessPurpose: 'Infrastructure compute',
        receiptIds: [], // No receipts
      });

    const claimId = draftRes.body.data._id;

    // 2. Attempt submit without receipt
    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimId}/submit`)
      .set('Authorization', `Bearer ${token1}`)
      .send({});

    expect(submitRes.status).toBe(400);
    expect(submitRes.body.error).toMatch(/requires at least one receipt/i);
  });

  it('allows submitting claim when receipt is attached', async () => {
    const receipt = await ReceiptAttachment.create({
      storageKey: '/tmp/receipt.pdf',
      originalFilename: 'aws-oct-invoice.pdf',
      contentType: 'application/pdf',
      size: 1024,
      uploadedBy: employeeUser._id,
    });

    const draftRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'AWS Monthly Hosting',
        categoryId: categoryWithReceipt._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'AWS',
        amount: 4500,
        businessPurpose: 'Infrastructure compute',
        receiptIds: [receipt._id.toString()],
      });

    const claimId = draftRes.body.data._id;

    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimId}/submit`)
      .set('Authorization', `Bearer ${token1}`)
      .send({});

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.claim.status).toBe('UNDER_REVIEW');
  });

  it('allows editing draft claims but rejects editing submitted claims via draft endpoint', async () => {
    // Create draft
    const draftRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Original Title',
        categoryId: categoryNoReceipt._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor A',
        amount: 1000,
        businessPurpose: 'Business purpose sample',
      });

    const claimId = draftRes.body.data._id;

    // Edit draft
    const patchRes = await request(app)
      .patch(`/api/v1/expenses/${claimId}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ title: 'Updated Title', amount: 1200 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.title).toBe('Updated Title');
    expect(patchRes.body.data.amount).toBe(1200);

    // Submit claim
    await request(app)
      .post(`/api/v1/expenses/${claimId}/submit`)
      .set('Authorization', `Bearer ${token1}`)
      .send({});

    // Attempt to edit now that it is SUBMITTED/UNDER_REVIEW
    const illegalEditRes = await request(app)
      .patch(`/api/v1/expenses/${claimId}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ title: 'Tampered Title' });

    expect(illegalEditRes.status).toBe(409);
    expect(illegalEditRes.body.error).toMatch(/Only draft claims can be edited/i);
  });

  it('allows employee to withdraw submitted claim', async () => {
    const draftRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Claim to Withdraw',
        categoryId: categoryNoReceipt._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor',
        amount: 1000,
        businessPurpose: 'Testing withdrawal',
      });

    const claimId = draftRes.body.data._id;

    await request(app)
      .post(`/api/v1/expenses/${claimId}/submit`)
      .set('Authorization', `Bearer ${token1}`)
      .send({});

    const withdrawRes = await request(app)
      .post(`/api/v1/expenses/${claimId}/withdraw`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ reason: 'Submitted duplicate by mistake' });

    expect(withdrawRes.status).toBe(200);
    expect(withdrawRes.body.data.status).toBe('WITHDRAWN');
  });

  it('enforces employee data isolation: employee Bob cannot view Alex private claim', async () => {
    const draftRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Alex Confidential Claim',
        categoryId: categoryNoReceipt._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Private Vendor',
        amount: 2000,
        businessPurpose: 'Confidential project expense',
      });

    const claimId = draftRes.body.data._id;

    // Bob tries to access Alex's claim
    const bobRes = await request(app)
      .get(`/api/v1/expenses/${claimId}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(bobRes.status).toBe(403);
    expect(bobRes.body.error).toMatch(/do not have permission/i);
  });
});
