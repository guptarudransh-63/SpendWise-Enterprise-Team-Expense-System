import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, TrendingUp, DollarSign, Filter, ExternalLink } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import StatCard from '../components/StatCard';

export default function TeamExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => {
    const loadTeamData = async () => {
      try {
        setLoading(true);
        let query = `/expenses?page=${page}&limit=15`;
        if (statusFilter) query += `&status=${statusFilter}`;

        const [expRes, budRes] = await Promise.all([
          api.get(query),
          api.get('/budgets'),
        ]);

        if (expRes.data.success) {
          setExpenses(expRes.data.data);
          setPagination(expRes.data.pagination);
        }

        if (budRes.data.success && budRes.data.data.length > 0) {
          const userDeptId = (user?.departmentId?._id || user?.departmentId)?.toString();
          const deptBudget = budRes.data.data.find(
            (b) => b.scopeType === 'department' && b.scopeId?.toString() === userDeptId
          ) || budRes.data.data[0];
          setBudget(deptBudget);
        }
      } catch (err) {
        console.error('Failed to load team expenses:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTeamData();
  }, [page, statusFilter, user]);

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
            By <strong className="text-slate-700">{row.employeeId?.name}</strong> (
            {row.employeeId?.email})
          </p>
        </div>
      ),
    },
    {
      header: 'Category',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">{row.categoryId?.name}</span>
      ),
    },
    {
      header: 'Expense Date',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {new Date(row.expenseDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Amount',
      render: (row) => (
        <span className="font-bold text-slate-900">
          {row.currency} {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Action',
      render: (row) => (
        <Link
          to={`/expenses/${row._id}`}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          View Details →
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Team Expense Overview</h1>
        <p className="text-xs text-slate-500 mt-1">
          Monitor your department's expenditure patterns, submitted claims, and budget run rates.
        </p>
      </div>

      {/* Department Budget Health Meter */}
      {budget && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Active Department Budget
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">{budget.name}</h3>
            </div>
            <div className="text-sm">
              <span className="text-slate-500">Available: </span>
              <strong className="text-emerald-600 font-bold">
                {budget.currency} {budget.availableAmount.toLocaleString()}
              </strong>{' '}
              / {budget.currency} {budget.allocatedAmount.toLocaleString()}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budget.utilizationPercentage > 90
                  ? 'bg-rose-500'
                  : budget.utilizationPercentage > 75
                  ? 'bg-amber-500'
                  : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.min(100, budget.utilizationPercentage)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Utilization: {budget.utilizationPercentage}%</span>
            <span>
              Committed: ₹{budget.committedAmount.toLocaleString()} • Actual Spend: ₹
              {budget.actualAmount.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Filter and Table */}
      <DataTable
        columns={columns}
        data={expenses}
        loading={loading}
        emptyMessage="No team claims found matching the selected filter."
        extraFilters={
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Reimbursed</option>
              <option value="CHANGES_REQUESTED">Changes Requested</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        }
        pagination={pagination}
        onPageChange={setPage}
      />
    </div>
  );
}
