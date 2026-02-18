import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart2, Building2, Users, Search, RefreshCw, DollarSign } from 'lucide-react';
import api from '../lib/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function TrendIcon({ direction }: { direction?: string }) {
  if (direction === 'increasing') return <TrendingUp size={14} className="text-green-500" />;
  if (direction === 'decreasing') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SummaryData {
  fiscal_year: number;
  naics_codes: string[];
  by_naics: Array<{ naics: string; total_spend: number | null; top_agency: string }>;
  total_addressable_market: number;
  insight: string;
}

interface NaicsData {
  naics_code: string;
  fiscal_year: number;
  total_federal_spend: number;
  top_agencies: Array<{ name: string; amount: number; count: number }>;
  top_vendors: Array<{ name: string; amount: number; uei?: string }>;
  insight: string;
}

interface IncumbentData {
  naics_codes: string[];
  fiscal_year: number;
  incumbents: Array<{ rank: number; name: string; amount: number; uei?: string }>;
  insight: string;
}

interface AgencyTrendData {
  agency: string;
  years_analyzed: number;
  trend: Array<{ fiscal_year: number; obligations: number | null; award_count: number | null }>;
  direction: string;
  insight: string;
}

// ── Main Component ────────────────────────────────────────────────────────────

const MarketIntel: React.FC = () => {
  // Company profile NAICS codes (fetched on load)
  const [profileNaics, setProfileNaics] = useState<string[]>([]);
  const naicsParam = profileNaics.join(',');

  // Tab
  const [activeTab, setActiveTab] = useState<'summary' | 'naics' | 'incumbents' | 'agency'>('summary');

  // Data states
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [naicsData, setNaicsData] = useState<NaicsData | null>(null);
  const [incumbents, setIncumbents] = useState<IncumbentData | null>(null);
  const [agencyTrend, setAgencyTrend] = useState<AgencyTrendData | null>(null);

  // Loading / error states per tab
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inputs
  const [selectedNaics, setSelectedNaics] = useState('');
  const [agencyName, setAgencyName] = useState('');

  // Expanded rows
  const [expandedNaics, setExpandedNaics] = useState<Set<string>>(new Set());

  // Load company profile for NAICS codes
  useEffect(() => {
    api.getCompanyProfile().then(res => {
      if (res.data?.naics_codes?.length) {
        setProfileNaics(res.data.naics_codes);
        setSelectedNaics(res.data.naics_codes[0] || '');
      }
    }).catch(() => {});
  }, []);

  // Load summary when profile NAICS are available
  useEffect(() => {
    if (naicsParam) loadSummary();
  }, [naicsParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSummary = useCallback(async () => {
    if (!naicsParam) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMarketSummary(naicsParam);
      if (res.data) setSummary(res.data);
      else setError(res.error || 'Failed to load summary');
    } catch {
      setError('Failed to load market summary');
    } finally {
      setLoading(false);
    }
  }, [naicsParam]);

  const loadNaicsAnalysis = useCallback(async (code: string) => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getNaicsAnalysis(code);
      if (res.data) setNaicsData(res.data);
      else setError(res.error || 'Failed to load NAICS analysis');
    } catch {
      setError('Failed to load NAICS analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIncumbents = useCallback(async () => {
    if (!naicsParam) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getIncumbents(naicsParam);
      if (res.data) setIncumbents(res.data);
      else setError(res.error || 'Failed to load incumbents');
    } catch {
      setError('Failed to load incumbents');
    } finally {
      setLoading(false);
    }
  }, [naicsParam]);

  const loadAgencyTrend = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAgencyTrend(name.trim());
      if (res.data) setAgencyTrend(res.data);
      else setError(res.error || 'Failed to load agency trend');
    } catch {
      setError('Failed to load agency trend');
    } finally {
      setLoading(false);
    }
  }, []);

  // Tab switch handlers
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setError(null);
    if (tab === 'summary' && !summary && naicsParam) loadSummary();
    if (tab === 'naics' && selectedNaics) loadNaicsAnalysis(selectedNaics);
    if (tab === 'incumbents' && !incumbents && naicsParam) loadIncumbents();
  };

  const tabs = [
    { id: 'summary' as const, label: 'Portfolio Summary', icon: BarChart2 },
    { id: 'naics' as const, label: 'NAICS Analysis', icon: Search },
    { id: 'incumbents' as const, label: 'Incumbents', icon: Users },
    { id: 'agency' as const, label: 'Agency Trend', icon: Building2 },
  ];

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderSummary = () => {
    if (!summary) return null;

    // Max spend for bar scaling
    const maxSpend = Math.max(...summary.by_naics.map(n => n.total_spend || 0), 1);

    return (
      <div className="space-y-6">
        {/* KPI card */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center">
              <DollarSign size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Total Addressable Market</p>
              <p className="text-3xl font-black text-gray-900">{formatMoney(summary.total_addressable_market)}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">{summary.insight}</p>
          <p className="text-xs text-gray-400 mt-1">FY{summary.fiscal_year} — federal contract obligations (top agencies per NAICS)</p>
        </div>

        {/* Per-NAICS breakdown */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Spend by NAICS Code</h3>
          <div className="space-y-3">
            {summary.by_naics.map(row => {
              const pct = row.total_spend ? Math.round((row.total_spend / maxSpend) * 100) : 0;
              const expanded = expandedNaics.has(row.naics);
              return (
                <div key={row.naics} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => {
                      const next = new Set(expandedNaics);
                      if (expanded) next.delete(row.naics); else next.add(row.naics);
                      setExpandedNaics(next);
                      if (!expanded) {
                        setSelectedNaics(row.naics);
                        loadNaicsAnalysis(row.naics);
                        setActiveTab('naics');
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-bold">{row.naics}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 truncate">{row.top_agency}</span>
                        <span className="text-sm font-bold text-gray-900 ml-2 shrink-0">{formatMoney(row.total_spend)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-indigo-600 font-medium shrink-0">Analyze →</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={loadSummary}
          disabled={loading}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh from USAspending.gov
        </button>
      </div>
    );
  };

  const renderNaicsAnalysis = () => (
    <div className="space-y-4">
      {/* NAICS selector */}
      <div className="flex gap-2">
        <div className="flex gap-2 flex-wrap flex-1">
          {profileNaics.map(code => (
            <button
              key={code}
              onClick={() => { setSelectedNaics(code); loadNaicsAnalysis(code); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                selectedNaics === code
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={selectedNaics}
            onChange={e => setSelectedNaics(e.target.value)}
            placeholder="Enter NAICS code"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono w-36 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
          />
          <button
            onClick={() => loadNaicsAnalysis(selectedNaics)}
            disabled={!selectedNaics || loading}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-indigo-700 transition-colors"
          >
            Analyze
          </button>
        </div>
      </div>

      {naicsData && (
        <>
          {/* Insight card */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm text-blue-800">{naicsData.insight}</p>
            <p className="text-xs text-blue-500 mt-1">FY{naicsData.fiscal_year} data — source: USAspending.gov</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Agencies */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Top Awarding Agencies</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {naicsData.top_agencies.slice(0, 8).map((agency, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-xs text-gray-400 w-4 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{agency.name}</p>
                    </div>
                    <span className="text-xs font-bold text-indigo-700 shrink-0">{formatMoney(agency.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Vendors */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Top Incumbents / Competitors</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {naicsData.top_vendors.slice(0, 8).map((vendor, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-xs text-gray-400 w-4 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{vendor.name}</p>
                      {vendor.uei && <p className="text-[10px] text-gray-400 font-mono">UEI: {vendor.uei}</p>}
                    </div>
                    <span className="text-xs font-bold text-green-700 shrink-0">{formatMoney(vendor.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderIncumbents = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Top vendors across all your NAICS codes — teaming targets and competitors.
        </p>
        <button
          onClick={loadIncumbents}
          disabled={loading || !naicsParam}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-indigo-700 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {incumbents && (
        <>
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-sm text-green-800">{incumbents.insight}</p>
            <p className="text-xs text-green-600 mt-1">NAICS codes: {incumbents.naics_codes.join(', ')} · FY{incumbents.fiscal_year}</p>
          </div>

          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[40px_1fr_140px_120px] px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              <span>#</span>
              <span>Vendor Name</span>
              <span>UEI</span>
              <span className="text-right">Awards (FY{incumbents.fiscal_year})</span>
            </div>
            <div className="divide-y divide-gray-50">
              {incumbents.incumbents.map(v => (
                <div key={v.rank} className="grid grid-cols-[40px_1fr_140px_120px] px-4 py-2.5 items-center hover:bg-gray-50 transition-colors">
                  <span className="text-xs font-bold text-gray-400">#{v.rank}</span>
                  <span className="text-xs font-medium text-gray-900">{v.name}</span>
                  <span className="text-[10px] font-mono text-gray-400 truncate">{v.uei || '—'}</span>
                  <span className="text-xs font-bold text-right text-indigo-700">{formatMoney(v.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!incumbents && !loading && (
        <div className="text-center py-12 text-gray-400 text-sm">
          {naicsParam ? 'Click Refresh to load incumbent data.' : 'Set NAICS codes in your Company Profile first.'}
        </div>
      )}
    </div>
  );

  const renderAgencyTrend = () => (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={agencyName}
          onChange={e => setAgencyName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadAgencyTrend(agencyName)}
          placeholder="e.g. Department of Defense, HHS, GSA..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
        />
        <button
          onClick={() => loadAgencyTrend(agencyName)}
          disabled={!agencyName.trim() || loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-indigo-700 transition-colors"
        >
          Analyze
        </button>
      </div>

      {agencyTrend && (
        <>
          <div className={`border rounded-xl p-4 ${
            agencyTrend.direction === 'increasing' ? 'bg-green-50 border-green-100' :
            agencyTrend.direction === 'decreasing' ? 'bg-red-50 border-red-100' :
            'bg-gray-50 border-gray-100'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <TrendIcon direction={agencyTrend.direction} />
              <span className={`text-xs font-bold uppercase tracking-wider ${
                agencyTrend.direction === 'increasing' ? 'text-green-700' :
                agencyTrend.direction === 'decreasing' ? 'text-red-700' :
                'text-gray-600'
              }`}>{agencyTrend.direction}</span>
            </div>
            <p className="text-sm text-gray-800">{agencyTrend.insight}</p>
          </div>

          {/* Trend bar chart */}
          <div className="border border-gray-100 rounded-xl p-4">
            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-4">Annual Obligations — {agencyTrend.agency}</h3>
            <div className="flex items-end gap-3 h-32">
              {agencyTrend.trend.map(row => {
                const maxVal = Math.max(...agencyTrend.trend.map(t => t.obligations || 0), 1);
                const heightPct = row.obligations ? Math.max(4, Math.round((row.obligations / maxVal) * 100)) : 4;
                return (
                  <div key={row.fiscal_year} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-gray-600">{formatMoney(row.obligations)}</span>
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        row.obligations == null ? 'bg-gray-100' :
                        agencyTrend.direction === 'increasing' ? 'bg-green-400' :
                        agencyTrend.direction === 'decreasing' ? 'bg-red-400' :
                        'bg-indigo-400'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[10px] text-gray-500">FY{row.fiscal_year}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!agencyTrend && !loading && (
        <div className="text-center py-12 text-gray-400 text-sm">
          Enter an agency name and click Analyze to see multi-year spending trends.
          <br />
          <span className="text-xs mt-1 block text-gray-300">Data sourced from USAspending.gov — no API key required.</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <BarChart2 size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Market Intelligence</h1>
              <p className="text-sm text-gray-500">Federal spending data from USAspending.gov — no API key required</p>
            </div>
          </div>

          {!naicsParam && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              Set your NAICS codes in <a href="#/company-profile" className="underline font-medium">Company Profile</a> to unlock portfolio-level market data.
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 min-h-[400px]">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <RefreshCw size={24} className="animate-spin" />
                <span className="text-sm">Fetching from USAspending.gov…</span>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-700">{error}</p>
              <p className="text-xs text-red-500 mt-1">USAspending.gov may be temporarily unavailable. Try again in a moment.</p>
            </div>
          )}

          {!loading && (
            <>
              {activeTab === 'summary' && renderSummary()}
              {activeTab === 'naics' && renderNaicsAnalysis()}
              {activeTab === 'incumbents' && renderIncumbents()}
              {activeTab === 'agency' && renderAgencyTrend()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketIntel;
