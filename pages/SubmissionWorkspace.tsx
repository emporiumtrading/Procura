import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText, CheckCircle, Circle, Upload, Send,
  ChevronRight, Clock, User, AlertTriangle, Sparkles,
  Download, Eye, Loader2
} from 'lucide-react';
import { api } from '../lib/api';

type SubmissionTask = {
  id: string;
  title: string;
  subtitle?: string | null;
  completed: boolean;
  locked: boolean;
  completed_at?: string | null;
};

type SubmissionFile = {
  id: string;
  file_name: string;
  file_size?: number | null;
  file_type?: string | null;
  storage_path: string;
  scan_status?: string | null;
  created_at?: string | null;
};

type SubmissionData = {
  id: string;
  title: string;
  portal: string;
  due_date: string;
  status: string;
  approval_status: string;
  opportunity?: {
    title?: string;
    agency?: string;
    external_ref?: string;
    ai_summary?: string;
    description?: string;
  } | null;
  files?: SubmissionFile[] | null;
  tasks?: SubmissionTask[] | null;
};

const SubmissionWorkspace: React.FC = () => {
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [tasks, setTasks] = useState<SubmissionTask[]>([]);
  const [documents, setDocuments] = useState<SubmissionFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSubmission = async () => {
    if (!submissionId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const response = await api.getSubmission(submissionId);
    if (response.error || !response.data) {
      setError(response.error || 'Submission not found');
      setSubmission(null);
      setTasks([]);
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    const data = response.data as SubmissionData;
    setSubmission(data);
    setTasks(data.tasks ?? []);
    setDocuments(data.files ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  const completedTasks = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);
  const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value || 'TBD';
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleToggleTask = async (task: SubmissionTask) => {
    if (!submissionId || task.locked) return;
    const nextCompleted = !task.completed;
    const response = await api.updateSubmissionTask(submissionId, task.id, nextCompleted);
    if (response.error) {
      setError(response.error);
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t)));
  };

  const handleSubmit = async () => {
    if (!submissionId) return;
    setIsSubmitting(true);
    const response = await api.finalizeSubmission(submissionId, false);
    if (response.error) {
      setError(response.error);
    }
    await loadSubmission();
    setIsSubmitting(false);
  };

  if (!submissionId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white text-gray-500">
        Select a submission from the Opportunities page to open its workspace.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white text-gray-500">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading workspace...
      </div>
    );
  }

  if (error && !submission) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-white min-h-0">
      <div className="flex-1 flex flex-col border-r border-gray-100 min-w-0">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <span>{submission?.id}</span>
                <ChevronRight size={14} />
                <span>{submission?.opportunity?.external_ref ?? 'N/A'}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">{submission?.title ?? 'Submission Workspace'}</h1>
              <p className="text-sm text-gray-500 mt-1">{submission?.opportunity?.agency ?? 'Unknown Agency'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
                <Eye size={16} />
                Preview
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {isSubmitting ? 'Submitting' : 'Submit'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Completion Progress</span>
                <span className="font-medium text-gray-900">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Due Date</p>
              <p className="font-semibold text-gray-900">{formatDate(submission?.due_date ?? '')}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-6 py-3 border-b border-red-200 bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Checklist</h2>
          {tasks.length === 0 ? (
            <div className="text-sm text-gray-500">No tasks yet for this submission.</div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    task.completed
                      ? 'bg-green-50 border-green-100'
                      : task.locked
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <button className="shrink-0" onClick={() => handleToggleTask(task)} disabled={task.locked}>
                    {task.completed ? (
                      <CheckCircle size={20} className="text-green-600" />
                    ) : (
                      <Circle size={20} className={task.locked ? 'text-gray-300' : 'text-gray-400'} />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </p>
                    {task.subtitle && (
                      <p className="text-xs text-gray-500 mt-0.5">{task.subtitle}</p>
                    )}
                  </div>
                  {task.locked && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <AlertTriangle size={12} /> Locked
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mt-8 mb-4">Documents</h2>
          {documents.length === 0 ? (
            <div className="text-sm text-gray-500">No documents uploaded yet.</div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-all">
                  <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <FileText size={20} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(doc.file_size)} - {doc.created_at ? formatDate(doc.created_at) : 'Recently'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    doc.scan_status === 'clean'
                      ? 'bg-green-100 text-green-700'
                      : doc.scan_status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}>
                    {doc.scan_status ?? 'pending'}
                  </span>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg">
                    <Download size={16} className="text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button className="flex items-center justify-center gap-2 w-full mt-4 py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all">
            <Upload size={16} />
            Upload Documents
          </button>
        </div>
      </div>

      <div className="w-80 flex flex-col bg-gray-50 shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Insights</h3>
              <p className="text-xs text-gray-500">Powered by configured LLM</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {submission?.opportunity?.ai_summary || submission?.opportunity?.description ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg border bg-white">
                <div className="flex items-start gap-2">
                  <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">
                    {submission?.opportunity?.ai_summary ?? submission?.opportunity?.description}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No AI insights available yet.</div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all">
            <Sparkles size={16} />
            Run Compliance Check
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionWorkspace;

