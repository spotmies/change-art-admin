import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Ban,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { IClient } from '@contracts';
import { cn } from '@lib/utils';
import {
  useAdminClientById,
  useAdminClients,
  usePendingClients,
  useSendCcForm,
  useSetClientActive,
  useSetClientHotlisted,
} from '../hooks/use-admin-clients';
import { useProfileChangeRequests } from '../hooks/use-profile-change-requests';
import { ClientDetailModal, type ClientModalMode } from './ClientDetailModal';
import { AddClientModal } from './AddClientModal';

export interface ClientDisplayRecord {
  id: string;
  client_id: string;
  client_name: string;
  company_name: string;
  email: string;
  contact_number: string;
  country: string;
  joined_on: string;
  last_updated_date: string;
  last_updated_time: string;
  status: 'Active' | 'Inactive';
  accounting: 'Updated CC Required' | 'Hotlisted' | 'Others' | '-';
  action: 'Send CC Form' | 'Send Payment Reminder' | '-';
  isHotlisted?: boolean;
  isActive?: boolean;
  rawClient?: IClient;
}



const COUNTRY_ISO_MAP: Record<string, string> = {
  // North America & Caribbean
  'united states': 'us', 'usa': 'us', 'us': 'us',
  'canada': 'ca', 'mexico': 'mx', 'panama': 'pa', 'costa rica': 'cr',
  'jamaica': 'jm', 'dominican republic': 'do', 'puerto rico': 'pr',
  'bahamas': 'bs', 'trinidad and tobago': 'tt', 'barbados': 'bb',
  'guatemala': 'gt', 'honduras': 'hn', 'el salvador': 'sv', 'nicaragua': 'ni',

  // Europe
  'united kingdom': 'gb', 'uk': 'gb', 'great britain': 'gb', 'england': 'gb', 'scotland': 'gb',
  'germany': 'de', 'france': 'fr', 'italy': 'it', 'spain': 'es', 'portugal': 'pt',
  'netherlands': 'nl', 'belgium': 'be', 'switzerland': 'ch', 'austria': 'at',
  'sweden': 'se', 'norway': 'no', 'denmark': 'dk', 'finland': 'fi', 'iceland': 'is',
  'ireland': 'ie', 'poland': 'pl', 'czech republic': 'cz', 'czechia': 'cz',
  'greece': 'gr', 'hungary': 'hu', 'romania': 'ro', 'bulgaria': 'bg',
  'ukraine': 'ua', 'russia': 'ru', 'russian federation': 'ru', 'turkey': 'tr', 'türkiye': 'tr',
  'croatia': 'hr', 'serbia': 'rs', 'slovakia': 'sk', 'slovenia': 'si',
  'estonia': 'ee', 'latvia': 'lv', 'lithuania': 'lt', 'cyprus': 'cy', 'malta': 'mt',
  'luxembourg': 'lu', 'monaco': 'mc',

  // Asia & Middle East
  'india': 'in', 'china': 'cn', 'japan': 'jp', 'south korea': 'kr', 'korea': 'kr',
  'singapore': 'sg', 'hong kong': 'hk', 'taiwan': 'tw', 'thailand': 'th',
  'vietnam': 'vn', 'malaysia': 'my', 'indonesia': 'id', 'philippines': 'ph',
  'pakistan': 'pk', 'bangladesh': 'bd', 'sri lanka': 'lk', 'nepal': 'np',
  'united arab emirates': 'ae', 'uae': 'ae', 'saudi arabia': 'sa',
  'qatar': 'qa', 'kuwait': 'kw', 'bahrain': 'bh', 'oman': 'om',
  'israel': 'il', 'jordan': 'jo', 'lebanon': 'lb', 'kazakhstan': 'kz',
  'uzbekistan': 'uz', 'azerbaijan': 'az', 'georgia': 'ge', 'armenia': 'am',

  // Oceania
  'australia': 'au', 'new zealand': 'nz', 'fiji': 'fj', 'papua new guinea': 'pg',

  // South America
  'brazil': 'br', 'argentina': 'ar', 'chile': 'cl', 'colombia': 'co',
  'peru': 'pe', 'venezuela': 've', 'ecuador': 'ec', 'uruguay': 'uy',
  'paraguay': 'py', 'bolivia': 'bo',

  // Africa
  'south africa': 'za', 'egypt': 'eg', 'nigeria': 'ng', 'kenya': 'ke',
  'morocco': 'ma', 'ghana': 'gh', 'ethiopia': 'et', 'algeria': 'dz',
  'tunisia': 'tn', 'uganda': 'ug', 'tanzania': 'tz', 'zimbabwe': 'zw',
  'mauritius': 'mu', 'senegal': 'sn', 'ivory coast': 'ci',
};

