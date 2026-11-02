import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Shield, Search, Eye, Filter } from 'lucide-react';
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
import DataTable from '../components/DataTable';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function AuditReports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('reports'); // reports | audit
  const [reports, setReports] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/reports/expenses');
      if (res.data.success) {
        setReports(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/audit-logs?page=${page}&limit=25`);
      if (res.data.success) {
        setAuditLogs(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    } else {
      fetchAuditLogs();
    }
  }, [activeTab, page]);

  const auditColumns = [
    {
      header: 'Timestamp',
      render: (log) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Actor',
      render: (log) => (
        <div>
          <span className="font-semibold text-slate-800 text-xs">
            {log.actorId ? (typeof log.actorId === 'object' ? log.actorId.name : log.actorId) : 'System Process'}
          </span>
          {log.actorId && typeof log.actorId === 'object' && log.actorId.role && (
            <p className="text-[10px] text-slate-400 capitalize">{log.actorId.role}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Action',
      render: (log) => (
        <span className="font-mono text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
          {log.action}
        </span>
      ),
    },
    {
      header: 'Target Entity',
      render: (log) => (
        <span className="text-xs text-slate-700 font-medium">
          {log.entityType} ({log.entityId ? String(log.entityId).slice(-6) : ''})
        </span>
      ),
    },
    {
      header: 'Remarks / Reason',
      render: (log) => (
        <span className="text-xs text-slate-500 italic truncate max-w-xs block">
          {log.reason || '—'}
        </span>
      ),
    },
    {
      header: 'Details',
      render: (log) => (
        <button
          onClick={() => setSelectedLog(log)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
        >
          View Diff
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Financial Reports & Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated corporate expense spending analytics and immutable append-only event logs.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'reports'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Expense Analytics
        </button>
        {user?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Append-Only Audit Logs
          </button>
        )}
      </div>

      {activeTab === 'reports' ? (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : reports ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">
                  Approved & Reimbursed Spending by Category (₹)
                </h3>
                <div className="h-72">
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

              {/* Department Breakdown */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">
                  Approved Spending Distribution by Department
                </h3>
                <div className="h-72 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reports.byDepartment}
                        dataKey="totalAmount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {reports.byDepartment?.map((entry, index) => (
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
          ) : (
            <p className="text-xs text-slate-400">No report data available.</p>
          )}
        </div>
      ) : (
        <DataTable
          columns={auditColumns}
          data={auditLogs}
          loading={loading}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      {/* Audit Log Diff Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Audit Event: {selectedLog.action}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Target {selectedLog.entityType} ({selectedLog.entityId}) •{' '}
              {new Date(selectedLog.createdAt).toLocaleString()}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Before State
                </span>
                <pre className="p-3 bg-slate-50 rounded-lg border border-slate-200 overflow-x-auto text-[11px] font-mono text-slate-700 max-h-60">
                  {selectedLog.before ? JSON.stringify(selectedLog.before, null, 2) : 'null'}
                </pre>
              </div>

              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  After State
                </span>
                <pre className="p-3 bg-slate-50 rounded-lg border border-slate-200 overflow-x-auto text-[11px] font-mono text-slate-700 max-h-60">
                  {selectedLog.after ? JSON.stringify(selectedLog.after, null, 2) : 'null'}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
