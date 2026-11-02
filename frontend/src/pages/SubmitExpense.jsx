import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  UploadCloud,
  FileCheck,
  AlertCircle,
  HelpCircle,
  Trash2,
  CheckCircle,
  ArrowRight,
  Info,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function SubmitExpense() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [departmentId, setDepartmentId] = useState(user?.departmentId?._id || user?.departmentId || '');
  const [paymentMethod, setPaymentMethod] = useState('personal_card');
  const [businessPurpose, setBusinessPurpose] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');

  // Uploaded receipts
  const [uploadedReceipts, setUploadedReceipts] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (user?.departmentId && !departmentId) {
      setDepartmentId(user.departmentId._id || user.departmentId);
    }
  }, [user]);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        setLoading(true);
        const [catRes, deptRes] = await Promise.all([
          api.get('/admin/categories'),
          api.get('/admin/departments'),
        ]);
        if (catRes.data.success) {
          setCategories(catRes.data.data.filter((c) => c.status === 'active'));
          if (catRes.data.data.length > 0) {
            setCategoryId(catRes.data.data[0]._id);
          }
        }
        if (deptRes.data.success) {
          const activeDepts = deptRes.data.data.filter((d) => d.status === 'active');
          setDepartments(activeDepts);
          if (!departmentId && activeDepts.length > 0) {
            setDepartmentId(user?.departmentId?._id || user?.departmentId || activeDepts[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to load categories/departments:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMetadata();
  }, []);

  const selectedCategory = categories.find((c) => c._id === categoryId);

  // File Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Receipt file size must be less than 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('receipt', file);

    setUploadingFile(true);
    setError(null);
    try {
      const res = await api.post('/expenses/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setUploadedReceipts((prev) => [...prev, res.data.data]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload receipt file.');
    } finally {
      setUploadingFile(false);
    }
  };

  const removeReceipt = (index) => {
    setUploadedReceipts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (submitDirectly = false) => {
    setError(null);
    setSuccess(null);

    // Frontend pre-check for required receipt
    if (submitDirectly && selectedCategory?.receiptRequired && uploadedReceipts.length === 0) {
      setError(`Category "${selectedCategory.name}" strictly requires at least one receipt attachment before submitting for approval.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title,
        description,
        categoryId,
        expenseDate: new Date(expenseDate).toISOString(),
        merchant,
        amount: Number(amount),
        currency,
        departmentId: departmentId || user?.departmentId?._id || user?.departmentId,
        paymentMethod,
        businessPurpose,
        submissionNotes,
        receiptIds: uploadedReceipts.map((r) => r._id),
      };

      // 1. Create Draft
      const draftRes = await api.post('/expenses', payload);
      const claimId = draftRes.data.data._id;

      if (submitDirectly) {
        // 2. Submit Claim for Workflow Evaluation
        await api.post(`/expenses/${claimId}/submit`);
        setSuccess('Expense claim submitted successfully for approval review!');
        setTimeout(() => navigate(`/expenses/${claimId}`), 1200);
      } else {
        setSuccess('Draft saved successfully!');
        setTimeout(() => navigate('/expenses'), 1200);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save or submit claim.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create Expense Claim</h1>
        <p className="text-xs text-slate-500 mt-1">
          Submit reimbursement claims in accordance with company spending policies.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
          <div>
            <p className="font-semibold">Submission Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-800">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
          <p className="font-semibold">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Basic Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Claim Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AWS Cloud Production Hosting - Oct"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Expense Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
            >
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.receiptRequired ? '(Receipt Required)' : ''}
                </option>
              ))}
            </select>
            {selectedCategory && (
              <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-400" />
                {selectedCategory.description}
                {selectedCategory.spendingLimit > 0 &&
                  ` • Policy Cap: ₹${selectedCategory.spendingLimit.toLocaleString()}`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Expense Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Merchant / Vendor <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. Amazon Web Services / IndiGo"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-2 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
            >
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.costCenter})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
            >
              <option value="personal_card">Personal Credit/Debit Card</option>
              <option value="corporate_card">Corporate Card</option>
              <option value="bank_transfer">Direct Bank Transfer</option>
              <option value="cash">Cash Out of Pocket</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Business Purpose <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={businessPurpose}
              onChange={(e) => setBusinessPurpose(e.target.value)}
              placeholder="State the clear business rationale for this expenditure..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Submission Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Any additional remarks or context for approvers..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Receipt Upload Section */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Receipt Attachment
              </h3>
              <p className="text-[11px] text-slate-500">
                PDF, PNG, or JPEG format (maximum 5MB per file)
              </p>
            </div>
            {selectedCategory?.receiptRequired && (
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Mandatory for this Category
              </span>
            )}
          </div>

          {/* Upload Dropzone */}
          <label className="relative border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-slate-50/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors block">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={uploadingFile}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-xs font-medium text-slate-700">
              {uploadingFile ? 'Uploading file to storage...' : 'Click or drag receipt file to upload'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">PDF, PNG, JPG up to 5MB</p>
          </label>

          {/* Attached Files List */}
          {uploadedReceipts.length > 0 && (
            <div className="mt-3 space-y-2">
              {uploadedReceipts.map((r, idx) => (
                <div
                  key={r._id || idx}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="font-semibold text-slate-800">{r.originalFilename}</span>
                      <span className="text-[10px] text-slate-400 ml-2">
                        ({(r.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeReceipt(idx)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={submitting || !title || !amount}
            onClick={() => handleSubmit(false)}
            className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={submitting || !title || !amount}
            onClick={() => handleSubmit(true)}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            {submitting ? 'Submitting...' : 'Submit Claim for Approval'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
