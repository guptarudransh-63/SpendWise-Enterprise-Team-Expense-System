import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, ExternalLink, Filter } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

export default function MyExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const tabs = [
    { key: 'ALL', label: 'All Claims' },
    { key: 'DRAFT', label: 'Drafts' },
    { key: 'UNDER_REVIEW', label: 'In Review' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'PAID', label: 'Reimbursed' },
    { key: 'REJECTED', label: 'Rejected' },
  ];

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      let query = `/expenses?page=${page}&limit=15&scope=personal`;
      if (activeTab !== 'ALL') {
        query += `&status=${activeTab}`;
      }
      if (search) {
        query += `&search=${encodeURIComponent(search)}`;
      }

      const res = await api.get(query);
      if (res.data.success) {
        setExpenses(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [activeTab, page, search]);

  const columns = [
    {
      header: 'Claim Number',
      accessor: 'claimNumber',
      render: (row) => (
        <Link
          to={`/expenses/${row._id}`}
          className="font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          {row.claimNumber}
          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
        </Link>
      ),
    },
    {
      header: 'Title & Merchant',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="text-xs text-slate-500">{row.merchant}</p>
        </div>
      ),
    },
    {
      header: 'Category',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {row.categoryId?.name || 'General'}
        </span>
      ),
    },
    {
      header: 'Date',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {new Date(row.expenseDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Amount',
      render: (row) => (
        <span className="font-semibold text-slate-900">
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
      {/* Header with Title and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Expense Claims</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track submission history, review progress, and reimbursement payouts.
          </p>
        </div>
        <Link
          to="/expenses/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          New Claim
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setPage(1);
            }}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={expenses}
        loading={loading}
        emptyMessage="No expense claims found matching filter criteria."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by claim #, title, or vendor..."
        pagination={pagination}
        onPageChange={setPage}
      />
    </div>
  );
}
