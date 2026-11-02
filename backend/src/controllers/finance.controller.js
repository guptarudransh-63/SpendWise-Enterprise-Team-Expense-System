const ExpenseClaim = require('../models/ExpenseClaim');
const Reimbursement = require('../models/Reimbursement');
const ReimbursementService = require('../services/reimbursement.service');

exports.getFinanceClaims = async (req, res, next) => {
  try {
    const { status = 'APPROVED', page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status === 'all') {
      filter.status = { $in: ['APPROVED', 'SCHEDULED', 'PAID'] };
    } else {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      ExpenseClaim.find(filter)
        .populate('employeeId', 'name email role departmentId')
        .populate('categoryId', 'name code')
        .populate('departmentId', 'name costCenter')
        .populate('receiptIds')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ExpenseClaim.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.scheduleReimbursement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scheduledAt, notes } = req.body;

    const reimbursement = await ReimbursementService.scheduleReimbursement({
      claimId: id,
      scheduledAt,
      notes,
      actor: req.user,
    });

    res.status(200).json({
      success: true,
      message: 'Reimbursement scheduled successfully.',
      data: reimbursement,
    });
  } catch (error) {
    next(error);
  }
};

exports.completeReimbursement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentReference, paidAt, notes } = req.body;

    const reimbursement = await ReimbursementService.completeReimbursement({
      claimId: id,
      paymentReference,
      paidAt,
      notes,
      actor: req.user,
    });

    res.status(200).json({
      success: true,
      message: 'Reimbursement completed successfully and budget updated.',
      data: reimbursement,
    });
  } catch (error) {
    next(error);
  }
};

exports.getReimbursements = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Reimbursement.find(filter)
        .populate({
          path: 'claimId',
          populate: [
            { path: 'employeeId', select: 'name email' },
            { path: 'departmentId', select: 'name costCenter' },
          ],
        })
        .populate('processedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Reimbursement.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getReimbursementById = async (req, res, next) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id)
      .populate({
        path: 'claimId',
        populate: [
          { path: 'employeeId', select: 'name email role' },
          { path: 'categoryId', select: 'name code' },
          { path: 'departmentId', select: 'name costCenter' },
        ],
      })
      .populate('processedBy', 'name email role');

    if (!reimbursement) {
      return res.status(404).json({
        success: false,
        error: 'Reimbursement record not found',
      });
    }

    res.status(200).json({
      success: true,
      data: reimbursement,
    });
  } catch (error) {
    next(error);
  }
};
