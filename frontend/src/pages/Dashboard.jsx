import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Inbox,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const sumRes = await api.get('/dashboard/summary');
        if (sumRes.data.success) {
          setSummary(sumRes.data.data);
        }

        if (['manager', 'finance', 'admin'].includes(user?.role)) {
          try {
            const repRes = await api.get('/dashboard/reports/expenses');
            if (repRes.data?.success) {
              setReports(repRes.data.data);
            }
          } catch (repErr) {
            console.error('Failed to load dashboard reports:', repErr);
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard summary:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
            {user?.role} Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Welcome back, {user?.name}
          </h1>
          <p className="text-sm text-slate-300 mt-2">
            SpendWise keeps team expenses compliant, approval chains transparent, and budget
            commitments strictly audited in real-time.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {['employee', 'manager'].includes(user?.role) && (
              <Link
                to="/expenses/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Submit New Expense
              </Link>
            )}
            {['manager', 'admin'].includes(user?.role) && (
              <Link
                to="/approvals"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
              >
                <Inbox className="w-4 h-4" />
                Approval Inbox
              </Link>
            )}
            {['finance', 'admin'].includes(user?.role) && (
              <Link
                to="/finance/queue"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                Finance Reimbursement Queue
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {user?.role === 'employee' && summary && (
          <>
            <StatCard
              title="Draft Claims"
              value={summary.draftsCount || 0}
              subtitle="Unsubmitted expenses"
              icon={FileText}
              color="amber"
            />
            <StatCard
              title="Under Review"
              value={summary.inReviewCount || 0}
              subtitle="Pending approver action"
              icon={Clock}
              color="blue"
            />
            <StatCard
              title="Approved"
              value={summary.approvedCount || 0}
              subtitle="Queued for reimbursement"
              icon={CheckCircle2}
              color="indigo"
            />
            <StatCard
              title="Total Reimbursed"
              value={`₹${(summary.totalReimbursed || 0).toLocaleString()}`}
              subtitle="Successfully paid out"
              icon={DollarSign}
              color="emerald"
            />
          </>
        )}

        {user?.role === 'manager' && summary && (
          <>
            <StatCard
              title="Pending Approvals"
              value={summary.pendingApprovalsCount || 0}
              subtitle="Claims needing your review"
              icon={Inbox}
              color="amber"
            />
            <StatCard
              title="Team Claims"
              value={summary.departmentTotalClaims || 0}
              subtitle="Total departmental claims"
              icon={FileText}
              color="indigo"
            />
            <StatCard
              title="Budget Utilization"
              value={summary.budget ? `${summary.budget.utilization}%` : 'N/A'}
              subtitle={
                summary.budget
                  ? `₹${summary.budget.committed.toLocaleString()} committed`
                  : 'No active budget'
              }
              icon={TrendingUp}
              color={summary.budget?.utilization > 80 ? 'rose' : 'emerald'}
            />
            <StatCard
              title="Department Budget"
              value={summary.budget ? `₹${summary.budget.allocated.toLocaleString()}` : 'N/A'}
              subtitle="Total allocated for period"
              icon={PieIcon}
              color="blue"
            />
          </>
        )}

        {user?.role === 'finance' && summary && (
          <>
            <StatCard
              title="Approved Unpaid"
              value={summary.approvedUnpaidCount || 0}
              subtitle="Ready for scheduling"
              icon={CheckCircle2}
              color="indigo"
            />
            <StatCard
              title="Scheduled Payouts"
              value={summary.scheduledCount || 0}
              subtitle="Pending payment execution"
              icon={Clock}
              color="amber"
            />
            <StatCard
              title="Claims In Review"
              value={summary.pendingReviews || 0}
              subtitle="Active approval steps"
              icon={Inbox}
              color="blue"
            />
            <StatCard
              title="Total Paid"
              value={`₹${(summary.totalPaidAmount || 0).toLocaleString()}`}
              subtitle="Completed reimbursements"
              icon={DollarSign}
              color="emerald"
            />
          </>
        )}

        {user?.role === 'admin' && summary && (
          <>
            <StatCard
              title="Total Users"
              value={summary.totalUsers || 0}
              subtitle="Active employees & managers"
              icon={FileText}
              color="indigo"
            />
            <StatCard
              title="Total Claims"
              value={summary.totalClaims || 0}
              subtitle="All system claims"
              icon={FileText}
              color="blue"
            />
            <StatCard
              title="Active Workflows"
              value={summary.activeWorkflows || 0}
              subtitle="In-progress approval state machines"
              icon={Clock}
              color="amber"
            />
            <StatCard
              title="Active Budgets"
              value={summary.activeBudgetsCount || 0}
              subtitle="Monitored financial scopes"
              icon={PieIcon}
              color="emerald"
            />
          </>
        )}
      </div>

      {/* Analytical Charts for Staff Roles */}
      {reports && (reports.byCategory?.length > 0 || reports.byDepartment?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending by Category */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">
              Spending by Expense Category (₹)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reports.byCategory}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    formatter={(val) => [`₹${val.toLocaleString()}`, 'Total Spent']}
                    contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
                  />
                  <Bar dataKey="totalAmount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Spending by Department */}
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">
              Spending by Department (₹)
            </h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reports.byDepartment}
                    dataKey="totalAmount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {reports.byDepartment.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`₹${val.toLocaleString()}`, 'Total Spent']}
                    contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
