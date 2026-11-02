import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Building,
  CreditCard,
  FileText,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  XCircle,
  RotateCcw,
  Paperclip,
  Eye,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Timeline from '../components/Timeline';
import ReceiptModal from '../components/ReceiptModal';
import ConfirmModal from '../components/ConfirmModal';

export default function ExpenseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [claim, setClaim] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Modals state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showResubmitModal, setShowResubmitModal] = useState(false);

  // Resubmit fields
  const [resubmitTitle, setResubmitTitle] = useState('');
  const [resubmitAmount, setResubmitAmount] = useState('');
  const [resubmitNotes, setResubmitNotes] = useState('');

  const loadClaimDetails = async () => {
    try {
      setLoading(true);
      const [claimRes, timelineRes] = await Promise.all([
        api.get(`/expenses/${id}`),
        api.get(`/expenses/${id}/timeline`),
      ]);

      if (claimRes.data.success) {
        setClaim(claimRes.data.data);
        setResubmitTitle(claimRes.data.data.title);
        setResubmitAmount(claimRes.data.data.amount);
      }
      if (timelineRes.data.success) {
        setTimeline(timelineRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load claim detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaimDetails();
  }, [id]);

  const handleWithdraw = async (reason) => {
    await api.post(`/expenses/${id}/withdraw`, { reason });
    loadClaimDetails();
  };

  const handleSubmitDraft = async () => {
    await api.post(`/expenses/${id}/submit`);
    loadClaimDetails();
  };

  const handleResubmit = async () => {
    await api.post(`/expenses/${id}/resubmit`, {
      title: resubmitTitle,
      amount: Number(resubmitAmount),
      submissionNotes: resubmitNotes,
    });
    setShowResubmitModal(false);
    loadClaimDetails();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-slate-800">Claim Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">
          The requested claim does not exist or you lack permission to view it.
        </p>
        <Link
          to="/expenses"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Expenses
        </Link>
      </div>
    );
  }

  const isOwner = claim.employeeId?._id === user?._id || claim.employeeId === user?._id;
  const canWithdraw = isOwner && ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED'].includes(claim.status);
  const canSubmitDraft = isOwner && claim.status === 'DRAFT';
  const canResubmit = isOwner && claim.status === 'CHANGES_REQUESTED';

  const workflow = claim.activeWorkflowId;

  return (
    <div className="space-y-6">
      {/* Top back button & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/expenses"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Expenses
        </Link>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canSubmitDraft && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-4 h-4" />
              Submit Claim
            </button>
          )}

          {canResubmit && (
            <button
              onClick={() => setShowResubmitModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Respond & Resubmit
            </button>
          )}

          {canWithdraw && (
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              Withdraw Claim
            </button>
          )}
        </div>
      </div>

      {/* Main Claim Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {claim.claimNumber}
              </span>
              <StatusBadge status={claim.status} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">{claim.title}</h1>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
              <span>Submitted by <strong className="text-slate-700">{claim.employeeId?.name}</strong></span>
              <span>•</span>
              <span>{claim.departmentId?.name} ({claim.departmentId?.costCenter})</span>
            </p>
          </div>

          <div className="sm:text-right">
            <span className="text-xs text-slate-400 font-medium">Claim Amount</span>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {claim.currency} {claim.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-slate-500">
              Expense Date: {new Date(claim.expenseDate).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Workflow Progression Stepper */}
        {workflow && workflow.steps && (
          <div className="pt-6">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
              Approval Chain Workflow (Policy v{workflow.policyVersion})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {workflow.steps.map((step, idx) => (
                <div
                  key={step._id || idx}
                  className={`p-4 rounded-xl border text-xs ${
                    step.status === 'APPROVED'
                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                      : step.status === 'PENDING'
                      ? 'bg-amber-50/50 border-amber-300 text-amber-900 ring-2 ring-amber-400/20'
                      : step.status === 'REJECTED'
                      ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                      : step.status === 'INFO_REQUESTED'
                      ? 'bg-orange-50/50 border-orange-200 text-orange-900'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">
                      Step {step.stepNumber}: {step.stepName}
                    </span>
                    <StatusBadge status={step.status} />
                  </div>
                  <p className="text-[11px] mt-1">
                    Assigned:{' '}
                    <strong>{step.assignedApproverId?.name || step.approverRole}</strong>
                  </p>
                  {step.comments && (
                    <div className="mt-2 p-2 rounded bg-white/70 border border-slate-200/60 text-[11px]">
                      <span className="font-semibold text-slate-700">Comment:</span> "{step.comments}"
                    </div>
                  )}
                  {step.actionAt && (
                    <p className="text-[10px] text-slate-400 mt-2">
                      Acted: {new Date(step.actionAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Claim Information */}
        <div className="pt-8 border-t border-slate-100 mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div>
            <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-2">Details</h4>
            <div className="space-y-2 text-slate-700">
              <p>
                <span className="text-slate-400">Category:</span>{' '}
                <strong>{claim.categoryId?.name}</strong>
              </p>
              <p>
                <span className="text-slate-400">Merchant / Vendor:</span>{' '}
                <strong>{claim.merchant}</strong>
              </p>
              <p>
                <span className="text-slate-400">Payment Method:</span>{' '}
                <strong className="capitalize">{claim.paymentMethod?.replace('_', ' ')}</strong>
              </p>
            </div>
          </div>

          <div className="md:col-span-2">
            <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-2">
              Business Purpose
            </h4>
            <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
              {claim.businessPurpose}
            </p>
            {claim.submissionNotes && (
              <div className="mt-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider">
                  Submission Notes
                </span>
                <p className="text-slate-600 mt-1 italic">{claim.submissionNotes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Attached Receipts */}
        <div className="pt-6 border-t border-slate-100 mt-6">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Paperclip className="w-4 h-4 text-slate-400" />
            Receipt Attachments ({claim.receiptIds?.length || 0})
          </h4>
          {claim.receiptIds && claim.receiptIds.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {claim.receiptIds.map((r) => (
                <div
                  key={r._id}
                  onClick={() => setSelectedReceipt(r)}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-300 transition-all cursor-pointer flex items-center gap-3 text-xs group"
                >
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {r.originalFilename}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {(r.size / 1024).toFixed(1)} KB • Click to preview
                    </p>
                  </div>
                  <Eye className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 ml-2" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No receipt attached for this claim.</p>
          )}
        </div>
      </div>

      {/* Audit Event Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-6">
          Audit Log & Event Timeline
        </h3>
        <Timeline events={timeline} />
      </div>

      {/* Receipt Preview Modal */}
      <ReceiptModal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        receipt={selectedReceipt}
      />

      {/* Withdraw Modal */}
      <ConfirmModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onConfirm={handleWithdraw}
        title="Withdraw Expense Claim"
        message="Are you sure you want to withdraw this claim? The active approval workflow will be cancelled and reserved budget released."
        confirmText="Withdraw Claim"
        confirmColor="rose"
        requireInput={true}
        inputLabel="Reason for Withdrawal"
        inputPlaceholder="e.g. Duplicate claim or wrong amount submitted"
      />

      {/* Submit Draft Modal */}
      <ConfirmModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmitDraft}
        title="Submit Expense for Approval"
        message="This will initiate the approval workflow according to organizational policy and commit budget reservation."
        confirmText="Confirm & Submit"
        confirmColor="indigo"
      />

      {/* Resubmit Modal */}
      {showResubmitModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Respond & Resubmit Claim</h3>
            <p className="text-xs text-slate-500 mt-1">
              Update the fields requested by the reviewer to restart review.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={resubmitTitle}
                  onChange={(e) => setResubmitTitle(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount</label>
                <input
                  type="number"
                  value={resubmitAmount}
                  onChange={(e) => setResubmitAmount(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Response / Clarification Notes
                </label>
                <textarea
                  rows={3}
                  value={resubmitNotes}
                  onChange={(e) => setResubmitNotes(e.target.value)}
                  placeholder="Explain the changes made in response to the request..."
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowResubmitModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleResubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Resubmit Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
