import React from 'react';
import { X, Download, FileText } from 'lucide-react';

export default function ReceiptModal({ isOpen, onClose, receipt }) {
  if (!isOpen || !receipt) return null;

  const fileUrl = `/api/v1/expenses/receipts/${receipt._id}`;
  const isPdf = receipt.contentType === 'application/pdf';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">{receipt.originalFilename}</h3>
              <p className="text-xs text-slate-500">
                {(receipt.size / 1024).toFixed(1)} KB • {receipt.contentType}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={fileUrl}
              download={receipt.originalFilename}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-200 transition-colors"
              title="Download Receipt"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-auto flex-1 flex items-center justify-center bg-slate-100/50">
          {isPdf ? (
            <iframe
              src={fileUrl}
              title={receipt.originalFilename}
              className="w-full h-[65vh] rounded-lg border border-slate-300"
            />
          ) : (
            <img
              src={fileUrl}
              alt={receipt.originalFilename}
              className="max-h-[65vh] object-contain rounded-lg border border-slate-300 shadow-sm"
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
