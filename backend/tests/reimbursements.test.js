const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const ExpenseCategory = require('../src/models/ExpenseCategory');
const ApprovalPolicy = require('../src/models/ApprovalPolicy');
const Budget = require('../src/models/Budget');
const Reimbursement = require('../src/models/Reimbursement');

describe('Reimbursements & Idempotency', () => {
  let employeeUser, managerUser, financeUser, department, category, budget;
  let employeeToken, managerToken, financeToken;

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

    financeUser = await User.create({
      name: 'Frank Finance',
      email: 'finance@spendwise.local',
      passwordHash,
      role: 'finance',
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

    category = await ExpenseCategory.create({
      name: 'General',
      code: 'GEN',
      receiptRequired: false,
    });

    await ApprovalPolicy.create({
      name: 'Simple Policy',
      priority: 10,
      conditions: { minAmount: 0 },
      approvalSteps: [{ stepNumber: 1, stepName: 'Manager Review', approverRole: 'manager' }],
      allowSelfApproval: false,
    });

    budget = await Budget.create({
      name: 'Eng Budget',
      scopeType: 'department',
      scopeId: department._id,
      periodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      periodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      allocatedAmount: 50000,
    });

    const empRes = await request(app).post('/api/v1/auth/login').send({ email: 'alex@spendwise.local', password: 'Password123!' });
    employeeToken = empRes.body.token;

    const mgrRes = await request(app).post('/api/v1/auth/login').send({ email: 'marcus@spendwise.local', password: 'Password123!' });
    managerToken = mgrRes.body.token;

    const finRes = await request(app).post('/api/v1/auth/login').send({ email: 'finance@spendwise.local', password: 'Password123!' });
    financeToken = finRes.body.token;
  });

  it('rejects reimbursement for unapproved claims', async () => {
    // Create draft claim
    const claimRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Draft Claim',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor',
        amount: 2500,
        businessPurpose: 'Draft payment attempt test',
      });

    const claimId = claimRes.body.data._id;

    // Finance attempts to mark unapproved draft as paid
    const payRes = await request(app)
      .post(`/api/v1/finance/claims/${claimId}/complete`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        paymentReference: 'TXN-001',
      });

    expect(payRes.status).toBe(409);
    expect(payRes.body.error).toMatch(/Only APPROVED or SCHEDULED claims can be paid/i);
  });

  it('rejects unauthorized employee from marking claims as paid', async () => {
    // Create and approve claim
    const claimRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Approved Claim',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor',
        amount: 2500,
        businessPurpose: 'Payment role test',
      });

    const claimId = claimRes.body.data._id;

    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    const workflow = submitRes.body.data.workflow;
    await request(app)
      .post(`/api/v1/approvals/${workflow._id}/steps/${workflow.steps[0]._id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comments: 'Approved' });

    // Employee tries to mark their own claim as paid
    const payRes = await request(app)
      .post(`/api/v1/finance/claims/${claimId}/complete`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        paymentReference: 'TXN-HACKED',
      });

    expect(payRes.status).toBe(403);
  });

  it('is idempotent: duplicate completion requests return same payment record and create no duplicate records', async () => {
    const claimRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Claim for Idempotent Payment',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor',
        amount: 3000,
        businessPurpose: 'Testing idempotency',
      });

    const claimId = claimRes.body.data._id;

    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    const workflow = submitRes.body.data.workflow;
    await request(app)
      .post(`/api/v1/approvals/${workflow._id}/steps/${workflow.steps[0]._id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comments: 'Approved' });

    // First completion request
    const pay1 = await request(app)
      .post(`/api/v1/finance/claims/${claimId}/complete`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('Idempotency-Key', 'unique-key-12345')
      .send({
        paymentReference: 'TXN-FIRST',
        notes: 'First payout',
      });

    expect(pay1.status).toBe(200);
    expect(pay1.body.data.paymentReference).toBe('TXN-FIRST');

    // Duplicate completion request with same Idempotency-Key
    const pay2 = await request(app)
      .post(`/api/v1/finance/claims/${claimId}/complete`)
      .set('Authorization', `Bearer ${financeToken}`)
      .set('Idempotency-Key', 'unique-key-12345')
      .send({
        paymentReference: 'TXN-DUPLICATE',
        notes: 'Duplicate attempt',
      });

    expect(pay2.status).toBe(200);
    // Returned cached response with original payment reference
    expect(pay2.body.data.paymentReference).toBe('TXN-FIRST');

    // Verify exactly ONE Reimbursement record exists in DB
    const count = await Reimbursement.countDocuments({ claimId });
    expect(count).toBe(1);
  });
});
