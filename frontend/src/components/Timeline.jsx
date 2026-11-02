import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  DollarSign,
  UserCheck,
  Send,
  RotateCcw,
} from 'lucide-react';

const getEventIcon = (action) => {
  switch (action) {
    case 'CLAIM_CREATED_DRAFT':
      return <FileText className="w-4 h-4 text-slate-500" />;
    case 'CLAIM_SUBMITTED':
      return <Send className="w-4 h-4 text-blue-500" />;
    case 'CLAIM_RESUBMITTED':
      return <RotateCcw className="w-4 h-4 text-indigo-500" />;
    case 'APPROVAL_STEP_APPROVED':
    case 'CLAIM_FULLY_APPROVED':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'CLAIM_REJECTED':
      return <XCircle className="w-4 h-4 text-rose-500" />;
    case 'ADDITIONAL_INFO_REQUESTED':
      return <AlertCircle className="w-4 h-4 text-amber-500" />;
    case 'REIMBURSEMENT_SCHEDULED':
    case 'REIMBURSEMENT_COMPLETED':
      return <DollarSign className="w-4 h-4 text-teal-600" />;
    case 'APPROVAL_REASSIGNED':
      return <UserCheck className="w-4 h-4 text-purple-500" />;
    default:
      return <FileText className="w-4 h-4 text-slate-400" />;
  }
};

const formatActionText = (action) => {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function Timeline({ events = [] }) {
  if (events.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-slate-400">
        No timeline events recorded yet.
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1;
          const actorName = event.actorId ? event.actorId.name : 'System';
          const actorRole = event.actorId ? `(${event.actorId.role})` : '';

          return (
            <li key={event._id || idx}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span className="h-8 w-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center ring-4 ring-white">
                      {getEventIcon(event.action)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {formatActionText(event.action)}{' '}
                        <span className="text-xs text-slate-500 font-normal">
                          by <span className="font-semibold text-slate-700">{actorName}</span>{' '}
                          {actorRole}
                        </span>
                      </p>
                      {event.reason && (
                        <p className="mt-1 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                          "{event.reason}"
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs whitespace-nowrap text-slate-400">
                      {new Date(event.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
