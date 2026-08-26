import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Users, Edit, Trash2, CheckCircle2, XCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useClientGroups, useDeleteClientGroup, useUpdateClientGroup } from '@modules/admin-panel/hooks/use-client-groups';
import { useAdminClients } from '@modules/admin-panel/hooks/use-admin-clients';
import type { IClientGroup, IClient } from '@contracts';

export function ClientGroupsListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isCsView = location.pathname.startsWith('/cs');
  const basePath = isCsView ? '/cs/client-groups' : '/admin/client-groups';

  const { data: groups, isLoading } = useClientGroups();
  const deleteGroup = useDeleteClientGroup();

  const [editingGroup, setEditingGroup] = useState<IClientGroup | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const totalGroups = groups?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalGroups / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedGroups = (groups ?? []).slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="max-w-6xl xl:max-w-[1400px] 2xl:max-w-[1680px] mx-auto px-4 py-6 min-h-[calc(100vh-92px)] flex flex-col space-y-6">
      {/* ── HEADER ── */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Client Groups</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage client groups and configure internal display options for Quotes and Orders.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`${basePath}/create`)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-md cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Client Group</span>
        </button>
      </div>

      {/* ── TABLE / LIST ── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-12 text-center text-slate-400 text-xs font-medium">
            Loading client groups...
          </div>
        ) : !groups || groups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-slate-700 font-bold text-sm">No Client Groups Created</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
              Create client groups to categorize your client database and define internal Quote/Order display rules.
            </p>
            <button
              type="button"
              onClick={() => navigate(`${basePath}/create`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-bold text-xs transition shadow-xs cursor-pointer mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Group</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[11.5px] font-bold text-slate-700">
                  <th className="py-3.5 px-5 w-[180px]">Group Name</th>
                  <th className="py-3.5 px-5">Description</th>
                  <th className="py-3.5 px-5 w-[150px]">Show in Quote</th>
                  <th className="py-3.5 px-5 w-[150px]">Show in Orders</th>
                  <th className="py-3.5 px-5 w-[130px] text-center">Total Clients</th>
                  <th className="py-3.5 px-5 w-[100px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-slate-50/70 transition">
                    {/* Name */}
                    <td className="py-3.5 px-5 font-bold text-slate-900 truncate" title={group.name}>
                      {group.name}
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-5 text-slate-500 truncate font-medium" title={group.description || undefined}>
                      {group.description || <span className="text-slate-300 italic">—</span>}
                    </td>

                    {/* Show in Quote */}
                    <td className="py-3.5 px-5">
                      {group.show_in_quote ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Enabled</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span>Disabled</span>
                        </span>
                      )}
                    </td>

                    {/* Show in Orders */}
                    <td className="py-3.5 px-5">
                      {group.show_in_orders ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Enabled</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span>Disabled</span>
                        </span>
                      )}
                    </td>

                    {/* Total Clients */}
                    <td className="py-3.5 px-5 text-center font-bold text-slate-800">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-xs">
                        <Users className="w-3.5 h-3.5" />
                        <span>{group.client_count ?? group.clients?.length ?? 0}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditingGroup(group)}
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                        title="Edit Group"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(group.id)}
                        className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="Delete Group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PAGINATION ── */}
        {!isLoading && groups && groups.length > 0 && (
          <div className="shrink-0 border-t border-slate-200/80 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 font-medium text-center sm:text-left">
            <div>
              Showing {totalGroups === 0 ? 0 : startIndex + 1} to{' '}
              {Math.min(startIndex + rowsPerPage, totalGroups)} of {totalGroups} groups
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
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

              <div className="flex items-center justify-center gap-1">
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
        )}
      </div>

      {/* ── EDIT GROUP MODAL ── */}
      {editingGroup && (
        <EditClientGroupModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
        />
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteConfirmId &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95">
              <h3 className="text-lg font-bold text-slate-900">Delete Client Group?</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Are you sure you want to delete this Client Group? Clients assigned to this group will no longer have group display settings applied.
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    deleteGroup.mutate(deleteConfirmId, {
                      onSuccess: () => setDeleteConfirmId(null),
                    });
                  }}
                  disabled={deleteGroup.isPending}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {deleteGroup.isPending ? 'Deleting...' : 'Delete Group'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** ── EDIT CLIENT GROUP MODAL COMPONENT ── */
function EditClientGroupModal({
  group,
  onClose,
}: {
  group: IClientGroup;
  onClose: () => void;
}) {
  const updateGroup = useUpdateClientGroup();

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [showInQuote, setShowInQuote] = useState(group.show_in_quote);
  const [showInOrders, setShowInOrders] = useState(group.show_in_orders);

  const [selectedClients, setSelectedClients] = useState<IClient[]>(
    (group.clients || []) as IClient[],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const { data: clientsData } = useAdminClients({
    page: 1,
    per_page: 250,
    search: searchQuery ? searchQuery : undefined,
  });

  const clientList = clientsData?.items || (clientsData as any)?.rows || [];
  const availableClients = clientList.filter(
    (c: IClient) => !selectedClients.some((sc) => sc.id === c.id),
  );

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    updateGroup.mutate(
      {
        id: group.id,
        payload: {
          name: name.trim(),
          description: description.trim() || null,
          show_in_quote: showInQuote,
          show_in_orders: showInOrders,
          client_ids: selectedClients.map((c) => c.id),
        },
      },
      {
        onSuccess: onClose,
      },
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 my-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Edit Client Group: {group.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-800">Group Name *</label>
              <span className="text-[11px] text-slate-400 font-medium">{name.length}/80</span>
            </div>
            <input
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-800">Description</label>
              <span className="text-[11px] text-slate-400 font-medium">{description.length}/250</span>
            </div>
            <textarea
              rows={2}
              maxLength={250}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="space-y-3 pt-2">
            <span className="block font-bold text-blue-600">Display Options</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={showInQuote}
                  onChange={(e) => setShowInQuote(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                />
                <span>Show in Quote</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={showInOrders}
                  onChange={(e) => setShowInOrders(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                />
                <span>Show in Orders</span>
              </label>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="block font-bold text-slate-900">Manage Group Clients</span>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-full">
                {selectedClients.length} {selectedClients.length === 1 ? 'client' : 'clients'}
              </span>
            </div>

            <div className="relative" ref={searchContainerRef}>
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search and add client..."
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsDropdownOpen(false);
                  }
                }}
                className="w-full h-9 pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800 placeholder:text-slate-400"
              />

              {isDropdownOpen && availableClients.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {availableClients.map((c: IClient) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClients((prev) => [...prev, c]);
                        setSearchQuery('');
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50/70 flex items-center justify-between text-xs transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{c.client_name}</span>
                        {c.company_name && (
                          <span className="text-[11px] text-slate-400 font-normal">({c.company_name})</span>
                        )}
                      </div>
                      <span className="font-mono text-[10.5px] text-slate-600 bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-700 px-2 py-0.5 rounded font-semibold border border-slate-200/80 group-hover:border-blue-200 transition-colors">
                        {c.client_id}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto space-y-1.5">
              {selectedClients.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs italic">
                  No clients assigned to this group yet
                </div>
              ) : (
                selectedClients.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 bg-white border border-slate-200/90 rounded-lg flex items-center justify-between shadow-2xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-slate-900 text-xs">{c.client_name}</span>
                      <span className="font-mono text-[10.5px] text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md font-semibold">
                        {c.client_id}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedClients((prev) => prev.filter((sc) => sc.id !== c.id))}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Remove client"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateGroup.isPending || !name.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {updateGroup.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
