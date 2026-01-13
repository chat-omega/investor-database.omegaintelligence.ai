import { useState } from 'react';
import { UserCircle, Search, ChevronLeft, ChevronRight, Mail, Phone, Linkedin } from 'lucide-react';
import { usePreqinPeople, usePreqinStats, formatNumber } from '@/services/preqinApi';
import type { PeopleParams } from '@/types/preqin';

export function PreqinPeoplePage() {
  const [params, setParams] = useState<PeopleParams>({ page: 1, page_size: 20 });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = usePreqinPeople(params);
  const { data: stats } = usePreqinStats();

  const handleSearch = () => {
    setParams(prev => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleFilterChange = (key: keyof PeopleParams, value: string) => {
    setParams(prev => ({ ...prev, [key]: value || undefined, page: 1 }));
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Preqin People</h1>
              <p className="text-sm text-slate-400">Contacts & Professionals</p>
            </div>
          </div>
          {stats && (
            <div className="flex items-center space-x-6 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{formatNumber(stats.total_persons)}</div>
                <div className="text-slate-400">Total Contacts</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-slate-700/20">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search people..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={params.seniority || ''}
            onChange={(e) => handleFilterChange('seniority', e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Seniority Levels</option>
            <option value="C-Level">C-Level</option>
            <option value="Partner">Partner</option>
            <option value="Managing Director">Managing Director</option>
            <option value="Director">Director</option>
            <option value="Vice President">Vice President</option>
            <option value="Associate">Associate</option>
            <option value="Analyst">Analyst</option>
          </select>
          <select
            value={params.country || ''}
            onChange={(e) => handleFilterChange('country', e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Countries</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="China">China</option>
            <option value="Japan">Japan</option>
          </select>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Firm</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Seniority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading...</td>
                  </tr>
                ) : !data?.items.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No people found</td>
                  </tr>
                ) : (
                  data.items.map((person) => (
                    <tr key={person.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-white font-medium">{person.full_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{person.title || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{person.current_firm_name || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {person.seniority_level ? (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                            {person.seniority_level}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {[person.location_city, person.location_country].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex items-center justify-center space-x-2">
                          {person.email && (
                            <a
                              href={`mailto:${person.email}`}
                              className="text-amber-400 hover:text-amber-300"
                              title={person.email}
                            >
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                          {person.phone && (
                            <a
                              href={`tel:${person.phone}`}
                              className="text-amber-400 hover:text-amber-300"
                              title={person.phone}
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          {person.linkedin_url && (
                            <a
                              href={person.linkedin_url.startsWith('http') ? person.linkedin_url : `https://${person.linkedin_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-400 hover:text-amber-300"
                            >
                              <Linkedin className="w-4 h-4" />
                            </a>
                          )}
                          {!person.email && !person.phone && !person.linkedin_url && '-'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && (
            <div className="px-4 py-3 bg-slate-800 border-t border-slate-700/50 flex items-center justify-between">
              <div className="text-sm text-slate-400">
                Showing {((data.page - 1) * data.page_size) + 1} to {Math.min(data.page * data.page_size, data.total)} of {data.total}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setParams(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                  disabled={data.page <= 1}
                  className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <span className="text-sm text-white">Page {data.page} of {data.pages}</span>
                <button
                  onClick={() => setParams(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                  disabled={data.page >= data.pages}
                  className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
