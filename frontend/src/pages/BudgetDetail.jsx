import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, PieChart, ShieldAlert, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';

export default function BudgetDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideClaimId, setOverrideClaimId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [unbudgetedClaims, setUnbudgetedClaims] = useState([]);
  const [error, setError] = useState(null);

  const fetchUtilization = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/budgets/${id}/utilization`);
      if (res.data.success) {
        setData(res.data.data);
      }

      // Fetch pending claims for potential override
      const claimsRes = await api.get('/expenses?limit=50');
      if (claimsRes.data.success) {
        setUnbudgetedClaims(claimsRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load budget detail:', err);
      setError('Failed to fetch budget utilization detail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUtilization();
  }, [id]);

  const handleApplyOverride = async (e) => {
    e.preventDefault();
    try {
      await api.post('/budgets/overrides', {
        claimId: overrideClaimId,
        reason: overrideReason,
      });
      setShowOverrideModal(false);
      setOverrideClaimId('');
      setOverrideReason('');
      fetchUtilization();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply budget override.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const { budget, metrics, activeReservations } = data;
  const isStaff = ['finance', 'admin'].includes(user?.role);

  const reservationColumns = [
    {
      header: 'Claim & Submitter',
      render: (r) => (
        <div>
          <Link
            to={`/expenses/${r.claimId?._id}`}
            className="font-bold text-indigo-600 hover:text-indigo-800 text-xs"
          >
            {r.claimId?.claimNumber} — {r.claimId?.title}
          </Link>
          <p className="text-[11px] text-slate-500">
            By {r.claimId?.employeeId?.name} ({r.claimId?.employeeId?.email})
          </p>
        </div>
      ),
    },
    {
      header: 'Committed Reservation',
      render: (r) => (
        <span className="font-bold text-slate-900">
          {r.currency} {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Reservation Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Reserved At',
      render: (r) => (
        <span className="text-xs text-slate-500">
          {new Date(r.reservedAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/budgets"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Budgets
        </Link>

        {isStaff && (
          <button
            onClick={() => setShowOverrideModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
          >
            <ShieldAlert className="w-4 h-4" />
            Apply Budget Override
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Main Budget Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
              {budget.scopeType} Budget
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">{budget.name}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Active Period: {new Date(budget.periodStart).toLocaleDateString()} to{' '}
              {new Date(budget.periodEnd).toLocaleDateString()}
            </p>
          </div>
          <div className="sm:text-right">
            <span className="text-xs text-slate-400 font-medium">Allocated Budget</span>
            <div className="text-3xl font-extrabold text-slate-900">
              {budget.currency} {metrics.allocated.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Big Utilization Bar */}
        <div className="pt-6">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-slate-700">Budget Consumption</span>
            <span className={metrics.utilizationPercentage >= 80 ? 'text-rose-600' : 'text-indigo-600'}>
              {metrics.utilizationPercentage}% Utilized
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden flex">
            {/* Actual Spent Portion */}
            <div
              className="bg-emerald-600 h-full"
              style={{
                width: `${Math.min(100, (metrics.actual / metrics.allocated) * 100)}%`,
              }}
              title="Actual Reimbursed"
            />
            {/* Committed Portion */}
            <div
              className="bg-amber-500 h-full"
              style={{
                width: `${Math.min(100 - (metrics.actual / metrics.allocated) * 100, (metrics.committed / metrics.allocated) * 100)}%`,
              }}
              title="Committed Reservations"
            />
          </div>
          <div className="mt-3 flex items-center gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-600" />
              <span>Actual Reimbursed: <strong>₹{metrics.actual.toLocaleString()}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-amber-500" />
              <span>Committed (In Review): <strong>₹{metrics.committed.toLocaleString()}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-slate-200" />
              <span>Available Budget: <strong>₹{metrics.available.toLocaleString()}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Reservations Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
          Active Budget Reservations ({activeReservations.length})
        </h3>
        <p className="text-xs text-slate-500">
          Claims that currently hold atomic budget reservations pending approval or payout.
        </p>

        <DataTable
          columns={reservationColumns}
          data={activeReservations}
          emptyMessage="No active reservations. All budget is uncommitted."
        />
      </div>

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Authorize Budget Overrun</h3>
            <p className="text-xs text-slate-500 mt-1">
              Apply an authorized financial override to reserve funds for an expense exceeding
              standard available budget limits. This action is permanently audited.
            </p>

            <form onSubmit={handleApplyOverride} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Claim</label>
                <select
                  required
                  value={overrideClaimId}
                  onChange={(e) => setOverrideClaimId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">Select claim...</option>
                  {unbudgetedClaims.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.claimNumber} — {c.title} (₹{c.amount})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Justification / Override Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="State the executive or emergency financial justification..."
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!overrideClaimId || !overrideReason.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-40"
                >
                  Authorize Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
