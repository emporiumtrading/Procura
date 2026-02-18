import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Save, Plus, Trash2, ChevronDown, ChevronUp,
  Info, CheckCircle, AlertCircle, Loader2, Tag, DollarSign,
  Award, Briefcase, Users, MapPin,
} from 'lucide-react';
import api from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PastPerformanceEntry {
  title: string;
  agency: string;
  contract_number?: string;
  value?: number;
  period?: string;
  description?: string;
  naics_code?: string;
}

interface CompanyProfileData {
  company_name: string;
  cage_code: string;
  uei_number: string;
  duns_number: string;
  naics_codes: string[];
  certifications: string[];
  set_aside_types: string[];
  size_standard: string;
  primary_location: string;
  capabilities: string;
  keywords: string[];
  past_performance: PastPerformanceEntry[];
  min_contract_value?: number;
  max_contract_value?: number;
  preferred_agencies: string[];
  excluded_set_asides: string[];
}

const EMPTY_PROFILE: CompanyProfileData = {
  company_name: '',
  cage_code: '',
  uei_number: '',
  duns_number: '',
  naics_codes: [],
  certifications: [],
  set_aside_types: [],
  size_standard: 'small',
  primary_location: '',
  capabilities: '',
  keywords: [],
  past_performance: [],
  min_contract_value: undefined,
  max_contract_value: undefined,
  preferred_agencies: [],
  excluded_set_asides: [],
};

const CERT_OPTIONS = [
  { value: '8(a)', label: '8(a) Business Development' },
  { value: 'HUBZone', label: 'HUBZone' },
  { value: 'SDVOSB', label: 'SDVOSB — Service-Disabled Veteran-Owned' },
  { value: 'VOSB', label: 'VOSB — Veteran-Owned Small Business' },
  { value: 'WOSB', label: 'WOSB — Women-Owned Small Business' },
  { value: 'EDWOSB', label: 'EDWOSB — Economically Disadvantaged WOSB' },
  { value: 'SDB', label: 'SDB — Small Disadvantaged Business' },
  { value: 'AbilityOne', label: 'AbilityOne' },
];

const COMMON_NAICS_IT = [
  { code: '541511', label: '541511 — Custom Computer Programming' },
  { code: '541512', label: '541512 — Computer Systems Design' },
  { code: '541513', label: '541513 — Computer Facilities Management' },
  { code: '541519', label: '541519 — Other Computer Related Services' },
  { code: '541330', label: '541330 — Engineering Services' },
  { code: '541611', label: '541611 — Management Consulting' },
  { code: '541618', label: '541618 — Other Mgmt Consulting' },
  { code: '541690', label: '541690 — Other Scientific & Technical Services' },
  { code: '518210', label: '518210 — Data Processing & Hosting' },
  { code: '611430', label: '611430 — IT Training' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-gray-900 text-sm">
          {icon}
          {title}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-2 bg-white space-y-4">{children}</div>}
    </div>
  );
}

