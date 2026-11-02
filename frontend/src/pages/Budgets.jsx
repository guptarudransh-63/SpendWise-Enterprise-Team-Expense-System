import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, PlusCircle, AlertTriangle, TrendingUp, DollarSign, ExternalLink } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';

export default function Budgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [departments, setDepartments] = useState([]);

  // Create budget form state
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState('department');
  const [scopeId, setScopeId] = useState('');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [periodStart, setPeriodStart] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [periodEnd, setPeriodEnd] = useState(
    new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
  );
  const [error, setError] = useState(null);

  const fetchBudgetData = async () => {
    try {
      setLoading(true);
      const [budRes, alertRes, deptRes] = await Promise.all([
        api.get('/budgets'),
        api.get('/budgets/alerts'),
        api.get('/admin/departments'),
      ]);

      if (budRes.data.success) setBudgets(budRes.data.data);
      if (alertRes.data.success) setAlerts(alertRes.data.data);
      if (deptRes.data.success) {
        setDepartments(deptRes.data.data);
        if (deptRes.data.data.length > 0) setScopeId(deptRes.data.data[0]._id);
      }
    } catch (err) {
      console.error('Failed to load budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const handleCreateBudget = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/budgets', {
        name,
        scopeType,
        scopeId,
        allocatedAmount: Number(allocatedAmount),
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
        currency: 'INR',
      });
      setShowCreateModal(false);
      setName('');
      setAllocatedAmount('');
      fetchBudgetData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create budget.');
    }
  };

  const isStaff = ['finance', 'admin'].includes(user?.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Department & Financial Budgets
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor allocated budgets, active reservations, and real-time utilization.
          </p>
        </div>

        {isStaff && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            Create Budget
          </button>
        )}
      </div>

      {/* Threshold Alerts Banner */}
      {alerts.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <h3 className="text-xs font-bold text-amber-900">
              Budget Warning Threshold Exceeded ({alerts.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {alerts.map((al) => (
              <div
                key={al.budgetId}
                className="bg-white/80 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-slate-900">{al.name}</span>
                  <p className="text-[11px] text-slate-500">
                    Utilized: ₹{al.utilizedAmount.toLocaleString()} / ₹
                    {al.allocatedAmount.toLocaleString()}
                  </p>
                </div>
                <span className="font-bold text-amber-700 text-xs bg-amber-100 px-2 py-0.5 rounded">
                  {al.utilizationPercentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budgets Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {budgets.map((b) => {
            const utilization = b.utilizationPercentage;
            const isHigh = utilization >= 80;

            return (
              <div
                key={b._id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
                        {b.scopeType} scope
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-2">{b.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(b.periodStart).toLocaleDateString()} –{' '}
                        {new Date(b.periodEnd).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>

                  {/* Progress bar */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                      <span className="text-slate-600">Utilization</span>
                      <span className={isHigh ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                        {utilization}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          utilization > 90
                            ? 'bg-rose-500'
                            : utilization >= 80
                            ? 'bg-amber-500'
                            : 'bg-indigo-600'
                        }`}
                        style={{ width: `${Math.min(100, utilization)}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="mt-5 grid grid-cols-3 gap-2 p-3 bg-slate-50/70 rounded-xl border border-slate-100 text-center text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-semibold">
                        Allocated
                      </span>
                      <p className="font-bold text-slate-800 mt-0.5">
                        ₹{b.allocatedAmount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-semibold">
                        Committed
                      </span>
                      <p className="font-bold text-amber-600 mt-0.5">
                        ₹{b.committedAmount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-semibold">
                        Available
                      </span>
                      <p className="font-bold text-emerald-600 mt-0.5">
                        ₹{b.availableAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Actual Reimbursed: <strong>₹{b.actualAmount.toLocaleString()}</strong>
                  </span>
                  <Link
                    to={`/budgets/${b._id}`}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    View Breakdown →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Budget Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Create New Budget</h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure organizational spending caps and periods.
            </p>

            {error && <p className="mt-3 text-xs text-rose-600 bg-rose-50 p-2 rounded">{error}</p>}

            <form onSubmit={handleCreateBudget} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Budget Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Engineering Q1 Budget"
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Scope Type</label>
                  <select
                    value={scopeType}
                    onChange={(e) => setScopeType(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="department">Department</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Allocated Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={allocatedAmount}
                  onChange={(e) => setAllocatedAmount(e.target.value)}
                  placeholder="1000000"
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Period Start</label>
                  <input
                    type="date"
                    required
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Period End</label>
                  <input
                    type="date"
                    required
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  Create Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
