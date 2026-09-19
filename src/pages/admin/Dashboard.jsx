import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StatTile from '../../components/StatTile';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { listRecentSubmissions, listRecentlyCreatedTests, listRecentlyEditedTests, listTests } from '../../services/firestore';

const RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];

function toDate(ts) {
  return ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
}

function withinRange(date, days) {
  if (days === 'all') return true;
  if (!date) return false;
  const cutoff = Date.now() - Number(days) * 24 * 60 * 60 * 1000;
  return date.getTime() >= cutoff;
}

function timeAgo(date) {
  if (!date) return '—';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState([]);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [recentCreated, setRecentCreated] = useState([]);
  const [recentEdited, setRecentEdited] = useState([]);
  const [range, setRange] = useState('7');

  useEffect(() => {
    async function load() {
      const sources = [
        { label: 'tests', fn: () => listTests(user.email), set: setTests },
        { label: 'recent submissions', fn: () => listRecentSubmissions(user.email, 30), set: setRecentSubmissions },
        { label: 'recently created tests', fn: () => listRecentlyCreatedTests(user.email, 10), set: setRecentCreated },
        { label: 'recently edited tests', fn: () => listRecentlyEditedTests(user.email, 10), set: setRecentEdited },
      ];
      const results = await Promise.allSettled(sources.map((s) => s.fn()));

      results.forEach((result, i) => {
        const { label, set } = sources[i];
        if (result.status === 'fulfilled') {
          set(result.value);
        } else {
          const err = result.reason;
          console.error(`Failed to load ${label}:`, err);
          toast.warning(`Failed to load ${label}${err?.code ? ` (${err.code})` : ''}.`);
        }
      });

      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email]);

  const metrics = useMemo(() => {
    const totalTests = tests.length;
    const active = tests.filter((t) => t.active !== false).length;
    const totalSubmissions = tests.reduce((sum, t) => sum + (t.submissionCount || 0), 0);
    return { totalTests, active, disabled: totalTests - active, totalSubmissions };
  }, [tests]);

  const testNamesById = useMemo(
    () => Object.fromEntries(tests.map((t) => [t.id, t.displayName])),
    [tests]
  );

  const filteredSubmissions = useMemo(
    () => recentSubmissions.filter((s) => withinRange(toDate(s.submittedAt), range)),
    [recentSubmissions, range]
  );
  const filteredCreated = useMemo(
    () => recentCreated.filter((t) => withinRange(toDate(t.createdAt), range)),
    [recentCreated, range]
  );
  const filteredEdited = useMemo(
    () => recentEdited.filter((t) => withinRange(toDate(t.updatedAt), range)),
    [recentEdited, range]
  );

  if (loading) return <p className="text-slate-500">Loading dashboard…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-medium text-[#1F1F1F]">Dashboard</h1>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="input-field !w-auto text-sm"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatTile icon="fa-solid fa-file-lines" label="Total Tests" value={metrics.totalTests} tone="blue" />
        <StatTile icon="fa-solid fa-inbox" label="Total Submissions" value={metrics.totalSubmissions} tone="green" />
        <StatTile icon="fa-solid fa-circle-check" label="Active Tests" value={metrics.active} tone="green" />
        <StatTile icon="fa-solid fa-circle-pause" label="Disabled Tests" value={metrics.disabled} tone="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <RecentCard title="Recent Submissions" empty="No submissions in this range.">
          {filteredSubmissions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-[#1F1F1F] truncate">{s.name || s.studentId}</div>
                <div className="text-xs text-[#444746] truncate">{testNamesById[s.testId] || s.testId}</div>
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(toDate(s.submittedAt))}</span>
            </li>
          ))}
        </RecentCard>

        <RecentCard title="Recently Created Tests" empty="No tests created in this range.">
          {filteredCreated.map((t) => (
            <li key={t.id} className="py-2 text-sm">
              <Link to={`/manage/${t.id}`} className="font-medium text-[#0B57D0] hover:underline truncate block">{t.displayName}</Link>
              <span className="text-xs text-slate-400">{timeAgo(toDate(t.createdAt))}</span>
            </li>
          ))}
        </RecentCard>

        <RecentCard title="Recently Edited Tests" empty="No edits in this range.">
          {filteredEdited.map((t) => (
            <li key={t.id} className="py-2 text-sm">
              <Link to={`/manage/${t.id}`} className="font-medium text-[#0B57D0] hover:underline truncate block">{t.displayName}</Link>
              <span className="text-xs text-slate-400">{timeAgo(toDate(t.updatedAt))}</span>
            </li>
          ))}
        </RecentCard>
      </div>
    </div>
  );
}

function RecentCard({ title, empty, children }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="gcard !p-5">
      <h3 className="text-sm font-semibold text-[#1F1F1F] mb-2">{title}</h3>
      {hasChildren ? (
        <ul className="divide-y divide-[#F1F3F4]">{children}</ul>
      ) : (
        <p className="text-sm text-[#444746] py-6 text-center">{empty}</p>
      )}
    </div>
  );
}
