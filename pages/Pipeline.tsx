import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, RefreshCw, Zap, Settings2, ChevronRight,
  Search, TrendingUp, FileText, CheckCircle, Send, Eye
} from 'lucide-react';
import { api } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type PipelineCard = {
  id: string;
  title: string;
  agency: string;
  fit_score?: number | null;
  due_date?: string | null;
  estimated_value?: number | null;
  source?: string;
  submission_id?: string | null;
  submission_status?: string | null;
};

type PipelineStages = Record<string, PipelineCard[]>;

type PipelineConfig = {
  mode: 'manual' | 'supervised' | 'autonomous';
  fit_threshold: number;
  auto_threshold: number;
  max_auto_value: number;
};

// ── Stage definitions ─────────────────────────────────────────────────────────

const STAGES = [
  { key: 'discovered', label: 'Discovered', color: 'border-gray-300', bg: 'bg-gray-50', dot: 'bg-gray-400', icon: <Search size={14} /> },
  { key: 'qualified', label: 'Qualified', color: 'border-blue-300', bg: 'bg-blue-50', dot: 'bg-blue-500', icon: <TrendingUp size={14} /> },
  { key: 'drafting', label: 'Drafting', color: 'border-purple-300', bg: 'bg-purple-50', dot: 'bg-purple-500', icon: <FileText size={14} /> },
  { key: 'review', label: 'Review', color: 'border-amber-300', bg: 'bg-amber-50', dot: 'bg-amber-500', icon: <Eye size={14} /> },
  { key: 'submitted', label: 'Submitted', color: 'border-green-300', bg: 'bg-green-50', dot: 'bg-green-500', icon: <Send size={14} /> },
  { key: 'tracking', label: 'Tracking', color: 'border-emerald-300', bg: 'bg-emerald-50', dot: 'bg-emerald-600', icon: <CheckCircle size={14} /> },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (v?: number | null) => {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
};

const formatDate = (d?: string | null) => {
  if (!d) return '—';
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const daysUntil = (d?: string | null) => {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
  return diff;
};

const FitBadge: React.FC<{ score?: number | null }> = ({ score }) => {
  if (score == null) return <span className="text-xs text-gray-400">—</span>;
  const color = score >= 80 ? 'text-green-700 bg-green-100' : score >= 60 ? 'text-amber-700 bg-amber-100' : 'text-gray-600 bg-gray-100';
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{score}</span>;
};

// ── Mode badge ────────────────────────────────────────────────────────────────

const ModeBadge: React.FC<{ mode: string }> = ({ mode }) => {
  const map: Record<string, { label: string; color: string }> = {
    manual: { label: 'Manual', color: 'bg-gray-100 text-gray-700' },
    supervised: { label: 'Supervised', color: 'bg-blue-100 text-blue-700' },
    autonomous: { label: 'Autonomous', color: 'bg-purple-100 text-purple-700' },
  };
  const entry = map[mode] || map.manual;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${entry.color}`}>
      {entry.label}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const Pipeline: React.FC = () => {
  const navigate = useNavigate();
  const [stages, setStages] = useState<PipelineStages>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [config, setConfig] = useState<PipelineConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [draftConfig, setDraftConfig] = useState<PipelineConfig | null>(null);

  const loadPipeline = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await api.getPipelineView();
    if (res.error || !res.data) {
      setError(res.error || 'Failed to load pipeline');
      setIsLoading(false);
      return;
    }
    setStages(res.data.stages);
    setTotals(res.data.totals);
    setConfig(res.data.pipeline_config as PipelineConfig);
    setDraftConfig(res.data.pipeline_config as PipelineConfig);
    setIsLoading(false);
  }, []);

  useEffect(() => { loadPipeline(); }, [loadPipeline]);

  const handleSaveConfig = async () => {
    if (!draftConfig) return;
    setSavingConfig(true);
    await api.updatePipelineConfig(draftConfig);
    setConfig(draftConfig);
    setSavingConfig(false);
    setShowConfigPanel(false);
  };

  const handleCardClick = (card: PipelineCard, stageKey: string) => {
    if (card.submission_id) {
      navigate(`/workspace/${card.submission_id}`);
    } else if (['qualified', 'discovered'].includes(stageKey)) {
      navigate('/dashboard');
    }
  };

  const totalOpportunities = (Object.values(totals) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pipeline</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalOpportunities} opportunities tracked · {' '}
              {config && <ModeBadge mode={config.mode} />}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigPanel(v => !v)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
            >
              <Settings2 size={16} />
              Autonomy Settings
            </button>
            <button
              onClick={loadPipeline}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-60"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Refresh
            </button>
          </div>
        </div>

        {/* Autonomy config panel */}
        {showConfigPanel && draftConfig && (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Autonomy Configuration</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Mode</label>
                <select
                  value={draftConfig.mode}
                  onChange={e => setDraftConfig(d => ({ ...d!, mode: e.target.value as PipelineConfig['mode'] }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="manual">Manual — humans decide all pursuits</option>
                  <option value="supervised">Supervised — auto-draft for high-fit</option>
                  <option value="autonomous">Autonomous — auto-draft + generate proposal</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">
                  Supervised threshold (fit ≥)
                </label>
                <input
                  type="number"
                  min={0} max={100}
                  value={draftConfig.fit_threshold}
                  onChange={e => setDraftConfig(d => ({ ...d!, fit_threshold: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <p className="text-[10px] text-gray-400 mt-1">Auto-create draft submission above this score</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">
                  Autonomous threshold (fit ≥)
                </label>
                <input
                  type="number"
                  min={0} max={100}
                  value={draftConfig.auto_threshold}
                  onChange={e => setDraftConfig(d => ({ ...d!, auto_threshold: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <p className="text-[10px] text-gray-400 mt-1">Also auto-generate full proposal above this score</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">
                  Max contract value (autonomous)
                </label>
                <input
                  type="number"
                  min={0}
                  value={draftConfig.max_auto_value}
                  onChange={e => setDraftConfig(d => ({ ...d!, max_auto_value: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <p className="text-[10px] text-gray-400 mt-1">Only auto-pursue contracts ≤ this value (USD)</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => { setShowConfigPanel(false); setDraftConfig(config); }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-60 transition-all"
              >
                {savingConfig ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading pipeline...
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 p-6 h-full min-w-max">
            {STAGES.map((stage) => {
              const cards = stages[stage.key] || [];
              return (
                <div key={stage.key} className="flex flex-col w-64 shrink-0">
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${stage.color} ${stage.bg} mb-3`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        {stage.label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-500 bg-white px-1.5 py-0.5 rounded-full border">
                      {cards.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                    {cards.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8 px-3 border-2 border-dashed border-gray-200 rounded-lg">
                        No opportunities
                      </div>
                    ) : (
                      cards.map((card) => {
                        const due = daysUntil(card.due_date);
                        const isUrgent = typeof due === 'number' && due <= 7 && due >= 0;
                        return (
                          <button
                            key={card.id}
                            onClick={() => handleCardClick(card, stage.key)}
                            className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 hover:border-gray-400 hover:shadow-sm transition-all group"
                          >
                            <div className="flex items-start justify-between gap-1 mb-2">
                              <p className="text-xs font-semibold text-gray-900 line-clamp-2 flex-1 leading-snug">
                                {card.title}
                              </p>
                              <FitBadge score={card.fit_score} />
                            </div>
                            <p className="text-[10px] text-gray-500 mb-2 truncate">{card.agency}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {card.due_date && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                    isUrgent
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-gray-50 text-gray-500 border-gray-200'
                                  }`}>
                                    {due !== null ? (due >= 0 ? `${due}d` : 'past') : formatDate(card.due_date)}
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400">{formatCurrency(card.estimated_value)}</span>
                              </div>
                              {card.submission_id && (
                                <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-600 transition-colors" />
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}

                    {/* Quick action at bottom of Discovered/Qualified columns */}
                    {(stage.key === 'discovered' || stage.key === 'qualified') && cards.length > 0 && (
                      <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center justify-center gap-1.5 w-full py-2 text-xs text-gray-500 hover:text-gray-900 border border-dashed border-gray-200 rounded-lg hover:border-gray-400 transition-all"
                      >
                        <Zap size={12} />
                        Pursue from Dashboard
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer stats */}
      {!isLoading && config && (
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-6 text-xs text-gray-500">
          <span>Mode: <strong className="text-gray-700">{config.mode}</strong></span>
          {config.mode !== 'manual' && (
            <span>Auto-draft threshold: <strong className="text-gray-700">{config.fit_threshold}</strong></span>
          )}
          {config.mode === 'autonomous' && (
            <>
              <span>Auto-proposal threshold: <strong className="text-gray-700">{config.auto_threshold}</strong></span>
              <span>Max auto value: <strong className="text-gray-700">{formatCurrency(config.max_auto_value)}</strong></span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Pipeline;
