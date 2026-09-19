import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listTests } from '../../services/firestore';

function toDate(ts) {
  return ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
}

export default function TestsList() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    listTests(user.email).then((data) => {
      setTests(data);
      setLoading(false);
    });
  }, [user.email]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium text-[#1F1F1F]">Tests</h1>
        <Link to="/manage/tests/new" className="btn-primary !w-auto px-4 py-2 text-sm flex items-center gap-2">
          <i className="fa-solid fa-plus"></i> New Test
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading tests…</p>
      ) : tests.length === 0 ? (
        <p className="text-slate-500">No tests yet — create your first one.</p>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => {
            const isOpen = openId === test.id;
            return (
              <div key={test.id} className="admin-card">
                <div className="admin-card-header" onClick={() => setOpenId(isOpen ? null : test.id)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${test.active !== false ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{test.displayName}</div>
                      <div className="text-xs text-slate-500 font-mono truncate">{test.id}</div>
                    </div>
                  </div>
                  <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                </div>

                {isOpen && (
                  <div className="admin-card-body pt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wide">Questions</div>
                        <div className="font-semibold text-slate-700">{test.questions?.length ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wide">Minutes</div>
                        <div className="font-semibold text-slate-700">{test.minutes}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wide">Submissions</div>
                        <div className="font-semibold text-slate-700">{test.submissionCount ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wide">Created</div>
                        <div className="font-semibold text-slate-700">{toDate(test.createdAt)?.toLocaleDateString() ?? '—'}</div>
                      </div>
                    </div>
                    <Link to={`/manage/${test.id}`} className="text-sm font-medium text-[#0B57D0] hover:underline">
                      Manage test <i className="fa-solid fa-arrow-right ml-1"></i>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
