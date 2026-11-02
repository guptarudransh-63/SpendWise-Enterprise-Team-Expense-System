const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const ExpenseCategory = require('../src/models/ExpenseCategory');
const ApprovalPolicy = require('../src/models/ApprovalPolicy');
const ApprovalWorkflow = require('../src/models/ApprovalWorkflow');
const Budget = require('../src/models/Budget');

describe('Approval Workflow Engine', () => {
  let employeeUser, managerUser, financeUser, adminUser, department, category;
  let employeeToken, managerToken, financeToken, adminToken;
  let tier1Policy, tier2Policy;

  beforeEach(async () => {
    department = await Department.create({
      name: 'Engineering',
      costCenter: 'ENG-001',
    });

    const passwordHash = await User.hashPassword('Password123!');

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@spendwise.local',
      passwordHash,
      role: 'admin',
      departmentId: department._id,
    });

    financeUser = await User.create({
      name: 'Finance User',
      email: 'finance@spendwise.local',
      passwordHash,
      role: 'finance',
      departmentId: department._id,
    });

    managerUser = await User.create({
      name: 'Manager User',
      email: 'manager@spendwise.local',
      passwordHash,
      role: 'manager',
      departmentId: department._id,
    });

    employeeUser = await User.create({
      name: 'Employee User',
      email: 'employee@spendwise.local',
      passwordHash,
      role: 'employee',
      departmentId: department._id,
      managerId: managerUser._id,
    });

    category = await ExpenseCategory.create({
      name: 'General Category',
      code: 'GEN',
      receiptRequired: false,
    });

    // Tier 1 Policy: <= 5,000 -> 1 Step (Manager)
    tier1Policy = await ApprovalPolicy.create({
      name: 'Tier 1 Policy',
      priority: 20,
      conditions: { minAmount: 0, maxAmount: 5000 },
      approvalSteps: [{ stepNumber: 1, stepName: 'Manager Review', approverRole: 'manager' }],
      allowSelfApproval: false,
      version: 1,
    });

    // Tier 2 Policy: > 5,000 -> 2 Steps (Step 1: Manager, Step 2: Finance)
    tier2Policy = await ApprovalPolicy.create({
      name: 'Tier 2 Policy',
      priority: 10,
      conditions: { minAmount: 5001 },
      approvalSteps: [
        { stepNumber: 1, stepName: 'Manager Review', approverRole: 'manager' },
        { stepNumber: 2, stepName: 'Finance Review', approverRole: 'finance' },
      ],
      allowSelfApproval: false,
      version: 1,
    });

    await Budget.create({
      name: 'Eng Budget',
      scopeType: 'department',
      scopeId: department._id,
      periodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      periodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      allocatedAmount: 1000000,
    });

    const empRes = await request(app).post('/api/v1/auth/login').send({ email: 'employee@spendwise.local', password: 'Password123!' });
    employeeToken = empRes.body.token;

    const mgrRes = await request(app).post('/api/v1/auth/login').send({ email: 'manager@spendwise.local', password: 'Password123!' });
    managerToken = mgrRes.body.token;

    const finRes = await request(app).post('/api/v1/auth/login').send({ email: 'finance@spendwise.local', password: 'Password123!' });
    financeToken = finRes.body.token;

    const admRes = await request(app).post('/api/v1/auth/login').send({ email: 'admin@spendwise.local', password: 'Password123!' });
    adminToken = admRes.body.token;
  });

  it('selects correct policy based on amount thresholds and assigns approvers', async () => {
    // 1. Submit claim for 3,000 (matches Tier 1: 1 step)
    const claim1Res = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Small Claim',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor A',
        amount: 3000,
        businessPurpose: 'Small purchase',
      });

    const submit1 = await request(app)
      .post(`/api/v1/expenses/${claim1Res.body.data._id}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(submit1.status).toBe(200);
    expect(submit1.body.data.workflow.steps.length).toBe(1);
    expect(submit1.body.data.workflow.policyId.toString()).toBe(tier1Policy._id.toString());
    expect(submit1.body.data.workflow.steps[0].assignedApproverId.toString()).toBe(managerUser._id.toString());

    // 2. Submit claim for 15,000 (matches Tier 2: 2 steps)
    const claim2Res = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Large Claim',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor B',
        amount: 15000,
        businessPurpose: 'Large tooling purchase',
      });

    const submit2 = await request(app)
      .post(`/api/v1/expenses/${claim2Res.body.data._id}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(submit2.status).toBe(200);
    expect(submit2.body.data.workflow.steps.length).toBe(2);
    expect(submit2.body.data.workflow.steps[0].assignedApproverId.toString()).toBe(managerUser._id.toString());
    expect(submit2.body.data.workflow.steps[1].assignedApproverId.toString()).toBe(financeUser._id.toString());
  });

  it('strictly rejects self-approval by default (employee cannot approve their own claim)', async () => {
    // Manager creates their own expense claim
    const claimRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Manager Self Expense',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor',
        amount: 2000,
        businessPurpose: 'Manager purchase',
      });

    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimRes.body.data._id}/submit`)
      .set('Authorization', `Bearer ${managerToken}`);

    const workflow = submitRes.body.data.workflow;
    const stepId = workflow.steps[0]._id;

    // Manager attempts to approve their own claim
    const approveRes = await request(app)
      .post(`/api/v1/approvals/${workflow._id}/steps/${stepId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comments: 'Self approval attempt' });

    expect(approveRes.status).toBe(403);
    expect(approveRes.body.error).toMatch(/strictly prohibits self-approval/i);
  });

  it('rejects out-of-order approval attempts (acting on Step 2 before Step 1 is approved)', async () => {
    // Submit Tier 2 claim (2 steps)
    const claimRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Tier 2 Claim',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor',
        amount: 10000,
        businessPurpose: 'Multi step workflow test',
      });

    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimRes.body.data._id}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    const workflow = submitRes.body.data.workflow;
    const step2Id = workflow.steps[1]._id; // Step 2 (Finance)

    // Finance tries to approve step 2 while step 1 is still pending
    const step2Res = await request(app)
      .post(`/api/v1/approvals/${workflow._id}/steps/${step2Id}/approve`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ comments: 'Premature finance approval' });

    expect(step2Res.status).toBe(409);
    expect(step2Res.body.error).toMatch(/out-of-order approval step/i);
  });

  it('executes sequential approval steps and transitions claim to APPROVED on final step', async () => {
    // Submit Tier 2 claim
    const claimRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Sequential Claim',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor',
        amount: 8000,
        businessPurpose: 'Sequential testing',
      });

    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimRes.body.data._id}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    const workflowId = submitRes.body.data.workflow._id;
    let wf = submitRes.body.data.workflow;

    // Step 1: Manager approves
    const step1Id = wf.steps[0]._id;
    const step1Approve = await request(app)
      .post(`/api/v1/approvals/${workflowId}/steps/${step1Id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comments: 'Manager step approved' });

    expect(step1Approve.status).toBe(200);
    expect(step1Approve.body.data.workflow.status).toBe('IN_PROGRESS');
    expect(step1Approve.body.data.workflow.currentStepIndex).toBe(1);
    expect(step1Approve.body.data.workflow.steps[1].status).toBe('PENDING');

    // Step 2: Finance approves
    const step2Id = wf.steps[1]._id;
    const step2Approve = await request(app)
      .post(`/api/v1/approvals/${workflowId}/steps/${step2Id}/approve`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ comments: 'Finance step approved' });

    expect(step2Approve.status).toBe(200);
    expect(step2Approve.body.data.workflow.status).toBe('APPROVED');
    expect(step2Approve.body.data.claim.status).toBe('APPROVED');
  });

  it('rejects stale approval attempt on already rejected claim', async () => {
    const claimRes = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Claim to Reject',
        categoryId: category._id.toString(),
        departmentId: department._id.toString(),
        expenseDate: new Date().toISOString(),
        merchant: 'Vendor',
        amount: 2000,
        businessPurpose: 'Rejection test',
      });

    const submitRes = await request(app)
      .post(`/api/v1/expenses/${claimRes.body.data._id}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);

    const workflow = submitRes.body.data.workflow;
    const stepId = workflow.steps[0]._id;

    // 1. Manager rejects
    const rejectRes = await request(app)
      .post(`/api/v1/approvals/${workflow._id}/steps/${stepId}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Non-compliant business expense' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.claim.status).toBe('REJECTED');

    // 2. Stale request attempt to approve after rejection
    const staleApproveRes = await request(app)
      .post(`/api/v1/approvals/${workflow._id}/steps/${stepId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comments: 'Stale approval' });

    expect(staleApproveRes.status).toBe(409);
    expect(staleApproveRes.body.error).toMatch(/Workflow is in "REJECTED" state/i);
  });
});
