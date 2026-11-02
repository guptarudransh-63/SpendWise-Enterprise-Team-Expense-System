const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/User');
const Department = require('../models/Department');
const ExpenseCategory = require('../models/ExpenseCategory');
const ApprovalPolicy = require('../models/ApprovalPolicy');
const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const Budget = require('../models/Budget');
const BudgetReservation = require('../models/BudgetReservation');
const ExpenseClaim = require('../models/ExpenseClaim');
const Reimbursement = require('../models/Reimbursement');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const IdempotencyKey = require('../models/IdempotencyKey');

const seedData = async () => {
  try {
    console.log('Connecting to MongoDB for seeding...');
    await mongoose.connect(env.MONGO_URI);
    console.log('Dropping existing database for clean seeding...');
    await mongoose.connection.dropDatabase();
    console.log('Synchronizing schema indexes...');
    await Promise.all([
      Department.createIndexes(),
      User.createIndexes(),
      ExpenseCategory.createIndexes(),
      ApprovalPolicy.createIndexes(),
      ApprovalWorkflow.createIndexes(),
      Budget.createIndexes(),
      BudgetReservation.createIndexes(),
      ExpenseClaim.createIndexes(),
      Reimbursement.createIndexes(),
      AuditLog.createIndexes(),
      Notification.createIndexes(),
      IdempotencyKey.createIndexes(),
    ]);

    console.log('Creating Departments...');
    const engDept = await Department.create({
      name: 'Engineering',
      costCenter: 'ENG-001',
      status: 'active',
    });

    const salesDept = await Department.create({
      name: 'Sales & Marketing',
      costCenter: 'SLS-002',
      status: 'active',
    });

    const opsDept = await Department.create({
      name: 'Operations & HR',
      costCenter: 'OPS-003',
      status: 'active',
    });

    console.log('Creating Users...');
    const defaultPassword = 'Password123!';
    const passwordHash = await User.hashPassword(defaultPassword);

    const adminUser = await User.create({
      name: 'Sarah Connor (Admin)',
      email: 'admin@spendwise.local',
      passwordHash,
      role: 'admin',
      departmentId: opsDept._id,
      status: 'active',
    });

    const financeUser = await User.create({
      name: 'Frank Miller (Finance Lead)',
      email: 'finance@spendwise.local',
      passwordHash,
      role: 'finance',
      departmentId: opsDept._id,
      status: 'active',
    });

    const engManager = await User.create({
      name: 'Marcus Vance (Eng Director)',
      email: 'engineering.mgr@spendwise.local',
      passwordHash,
      role: 'manager',
      departmentId: engDept._id,
      status: 'active',
    });

    const salesManager = await User.create({
      name: 'Rachel Green (Sales VP)',
      email: 'sales.mgr@spendwise.local',
      passwordHash,
      role: 'manager',
      departmentId: salesDept._id,
      status: 'active',
    });

    const dev1 = await User.create({
      name: 'Alex Rivera (Sr Developer)',
      email: 'dev1@spendwise.local',
      passwordHash,
      role: 'employee',
      departmentId: engDept._id,
      managerId: engManager._id,
      status: 'active',
    });

    const dev2 = await User.create({
      name: 'Elena Rostova (Frontend Dev)',
      email: 'dev2@spendwise.local',
      passwordHash,
      role: 'employee',
      departmentId: engDept._id,
      managerId: engManager._id,
      status: 'active',
    });

    const salesRep = await User.create({
      name: 'Jordan Belfort (Account Exec)',
      email: 'salesrep1@spendwise.local',
      passwordHash,
      role: 'employee',
      departmentId: salesDept._id,
      managerId: salesManager._id,
      status: 'active',
    });

    // Link managers back to departments
    await Department.findByIdAndUpdate(engDept._id, { managerId: engManager._id });
    await Department.findByIdAndUpdate(salesDept._id, { managerId: salesManager._id });
    await Department.findByIdAndUpdate(opsDept._id, { managerId: adminUser._id });

    console.log('Creating Expense Categories...');
    const softwareCat = await ExpenseCategory.create({
      name: 'Software & Cloud Services',
      code: 'SFTW',
      description: 'SaaS tools, cloud infrastructure (AWS/GCP), developer tooling',
      receiptRequired: true,
      spendingLimit: 100000,
      status: 'active',
    });

    const travelCat = await ExpenseCategory.create({
      name: 'Travel & Lodging',
      code: 'TRVL',
      description: 'Flights, trains, hotels, and local ground transport',
      receiptRequired: true,
      spendingLimit: 50000,
      status: 'active',
    });

    const mealCat = await ExpenseCategory.create({
      name: 'Meals & Client Entertainment',
      code: 'MEAL',
      description: 'Team lunches, client dinners, conference catering',
      receiptRequired: true,
      spendingLimit: 10000,
      status: 'active',
    });

    const hardwareCat = await ExpenseCategory.create({
      name: 'Hardware & Peripherals',
      code: 'HDWR',
      description: 'Monitors, laptops, test devices, accessories',
      receiptRequired: true,
      spendingLimit: 150000,
      status: 'active',
    });

    const officeCat = await ExpenseCategory.create({
      name: 'Office Supplies & Miscellaneous',
      code: 'OFFC',
      description: 'Stationery, books, desk supplies',
      receiptRequired: false,
      spendingLimit: 5000,
      status: 'active',
    });

    console.log('Creating Approval Policies...');
    // Tier 1: Small Claims (<= 5000) -> 1 level Manager
    const tier1Policy = await ApprovalPolicy.create({
      name: 'Tier 1: Standard Employee Expense (<= ₹5,000)',
      description: 'Single manager approval required for claims up to ₹5,000',
      priority: 30,
      conditions: {
        minAmount: 0,
        maxAmount: 5000,
        requiresReceipt: true,
      },
      approvalSteps: [
        {
          stepNumber: 1,
          stepName: 'Manager Review',
          approverRole: 'manager',
        },
      ],
      allowSelfApproval: false,
      version: 1,
      createdBy: adminUser._id,
    });

    // Tier 2: Mid-Range Claims (5000 - 25000) -> 2 levels: Manager + Finance
    const tier2Policy = await ApprovalPolicy.create({
      name: 'Tier 2: Elevated Expense (₹5,001 - ₹25,000)',
      description: 'Requires direct Manager review followed by Finance team audit',
      priority: 20,
      conditions: {
        minAmount: 5001,
        maxAmount: 25000,
        requiresReceipt: true,
      },
      approvalSteps: [
        {
          stepNumber: 1,
          stepName: 'Manager Review',
          approverRole: 'manager',
        },
        {
          stepNumber: 2,
          stepName: 'Finance Verification',
          approverRole: 'finance',
        },
      ],
      allowSelfApproval: false,
      version: 1,
      createdBy: adminUser._id,
    });

    // Tier 3: High-Value Claims (> 25000) -> 3 levels: Manager + Finance + Admin
    const tier3Policy = await ApprovalPolicy.create({
      name: 'Tier 3: Executive Capital Expenditure (> ₹25,000)',
      description: 'High-value claims requiring Manager, Finance, and Executive Admin Signoff',
      priority: 10,
      conditions: {
        minAmount: 25001,
        maxAmount: null,
        requiresReceipt: true,
      },
      approvalSteps: [
        {
          stepNumber: 1,
          stepName: 'Manager Review',
          approverRole: 'manager',
        },
        {
          stepNumber: 2,
          stepName: 'Finance Verification',
          approverRole: 'finance',
        },
        {
          stepNumber: 3,
          stepName: 'Executive Admin Approval',
          approverRole: 'admin',
        },
      ],
      allowSelfApproval: false,
      version: 1,
      createdBy: adminUser._id,
    });

    console.log('Creating Budgets...');
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), 0, 1);
    const periodEnd = new Date(now.getFullYear(), 11, 31);

    const engBudget = await Budget.create({
      name: 'Engineering FY2026 Budget',
      scopeType: 'department',
      scopeId: engDept._id,
      periodStart,
      periodEnd,
      currency: 'INR',
      allocatedAmount: 1000000,
      committedAmount: 21000, // 12500 + 8500
      actualAmount: 0,
      policy: {
        allowOverrun: false,
        requireOverride: true,
        warningThresholdPercentage: 80,
      },
      status: 'active',
    });

    const salesBudget = await Budget.create({
      name: 'Sales & Marketing FY2026 Budget',
      scopeType: 'department',
      scopeId: salesDept._id,
      periodStart,
      periodEnd,
      currency: 'INR',
      allocatedAmount: 500000,
      committedAmount: 0,
      actualAmount: 18000,
      policy: {
        allowOverrun: false,
        requireOverride: true,
        warningThresholdPercentage: 85,
      },
      status: 'active',
    });

    console.log('Creating Sample Expense Claims across lifecycle states...');

    // Claim 1: DRAFT by dev1
    await ExpenseClaim.create({
      claimNumber: 'EXP-2026-00001',
      employeeId: dev1._id,
      title: 'Desk Ergo Mouse & Keyboard',
      description: 'Wireless ergonomic keyboard and vertical mouse for development workstation',
      categoryId: officeCat._id,
      expenseDate: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      merchant: 'Logitech India Store',
      amount: 3500,
      currency: 'INR',
      departmentId: engDept._id,
      paymentMethod: 'personal_card',
      businessPurpose: 'Ergonomic workspace setup for reduced RSI strain',
      status: 'DRAFT',
    });

    // Claim 2: UNDER_REVIEW by dev1 (Tier 2, ₹12,500)
    const claim2 = await ExpenseClaim.create({
      claimNumber: 'EXP-2026-00002',
      employeeId: dev1._id,
      title: 'AWS Cloud Production Cluster Hosting',
      description: 'Monthly compute and managed database costs for staging and testing clusters',
      categoryId: softwareCat._id,
      expenseDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      merchant: 'Amazon Web Services',
      amount: 12500,
      currency: 'INR',
      departmentId: engDept._id,
      paymentMethod: 'corporate_card',
      businessPurpose: 'Infrastructure hosting for developer continuous integration',
      status: 'UNDER_REVIEW',
      policyId: tier2Policy._id,
      policyVersion: 1,
      submittedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
    });

    const workflow2 = await ApprovalWorkflow.create({
      claimId: claim2._id,
      policyId: tier2Policy._id,
      policyVersion: 1,
      status: 'IN_PROGRESS',
      currentStepIndex: 0,
      steps: [
        {
          stepNumber: 1,
          stepName: 'Manager Review',
          approverRole: 'manager',
          assignedApproverId: engManager._id,
          status: 'PENDING',
        },
        {
          stepNumber: 2,
          stepName: 'Finance Verification',
          approverRole: 'finance',
          assignedApproverId: financeUser._id,
          status: 'WAITING',
        },
      ],
    });

    await ExpenseClaim.findByIdAndUpdate(claim2._id, { activeWorkflowId: workflow2._id });

    await BudgetReservation.create({
      claimId: claim2._id,
      budgetId: engBudget._id,
      amount: 12500,
      currency: 'INR',
      status: 'ACTIVE',
      reservedAt: new Date(),
    });

    // Claim 3: CHANGES_REQUESTED by dev2 (₹4,200)
    const claim3 = await ExpenseClaim.create({
      claimNumber: 'EXP-2026-00003',
      employeeId: dev2._id,
      title: 'Quarterly Team Lunch & Retrospective',
      description: 'Sprint retrospective team lunch for frontend engineering squad',
      categoryId: mealCat._id,
      expenseDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      merchant: 'Barbeque Nation',
      amount: 4200,
      currency: 'INR',
      departmentId: engDept._id,
      paymentMethod: 'personal_card',
      businessPurpose: 'Quarterly team celebration and sprint review retrospective',
      status: 'CHANGES_REQUESTED',
      policyId: tier1Policy._id,
      policyVersion: 1,
      submittedAt: new Date(Date.now() - 6 * 24 * 3600 * 1000),
    });

    const workflow3 = await ApprovalWorkflow.create({
      claimId: claim3._id,
      policyId: tier1Policy._id,
      policyVersion: 1,
      status: 'IN_PROGRESS',
      currentStepIndex: 0,
      steps: [
        {
          stepNumber: 1,
          stepName: 'Manager Review',
          approverRole: 'manager',
          assignedApproverId: engManager._id,
          status: 'INFO_REQUESTED',
          decision: 'REQUEST_INFO',
          comments: 'Please attach the itemized tax receipt and participant headcount list.',
          actionAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
          actedBy: engManager._id,
        },
      ],
    });

    await ExpenseClaim.findByIdAndUpdate(claim3._id, { activeWorkflowId: workflow3._id });

    // Claim 4: APPROVED by dev1 (₹8,500) - Ready for Finance Queue
    const claim4 = await ExpenseClaim.create({
      claimNumber: 'EXP-2026-00004',
      employeeId: dev1._id,
      title: 'JetBrains All Products Annual Subscription',
      description: 'WebStorm, IntelliJ IDEA, and DataGrip annual professional toolchain licenses',
      categoryId: softwareCat._id,
      expenseDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      merchant: 'JetBrains s.r.o.',
      amount: 8500,
      currency: 'INR',
      departmentId: engDept._id,
      paymentMethod: 'personal_card',
      businessPurpose: 'Core development IDE software licenses',
      status: 'APPROVED',
      policyId: tier2Policy._id,
      policyVersion: 1,
      submittedAt: new Date(Date.now() - 9 * 24 * 3600 * 1000),
    });

    const workflow4 = await ApprovalWorkflow.create({
      claimId: claim4._id,
      policyId: tier2Policy._id,
      policyVersion: 1,
      status: 'APPROVED',
      currentStepIndex: 1,
      completedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      steps: [
        {
          stepNumber: 1,
          stepName: 'Manager Review',
          approverRole: 'manager',
          assignedApproverId: engManager._id,
          status: 'APPROVED',
          decision: 'APPROVE',
          comments: 'Approved as planned in team software tooling budget.',
          actionAt: new Date(Date.now() - 8 * 24 * 3600 * 1000),
          actedBy: engManager._id,
        },
        {
          stepNumber: 2,
          stepName: 'Finance Verification',
          approverRole: 'finance',
          assignedApproverId: financeUser._id,
          status: 'APPROVED',
          decision: 'APPROVE',
          comments: 'Invoice and GST identification verified.',
          actionAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
          actedBy: financeUser._id,
        },
      ],
    });

    await ExpenseClaim.findByIdAndUpdate(claim4._id, { activeWorkflowId: workflow4._id });

    await BudgetReservation.create({
      claimId: claim4._id,
      budgetId: engBudget._id,
      amount: 8500,
      currency: 'INR',
      status: 'ACTIVE',
      reservedAt: new Date(Date.now() - 9 * 24 * 3600 * 1000),
    });

    // Claim 5: PAID by salesRep (₹18,000) - Completed Reimbursement
    const claim5 = await ExpenseClaim.create({
      claimNumber: 'EXP-2026-00005',
      employeeId: salesRep._id,
      title: 'Client Onsite Presentation - Flight & Stay',
      description: 'Roundtrip Mumbai to Bangalore flights and hotel stay for enterprise contract closing',
      categoryId: travelCat._id,
      expenseDate: new Date(Date.now() - 15 * 24 * 3600 * 1000),
      merchant: 'IndiGo Airlines & Taj Hotels',
      amount: 18000,
      currency: 'INR',
      departmentId: salesDept._id,
      paymentMethod: 'personal_card',
      businessPurpose: 'Strategic client closing meeting for ₹15L ARR contract',
      status: 'PAID',
      policyId: tier2Policy._id,
      policyVersion: 1,
      submittedAt: new Date(Date.now() - 14 * 24 * 3600 * 1000),
    });

    await Reimbursement.create({
      claimId: claim5._id,
      amount: 18000,
      currency: 'INR',
      status: 'PAID',
      paymentReference: 'NEFT-UTIB000291-84729103',
      scheduledAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      paidAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      processedBy: financeUser._id,
      notes: 'Direct bank deposit processed via corporate portal.',
    });

    await BudgetReservation.create({
      claimId: claim5._id,
      budgetId: salesBudget._id,
      amount: 18000,
      currency: 'INR',
      status: 'FULFILLED',
      reservedAt: new Date(Date.now() - 14 * 24 * 3600 * 1000),
      fulfilledAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    });

    console.log('Seeding initial Audit Logs & Notifications...');
    await AuditLog.create([
      {
        actorId: dev1._id,
        action: 'CLAIM_SUBMITTED',
        entityType: 'ExpenseClaim',
        entityId: claim2._id,
        reason: 'Monthly AWS bill',
      },
      {
        actorId: engManager._id,
        action: 'ADDITIONAL_INFO_REQUESTED',
        entityType: 'ExpenseClaim',
        entityId: claim3._id,
        reason: 'Missing itemized receipt',
      },
      {
        actorId: financeUser._id,
        action: 'REIMBURSEMENT_COMPLETED',
        entityType: 'Reimbursement',
        entityId: claim5._id,
        reason: 'Payment complete reference: NEFT-UTIB000291-84729103',
      },
    ]);

    await Notification.create([
      {
        userId: engManager._id,
        type: 'APPROVAL_ASSIGNED',
        title: 'New Expense Claim Pending Approval',
        message: 'Alex Rivera submitted claim "AWS Cloud Production Cluster Hosting" (EXP-2026-00002) for INR 12500.00.',
        relatedEntityType: 'ExpenseClaim',
        relatedEntityId: claim2._id,
      },
      {
        userId: dev2._id,
        type: 'INFO_REQUESTED',
        title: 'Additional Information Requested',
        message: 'Marcus Vance requested changes on "Quarterly Team Lunch & Retrospective": Please attach itemized tax receipt.',
        relatedEntityType: 'ExpenseClaim',
        relatedEntityId: claim3._id,
      },
    ]);

    console.log('\n==========================================');
    console.log('Database Seeding Completed Successfully!');
    console.log('==========================================');
    console.log('Demo Credentials for Testing:');
    console.log('------------------------------------------');
    console.log('1. Admin:           admin@spendwise.local           / Password123!');
    console.log('2. Finance Lead:    finance@spendwise.local         / Password123!');
    console.log('3. Eng Manager:     engineering.mgr@spendwise.local / Password123!');
    console.log('4. Sales Manager:   sales.mgr@spendwise.local       / Password123!');
    console.log('5. Dev Employee:    dev1@spendwise.local            / Password123!');
    console.log('6. Dev Employee:    dev2@spendwise.local            / Password123!');
    console.log('7. Sales Rep:       salesrep1@spendwise.local       / Password123!');
    console.log('==========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedData();
