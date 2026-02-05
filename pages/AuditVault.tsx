import React, { useEffect, useMemo, useState } from 'react';
import { Download, Search, ChevronDown, Filter, FileText, Image, Copy, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

type AuditLog = {
  id: string;
  submissionId: string;
  timestamp: string;
  portal: string;
  status: string;
  receiptId: string;
  hash: string;
};

const AuditVault = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    const response = await api.getAuditLogs({ limit: 200 });
    if (response.error) {
      setError(response.error);
      setLogs([]);
      setIsLoading(false);
      return;
    }
    const data = response.data?.data ?? [];
    const mapped = data.map((log: any) => ({
      id: log.id,
      submissionId: log.submission_ref ?? log.submission_id ?? 'N/A',
      timestamp: log.timestamp ?? '',
      portal: log.portal ?? 'Unknown',
      status: log.status ?? 'PENDING',
      receiptId: log.receipt_id ?? 'N/A',
      hash: log.confirmation_hash ?? '',
    }));
    setLogs(mapped);
    setIsLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) =>
      log.submissionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.receiptId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.hash.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [logs, searchQuery]);

  const handleExport = () => {
    setIsExporting(true);
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audit_logs.json';
    link.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  };

  const formatTimestamp = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value || 'N/A';
    return parsed.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-[#191919]">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <span className="hover:text-gray-900 dark:hover:text-white cursor-pointer transition-colors">Operations</span>
            <span>{'>'}</span>
            <span className="hover:text-gray-900 dark:hover:text-white cursor-pointer transition-colors">Submissions</span>
            <span>{'>'}</span>
            <span className="font-medium text-gray-900 dark:text-white">Audit Vault</span>
          </nav>

          <div className="flex justify-between items-start">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Evidence & Audit Vault</h1>
              <p className="text-gray-500 mt-2">Immutable record of external portal interactions and submission receipts.</p>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting || isLoading}
              className="bg-gray-900 dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
            >
              {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {isExporting ? 'Exporting...' : 'Export Audit Trail'}
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="bg-white dark:bg-[#1e1e1e] p-1 rounded-xl flex flex-wrap gap-4 items-center border border-gray-200 dark:border-neutral-800 shadow-sm">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Submission ID or Receipt Hash..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-neutral-800 rounded-lg text-sm border-none focus:ring-2 focus:ring-gray-900 outline-none transition-shadow"
              />
            </div>
            <div className="flex gap-2 p-1">
              <button className="h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-colors">
                Date: Last 30 Days <ChevronDown size={16} className="text-gray-400" />
              </button>
              <button className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 transition-colors">
                <Filter size={18} />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden min-h-[400px]">
            <table className="w-full text-left">
              <thead className="border-b border-gray-200 dark:border-neutral-800">
                <tr>
                  <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-gray-500">Submission ID</th>
                  <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-gray-500">Timestamp (UTC)</th>
                  <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-gray-500">Portal</th>
                  <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-gray-500 w-1/4">Receipt ID</th>
                  <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Artifacts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-500">
                      <Loader2 size={18} className="inline-block animate-spin mr-2" /> Loading audit logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-500">No records found matching your search.</td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 group transition-colors">
                      <td className="py-4 px-6">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{log.submissionId}</span>
                      </td>
                      <td className="py-4 px-6 text-sm font-mono text-gray-600 dark:text-gray-400">{formatTimestamp(log.timestamp)}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-900 dark:bg-white"></div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{log.portal}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          log.status === 'CONFIRMED'
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-black'
                            : 'bg-white border border-gray-300 text-gray-700'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 group/hash">
                          <code className="text-xs font-mono bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-neutral-700">
                            {log.receiptId}
                          </code>
                          {log.hash && (
                            <Copy
                              size={14}
                              className="opacity-0 group-hover/hash:opacity-100 text-gray-400 cursor-pointer hover:text-gray-900 transition-all"
                              onClick={() => navigator.clipboard.writeText(log.hash)}
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors" title="View Logs"><FileText size={18} /></button>
                          <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors" title="View Snapshot"><Image size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <p className="text-xs text-gray-500">Showing <span className="font-bold text-gray-900 dark:text-white">{filteredLogs.length}</span> entries</p>
              <div className="flex gap-2">
                <button className="px-2 py-1 rounded hover:bg-gray-100 text-gray-500 text-sm transition-colors">Prev</button>
                <button className="px-2 py-1 rounded hover:bg-gray-100 text-gray-500 text-sm transition-colors">Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditVault;
