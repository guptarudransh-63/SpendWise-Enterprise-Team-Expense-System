import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  PlusCircle,
  Inbox,
  Users,
  CreditCard,
  PieChart,
  ShieldCheck,
  FileSpreadsheet,
  Building2,
  Bell,
  LogOut,
  ChevronDown,
  Check,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['employee', 'manager', 'finance', 'admin'] },
    { label: 'Submit Expense', path: '/expenses/new', icon: PlusCircle, roles: ['employee', 'manager', 'admin'] },
    { label: 'My Expenses', path: '/expenses', icon: Receipt, roles: ['employee', 'manager', 'admin'] },
    { label: 'Approval Inbox', path: '/approvals', icon: Inbox, roles: ['manager', 'finance', 'admin'] },
    { label: 'Team Expenses', path: '/team-expenses', icon: Users, roles: ['manager', 'admin'] },
    { label: 'Finance Queue', path: '/finance/queue', icon: CreditCard, roles: ['finance', 'admin'] },
    { label: 'Reimbursements', path: '/reimbursements', icon: Receipt, roles: ['finance', 'admin', 'manager'] },
    { label: 'Budgets', path: '/budgets', icon: PieChart, roles: ['manager', 'finance', 'admin'] },
    { label: 'Approval Policies', path: '/policies', icon: ShieldCheck, roles: ['admin'] },
    { label: 'Users & Org', path: '/admin/users', icon: Building2, roles: ['admin'] },
    { label: 'Reports & Audits', path: '/reports', icon: FileSpreadsheet, roles: ['manager', 'finance', 'admin'] },
  ];

  const allowedNav = navItems.filter((item) => user && item.roles.includes(user.role));

  const roleBadgeColors = {
    employee: 'bg-slate-700 text-slate-200',
    manager: 'bg-amber-900/60 text-amber-200 border border-amber-700',
    finance: 'bg-emerald-900/60 text-emerald-200 border border-emerald-700',
    admin: 'bg-indigo-900/60 text-indigo-200 border border-indigo-700',
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Dark Charcoal Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800">
        {/* Brand */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
            SW
          </div>
          <div>
            <h1 className="font-bold text-white text-base tracking-tight">SpendWise</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
              Enterprise Expense
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Card in Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-indigo-400">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <span
                className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded uppercase ${
                  roleBadgeColors[user?.role] || 'bg-slate-800 text-slate-300'
                }`}
              >
                {user?.role}
              </span>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shadow-xs z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-slate-800">
              {navItems.find((n) => n.path === location.pathname)?.label || 'SpendWise Workspace'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Submit Button */}
            {['employee', 'manager'].includes(user?.role) && (
              <Link
                to="/expenses/new"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                New Claim
              </Link>
            )}

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Notifications ({unreadCount} new)
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No notifications to show.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          onClick={() => markAsRead(n._id)}
                          className={`p-3 text-xs transition-colors cursor-pointer hover:bg-slate-50 ${
                            !n.readAt ? 'bg-indigo-50/40 font-medium' : 'text-slate-600'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-slate-900">{n.title}</p>
                            {!n.readAt && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600 mt-1 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(n.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* API Docs quick link */}
            <a
              href="/api-docs"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 border border-slate-200 px-2 py-1 rounded-md"
              title="Open OpenAPI/Swagger Documentation"
            >
              <span>API Docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/60">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
