import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Briefcase,
  ChevronDown,
  List,
  Loader2,
  ShieldCheck,
  UserCheck,
  FileText,
  X,
  Plus,
  RefreshCw,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { UserRole, UserSubType } from '@contracts';
import { ApiClientError } from '@lib/api-client';
import { CountryPicker, DatePicker } from '@modules/shared-ui';
import { useCreateUser } from '../../modules/admin-panel/hooks/use-admin-users';
import { useAdminUsers } from '../../modules/admin-panel/hooks/use-admin-jobs';

const DEPARTMENT_OPTIONS = [
  { value: 'Client Servicing', label: 'Client Servicing' },
  { value: 'Design', label: 'Design' },
  { value: 'Digitizing', label: 'Digitizing' },
  { value: 'Sewout', label: 'Sewout' },
  { value: 'Quality Control', label: 'Quality Control' },
  { value: 'Management', label: 'Management' },
  { value: 'IT & Operations', label: 'IT & Operations' },
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: UserRole.CS, label: 'Client Servicing' },
  { value: UserRole.TEAM_LEAD, label: 'Team Lead' },
  { value: UserRole.DESIGNER, label: 'Designer' },
  { value: UserRole.DIGITATOR, label: 'Digitizor' },
  { value: UserRole.SEWOUT, label: 'Sewout' },
  { value: UserRole.QC, label: 'QC Reviewer' },
  { value: UserRole.ADMIN, label: 'Admin' },
];

const WORK_LOCATION_OPTIONS = [
  { value: 'Headquarters / Main Office', label: 'Headquarters / Main Office' },
  { value: 'Remote - US', label: 'Remote - US' },
  { value: 'Remote - India', label: 'Remote - India' },
  { value: 'Branch Office - NY', label: 'Branch Office - NY' },
  { value: 'Branch Office - London', label: 'Branch Office - London' },
  { value: 'On-Site / Office', label: 'On-Site / Office' },
];

const SHIFT_OPTIONS = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'GENERAL', label: 'General' },
  { value: 'EVENING', label: 'Evening' },
  { value: 'NIGHT', label: 'Night' },
];

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

const OCTET_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const WORK_REMARKS_MAX = 200;
const NOTES_MAX = 250;

function isValidIpv4(value: string): boolean {
  return IPV4_RE.test(value) && value.split('.').every((octet) => OCTET_RE.test(octet));
}

function generateRandomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let pass = '';
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export function AddStaffPage() {
  const navigate = useNavigate();
  const createUser = useCreateUser();
  const { data: usersData } = useAdminUsers({ per_page: 200 });

  // ── Personal Information State ──
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [joiningDate, setJoiningDate] = useState('');

  // ── Work Information State ──
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [subType, setSubType] = useState<UserSubType | ''>('');
  const [reportingToId, setReportingToId] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [shift, setShift] = useState('');
  const [remarks, setRemarks] = useState('');

  // ── Login Access Control State ── (the only fields here actually enforced
  // by the backend — see change-art-backend auth.routes.ts sign-in handler)
  const [ipWhitelist, setIpWhitelist] = useState<string[]>([]);
  const [ipInput, setIpInput] = useState('');
  const [ipError, setIpError] = useState<string | null>(null);
  const [maxActiveSessions, setMaxActiveSessions] = useState('1');

  // ── Account Status & Notes State ──
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState(() => generateRandomPassword());
  const [showPassword, setShowPassword] = useState(false);
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);

  const managers = useMemo(
    () => usersData?.items ?? [],
    [usersData],
  );

  const showSubType = role === UserRole.DESIGNER || role === UserRole.DIGITATOR;

  function addIp() {
    const value = ipInput.trim();
    if (!value) return;
    if (!isValidIpv4(value)) {
      setIpError('Enter a valid IPv4 address, e.g. 49.123.45.10');
      return;
    }
    if (ipWhitelist.includes(value)) {
      setIpError('That IP is already added.');
      return;
    }
    setIpWhitelist([...ipWhitelist, value]);
    setIpInput('');
    setIpError(null);
  }

  function removeIp(ip: string) {
    setIpWhitelist(ipWhitelist.filter((v) => v !== ip));
  }

  function handleRefreshPassword() {
    setPassword(generateRandomPassword());
    toast.success('Generated new temporary password!');
  }

  function handleSubmit(e: React.FormEvent, isDraft = false) {
    e.preventDefault();
    setError(null);

    if (isDraft) {
      toast.success('Draft saved successfully!');
      return;
    }

    // Form Validation
    if (!firstName.trim()) return setError('First name is required.');
    if (!lastName.trim()) return setError('Last name is required.');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError('A valid email address is required.');
    }
    if (!phone.trim()) return setError('Phone number is required.');
    if (!employeeId.trim()) return setError('Employee ID is required.');
    if (!joiningDate) return setError('Joining date is required.');
    if (!department) return setError('Department is required.');
    if (!role) return setError('Role is required.');
    if (!workLocation) return setError('Work location is required.');

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const formattedPhone = `${countryCode} ${phone.trim()}`;

    createUser.mutate(
      {
        name: fullName,
        email: email.trim().toLowerCase(),
        password: password.trim() || generateRandomPassword(),
        role: role as UserRole,
        sub_type: showSubType && subType ? (subType as UserSubType) : undefined,
        is_active: isActive,
        phone: formattedPhone,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        employee_id: employeeId.trim(),
        joining_date: joiningDate,
        department,
        reporting_to_id: reportingToId || null,
        work_location: workLocation,
        shift: shift || null,
        work_remarks: remarks.trim() || null,
        ip_whitelist: ipWhitelist,
        max_active_sessions: maxActiveSessions === 'unlimited' ? null : Number(maxActiveSessions),
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(`Staff member ${fullName} created successfully!`);
          navigate('/admin/users');
        },
        onError: (err: unknown) => {
          setError(
            err instanceof ApiClientError
              ? err.toUserMessage()
              : 'Failed to create staff account. Please check the inputs.',
          );
        },
      },
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans text-slate-800 bg-[#f8fafc] min-h-screen">
      {/* ── Top Header Navigation ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            aria-label="Back to staff list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Add New Staff</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Create a new staff account and set permissions</p>
          </div>
        </div>

        <Link
          to="/admin/users"
          className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors gap-2 self-start sm:self-auto no-underline"
        >
          <List className="w-4 h-4 text-slate-600" />
          View Staff List
        </Link>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        {/* ── Row 1: Personal Information & Work Information ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Card 1: Personal Information */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-slate-100">
              <User className="w-4 h-4 text-[#2563eb]" />
              <h2 className="text-sm sm:text-base font-semibold text-[#2563eb]">Personal Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
              {/* First Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter last name"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#2563eb] transition-all overflow-visible">
                  {/* Segment 1: Custom CountryPicker Popover with Search */}
                  <CountryPicker value={countryCode} onChange={setCountryCode} />

                  {/* Segment 2: Dial Code */}
                  <div className="bg-slate-50 border-r border-slate-200 px-3 py-1.5 shrink-0 flex items-center justify-center min-w-[48px]">
                    <span className="text-xs font-semibold text-slate-700">{countryCode}</span>
                  </div>

                  {/* Segment 3: Input Field */}
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full py-1.5 px-3 text-xs bg-transparent focus:outline-none placeholder:text-slate-400 text-slate-800"
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                <DatePicker
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  maxDate={new Date()}
                  triggerClassName="px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all text-slate-700"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                <div className="relative flex items-center">
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all appearance-none cursor-pointer text-slate-700 pr-8"
                  >
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Employee ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Employee ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Enter employee ID (Manual entry)"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all placeholder:text-slate-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">Enter a unique Employee ID for this staff.</p>
              </div>

              {/* Joining Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Joining Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={joiningDate}
                  onChange={setJoiningDate}
                  triggerClassName="px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Work Information */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-slate-100">
              <Briefcase className="w-4 h-4 text-[#2563eb]" />
              <h2 className="text-sm sm:text-base font-semibold text-[#2563eb]">Work Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <select
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all appearance-none cursor-pointer text-slate-700 pr-8"
                  >
                    <option value="">Select department</option>
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <select
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all appearance-none cursor-pointer text-slate-700 pr-8"
                  >
                    <option value="">Select role</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Sub-Type (if Designer or Digitizer) */}
              {showSubType && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sub-Type</label>
                  <div className="relative flex items-center">
                    <select
                      value={subType}
                      onChange={(e) => setSubType(e.target.value as UserSubType)}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all appearance-none cursor-pointer text-slate-700 pr-8"
                    >
                      <option value="">Select sub-type</option>
                      <option value={UserSubType.JUNIOR}>Junior</option>
                      <option value={UserSubType.SENIOR}>Senior</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Reporting To */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reporting To</label>
                <div className="relative flex items-center">
                  <select
                    value={reportingToId}
                    onChange={(e) => setReportingToId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all appearance-none cursor-pointer text-slate-700 pr-8"
                  >
                    <option value="">Select reporting manager</option>
                    {managers.map((m: { id: string; name: string; role: string }) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Work Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Location <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <select
                    required
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all appearance-none cursor-pointer text-slate-700 pr-8"
                  >
                    <option value="">Select work location</option>
                    {WORK_LOCATION_OPTIONS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Shift */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shift</label>
                <div className="relative flex items-center">
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all appearance-none cursor-pointer text-slate-700 pr-8"
                  >
                    <option value="">Select shift</option>
                    {SHIFT_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Remarks (Optional) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks (Optional)</label>
                <textarea
                  rows={3}
                  maxLength={WORK_REMARKS_MAX}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all placeholder:text-slate-400 resize-none text-slate-700"
                />
                <div className="text-right text-[11px] text-slate-400 mt-0.5 font-mono">
                  {remarks.length} / {WORK_REMARKS_MAX}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 2: Login Access Control ── */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6 shadow-sm mb-6">
          <div className="flex flex-col gap-0.5 mb-4 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2563eb]" />
              <h2 className="text-sm sm:text-base font-semibold text-[#2563eb]">Login Access Control</h2>
            </div>
            <p className="text-xs text-slate-500 pl-6">Restrict this staff account to specific office IPs and cap concurrent sessions.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Office Network (IP Whitelist) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Office Network (IP Whitelist) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#2563eb] transition-all">
                <input
                  type="text"
                  value={ipInput}
                  onChange={(e) => {
                    setIpInput(e.target.value);
                    setIpError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addIp();
                    }
                  }}
                  placeholder="Add your office's public IP address(es)"
                  className="flex-1 border-none focus:outline-none text-xs py-1 px-2 bg-transparent text-slate-800 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={addIp}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-[#2563eb] text-xs font-semibold rounded-md border border-slate-200 shadow-2xs transition-colors shrink-0"
                >
                  <Plus className="w-3 h-3 text-[#2563eb]" aria-hidden /> Add IP
                </button>
              </div>
              {ipError && <p className="text-[11px] text-red-500 mt-1">{ipError}</p>}
              {ipWhitelist.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 items-center mt-2">
                  {ipWhitelist.map((ip) => (
                    <span
                      key={ip}
                      className="inline-flex items-center gap-1.5 bg-blue-50/70 text-[#2563eb] text-xs px-2.5 py-1 rounded-md font-mono border border-blue-200/80 font-medium"
                    >
                      {ip}
                      <button
                        type="button"
                        onClick={() => removeIp(ip)}
                        aria-label={`Remove ${ip}`}
                        className="text-blue-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">No IP addresses added yet — leave empty to allow sign-in from any network.</p>
              )}
            </div>

            {/* Max Active Sessions */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Active Sessions <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <select
                  value={maxActiveSessions}
                  onChange={(e) => setMaxActiveSessions(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] appearance-none cursor-pointer text-slate-800 font-medium pr-8"
                >
                  <option value="1">1 (Single Session)</option>
                  <option value="2">2 Concurrent Sessions</option>
                  <option value="3">3 Concurrent Sessions</option>
                  <option value="unlimited">Unlimited Sessions</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Maximum allowed concurrent login sessions</p>
            </div>
          </div>
        </div>

        {/* ── Row 3: Account Status & Notes ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Card 1: Account Status */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <UserCheck className="w-4 h-4 text-[#2563eb]" />
                <h3 className="text-xs sm:text-sm font-semibold text-[#2563eb]">Account Status</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Account Status <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <select
                      value={isActive ? 'active' : 'inactive'}
                      onChange={(e) => setIsActive(e.target.value === 'active')}
                      className="w-full px-2.5 py-1.5 text-xs bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 rounded-lg focus:outline-none appearance-none cursor-pointer pr-7"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-emerald-600 absolute right-2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Temporary Password</label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none pr-14 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-8 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleRefreshPassword}
                      title="Generate new random password"
                      className="absolute right-2 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Notes (Optional) */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <FileText className="w-4 h-4 text-[#2563eb]" />
                <h3 className="text-xs sm:text-sm font-semibold text-[#2563eb]">Notes (Optional)</h3>
              </div>

              <div>
                <textarea
                  rows={4}
                  maxLength={NOTES_MAX}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter notes about this staff..."
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563eb] transition-all placeholder:text-slate-400 resize-none text-slate-700"
                />
                <div className="text-right text-[10px] text-slate-400 mt-1 font-mono">
                  {notes.length} / {NOTES_MAX}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Banner if any */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* ── Row 4: Info Note Banner & Actions ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/80">
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-blue-50/80 border border-blue-100 px-3.5 py-2 rounded-lg w-full sm:w-auto">
            <Info className="w-4 h-4 text-[#2563eb] shrink-0" />
            <span>
              <strong>Note:</strong> If an Office Network IP is set above, this staff member can only sign in from that IP.
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => navigate('/admin/users')}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={createUser.isPending}
              className="px-5 py-2 text-xs sm:text-sm font-medium text-white bg-[#2563eb] hover:bg-[#1d4ed8] border border-[#2563eb] rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {createUser.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Staff…
                </>
              ) : (
                'Create Staff'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
