import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, CheckCircle2, Clock, Calendar, ExternalLink } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

export default function Reimbursements() {
  const [reimbursements, setReimbursements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => {
    const fetchReimbursements = async () => {
      try {
        setLoading(true);
        let query = `/finance/reimbursements?page=${page}&limit=15`;
        if (statusFilter) query += `&status=${statusFilter}`;

        const res = await api.get(query);
        if (res.data.success) {
          setReimbursements(res.data.data);
          setPagination(res.data.pagination);
        }
      } catch (err) {
        console.error('Failed to load reimbursements:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReimbursements();
  }, [page, statusFilter]);

  const columns = [
    {
      header: 'Payment Reference',
      render: (r) => (
        <div>
          <span className="font-mono font-bold text-slate-800 text-xs">
            {r.paymentReference || 'PENDING ASSIGNMENT'}
          </span>
          <p className="text-[11px] text-slate-400">
            {r.paidAt ? `Paid on ${new Date(r.paidAt).toLocaleDateString()}` : 'Unpaid'}
          </p>
        </div>
      ),
    },
    {
      header: 'Claim & Submitter',
      render: (r) => (
        <div>
          <Link
            to={`/expenses/${r.claimId?._id}`}
            className="font-semibold text-indigo-600 hover:text-indigo-800 text-xs"
          >
            {r.claimId?.claimNumber} — {r.claimId?.title}
          </Link>
          <p className="text-[11px] text-slate-500">
            {r.claimId?.employeeId?.name} • {r.claimId?.departmentId?.name}
          </p>
        </div>
      ),
    },
    {
      header: 'Amount',
      render: (r) => (
        <span className="font-bold text-slate-900">
          {r.currency} {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Processed By',
      render: (r) => (
        <span className="text-xs text-slate-600">
          {r.processedBy ? r.processedBy.name : 'System'}
        </span>
      ),
    },
    {
      header: 'Action',
      render: (r) => (
        <Link
          to={`/expenses/${r.claimId?._id}`}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          View Claim →
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reimbursement Transactions</h1>
        <p className="text-xs text-slate-500 mt-1">
          Historical record of completed and scheduled employee expense payouts.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={reimbursements}
        loading={loading}
        emptyMessage="No reimbursement records found."
        extraFilters={
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PENDING">Pending</option>
          </select>
        }
        pagination={pagination}
        onPageChange={setPage}
      />
    </div>
  );
}
