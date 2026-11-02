import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox,
  CheckCircle,
  XCircle,
  HelpCircle,
  UserCheck,
  Eye,
  Clock,
  AlertCircle,
} from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';

export default function ManagerInbox() {
  const [inboxWorkflows, setInboxWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null); // { workflowId, stepId, claim }
  const [modalAction, setModalAction] = useState(null); // 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'REASSIGN'
  const [usersList, setUsersList] = useState([]);
  const [selectedNewApprover, setSelectedNewApprover] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [error, setError] = useState(null);

  const fetchInbox = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/approvals/inbox');
      if (res.data.success) {
        setInboxWorkflows(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load approval inbox:', err);
      setError('Failed to load approvals inbox.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
    // Load users list for delegation
    api.get('/admin/users').then((res) => {
      if (res.data.success) setUsersList(res.data.data);
    }).catch(() => {});
  }, []);

  const handleActionConfirm = async (commentOrReason) => {
    if (!selectedItem) return;
    const { workflowId, stepId } = selectedItem;

    try {
      if (modalAction === 'APPROVE') {
        await api.post(`/approvals/${workflowId}/steps/${stepId}/approve`, {
          comments: commentOrReason || 'Approved',
        });
      } else if (modalAction === 'REJECT') {
        await api.post(`/approvals/${workflowId}/steps/${stepId}/reject`, {
          reason: commentOrReason,
        });
      } else if (modalAction === 'REQUEST_INFO') {
        await api.post(`/approvals/${workflowId}/steps/${stepId}/request-information`, {
          comments: commentOrReason,
        });
      } else if (modalAction === 'REASSIGN') {
        await api.post(`/approvals/${workflowId}/steps/${stepId}/reassign`, {
          newApproverId: selectedNewApprover,
          reason: reassignReason,
        });
      }

      setSelectedItem(null);
      setModalAction(null);
      fetchInbox();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
      throw err;
    }
  };

  const columns = [
    {
      header: 'Claim & Submitter',
      render: (wf) => {
        const claim = wf.claimId;
        return (
          <div>
            <Link
              to={`/expenses/${claim._id}`}
              className="font-bold text-indigo-600 hover:text-indigo-800 text-sm"
            >
              {claim.claimNumber} — {claim.title}
            </Link>
            <p className="text-xs text-slate-500 mt-0.5">
              By <strong className="text-slate-700">{claim.employeeId?.name}</strong> •{' '}
              {claim.departmentId?.name}
            </p>
          </div>
        );
      },
    },
    {
      header: 'Category',
      render: (wf) => (
        <span className="text-xs text-slate-600 font-medium">
          {wf.claimId?.categoryId?.name || 'General'}
        </span>
      ),
    },
    {
      header: 'Amount',
      render: (wf) => (
        <span className="font-bold text-slate-900">
          {wf.claimId?.currency} {wf.claimId?.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Current Step',
      render: (wf) => {
        const currentStep = wf.steps[wf.currentStepIndex];
        return (
          <div>
            <span className="font-medium text-xs text-slate-800">
              Step {currentStep?.stepNumber}: {currentStep?.stepName}
            </span>
            <p className="text-[10px] text-slate-400">
              Assigned: {currentStep?.assignedApproverId?.name}
            </p>
          </div>
        );
      },
    },
    {
      header: 'Claim Age',
      render: (wf) => {
        const submitted = new Date(wf.claimId?.submittedAt || wf.createdAt);
        const diffDays = Math.floor((new Date() - submitted) / (1000 * 3600 * 24));
        return (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {diffDays === 0 ? 'Today' : `${diffDays}d ago`}
          </span>
        );
      },
    },
    {
      header: 'Quick Decisions',
      className: 'text-right',
      render: (wf) => {
        const currentStep = wf.steps[wf.currentStepIndex];
        return (
          <div className="flex items-center justify-end gap-1.5">
            {/* Quick Approve */}
            <button
              onClick={() => {
                setSelectedItem({ workflowId: wf._id, stepId: currentStep._id, claim: wf.claimId });
                setModalAction('APPROVE');
              }}
              title="Approve Claim"
              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
            </button>

            {/* Request Info */}
            <button
              onClick={() => {
                setSelectedItem({ workflowId: wf._id, stepId: currentStep._id, claim: wf.claimId });
                setModalAction('REQUEST_INFO');
              }}
              title="Request Additional Information"
              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Quick Reject */}
            <button
              onClick={() => {
                setSelectedItem({ workflowId: wf._id, stepId: currentStep._id, claim: wf.claimId });
                setModalAction('REJECT');
              }}
              title="Reject Claim"
              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>

            {/* Reassign */}
            <button
              onClick={() => {
                setSelectedItem({ workflowId: wf._id, stepId: currentStep._id, claim: wf.claimId });
                setModalAction('REASSIGN');
              }}
              title="Delegate / Reassign"
              className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition-colors"
            >
              <UserCheck className="w-4 h-4" />
            </button>

            {/* View full claim */}
            <Link
              to={`/expenses/${wf.claimId._id}`}
              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors ml-1"
              title="View Claim Details"
            >
              <Eye className="w-4 h-4" />
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Manager Approval Inbox</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review pending employee claims assigned to you according to company expense policies.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={inboxWorkflows}
        loading={loading}
        emptyMessage="Your approval inbox is clear! No claims are currently pending your decision."
      />

      {/* Confirm Modal for Approve / Reject / Info */}
      {modalAction && modalAction !== 'REASSIGN' && (
        <ConfirmModal
          isOpen={!!modalAction}
          onClose={() => {
            setModalAction(null);
            setSelectedItem(null);
          }}
          onConfirm={handleActionConfirm}
          title={
            modalAction === 'APPROVE'
              ? `Approve Claim ${selectedItem?.claim?.claimNumber}`
              : modalAction === 'REJECT'
              ? `Reject Claim ${selectedItem?.claim?.claimNumber}`
              : `Request Info for ${selectedItem?.claim?.claimNumber}`
          }
          message={
            modalAction === 'APPROVE'
              ? `Confirm approval of ${selectedItem?.claim?.currency} ${selectedItem?.claim?.amount}? The claim will advance to the next step or final approval.`
              : modalAction === 'REJECT'
              ? 'Rejecting this claim will immediately cancel the workflow and release the committed budget reservation back to the department.'
              : 'The claim will be returned to the employee to modify details and provide requested clarifications.'
          }
          confirmText={
            modalAction === 'APPROVE'
              ? 'Approve'
              : modalAction === 'REJECT'
              ? 'Reject Claim'
              : 'Send Request'
          }
          confirmColor={
            modalAction === 'APPROVE'
              ? 'emerald'
              : modalAction === 'REJECT'
              ? 'rose'
              : 'amber'
          }
          requireInput={modalAction !== 'APPROVE'}
          inputLabel={modalAction === 'REJECT' ? 'Rejection Reason (Required)' : 'Notes / Clarification Requested'}
          inputPlaceholder={
            modalAction === 'REJECT'
              ? 'State policy violation or reason for denial...'
              : 'Describe missing documentation or questions...'
          }
        />
      )}

      {/* Reassign Modal */}
      {modalAction === 'REASSIGN' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Delegate / Reassign Approval</h3>
            <p className="text-xs text-slate-500 mt-1">
              Select an authorized manager or administrator to act on this step.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Approver</label>
                <select
                  value={selectedNewApprover}
                  onChange={(e) => setSelectedNewApprover(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">Select user...</option>
                  {usersList
                    .filter((u) => ['manager', 'admin', 'finance'].includes(u.role))
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role} - {u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Delegation
                </label>
                <textarea
                  rows={3}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Out of office, conflict of interest, or secondary review required..."
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setModalAction(null);
                  setSelectedItem(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={!selectedNewApprover || !reassignReason.trim()}
                onClick={() => handleActionConfirm()}
                className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-40"
              >
                Reassign Step
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
