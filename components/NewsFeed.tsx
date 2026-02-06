import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Newspaper, RefreshCw, Search } from 'lucide-react';
import api from '../lib/api';

interface Article {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
  author: string | null;
}

interface NewsFeedData {
  totalResults: number;
  articles: Article[];
}

const DEFAULT_QUERY = 'government contracts OR federal procurement';

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';

  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const NewsFeed: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [activeQuery, setActiveQuery] = useState(DEFAULT_QUERY);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchNews = useCallback(async (q: string) => {
    setIsLoading(true);
    setError(null);
    setNotConfigured(false);

    const response = await api.getNewsFeed({ q, page_size: 10 });

    if (response.error) {
      const msg = typeof response.error === 'string' ? response.error : 'Failed to fetch news.';
      const lower = msg.toLowerCase();

      if (
        lower.includes('news_api_key') ||
        lower.includes('not configured') ||
        lower.includes('api key') ||
        response.status === 503
      ) {
        setNotConfigured(true);
      } else {
        setError(msg);
      }

      setArticles([]);
      setTotalResults(0);
      setIsLoading(false);
      return;
    }

    const payload = (response.data as any)?.data as NewsFeedData | undefined;
    setArticles(payload?.articles ?? []);
    setTotalResults(payload?.totalResults ?? 0);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchNews(activeQuery);
  }, [activeQuery, fetchNews]);

  const handleSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setActiveQuery(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleRefresh = () => {
    fetchNews(activeQuery);
  };

  // -- Not configured state --
  if (notConfigured) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Newspaper size={18} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Market Intelligence</h3>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <Newspaper size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-600 font-medium">News feed not available</p>
          <p className="text-xs text-gray-500 mt-1">
            The NEWS_API_KEY is not configured on the server. Add it in Settings to enable market intelligence.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Newspaper size={18} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Market Intelligence</h3>
          {!isLoading && totalResults > 0 && (
            <span className="text-xs text-gray-400">{totalResults} results</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="Refresh news"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search news topics..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          Search
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">Loading news...</span>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && articles.length === 0 && (
        <div className="text-center py-6">
          <Newspaper size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No articles found for this search.</p>
        </div>
      )}

      {/* Articles list */}
      {!isLoading && !error && articles.length > 0 && (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {articles.map((article, idx) => (
            <a
              key={`${article.url}-${idx}`}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 hover:border-gray-300 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 group-hover:text-gray-700">
                  {article.title}
                </h4>
                <ExternalLink size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5" />
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px] font-medium text-gray-500">{article.source?.name}</span>
                <span className="text-[11px] text-gray-300">|</span>
                <span className="text-[11px] text-gray-400">{relativeTime(article.publishedAt)}</span>
              </div>
              {article.description && (
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">
                  {article.description}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsFeed;
