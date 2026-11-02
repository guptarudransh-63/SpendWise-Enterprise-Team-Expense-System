import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Calendar, CheckCircle2, DollarSign, AlertCircle, ExternalLink } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';

export default function FinanceQueue() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('APPROVED'); // APPROVED | SCHEDULED | all
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  // Form inputs
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [error, setError] = useState(null);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/finance/claims?status=${activeTab}`);
      if (res.data.success) {
        setClaims(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load finance claims:', err);
      setError('Failed to fetch finance queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [activeTab]);

  const handleScheduleConfirm = async () => {
    if (!selectedClaim) return;
    try {
      await api.post(`/finance/claims/${selectedClaim._id}/schedule`, {
        scheduledAt: new Date(scheduledDate).toISOString(),
        notes: scheduleNotes,
      });
      setShowScheduleModal(false);
      setSelectedClaim(null);
      fetchQueue();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule payment.');
    }
  };

  const handlePayConfirm = async () => {
    if (!selectedClaim) return;
    try {
      await api.post(`/finance/claims/${selectedClaim._id}/complete`, {
        paymentReference: paymentRef,
        notes: paymentNotes,
      });
      setShowPayModal(false);
      setSelectedClaim(null);
      fetchQueue();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete payment.');
    }
  };

  const columns = [
    {
      header: 'Claim & Employee',
      render: (row) => (
        <div>
          <Link
            to={`/expenses/${row._id}`}
            className="font-bold text-indigo-600 hover:text-indigo-800 text-sm"
          >
            {row.claimNumber} — {row.title}
          </Link>
          <p className="text-xs text-slate-500 mt-0.5">
            By <strong className="text-slate-700">{row.employeeId?.name}</strong> •{' '}
            {row.departmentId?.name}
          </p>
        </div>
      ),
    },
    {
      header: 'Category & Vendor',
      render: (row) => (
        <div>
          <span className="text-xs text-slate-700 font-medium">{row.categoryId?.name}</span>
          <p className="text-[11px] text-slate-400">{row.merchant}</p>
        </div>
      ),
    },
    {
      header: 'Amount',
      render: (row) => (
        <span className="font-extrabold text-slate-900">
          {row.currency} {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Finance Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status === 'APPROVED' && (
            <button
              onClick={() => {
                setSelectedClaim(row);
                setShowScheduleModal(true);
              }}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule Payout
            </button>
          )}

          {(row.status === 'APPROVED' || row.status === 'SCHEDULED') && (
            <button
              onClick={() => {
                setSelectedClaim(row);
                setPaymentRef(`TXN-${Date.now().toString().slice(-6)}`);
                setShowPayModal(true);
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Mark Reimbursed
            </button>
          )}

          <Link
            to={`/expenses/${row._id}`}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
            title="View Details"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Finance Review & Reimbursement Queue
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Schedule and execute bank reimbursements for fully approved employee expense claims.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('APPROVED')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'APPROVED'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Approved & Unpaid
        </button>
        <button
          onClick={() => setActiveTab('SCHEDULED')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'SCHEDULED'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Scheduled Payouts
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          All Payout Claims
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={claims}
        loading={loading}
        emptyMessage="No approved claims currently awaiting reimbursement in this view."
      />

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Schedule Reimbursement</h3>
            <p className="text-xs text-slate-500 mt-1">
              Select planned disbursement date for claim {selectedClaim?.claimNumber} (
              {selectedClaim?.currency} {selectedClaim?.amount.toLocaleString()}).
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="e.g. Scheduled in upcoming bi-weekly payroll batch..."
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Confirm Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Reimbursement Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Execute Reimbursement Payout</h3>
            <p className="text-xs text-slate-500 mt-1">
              Complete payout for {selectedClaim?.claimNumber}. This will fulfill the budget
              commitment into actual spending without double-counting.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Reference / Transaction ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. NEFT-UTIB000291-84729103 / UTR-92812"
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Notes</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Direct bank wire to employee HDFC salary account..."
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={!paymentRef.trim()}
                onClick={handlePayConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40"
              >
                Complete Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
