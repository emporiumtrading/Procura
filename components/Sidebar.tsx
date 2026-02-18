import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, ShieldAlert, Lock, Briefcase, Gem, ChevronLeft, ChevronRight, LogOut, Settings, FolderOpen, CalendarClock, Mail, Building2, Bell, ExternalLink, CheckCheck, GitBranch, TrendingUp } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import api from '../lib/api';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  read: boolean;
  action_url?: string;
  created_at: string;
}

const POLL_INTERVAL_MS = 60_000; // check every 60 seconds

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // ── Notifications state ───────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.listNotifications(false, 1);
      if (res.data) {
        const items: Notification[] = res.data.notifications || res.data.data || res.data || [];
        setNotifications(items.slice(0, 8));
        setUnreadCount(items.filter((n: Notification) => !n.read).length);
      }
    } catch {
      // silent — notifications are non-critical
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleNotifClick = (n: Notification) => {
    if (!n.read) {
      api.markNotificationRead(n.id);
      setNotifications(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x));
      setUnreadCount(c => Math.max(0, c - 1));
    }
    if (n.action_url) navigate(n.action_url);
    setShowNotifDropdown(false);
  };

  const priorityColor = (p: string) =>
    p === 'urgent' ? 'bg-red-500' : p === 'high' ? 'bg-amber-500' : 'bg-blue-500';

  const displayName = (user as any)?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userRole = (user as any)?.user_metadata?.role || 'viewer';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${isActive
      ? 'bg-gray-900 text-white shadow-md'
      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-neutral-800 dark:text-gray-400 dark:hover:text-white'
    } ${isCollapsed ? 'justify-center' : ''}`;

  return (
    <div
      className={`flex h-full flex-col border-r border-gray-200 bg-white dark:bg-[#111111] dark:border-neutral-800 shrink-0 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${isCollapsed ? 'w-[80px]' : 'w-64'}`}
    >
      {/* Logo Area */}
      <div className={`flex h-16 items-center border-b border-gray-100 dark:border-neutral-800 transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'px-6 gap-3'}`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white shrink-0 shadow-sm transition-transform hover:scale-105">
          <Gem size={20} />
        </div>
        <div className={`flex flex-col overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <h1 className="text-gray-900 dark:text-white text-sm font-bold leading-none tracking-tight">Procura</h1>
          <p className="text-gray-500 text-[10px] mt-1 font-medium tracking-wide uppercase">Ops Command</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-1 p-3 overflow-y-auto flex-1 overflow-x-hidden custom-scrollbar">
        {!isCollapsed && <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-in fade-in duration-300">Main</p>}
        {isCollapsed && <div className="h-4"></div>}

        <NavLink to="/dashboard" className={navItemClass} title="Browse and qualify opportunities">
          <LayoutDashboard size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Dashboard</span>
        </NavLink>
        <NavLink to="/submissions" className={navItemClass} title="Manage submission workflows">
          <FileText size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Submissions</span>
        </NavLink>
        <NavLink to="/workspace" className={navItemClass} title="Proposal workspace">
          <Briefcase size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Workspace</span>
        </NavLink>
        <NavLink to="/pipeline" className={navItemClass} title="Pipeline — track opportunities by stage">
          <GitBranch size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Pipeline</span>
        </NavLink>
        <NavLink to="/market-intel" className={navItemClass} title="Federal market intelligence from USAspending.gov">
          <TrendingUp size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Market Intel</span>
        </NavLink>
        <NavLink to="/documents" className={navItemClass} title="Reusable document library">
          <FolderOpen size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Documents</span>
        </NavLink>

        {!isCollapsed && <div className="my-2 border-t border-gray-100 dark:border-neutral-800 mx-3"></div>}
        {!isCollapsed && <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-in fade-in duration-300">Tracking</p>}

        <NavLink to="/follow-ups" className={navItemClass} title="Application follow-up tracking">
          <CalendarClock size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Follow-ups</span>
        </NavLink>
        <NavLink to="/correspondence" className={navItemClass} title="Awards, communications & notifications">
          <Mail size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Correspondence</span>
        </NavLink>

        {!isCollapsed && <div className="my-2 border-t border-gray-100 dark:border-neutral-800 mx-3"></div>}
        {!isCollapsed && <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-in fade-in duration-300">System</p>}

        <NavLink to="/company-profile" className={navItemClass} title="Your company profile for AI scoring">
          <Building2 size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Company Profile</span>
        </NavLink>
        <NavLink to="/admin" className={navItemClass} title="System administration and settings">
          <ShieldAlert size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Admin</span>
        </NavLink>
        <NavLink to="/audit" className={navItemClass} title="Audit trail and compliance logs">
          <Lock size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Audit Logs</span>
        </NavLink>
        <NavLink to="/settings" className={navItemClass} title="API keys and system settings">
          <Settings size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>Settings</span>
        </NavLink>
      </div>

      {/* Notification Bell */}
      <div ref={notifRef} className="relative px-3 pb-1">
        <button
          onClick={() => setShowNotifDropdown(o => !o)}
          className={`relative flex items-center gap-2 w-full px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors ${isCollapsed ? 'justify-center' : ''}`}
          title="Notifications"
        >
          <Bell size={20} className="shrink-0" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 left-7 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          {!isCollapsed && (
            <span className="text-sm font-medium">
              Notifications
              {unreadCount > 0 && <span className="ml-2 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
            </span>
          )}
        </button>

        {/* Notification Dropdown */}
        {showNotifDropdown && (
          <div className={`absolute bottom-12 ${isCollapsed ? 'left-16' : 'left-3 right-3'} z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[300px]`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors">
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-gray-400">
                  No notifications yet.<br />High-fit opportunities will appear here.
                </div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${!n.read ? priorityColor(n.priority) : 'bg-gray-200'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${!n.read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {n.action_url && <ExternalLink size={10} className="shrink-0 mt-1.5 text-gray-300" />}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer / User Profile */}
      <div className="p-3 border-t border-gray-200 dark:border-neutral-800 flex flex-col gap-2">
        <div className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm ring-2 ring-white dark:ring-neutral-900">{initials}</div>
          <div className={`flex flex-col overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{displayName}</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">{userRole}</span>
          </div>
          {!isCollapsed && <button onClick={handleLogout} title="Sign out"><LogOut size={14} className="ml-auto text-gray-400 hover:text-red-500 transition-colors" /></button>}
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`flex items-center justify-center h-8 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 transition-all active:scale-95 ${isCollapsed ? 'w-full' : 'w-full'}`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <div className="flex items-center gap-2"><ChevronLeft size={16} /><span className="text-xs font-medium">Collapse</span></div>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
