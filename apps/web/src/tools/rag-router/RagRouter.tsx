// RAG Router tool shell: a header + tab bar ("Query" and "Knowledge"), with the
// active tab rendered via nested routes under /tools/rag-router/*.

import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useCompany } from '../../company/CompanyContext';
import QueryTab from './QueryTab';
import KnowledgeTab from './KnowledgeTab';

export default function RagRouter() {
  const { activeCompany } = useCompany();

  return (
    <div className="flex min-h-full flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-8 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">🧭 Agentic RAG Router</h1>
            <p className="text-sm text-slate-400">
              {activeCompany ? (
                <>
                  Working in{' '}
                  <span className="text-indigo-300">{activeCompany.name}</span> — ask
                  questions or manage its knowledge.
                </>
              ) : (
                'Ask a finance question — routed to semantic search, Text-to-SQL, or both.'
              )}
            </p>
          </div>
          <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← All tools
          </Link>
        </div>

        <nav className="mt-4 flex gap-1">
          <TabLink to="." end>
            Query
          </TabLink>
          <TabLink to="knowledge">Knowledge</TabLink>
        </nav>
      </header>

      <Routes>
        <Route index element={<QueryTab />} />
        <Route path="knowledge" element={<KnowledgeTab />} />
      </Routes>
    </div>
  );
}

function TabLink({
  to,
  end,
  children,
}: {
  to: string;
  end?: boolean;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
          isActive
            ? 'border-indigo-500 text-slate-100'
            : 'border-transparent text-slate-400 hover:text-slate-200'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