function TagInput({ label, values, onChange, placeholder, suggestions = [] }: {
  label: string; values: string[]; onChange: (v: string[]) => void;
  placeholder?: string; suggestions?: string[];
}) {
  const [input, setInput] = useState('');

  const add = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
  };

  const remove = (v: string) => onChange(values.filter(x => x !== v));

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 bg-gray-900 text-white text-xs rounded-full px-3 py-1">
            {v}
            <button type="button" onClick={() => remove(v)} className="hover:text-red-300 ml-0.5">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); } }}
          placeholder={placeholder || 'Type and press Enter'}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <button type="button" onClick={() => add(input)} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          <Plus size={14} />
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {suggestions.filter(s => !values.includes(s)).map(s => (
            <button key={s} type="button" onClick={() => add(s)}
              className="text-xs text-gray-500 border border-gray-200 rounded-full px-2 py-0.5 hover:border-gray-900 hover:text-gray-900 transition-colors">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckboxGroup({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) => {
    selected.includes(val)
      ? onChange(selected.filter(x => x !== val))
      : onChange([...selected, val]);
  };
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">{label}</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CompanyProfile: React.FC = () => {
  const [profile, setProfile] = useState<CompanyProfileData>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  // Past performance edit state
  const [ppDraft, setPpDraft] = useState<PastPerformanceEntry>({
    title: '', agency: '', contract_number: '', value: undefined, period: '', description: '',
  });
  const [showPpForm, setShowPpForm] = useState(false);

  const setField = useCallback(<K extends keyof CompanyProfileData>(key: K, value: CompanyProfileData[K]) => {
    setProfile(p => ({ ...p, [key]: value }));
    setDirty(true);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.getCompanyProfile();
      if (res.data) {
        setProfile({ ...EMPTY_PROFILE, ...res.data });
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    // Sync certifications → set_aside_types for backend pre-filtering
    const toSave = { ...profile, set_aside_types: profile.certifications };
    const res = await api.saveCompanyProfile(toSave);
    setSaving(false);
    if (res.error) {
      setSaveStatus('error');
      setError(res.error);
    } else {
      setSaveStatus('success');
      setDirty(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const addPastPerf = () => {
    if (!ppDraft.title || !ppDraft.agency) return;
    setField('past_performance', [...profile.past_performance, { ...ppDraft }]);
    setPpDraft({ title: '', agency: '', contract_number: '', value: undefined, period: '', description: '' });
    setShowPpForm(false);
  };

  const removePastPerf = (idx: number) => {
    setField('past_performance', profile.past_performance.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Building2 size={22} className="text-gray-900" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Company Profile</h1>
            <p className="text-xs text-gray-500">Used by AI to personalize opportunity scoring and proposal generation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'success' && (
            <span className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
              <CheckCircle size={14} /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <AlertCircle size={14} /> {error}
            </span>
          )}
          {!profile.company_name && (
            <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <Info size={12} /> Profile not set — AI uses generic scoring
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl w-full mx-auto">

        {/* Basic Info */}
        <Section title="Company Identity" icon={<Building2 size={16} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Company Name *</label>
              <input value={profile.company_name} onChange={e => setField('company_name', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Acme Technologies LLC" />
            </div>
            {[
              { key: 'cage_code' as const, label: 'CAGE Code', placeholder: '1ABC2' },
              { key: 'uei_number' as const, label: 'UEI Number (SAM.gov)', placeholder: 'ABCDE1234567' },
              { key: 'duns_number' as const, label: 'DUNS Number', placeholder: '123456789' },
              { key: 'primary_location' as const, label: 'Primary Location', placeholder: 'Washington, DC' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{f.label}</label>
                <input value={(profile[f.key] as string) || ''} onChange={e => setField(f.key, e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder={f.placeholder} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Business Size</label>
              <select value={profile.size_standard} onChange={e => setField('size_standard', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="small">Small Business</option>
                <option value="large">Large Business</option>
                <option value="micro">Micro Business</option>
              </select>
            </div>
          </div>
        </Section>

        {/* NAICS Codes */}
        <Section title="NAICS Codes" icon={<Tag size={16} />}>
          <p className="text-xs text-gray-500">Add your registered NAICS codes. AI will only score opportunities whose NAICS matches one of these.</p>
          <TagInput
            label="Your NAICS Codes"
            values={profile.naics_codes}
            onChange={v => setField('naics_codes', v)}
            placeholder="e.g. 541511"
            suggestions={COMMON_NAICS_IT.filter(n => !profile.naics_codes.includes(n.code)).map(n => n.code)}
          />
          {COMMON_NAICS_IT.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {COMMON_NAICS_IT.map(n => (
                <button key={n.code} type="button"
                  onClick={() => !profile.naics_codes.includes(n.code) && setField('naics_codes', [...profile.naics_codes, n.code])}
                  className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                    profile.naics_codes.includes(n.code)
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-200 text-gray-600 hover:border-gray-900 hover:text-gray-900'
                  }`}>
                  {n.code} — {n.label.split('—')[1]?.trim()}
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Certifications */}
        <Section title="Certifications & Set-Aside Eligibility" icon={<Award size={16} />}>
          <p className="text-xs text-gray-500">Select all certifications your company holds. Opportunities with non-matching set-asides will receive lower fit scores.</p>
          <CheckboxGroup
            label="Active Certifications"
            options={CERT_OPTIONS}
            selected={profile.certifications}
            onChange={v => setField('certifications', v)}
          />
        </Section>

        {/* Capabilities */}
        <Section title="Capabilities & Keywords" icon={<Briefcase size={16} />}>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Capability Statement
            </label>
            <textarea
              value={profile.capabilities}
              onChange={e => setField('capabilities', e.target.value)}
              rows={5}
              placeholder="Describe your company's core technical capabilities, areas of expertise, differentiators, and the types of government work you have performed..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{profile.capabilities.length} characters — more detail leads to better AI scoring</p>
          </div>
          <TagInput
            label="Industry Keywords"
            values={profile.keywords}
            onChange={v => setField('keywords', v)}
            placeholder="e.g. cloud migration, cybersecurity, DevSecOps"
            suggestions={['cloud', 'cybersecurity', 'DevSecOps', 'Agile', 'AI/ML', 'data analytics', 'zero trust', 'SIEM', 'AWS', 'Azure', 'GCP', 'Kubernetes', 'microservices']}
          />
        </Section>

        {/* Past Performance */}
        <Section title="Past Performance" icon={<Users size={16} />} defaultOpen={false}>
          <p className="text-xs text-gray-500">Past contracts are used by AI to match similar opportunities and generate proposal narratives.</p>
          <div className="space-y-2">
            {profile.past_performance.map((pp, idx) => (
              <div key={idx} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{pp.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {pp.agency}{pp.value ? ` · $${pp.value.toLocaleString()}` : ''}{pp.period ? ` · ${pp.period}` : ''}
                  </p>
                  {pp.description && <p className="text-gray-400 text-xs mt-1 truncate">{pp.description}</p>}
                </div>
                <button onClick={() => removePastPerf(idx)} className="ml-3 text-gray-400 hover:text-red-500 shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {showPpForm ? (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'title', label: 'Contract Title *', placeholder: 'Cloud Migration Support' },
                  { key: 'agency', label: 'Agency *', placeholder: 'DoD / DISA' },
                  { key: 'contract_number', label: 'Contract Number', placeholder: 'W52P1J-23-C-0001' },
                  { key: 'period', label: 'Period of Performance', placeholder: '2022-2024' },
                  { key: 'naics_code', label: 'NAICS Code', placeholder: '541512' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{f.label}</label>
                    <input
                      value={(ppDraft as any)[f.key] || ''}
                      onChange={e => setPpDraft(d => ({ ...d, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Contract Value ($)</label>
                  <input
                    type="number"
                    value={ppDraft.value || ''}
                    onChange={e => setPpDraft(d => ({ ...d, value: Number(e.target.value) || undefined }))}
                    placeholder="500000"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Description</label>
                <textarea
                  rows={2}
                  value={ppDraft.description || ''}
                  onChange={e => setPpDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder="Brief description of work performed..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addPastPerf}
                  className="flex items-center gap-1.5 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                  <Plus size={14} /> Add Entry
                </button>
                <button onClick={() => setShowPpForm(false)}
                  className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowPpForm(true)}
              className="flex items-center gap-2 text-sm text-gray-600 border border-dashed border-gray-300 rounded-lg px-4 py-2.5 hover:border-gray-900 hover:text-gray-900 transition-colors w-full justify-center">
              <Plus size={14} /> Add Past Performance Entry
            </button>
          )}
        </Section>

        {/* Bidding Preferences */}
        <Section title="Bidding Preferences" icon={<DollarSign size={16} />} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Min Contract Value ($)</label>
              <input
                type="number"
                value={profile.min_contract_value || ''}
                onChange={e => setField('min_contract_value', Number(e.target.value) || undefined)}
                placeholder="25000"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Max Contract Value ($)</label>
              <input
                type="number"
                value={profile.max_contract_value || ''}
                onChange={e => setField('max_contract_value', Number(e.target.value) || undefined)}
                placeholder="10000000"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>
          <TagInput
            label="Preferred Agencies"
            values={profile.preferred_agencies}
            onChange={v => setField('preferred_agencies', v)}
            placeholder="e.g. DoD, DHS, HHS"
            suggestions={['DoD', 'DHS', 'HHS', 'VA', 'GSA', 'NASA', 'DOJ', 'Treasury', 'USAF', 'Army', 'Navy', 'DISA', 'CISA']}
          />
          <TagInput
            label="Excluded Set-Asides (skip these)"
            values={profile.excluded_set_asides}
            onChange={v => setField('excluded_set_asides', v)}
            placeholder="e.g. 8(a) (if you don't have this cert)"
            suggestions={['8(a)', 'HUBZone', 'SDVOSB', 'WOSB']}
          />
        </Section>

        {/* AI Scoring Preview */}
        {profile.company_name && (
          <div className="bg-gray-900 text-white rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <CheckCircle size={14} className="text-green-400" />
              Personalized AI scoring is active
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              AI will now score opportunities against <span className="text-white font-medium">{profile.company_name}</span>'s
              {profile.naics_codes.length > 0 && <> {profile.naics_codes.length} NAICS codes,</>}
              {profile.certifications.length > 0 && <> {profile.certifications.join(', ')} certifications,</>}
              {' '}and your capability statement. Use <span className="text-white font-medium">Force Refresh</span> on any opportunity to re-score with this profile.
            </p>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
};

export default CompanyProfile;
