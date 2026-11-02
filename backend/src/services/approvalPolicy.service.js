const ApprovalPolicy = require('../models/ApprovalPolicy');
const User = require('../models/User');
const Department = require('../models/Department');

class ApprovalPolicyService {
  /**
   * Find matching active policy for a claim based on amount, department, category, and priority
   */
  static async matchPolicy(claim, session = null) {
    let query = ApprovalPolicy.find({
      status: 'active',
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: new Date() } },
      ],
      'conditions.minAmount': { $lte: claim.amount },
    }).sort({ priority: 1, createdAt: -1 });

    if (session) query = query.session(session);
    const candidatePolicies = await query;

    // Filter candidate policies for maxAmount, department, category
    for (const policy of candidatePolicies) {
      const cond = policy.conditions;

      if (cond.maxAmount !== null && cond.maxAmount !== undefined && claim.amount > cond.maxAmount) {
        continue;
      }

      if (cond.departmentIds && cond.departmentIds.length > 0) {
        const matchesDept = cond.departmentIds.some(
          (dId) => dId.toString() === claim.departmentId.toString()
        );
        if (!matchesDept) continue;
      }

      if (cond.categoryIds && cond.categoryIds.length > 0) {
        const matchesCat = cond.categoryIds.some(
          (cId) => cId.toString() === claim.categoryId.toString()
        );
        if (!matchesCat) continue;
      }

      return policy;
    }

    // Fallback: Default single manager approval policy if no custom policy matched
    return null;
  }

  /**
   * Resolve specific approver User ID for a given approval step
   */
  static async resolveApproverForStep({ stepDef, claim, employeeUser, session = null }) {
    if (stepDef.approverRole === 'specific_user' && stepDef.specificUserId) {
      return stepDef.specificUserId;
    }

    if (stepDef.approverRole === 'manager') {
      // 1. Employee's direct manager
      if (employeeUser.managerId) {
        return employeeUser.managerId;
      }
      // 2. Department manager
      const deptQuery = Department.findById(claim.departmentId);
      if (session) deptQuery.session(session);
      const department = await deptQuery;

      if (department && department.managerId) {
        return department.managerId;
      }

      // 3. Any active manager in company
      let mgrQuery = User.findOne({ role: 'manager', status: 'active' });
      if (session) mgrQuery = mgrQuery.session(session);
      const anyMgr = await mgrQuery;
      if (anyMgr) return anyMgr._id;
    }

    if (stepDef.approverRole === 'finance') {
      // Assign to finance team user
      let finQuery = User.findOne({ role: 'finance', status: 'active' });
      if (session) finQuery = finQuery.session(session);
      const financeUser = await finQuery;
      if (financeUser) return financeUser._id;
    }

    if (stepDef.approverRole === 'admin') {
      // Assign to admin user
      let admQuery = User.findOne({ role: 'admin', status: 'active' });
      if (session) admQuery = admQuery.session(session);
      const adminUser = await admQuery;
      if (adminUser) return adminUser._id;
    }

    // Default fallback to company admin or first manager
    let fbQuery = User.findOne({ role: { $in: ['admin', 'manager'] }, status: 'active' });
    if (session) fbQuery = fbQuery.session(session);
    const fallbackUser = await fbQuery;
    return fallbackUser ? fallbackUser._id : employeeUser._id;
  }

  /**
   * Instantiate workflow steps from policy definition
   */
  static async instantiateSteps({ policy, claim, employeeUser, session = null }) {
    const steps = [];

    for (let i = 0; i < policy.approvalSteps.length; i++) {
      const stepDef = policy.approvalSteps[i];
      const assignedApproverId = await this.resolveApproverForStep({
        stepDef,
        claim,
        employeeUser,
        session,
      });

      steps.push({
        stepNumber: stepDef.stepNumber || i + 1,
        stepName: stepDef.stepName,
        approverRole: stepDef.approverRole,
        assignedApproverId: assignedApproverId,
        status: i === 0 ? 'PENDING' : 'WAITING', // First step starts PENDING
        decision: null,
        comments: '',
        actionAt: null,
        actedBy: null,
        delegationHistory: [],
      });
    }

    return steps;
  }
}

module.exports = ApprovalPolicyService;