function getCountryFlagUrl(country?: string | null): string | null {
  if (!country) return null;
  const str = country.trim().toLowerCase();

  // Direct match or alias
  if (COUNTRY_ISO_MAP[str]) {
    return `https://flagcdn.com/w40/${COUNTRY_ISO_MAP[str]}.png`;
  }

  // Partial match in dictionary
  for (const [name, code] of Object.entries(COUNTRY_ISO_MAP)) {
    if (str.includes(name)) {
      return `https://flagcdn.com/w40/${code}.png`;
    }
  }

  // Fallback for 2-letter ISO code string
  if (str.length === 2 && /^[a-z]{2}$/.test(str)) {
    return `https://flagcdn.com/w40/${str}.png`;
  }

  return null;
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 1) return [1];
  if (total === 2 || current <= 2) return [1, 2];
  return [current - 1, current];
}

function ActionsCell({
  onView,
  onEdit,
  onSendCcForm,
  onToggleHotlist,
  onToggleActive,
  isHotlisted,
  isActive,
}: {
  onView: () => void;
  onEdit: () => void;
  onSendCcForm: () => void;
  onToggleHotlist: () => void;
  onToggleActive: () => void;
  isHotlisted?: boolean;
  isActive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="inline-flex items-center gap-1.5 justify-end">
      <button
        type="button"
        className="w-7 h-7 rounded-[6px] border border-slate-200/90 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 shadow-2xs transition cursor-pointer"
        title="View Client Details"
        onClick={onView}
      >
        <Eye className="w-4 h-4 text-slate-700" />
      </button>
      <button
        ref={btnRef}
        type="button"
        className="w-7 h-7 rounded-[6px] border border-slate-200/90 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 shadow-2xs transition cursor-pointer"
        title="More options"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="w-4 h-4 text-slate-700" />
      </button>

      {open && pos
        ? createPortal(
          <>
            <div className="fixed inset-0 z-[59]" role="presentation" onClick={() => setOpen(false)} />
            <div
              role="menu"
              className="fixed w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1 z-[60] text-left divide-y divide-slate-100"
              style={{ top: pos.top, right: pos.right }}
            >
              <div className="py-1">
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  onClick={() => {
                    setOpen(false);
                    onView();
                  }}
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>View Profile</span>
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  onClick={() => {
                    setOpen(false);
                    onEdit();
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-400" />
                  <span>Edit Client</span>
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-50 flex items-center gap-2 cursor-pointer"
                  onClick={() => {
                    setOpen(false);
                    onSendCcForm();
                  }}
                >
                  <Send className="w-3.5 h-3.5 text-purple-600" />
                  <span>Send CC Form</span>
                </button>
              </div>

              <div className="py-1">
                {/* Status toggle option */}
                {isActive ? (
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2 cursor-pointer"
                    onClick={() => {
                      setOpen(false);
                      onToggleActive();
                    }}
                  >
                    <UserX className="w-3.5 h-3.5 text-amber-600" />
                    <span>Deactivate Client</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
                    onClick={() => {
                      setOpen(false);
                      onToggleActive();
                    }}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Activate Client</span>
                  </button>
                )}

                {/* Hotlist toggle option */}
                {isHotlisted ? (
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    onClick={() => {
                      setOpen(false);
                      onToggleHotlist();
                    }}
                  >
                    <Ban className="w-3.5 h-3.5 text-slate-400" />
                    <span>Remove Hotlist</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                    onClick={() => {
                      setOpen(false);
                      onToggleHotlist();
                    }}
                  >
                    <Ban className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hotlist Client</span>
                  </button>
                )}
              </div>
            </div>
          </>,
          document.body,
        )
        : null}
    </div>
  );
}

interface ClientRecordsViewProps {
  isAdminView?: boolean;
  onNavigateToApprove?: () => void;
  onNavigateToProfileRequests?: () => void;
}

function truncateString(str: string | undefined | null, maxLen = 14): string {
  if (!str) return '—';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

function TextWithTooltip({
  text,
  maxLen = 14,
  className = '',
}: {
  text: string | undefined | null;
  maxLen?: number;
  className?: string;
}) {
  if (!text || text === '—') {
    return <span className={className}>—</span>;
  }

  const isTruncated = text.length > maxLen;
  const displayText = truncateString(text, maxLen);

  if (!isTruncated) {
    return <span className={className}>{displayText}</span>;
  }

  return (
    <span className="relative group/tooltip inline-block max-w-full">
      <span className={className}>{displayText}</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:flex flex-col items-center z-[100] animate-in fade-in zoom-in-95 duration-100">
        <span className="bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-[6px] shadow-xl whitespace-nowrap border border-slate-800 tracking-normal font-sans">
          {text}
        </span>
        <span className="w-2 h-2 -mt-1 rotate-45 bg-slate-900 border-r border-b border-slate-800" />
      </span>
    </span>
  );
}

export function ClientRecordsView({
  isAdminView = true,
  onNavigateToApprove,
  onNavigateToProfileRequests,
}: ClientRecordsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [accountingFilter, setAccountingFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [joinedFrom, setJoinedFrom] = useState<string>('');
  const [joinedTo, setJoinedTo] = useState<string>('');

  const [sortField, setSortField] = useState<keyof ClientDisplayRecord>('client_id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Reset to page 1 when search/filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, accountingFilter, countryFilter, joinedFrom, joinedTo]);

  const [selectedClient, setSelectedClient] = useState<{ id: string; mode: ClientModalMode } | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);

  const { data: apiData, isLoading: isClientsLoading } = useAdminClients({ per_page: 250 });
  const { data: activeModalClient } = useAdminClientById(selectedClient?.id ?? null);
  const sendCcForm = useSendCcForm();
  const setClientHotlisted = useSetClientHotlisted();
  const setClientActive = useSetClientActive();

  function handleToggleHotlist(rec: ClientDisplayRecord) {
    if (!rec.id) return;
    const isHotlisted = rec.isHotlisted ?? (rec.accounting === 'Hotlisted');
    setClientHotlisted.mutate({ id: rec.id, hotlisted: !isHotlisted });
  }

  function handleToggleActive(rec: ClientDisplayRecord) {
    if (!rec.id) return;
    const isActive = rec.isActive ?? (rec.status === 'Active');
    setClientActive.mutate({ id: rec.id, is_active: !isActive });
  }

  const { data: pendingApprovals } = usePendingClients();
  const signupRequestsCount = pendingApprovals?.length ?? 0;

  const { data: pendingCRs } = useProfileChangeRequests({
    status: 'PENDING',
    per_page: 100,
  });
  const pendingProfileRequestsCount = pendingCRs?.meta?.total ?? 0;

  // Real backend data mapping
  const allRecords: ClientDisplayRecord[] = useMemo(() => {
    const apiItems = apiData?.items ?? [];

    return apiItems.map((c, idx) => {
      const isHotlisted = c.is_hotlisted;
      const ccSent = !!c.cc_form_sent_at;
      let accountingVal: ClientDisplayRecord['accounting'] = '-';
      if (isHotlisted) accountingVal = 'Hotlisted';
      else if (ccSent) accountingVal = 'Updated CC Required';

      let actionVal: ClientDisplayRecord['action'] = '-';
      if (accountingVal === 'Updated CC Required') actionVal = 'Send CC Form';
      else if (accountingVal === 'Hotlisted') actionVal = 'Send Payment Reminder';

      const joinedSource = c.date || c.created_at;
      const joinedDate = joinedSource ? new Date(joinedSource) : null;
      const joinedStr = joinedDate
        ? joinedDate.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        : '—';

      // There is no last-login tracking in the backend yet — `updated_at`
      // reflects the last record edit, not a login. Label it honestly rather
      // than implying it's a login timestamp.
      const updatedDate = c.updated_at ? new Date(c.updated_at) : null;
      const lastUpdatedDateStr = updatedDate
        ? updatedDate.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        : '—';
      const lastUpdatedTimeStr = updatedDate
        ? updatedDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        : '';

      return {
        id: c.id,
        client_id: c.client_id || `CLI-${String(idx + 1).padStart(4, '0')}`,
        client_name: c.client_name || c.contact_name || 'Client',
        company_name: c.company_name || '—',
        email: c.email || '—',
        contact_number: c.contact_number || '—',
        country: c.country || '—',
        joined_on: joinedStr,
        last_updated_date: lastUpdatedDateStr,
        last_updated_time: lastUpdatedTimeStr,
        status: c.is_active !== false ? 'Active' : 'Inactive',
        accounting: accountingVal,
        action: actionVal,
        isHotlisted: !!c.is_hotlisted,
        isActive: c.is_active !== false,
        rawClient: c,
      };
    });
  }, [apiData]);

  // Compute stat counts dynamically
  const totalCount = allRecords.length;
  const activeCount = allRecords.filter((r) => r.status === 'Active').length;
  const inactiveCount = allRecords.filter((r) => r.status === 'Inactive').length;
  const updatedCcCount = allRecords.filter((r) => r.accounting === 'Updated CC Required').length;
  const hotlistedCount = allRecords.filter((r) => r.accounting === 'Hotlisted').length;
  const othersCount = allRecords.filter((r) => r.accounting === 'Others').length;

  // Filter logic
  const filteredRecords = useMemo(() => {
    return allRecords.filter((rec) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const match =
          rec.client_id.toLowerCase().includes(q) ||
          rec.client_name.toLowerCase().includes(q) ||
          rec.company_name.toLowerCase().includes(q) ||
          rec.email.toLowerCase().includes(q) ||
          rec.contact_number.toLowerCase().includes(q);
        if (!match) return false;
      }
      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && rec.status !== 'Active') return false;
        if (statusFilter === 'inactive' && rec.status !== 'Inactive') return false;
      }
      // Accounting
      if (accountingFilter !== 'all') {
        if (accountingFilter === 'updated_cc' && rec.accounting !== 'Updated CC Required') return false;
        if (accountingFilter === 'hotlisted' && rec.accounting !== 'Hotlisted') return false;
        if (accountingFilter === 'others' && rec.accounting !== 'Others') return false;
      }
      // Country
      if (countryFilter !== 'all') {
        if (rec.country.toLowerCase() !== countryFilter.toLowerCase()) return false;
      }
      // Date filters
      if (joinedFrom) {
        const fTime = new Date(joinedFrom).getTime();
        const rTime = new Date(rec.joined_on).getTime();
        if (!isNaN(fTime) && !isNaN(rTime) && rTime < fTime) return false;
      }
      if (joinedTo) {
        const tTime = new Date(joinedTo).getTime();
        const rTime = new Date(rec.joined_on).getTime();
        if (!isNaN(tTime) && !isNaN(rTime) && rTime > tTime) return false;
      }
      return true;
    });
  }, [allRecords, search, statusFilter, accountingFilter, countryFilter, joinedFrom, joinedTo]);

  // Sort logic
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortField, sortDir]);

  // Pagination calculation
  const totalItems = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = totalItems > 0 ? (safeCurrentPage - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedRecords = useMemo(() => {
    return sortedRecords.slice(startIndex, startIndex + pageSize);
  }, [sortedRecords, startIndex, pageSize]);

  function renderSortIcon(field: keyof ClientDisplayRecord) {
    const isSorted = sortField === field;
    if (!isSorted) {
      return <ChevronDown className="w-3 h-3 text-slate-400/70 shrink-0 transition-transform" />;
    }
    return (
      <ChevronDown
        className={cn(
          'w-3 h-3 text-rose-600 font-bold shrink-0 transition-transform duration-150',
          sortDir === 'asc' && 'rotate-180'
        )}
      />
    );
  }

  function handleSort(field: keyof ClientDisplayRecord) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleClearFilters() {
    setSearch('');
    setStatusFilter('all');
    setAccountingFilter('all');
    setCountryFilter('all');
    setJoinedFrom('');
    setJoinedTo('');
    setSortField('client_id');
    setSortDir('asc');
  }

  function handleQuickAction(rec: ClientDisplayRecord, action: string) {
    if (action === 'Send CC Form') {
      if (rec.rawClient?.id) {
        sendCcForm.mutate(rec.rawClient.id);
      } else {
        toast.success(`Credit Card Authorization form sent to ${rec.client_name}`);
      }
    } else if (action === 'Send Payment Reminder') {
      toast.success(`Payment reminder email sent to ${rec.client_name}`);
    }
  }

  return (
    <div className="w-full space-y-2.5 text-slate-800 font-sans">
      {/* ── HEADER ROW ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage and view all registered clients</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-full sm:w-[460px] md:w-[480px]">
            <input
              type="text"
              className="w-full rounded-[6px] border border-slate-200 bg-white pl-4 pr-10 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-slate-400 shadow-2xs transition"
              placeholder="Search by Client ID, Client Name, Business Name, Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Add New Client (Admin only) */}
          {isAdminView && (
            <button
              type="button"
              className="bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs px-3.5 py-2 rounded-[6px] shadow-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer"
              onClick={() => setAddClientOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>Add New Client</span>
            </button>
          )}
        </div>
      </div>

      {/* ── STAT CARDS ROW (8 CARDS) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 items-stretch">
        {/* Card 1: Total Clients */}
        <div className="bg-white rounded-[4px] border border-slate-200/90 p-2.5 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[4px] bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <Users className="w-4.5 h-4.5 text-rose-500" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-slate-700 leading-tight truncate">Total Clients</span>
            <span className="text-[20px] font-extrabold text-rose-500 tracking-tight leading-none mt-0.5">{totalCount}</span>
          </div>
        </div>

        {/* Card 2: Active Clients */}
        <div className="bg-white rounded-[4px] border border-slate-200/90 p-2.5 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[4px] bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <UserCheck className="w-4.5 h-4.5 text-emerald-500" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-slate-700 leading-tight truncate">Active Clients</span>
            <span className="text-[20px] font-extrabold text-emerald-500 tracking-tight leading-none mt-0.5">{activeCount}</span>
          </div>
        </div>

        {/* Card 3: Inactive Clients */}
        <div className="bg-white rounded-[4px] border border-slate-200/90 p-2.5 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[4px] bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <UserX className="w-4.5 h-4.5 text-amber-500" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-slate-700 leading-tight truncate">Inactive Clients</span>
            <span className="text-[20px] font-extrabold text-amber-500 tracking-tight leading-none mt-0.5">{inactiveCount}</span>
          </div>
        </div>

        {/* Card 4: Updated CC Required */}
        <div className="bg-white rounded-[4px] border border-slate-200/90 p-2.5 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[4px] bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
            <CreditCard className="w-4.5 h-4.5 text-purple-600" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-slate-700 leading-tight truncate">Updated CC Required</span>
            <span className="text-[20px] font-extrabold text-purple-600 tracking-tight leading-none mt-0.5">{updatedCcCount}</span>
          </div>
        </div>

        {/* Card 5: Accounting - Hotlisted */}
        <div className="bg-white rounded-[4px] border border-slate-200/90 p-2.5 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[4px] bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
            <Ban className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-slate-700 leading-tight truncate">Accounting - Hotlisted</span>
            <span className="text-[20px] font-extrabold text-violet-600 tracking-tight leading-none mt-0.5">{hotlistedCount}</span>
          </div>
        </div>

        {/* Card 6: Accounting - Others */}
        <div className="bg-white rounded-[4px] border border-slate-200/90 p-2.5 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[4px] bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
            <MoreHorizontal className="w-4.5 h-4.5 text-sky-500" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-slate-700 leading-tight truncate">Accounting - Others</span>
            <span className="text-[20px] font-extrabold text-sky-500 tracking-tight leading-none mt-0.5">{othersCount}</span>
          </div>
        </div>

        {/* Card 7: New Signup Requests (Featured Gold Card) */}
        <div className="bg-[#fffbeb] rounded-[4px] border border-[#fde68a] p-2.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[4px] bg-amber-100/80 border border-amber-200 flex items-center justify-center shrink-0">
              <UserPlus className="w-4.5 h-4.5 text-amber-600" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10.5px] font-bold text-slate-800 leading-tight truncate">Signup Requests</span>
              <span className="text-[20px] font-extrabold text-amber-600 tracking-tight leading-none mt-0.5">{signupRequestsCount}</span>
            </div>
          </div>
          <button
            type="button"
            className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-slate-900 font-bold text-[10px] py-1 px-2 rounded-[4px] shadow-2xs mt-1.5 transition cursor-pointer flex items-center justify-center"
            onClick={() => onNavigateToApprove?.()}
          >
            Approve
          </button>
        </div>

        {/* Card 8: Profile Modification Requests (Featured Emerald Card) */}
        <div className="bg-[#f0fdf4] rounded-[4px] border border-[#bbf7d0] p-2.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[4px] bg-emerald-100/80 border border-emerald-200 flex items-center justify-center shrink-0">
              <UserPlus className="w-4.5 h-4.5 text-emerald-600" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10.5px] font-bold text-slate-800 leading-tight truncate">Profile Requests</span>
              <span className="text-[20px] font-extrabold text-emerald-600 tracking-tight leading-none mt-0.5">{pendingProfileRequestsCount}</span>
            </div>
          </div>
          <button
            type="button"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1 px-2 rounded-[4px] shadow-2xs mt-1.5 transition cursor-pointer flex items-center justify-center"
            onClick={() => onNavigateToProfileRequests?.()}
          >
            Review
          </button>
        </div>
      </div>

      {/* ── FILTER BAR ROW (SINGLE FLEX ROW) ── */}
      <div className="bg-white rounded-[6px] border border-slate-200/90 p-2.5 shadow-2xs flex items-end gap-2.5 w-full flex-nowrap overflow-x-auto">
        {/* Status Filter */}
        <div className="flex flex-col gap-1 min-w-[130px] flex-1 shrink-0">
          <label className="text-[11px] font-bold text-slate-700 leading-none">Status</label>
          <select
            className="w-full h-[31px] rounded-[6px] border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-2xs cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Accounting Filter */}
        <div className="flex flex-col gap-1 min-w-[150px] flex-1 shrink-0">
          <label className="text-[11px] font-bold text-slate-700 leading-none">Accounting</label>
          <select
            className="w-full h-[31px] rounded-[6px] border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-2xs cursor-pointer"
            value={accountingFilter}
            onChange={(e) => setAccountingFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="updated_cc">Updated CC Required</option>
            <option value="hotlisted">Hotlisted</option>
            <option value="others">Others</option>
          </select>
        </div>

        {/* Country Filter */}
        <div className="flex flex-col gap-1 min-w-[140px] flex-1 shrink-0">
          <label className="text-[11px] font-bold text-slate-700 leading-none">Country</label>
          <select
            className="w-full h-[31px] rounded-[6px] border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-2xs cursor-pointer"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
          >
            <option value="all">All Countries</option>
            <option value="United States">United States</option>
            <option value="Canada">Canada</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="India">India</option>
            <option value="Australia">Australia</option>
            <option value="Germany">Germany</option>
          </select>
        </div>

        {/* Joined From */}
        <div className="flex flex-col gap-1 min-w-[130px] flex-1 shrink-0">
          <label className="text-[11px] font-bold text-slate-700 leading-none">Joined From</label>
          <div className="relative">
            <input
              type="date"
              className="w-full h-[31px] rounded-[6px] border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-2xs cursor-pointer"
              value={joinedFrom}
              onChange={(e) => setJoinedFrom(e.target.value)}
            />
          </div>
        </div>

        {/* Joined To */}
        <div className="flex flex-col gap-1 min-w-[130px] flex-1 shrink-0">
          <label className="text-[11px] font-bold text-slate-700 leading-none">Joined To</label>
          <div className="relative">
            <input
              type="date"
              className="w-full h-[31px] rounded-[6px] border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-2xs cursor-pointer"
              value={joinedTo}
              onChange={(e) => setJoinedTo(e.target.value)}
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        <div className="flex flex-col justify-end shrink-0 ml-auto">
          <button
            type="button"
            className="h-[31px] px-3 rounded-[6px] border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            onClick={handleClearFilters}
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Clear Filters</span>
          </button>
        </div>
      </div>

      {/* ── YELLOW ALERT BANNER ── */}
      <div className="bg-[#fffbeb] border border-[#fde68a] rounded-[6px] px-3.5 py-1.5 flex items-center justify-between shadow-2xs gap-4 w-full">
        <div className="flex items-center gap-2 text-xs font-bold text-[#92400e]">
          <AlertCircle className="w-3.5 h-3.5 text-[#d97706] shrink-0" />
          <span>You have {signupRequestsCount} new signup requests from clients. Please review and activate their accounts.</span>
        </div>
        <button
          type="button"
          className="bg-[#f59e0b] hover:bg-[#d97706] text-slate-900 text-[11px] font-bold px-3 py-1 rounded-[4px] shadow-2xs transition cursor-pointer whitespace-nowrap"
          onClick={() => onNavigateToApprove?.()}
        >
          Review Requests
        </button>
      </div>

      {/* ── CLIENT RECORDS TABLE ── */}
      <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold text-[11px] select-none">
                <th
                  className="py-2.5 px-2.5 font-bold whitespace-nowrap cursor-pointer hover:bg-slate-100/60 transition"
                  onClick={() => handleSort('client_id')}
                >
                  <div className="flex items-center gap-1">
                    <span>Client ID</span>
                    {renderSortIcon('client_id')}
                  </div>
                </th>

                <th
                  className="py-2.5 px-2.5 font-bold whitespace-nowrap cursor-pointer hover:bg-slate-100/60 transition"
                  onClick={() => handleSort('client_name')}
                >
                  <div className="flex items-center gap-1">
                    <span>Client Name</span>
                    {renderSortIcon('client_name')}
                  </div>
                </th>

                <th className="py-2.5 px-2.5 font-bold whitespace-nowrap">Business Name</th>
                <th className="py-2.5 px-2.5 font-bold whitespace-nowrap">Email</th>

                <th
                  className="py-2.5 px-2.5 font-bold whitespace-nowrap cursor-pointer hover:bg-slate-100/60 transition"
                  onClick={() => handleSort('contact_number')}
                >
                  <div className="flex items-center gap-1">
                    <span>Contact Number</span>
                    {renderSortIcon('contact_number')}
                  </div>
                </th>

                <th
                  className="py-2.5 px-2.5 font-bold whitespace-nowrap cursor-pointer hover:bg-slate-100/60 transition"
                  onClick={() => handleSort('country')}
                >
                  <div className="flex items-center gap-1">
                    <span>Country</span>
                    {renderSortIcon('country')}
                  </div>
                </th>

                <th
                  className="py-2.5 px-2.5 font-bold whitespace-nowrap cursor-pointer hover:bg-slate-100/60 transition"
                  onClick={() => handleSort('joined_on')}
                >
                  <div className="flex items-center gap-1">
                    <span>Joined On</span>
                    {renderSortIcon('joined_on')}
                  </div>
                </th>

                <th
                  className="py-2.5 px-2.5 font-bold whitespace-nowrap cursor-pointer hover:bg-slate-100/60 transition"
                  onClick={() => handleSort('last_updated_date')}
                >
                  <div className="flex items-center gap-1">
                    <span>Last Updated</span>
                    {renderSortIcon('last_updated_date')}
                  </div>
                </th>

                <th
                  className="py-2.5 px-2.5 font-bold whitespace-nowrap cursor-pointer hover:bg-slate-100/60 transition"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    {renderSortIcon('status')}
                  </div>
                </th>

                <th className="py-2.5 px-2.5 font-bold whitespace-nowrap">Accounting</th>
                <th className="py-2.5 px-2.5 font-bold whitespace-nowrap">Action</th>
                <th className="py-2.5 px-2.5 font-bold whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-800">
              {isClientsLoading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 text-xs">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading real client data from database...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 text-xs">
                    No matching client records found.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => setSelectedClient({ id: rec.id, mode: 'view' })}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    {/* Client ID */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <button
                        type="button"
                        className="font-bold text-[#e11d48] hover:underline cursor-pointer text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClient({ id: rec.id, mode: 'view' });
                        }}
                      >
                        {rec.client_id}
                      </button>
                    </td>

                    {/* Client Name */}
                    <td className="py-2.5 px-2.5 font-semibold text-slate-900 whitespace-nowrap">
                      <TextWithTooltip text={rec.client_name} maxLen={14} className="font-semibold text-slate-900" />
                    </td>

                    {/* Business Name */}
                    <td className="py-2.5 px-2.5 text-slate-700 font-medium whitespace-nowrap">
                      <TextWithTooltip text={rec.company_name} maxLen={14} className="text-slate-700 font-medium" />
                    </td>

                    {/* Email */}
                    <td className="py-2.5 px-2.5 text-slate-600 whitespace-nowrap">
                      <TextWithTooltip text={rec.email} maxLen={16} className="text-slate-600" />
                    </td>

                    {/* Contact Number */}
                    <td className="py-2.5 px-2.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      <TextWithTooltip text={rec.contact_number} maxLen={14} className="text-slate-600 font-mono text-[11px]" />
                    </td>

                    {/* Country */}
                    <td className="py-2.5 px-2.5 font-medium text-slate-700 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {getCountryFlagUrl(rec.country) ? (
                          <img
                            src={getCountryFlagUrl(rec.country)!}
                            alt={rec.country}
                            className="w-4 h-3 object-cover rounded-[1px] shadow-2xs border border-slate-200/80 shrink-0"
                          />
                        ) : (
                          <span className="text-[11px] leading-none shrink-0">🌐</span>
                        )}
                        <TextWithTooltip text={rec.country} maxLen={13} className="font-medium text-slate-700" />
                      </div>
                    </td>

                    {/* Joined On */}
                    <td className="py-2.5 px-2.5 text-slate-600 whitespace-nowrap">{rec.joined_on}</td>

                    {/* Last Updated */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-slate-800 font-medium text-[11.5px]">
                          {rec.last_updated_date}
                        </span>
                        <span className="text-[10.5px] text-slate-400 font-normal">
                          {rec.last_updated_time}
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {rec.status === 'Active' ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/80 hover:bg-emerald-100 transition cursor-pointer"
                          title="Click to deactivate client"
                          onClick={() => handleToggleActive(rec)}
                        >
                          <UserCheck className="w-3 h-3 text-emerald-500" />
                          <span>Active</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-bold bg-rose-50 text-rose-500 border border-rose-200/80 hover:bg-rose-100 transition cursor-pointer"
                          title="Click to activate client"
                          onClick={() => handleToggleActive(rec)}
                        >
                          <UserX className="w-3 h-3 text-rose-500" />
                          <span>Inactive</span>
                        </button>
                      )}
                    </td>

                    {/* Accounting Badge */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {rec.accounting === '-' ? (
                        <span className="text-slate-400">-</span>
                      ) : rec.accounting === 'Updated CC Required' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                          Updated CC Required
                        </span>
                      ) : rec.accounting === 'Hotlisted' ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold bg-rose-50 text-rose-600 border border-rose-200/80 hover:bg-rose-100 transition cursor-pointer"
                          title="Click to remove hotlist status"
                          onClick={() => handleToggleHotlist(rec)}
                        >
                          <Ban className="w-3 h-3 text-rose-600" />
                          <span>Hotlisted</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold bg-blue-50 text-blue-600 border border-blue-200/80">
                          Others
                        </span>
                      )}
                    </td>

                    {/* Action Quick Button */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {rec.action === '-' ? (
                        <span className="text-slate-400">-</span>
                      ) : rec.action === 'Send CC Form' ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[11px] font-bold border border-purple-300 text-purple-700 bg-purple-50/50 hover:bg-purple-100/70 transition cursor-pointer"
                          onClick={() => handleQuickAction(rec, 'Send CC Form')}
                        >
                          <Send className="w-3 h-3 text-purple-600" />
                          <span>Send CC Form</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[11px] font-bold border border-rose-300 text-rose-600 bg-rose-50/50 hover:bg-rose-100/70 transition cursor-pointer"
                          onClick={() => handleQuickAction(rec, 'Send Payment Reminder')}
                        >
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          <span>Send Payment Reminder</span>
                        </button>
                      )}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionsCell
                        onView={() => setSelectedClient({ id: rec.id, mode: 'view' })}
                        onEdit={() => setSelectedClient({ id: rec.id, mode: 'edit' })}
                        onSendCcForm={() => handleQuickAction(rec, 'Send CC Form')}
                        onToggleHotlist={() => handleToggleHotlist(rec)}
                        onToggleActive={() => handleToggleActive(rec)}
                        isHotlisted={rec.isHotlisted}
                        isActive={rec.isActive}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION FOOTER BAR ── */}
        <div className="bg-slate-50/80 border-t border-slate-200 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none">
          {/* Left: Entries summary */}
          <div className="flex items-center gap-4 text-slate-600 font-medium">
            <span>
              Showing <strong className="font-bold text-slate-900">{totalItems > 0 ? startIndex + 1 : 0}</strong> to{' '}
              <strong className="font-bold text-slate-900">{endIndex}</strong> of{' '}
              <strong className="font-bold text-slate-900">{totalItems}</strong> entries
            </span>
          </div>

          {/* Right: Page navigation controls */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              type="button"
              className="w-7 h-7 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 transition cursor-pointer shadow-2xs"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Previous Page */}
            <button
              type="button"
              className="w-7 h-7 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 transition cursor-pointer shadow-2xs"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {getPageNumbers(safeCurrentPage, totalPages).map((p, i) =>
                typeof p === 'number' ? (
                  <button
                    key={p}
                    type="button"
                    className={cn(
                      'w-7 h-7 rounded-[6px] text-xs font-bold transition cursor-pointer flex items-center justify-center',
                      p === safeCurrentPage
                        ? 'bg-[#002868] text-white shadow-2xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-2xs',
                    )}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={`dots-${i}`} className="px-1 text-slate-400 font-bold select-none">
                    ...
                  </span>
                ),
              )}
            </div>

            {/* Next Page */}
            <button
              type="button"
              className="w-7 h-7 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 transition cursor-pointer shadow-2xs"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              className="w-7 h-7 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 transition cursor-pointer shadow-2xs"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {selectedClient && (
        <ClientDetailModal
          client={activeModalClient ?? (sortedRecords.find((r) => r.id === selectedClient.id)?.rawClient as IClient) ?? null}
          mode={selectedClient.mode}
          onClose={() => setSelectedClient(null)}
        />
      )}

      {addClientOpen && (
        <AddClientModal
          open={addClientOpen}
          onClose={() => setAddClientOpen(false)}
        />
      )}
    </div>
  );
}
