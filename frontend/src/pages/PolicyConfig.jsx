import React, { useState, useEffect } from 'react';
import { ShieldCheck, PlusCircle, AlertCircle, CheckCircle2, ArrowRight, Layers } from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function PolicyConfig() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(10);
  const [minAmount, setMinAmount] = useState(0);
  const [maxAmount, setMaxAmount] = useState('');
  const [allowSelfApproval, setAllowSelfApproval] = useState(false);
  const [steps, setSteps] = useState([
    { stepNumber: 1, stepName: 'Manager Review', approverRole: 'manager' },
  ]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/approval-policies');
      if (res.data.success) {
        setPolicies(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load policies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        stepNumber: prev.length + 1,
        stepName: `Review Step ${prev.length + 1}`,
        approverRole: 'finance',
      },
    ]);
  };

  const removeStep = (index) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreatePolicy = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/admin/approval-policies', {
        name,
        description,
        priority: Number(priority),
        conditions: {
          minAmount: Number(minAmount),
          maxAmount: maxAmount ? Number(maxAmount) : null,
          requiresReceipt: true,
        },
        approvalSteps: steps,
        allowSelfApproval,
      });

      setShowModal(false);
      setName('');
      setDescription('');
      fetchPolicies();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create approval policy.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Approval Policy Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Define multi-tier approval chains, spending thresholds, and rule priorities.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Create Policy
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-4">
          {policies.map((p) => (
            <div
              key={p._id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{p.name}</h3>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      Version {p.version || 1}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      Priority {p.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{p.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                </div>
              </div>

              {/* Policy Thresholds */}
              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-wrap gap-4 text-xs text-slate-700">
                <div>
                  <span className="text-slate-400">Amount Range:</span>{' '}
                  <strong>
                    ₹{p.conditions?.minAmount?.toLocaleString() || 0} –{' '}
                    {p.conditions?.maxAmount ? `₹${p.conditions.maxAmount.toLocaleString()}` : 'Unbounded (No Cap)'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Receipt Required:</span>{' '}
                  <strong>{p.conditions?.requiresReceipt ? 'Yes' : 'No'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Self-Approval:</span>{' '}
                  <strong className={p.allowSelfApproval ? 'text-rose-600' : 'text-emerald-700'}>
                    {p.allowSelfApproval ? 'Permitted (Exception)' : 'Strictly Prohibited (Default)'}
                  </strong>
                </div>
              </div>

              {/* Approval Steps Stepper */}
              <div className="mt-5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Approval Steps Chain ({p.approvalSteps?.length || 0} levels)
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {p.approvalSteps?.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50/60 border border-indigo-200 text-xs">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
                          {step.stepNumber}
                        </span>
                        <div>
                          <p className="font-bold text-slate-800">{step.stepName}</p>
                          <p className="text-[10px] text-indigo-600 font-semibold uppercase">
                            Role: {step.approverRole}
                          </p>
                        </div>
                      </div>
                      {idx < p.approvalSteps.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Policy Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Create Approval Policy</h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure amount rules and sequential approver roles.
            </p>

            {error && <p className="mt-3 text-xs text-rose-600 bg-rose-50 p-2 rounded">{error}</p>}

            <form onSubmit={handleCreatePolicy} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Policy Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tier 4: Capital Equipment > ₹100,000"
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe when this policy is applied..."
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Amount (₹)</label>
                  <input
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Amount (₹)</label>
                  <input
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    placeholder="Empty for no cap"
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    placeholder="10"
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Steps builder */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-700">Approval Steps Chain</span>
                  <button
                    type="button"
                    onClick={addStep}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    + Add Step
                  </button>
                </div>
                <div className="space-y-2">
                  {steps.map((st, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <span className="font-bold text-slate-500 w-4">{idx + 1}.</span>
                      <input
                        type="text"
                        value={st.stepName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSteps((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, stepName: val } : s))
                          );
                        }}
                        className="flex-1 p-1.5 rounded border border-slate-300 text-xs"
                      />
                      <select
                        value={st.approverRole}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSteps((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, approverRole: val } : s))
                          );
                        }}
                        className="p-1.5 rounded border border-slate-300 text-xs bg-white"
                      >
                        <option value="manager">Manager</option>
                        <option value="finance">Finance</option>
                        <option value="admin">Admin</option>
                      </select>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          className="text-rose-500 hover:text-rose-700 text-xs px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="selfApproval"
                  checked={allowSelfApproval}
                  onChange={(e) => setAllowSelfApproval(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <label htmlFor="selfApproval" className="text-xs text-slate-700">
                  Allow self-approval (Exception policy override)
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  Create Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
