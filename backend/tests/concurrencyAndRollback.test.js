const mongoose = require('mongoose');
const { withTransaction } = require('../src/config/db');
const Budget = require('../src/models/Budget');
const ExpenseClaim = require('../src/models/ExpenseClaim');
const BudgetReservation = require('../src/models/BudgetReservation');
const Department = require('../src/models/Department');
const User = require('../src/models/User');

describe('Transaction Rollback & Concurrency Failure Safety', () => {
  let department, user, budget;

  beforeEach(async () => {
    department = await Department.create({
      name: 'Engineering',
      costCenter: 'ENG-ROLLBACK',
    });

    const passwordHash = await User.hashPassword('Password123!');
    user = await User.create({
      name: 'Tester',
      email: 'tester@spendwise.local',
      passwordHash,
      role: 'employee',
      departmentId: department._id,
    });

    budget = await Budget.create({
      name: 'Test Budget',
      scopeType: 'department',
      scopeId: department._id,
      periodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      periodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      allocatedAmount: 10000,
      committedAmount: 0,
      actualAmount: 0,
    });

    await ExpenseClaim.init();
    await Budget.init();
    await BudgetReservation.init();
  });

  it('rolls back all multi-document modifications when an operation within the transaction fails', async () => {
    const claim = await ExpenseClaim.create({
      claimNumber: 'EXP-TEST-001',
      employeeId: user._id,
      title: 'Rollback Claim',
      categoryId: new mongoose.Types.ObjectId(),
      expenseDate: new Date(),
      merchant: 'Vendor',
      amount: 4000,
      departmentId: department._id,
      businessPurpose: 'Testing transaction rollback',
      status: 'DRAFT',
    });

    // Execute multi-document transaction that deliberately throws halfway through
    try {
      await withTransaction(async (session) => {
        // Step 1: Update budget
        await Budget.findByIdAndUpdate(
          budget._id,
          { $inc: { committedAmount: 4000 } },
          { session }
        );

        // Step 2: Create reservation
        await BudgetReservation.create(
          [
            {
              claimId: claim._id,
              budgetId: budget._id,
              amount: 4000,
              status: 'ACTIVE',
            },
          ],
          { session }
        );

        // Step 3: Update claim status
        await ExpenseClaim.findByIdAndUpdate(
          claim._id,
          { status: 'UNDER_REVIEW' },
          { session }
        );

        // DELIBERATE FAILURE: Simulate unexpected failure / crash
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      });
    } catch (err) {
      expect(err.message).toBe('SIMULATED_TRANSACTION_FAILURE');
    }

    // VERIFY ROLLBACK INTEGRITY:
    // 1. Budget committed amount must still be 0 (NOT 4000)
    const refreshedBudget = await Budget.findById(budget._id);
    expect(refreshedBudget.committedAmount).toBe(0);

    // 2. Reservation must NOT exist
    const reservation = await BudgetReservation.findOne({ claimId: claim._id });
    expect(reservation).toBeNull();

    // 3. Claim status must remain DRAFT (NOT UNDER_REVIEW)
    const refreshedClaim = await ExpenseClaim.findById(claim._id);
    expect(refreshedClaim.status).toBe('DRAFT');
  });
});
