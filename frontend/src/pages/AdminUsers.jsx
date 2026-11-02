import React, { useState, useEffect } from 'react';
import { Users, Building2, PlusCircle, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

export default function AdminUsers() {
  const [activeTab, setActiveTab] = useState('users'); // users | departments
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // New user modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password123!');
  const [role, setRole] = useState('employee');
  const [departmentId, setDepartmentId] = useState('');
  const [managerId, setManagerId] = useState('');

  // New department modal
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [costCenter, setCostCenter] = useState('');

  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [uRes, dRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/departments'),
      ]);
      if (uRes.data.success) setUsers(uRes.data.data);
      if (dRes.data.success) setDepartments(dRes.data.data);
    } catch (err) {
      console.error('Failed to load users/departments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/admin/users', {
        name,
        email,
        password,
        role,
        departmentId: departmentId || null,
        managerId: managerId || null,
      });
      setShowUserModal(false);
      setName('');
      setEmail('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user.');
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/admin/departments', {
        name: deptName,
        costCenter,
      });
      setShowDeptModal(false);
      setDeptName('');
      setCostCenter('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create department.');
    }
  };

  const userColumns = [
    {
      header: 'Name & Email',
      render: (u) => (
        <div>
          <p className="font-bold text-slate-800 text-xs">{u.name}</p>
          <p className="text-[11px] text-slate-400">{u.email}</p>
        </div>
      ),
    },
    {
      header: 'Role',
      render: (u) => (
        <span className="capitalize font-semibold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
          {u.role}
        </span>
      ),
    },
    {
      header: 'Department',
      render: (u) => (
        <span className="text-xs text-slate-600 font-medium">{u.departmentId?.name || '—'}</span>
      ),
    },
    {
      header: 'Direct Manager',
      render: (u) => (
        <span className="text-xs text-slate-600">{u.managerId?.name || '—'}</span>
      ),
    },
    {
      header: 'Status',
      render: (u) => <StatusBadge status={u.status} />,
    },
  ];

  const deptColumns = [
    {
      header: 'Department Name',
      render: (d) => <span className="font-bold text-slate-800 text-xs">{d.name}</span>,
    },
    {
      header: 'Cost Center Code',
      render: (d) => (
        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {d.costCenter}
        </span>
      ),
    },
    {
      header: 'Department Head',
      render: (d) => (
        <span className="text-xs text-slate-600">{d.managerId?.name || 'Unassigned'}</span>
      ),
    },
    {
      header: 'Status',
      render: (d) => <StatusBadge status={d.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Organization & Users</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage employee access, manager hierarchies, and cost center departments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'users' ? (
            <button
              onClick={() => setShowUserModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add User
            </button>
          ) : (
            <button
              onClick={() => setShowDeptModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add Department
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'departments'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Departments ({departments.length})
        </button>
      </div>

      {activeTab === 'users' ? (
        <DataTable columns={userColumns} data={users} loading={loading} />
      ) : (
        <DataTable columns={deptColumns} data={departments} loading={loading} />
      )}

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Add New User</h3>
            {error && <p className="mt-2 text-xs text-rose-600 bg-rose-50 p-2 rounded">{error}</p>}
            <form onSubmit={handleCreateUser} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="finance">Finance</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">None</option>
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
                  Manager (Approver)
                </label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">None</option>
                  {users
                    .filter((u) => ['manager', 'admin'].includes(u.role))
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Add Department</h3>
            {error && <p className="mt-2 text-xs text-rose-600 bg-rose-50 p-2 rounded">{error}</p>}
            <form onSubmit={handleCreateDept} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Legal & Compliance"
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cost Center Code</label>
                <input
                  type="text"
                  required
                  value={costCenter}
                  onChange={(e) => setCostCenter(e.target.value.toUpperCase())}
                  placeholder="e.g. LGL-004"
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
