const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const ExpenseCategory = require('../src/models/ExpenseCategory');
const ApprovalPolicy = require('../src/models/ApprovalPolicy');
const Budget = require('../src/models/Budget');
const BudgetReservation = require('../src/models/BudgetReservation');

describe('Transactional Budget Enforcement', () => {
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
      name: 'Development Tools',
      code: 'DEV',
      receiptRequired: false,
    });

    await ApprovalPolicy.create({
      name: 'Standard Policy',
      priority: 10,
      conditions: { minAmount: 0 },
      approvalSteps: [{ stepNumber: 1, stepName: 'Manager Review', approverRole: 'manager' }],
      allowSelfApproval: false,
    });

    // Budget of ₹10,000
    budget = await Budget.create({
      name: 'Strict Budget',
      scopeType: 'department',
      scopeId: department._id,
      periodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      periodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      allocatedAmount: 10000,
      committedAmount: 0,
      actualAmount: 0,
      policy: { allowOverrun: false, requireOverride: true },
    });

    const empRes = await request(app).post('/api/v1/auth/login').send({ email: 'alex@spendwise.local', password: 'Password123!' });
    employeeToken = empRes.body.token;

    const mgrRes = await request(app).post('/api/v1/auth/login').send({ email: 'marcus@spendwise.local', password: 'Password123!' });
    managerToken = mgrRes.body.token;

    const finRes = await request(app).post('/api/v1/auth/login').send({ email: 'finance@spendwise.local', password: 'Password123!' });
    financeToken = finRes.body.token;
  });

  it('reserves budget atomically upon claim submission', async () => {
    const claimRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Tool License',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor',
        amount: 4000,
        businessPurpose: 'IDE tool',
      });

    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimRes.body.data._id}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    if (submitRes.status !== 200) {
      console.error('SUBMIT FAILED IN TEST:', submitRes.status, submitRes.body);
    }
    expect(submitRes.status).toBe(200);

    const updatedBudget = await Budget.findById(budget._id);
    expect(updatedBudget.committedAmount).toBe(4000);
    expect(updatedBudget.availableAmount).toBe(6000);

    const reservation = await BudgetReservation.findOne({ claimId: claimRes.body.data._id });
    expect(reservation).toBeDefined();
    expect(reservation.status).toBe('ACTIVE');
    expect(reservation.amount).toBe(4000);
  });

  it('releases budget reservation atomically upon claim rejection', async () => {
    const claimRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Tool License',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor',
        amount: 3000,
        businessPurpose: 'IDE tool',
      });

    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimRes.body.data._id}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    const workflow = submitRes.body.data.workflow;
    const stepId = workflow.steps[0]._id;

    // Reject claim
    await request(app)
      .post(`/api/v1/approvals/${workflow._id}/steps/${stepId}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Not approved' });

    const updatedBudget = await Budget.findById(budget._id);
    expect(updatedBudget.committedAmount).toBe(0);
    expect(updatedBudget.availableAmount).toBe(10000);

    const reservation = await BudgetReservation.findOne({ claimId: claimRes.body.data._id });
    expect(reservation.status).toBe('RELEASED');
  });

  it('blocks claim submission when remaining budget is insufficient', async () => {
    // Attempt to submit claim of 15,000 on a 10,000 budget
    const claimRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Expensive Hardware',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Apple Store',
        amount: 15000,
        businessPurpose: 'New laptop',
      });

    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimRes.body.data._id}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(submitRes.status).toBe(409);
    expect(submitRes.body.error).toMatch(/Insufficient budget/i);

    // Verify budget was not modified
    const currentBudget = await Budget.findById(budget._id);
    expect(currentBudget.committedAmount).toBe(0);
  });

  it('prevents double-counting: shifts committed to actual when reimbursement completes', async () => {
    const claimRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Reimbursable Expense',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor',
        amount: 5000,
        businessPurpose: 'Testing reimbursement accounting',
      });

    const claimId = claimRes.body.data._id;

    // Submit
    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    // Approve
    const workflow = submitRes.body.data.workflow;
    const stepId = workflow.steps[0]._id;
    await request(app)
      .post(`/api/v1/approvals/${workflow._id}/steps/${stepId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comments: 'Approved' });

    // Budget before payment: committed = 5000, actual = 0
    let b = await Budget.findById(budget._id);
    expect(b.committedAmount).toBe(5000);
    expect(b.actualAmount).toBe(0);

    // Finance completes reimbursement
    const payRes = await request(app)
      .post(`/api/v1/finance/claims/${claimId}/complete`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        paymentReference: 'TXN-984210',
        notes: 'Bank transfer paid',
      });

    expect(payRes.status).toBe(200);

    // Budget after payment: committed = 0, actual = 5000, available = 5000 (NO DOUBLE COUNTING!)
    b = await Budget.findById(budget._id);
    expect(b.committedAmount).toBe(0);
    expect(b.actualAmount).toBe(5000);
    expect(b.availableAmount).toBe(5000);
  });

  it('concurrency test: simultaneous claims cannot exceed strict budget limit', async () => {
    // Budget is ₹10,000. Launch two concurrent submissions of ₹7,000 each.
    // Exactly ONE should succeed and ONE must be rejected with 409 Conflict!
    const claim1 = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Concurrent Claim 1',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor 1',
        amount: 7000,
        businessPurpose: 'Concurrent 1',
      });

    const claim2 = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Concurrent Claim 2',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor 2',
        amount: 7000,
        businessPurpose: 'Concurrent 2',
      });

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/v1/expenses/${claim1.body.data._id}/submit`)
        .set('Authorization', `Bearer ${employeeToken}`),
      request(app)
        .post(`/api/v1/expenses/${claim2.body.data._id}/submit`)
        .set('Authorization', `Bearer ${employeeToken}`),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // One must be 200 (succeeded), one must be 409 (budget exceeded conflict)
    expect(statuses).toEqual([200, 409]);

    const finalBudget = await Budget.findById(budget._id);
    // Final committed amount must be exactly 7,000 (not 14,000!)
    expect(finalBudget.committedAmount).toBe(7000);
    expect(finalBudget.availableAmount).toBe(3000);
  });
});
