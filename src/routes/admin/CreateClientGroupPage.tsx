import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Plus, Trash2, Users as UsersIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCreateClientGroup } from '@modules/admin-panel/hooks/use-client-groups';
import { useAdminClients } from '@modules/admin-panel/hooks/use-admin-clients';
import type { IClient } from '@contracts';

export function CreateClientGroupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isCsView = location.pathname.startsWith('/cs');
  const basePath = isCsView ? '/cs/client-groups' : '/admin/client-groups';

  const createGroup = useCreateClientGroup();

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showInQuote, setShowInQuote] = useState(false);
  const [showInOrders, setShowInOrders] = useState(false);

  // Selected Clients State
  const [selectedClients, setSelectedClients] = useState<IClient[]>([]);

  // Search & Picker State
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch directory clients for adding to group
  const { data: clientsData } = useAdminClients({
    page: 1,
    per_page: 250,
    search: searchQuery ? searchQuery : undefined,
  });

  const clientList = clientsData?.items || (clientsData as any)?.rows || [];
  const availableClients = clientList.filter(
    (c: IClient) => !selectedClients.some((sc) => sc.id === c.id),
  );

  function handleAddClient(client: IClient) {
    setSelectedClients((prev) => [...prev, client]);
    setSearchQuery('');
    setIsDropdownOpen(false);
  }

  function handleRemoveClient(clientId: string) {
    setSelectedClients((prev) => prev.filter((c) => c.id !== clientId));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    createGroup.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        show_in_quote: showInQuote,
        show_in_orders: showInOrders,
        client_ids: selectedClients.map((c) => c.id),
      },
      {
        onSuccess: () => {
          navigate(basePath);
        },
      },
    );
  }

  // Pagination for selected clients table
  const totalSelected = selectedClients.length;
  const totalPages = Math.max(1, Math.ceil(totalSelected / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedSelectedClients = selectedClients.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="max-w-6xl mx-auto px-4 py-2 space-y-2.5">
      {/* ── PAGE TITLE ── */}
      <div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">Create Client Group</h1>
        <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium">
          Create a new client group and define rules and display options.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* ── SINGLE MAIN CARD CONTAINER ── */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 space-y-3">
          {/* SECTION 1: BASIC INFORMATION */}
          <div className="space-y-2">
            <h2 className="text-[13px] font-extrabold text-blue-700 tracking-wide pb-1.5 border-b border-slate-200">
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-0.5">
              <div>
                <label className="block text-xs font-extrabold text-slate-900 mb-1">
                  Client Group Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter client group name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal transition-colors shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-900 mb-1">
                  Description <span className="text-slate-500 font-medium">(Optional)</span>
                </label>
                <textarea
                  rows={1.5}
                  placeholder="Enter description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal transition-colors shadow-2xs resize-y h-14"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: DISPLAY OPTIONS */}
          <div className="space-y-2 pt-0.5">
            <h2 className="text-[13px] font-extrabold text-blue-700 tracking-wide pb-1.5 border-b border-slate-200">
              Display Options
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 pt-0.5">
              {/* Show in Quote */}
              <div className="flex items-center gap-2.5 py-1 md:pr-4">
                <input
                  type="checkbox"
                  id="show_in_quote"
                  checked={showInQuote}
                  onChange={(e) => setShowInQuote(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                />
                <div>
                  <label htmlFor="show_in_quote" className="text-xs font-extrabold text-slate-900 cursor-pointer block leading-tight">
                    Show in Quote
                  </label>
                  <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                    Client group name will be displayed in Quotes.
                  </p>
                </div>
              </div>

              {/* Show in Orders */}
              <div className="flex items-center gap-2.5 py-1 md:pl-4">
                <input
                  type="checkbox"
                  id="show_in_orders"
                  checked={showInOrders}
                  onChange={(e) => setShowInOrders(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                />
                <div>
                  <label htmlFor="show_in_orders" className="text-xs font-extrabold text-slate-900 cursor-pointer block leading-tight">
                    Show in Orders
                  </label>
                  <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                    Client group name will be displayed in Orders.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: ADD CLIENTS TO THIS GROUP */}
          <div className="border-t border-slate-200 pt-2 space-y-2">
            <div>
              <h2 className="text-[13px] font-extrabold text-blue-700 tracking-wide">
                Add Clients to this Group <span className="text-slate-500 font-medium">(Optional)</span>
              </h2>
              <p className="text-[11.5px] text-slate-600 mt-0.5 font-medium">
                Search and add clients who will be part of this group.
              </p>
            </div>

            {/* Search & Add Bar */}
            <div className="relative flex items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search client name or client ID"
                  value={searchQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal transition-colors shadow-2xs"
                />

                {/* Dropdown list of matching clients */}
                {isDropdownOpen && availableClients.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-36 overflow-y-auto">
                    {availableClients.map((c: IClient) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleAddClient(c)}
                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center justify-between text-xs transition border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-slate-900 block">{c.client_name}</span>
                          <span className="text-[10.5px] text-slate-500">{c.email}</span>
                        </div>
                        <span className="font-mono text-[10.5px] text-slate-600 font-semibold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          {c.client_id}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-blue-600 bg-white text-blue-600 font-bold text-xs hover:bg-blue-50 transition shadow-2xs cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Client</span>
              </button>
            </div>

            {/* Selected Clients Table */}
            <div className="border border-slate-200/90 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                    <th className="py-1.5 px-3">Client ID</th>
                    <th className="py-1.5 px-3">Client Name</th>
                    <th className="py-1.5 px-3">Email</th>
                    <th className="py-1.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedSelectedClients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-2 text-center text-slate-400 text-xs font-medium">
                        No clients added to this group yet. Use the search bar above to select clients.
                      </td>
                    </tr>
                  ) : (
                    paginatedSelectedClients.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-1.5 px-3 font-mono font-medium text-slate-800 text-xs">
                          {c.client_id}
                        </td>
                        <td className="py-1.5 px-3 font-semibold text-slate-900">
                          {c.client_name}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600">{c.email}</td>
                        <td className="py-1.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveClient(c.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Remove Client"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Pagination */}
            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <div>
                Showing {totalSelected === 0 ? 0 : startIndex + 1} to{' '}
                {Math.min(startIndex + rowsPerPage, totalSelected)} of {totalSelected} clients
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span>Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-6 border border-slate-200 rounded-lg px-1.5 text-[11px] bg-white focus:outline-none cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-[11px]">
                    {currentPage}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── CARD FOOTER / ACTION BUTTONS AREA ── */}
          <div className="border-t border-slate-200/80 pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => navigate(basePath)}
              className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createGroup.isPending || !name.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UsersIcon className="w-3.5 h-3.5" />
              <span>{createGroup.isPending ? 'Creating...' : 'Create Client Group'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
