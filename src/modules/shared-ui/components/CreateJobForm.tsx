import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Send, Save, Upload, Check, ArrowRight, ArrowLeft, X, Loader2, FileText, Eye, EyeOff, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  FinalFileFormat,
  type IClient,
  type IJobCard,
  OrderType,
  Placement,
  Priority,
  ProcessType,
  ProjectType,
  FileCategory,
} from '@contracts';
import { cn } from '@lib/utils';
import { apiClient } from '@lib/api-client';

export interface ClientBriefData {
  client_id?: string;
  order_type: OrderType;
  project_type: ProjectType;
  design_name: string;
  eta_hours?: number;
  priority?: Priority;
  process_type?: ProcessType;
  num_colors?: number;
  placement?: Placement;
  width_inches?: number;
  height_inches?: number;
  fabric?: string;
  sewout_required?: boolean;
  description: string;
  final_files: FinalFileFormat[];
  billing_address?: string;
  shipping_address?: string;
  cloud_link?: string;
  files: File[];
}

interface NewClientProvisionBody {
  client_name: string;
  contact_name: string;
  contact_number: string;
  email: string;
  password: string;
  company_name?: string;
}

interface CreateJobCardBody {
  client_id: string;
  mail: string;
  order_type: string;
  project_type: string;
  design_name: string;
  eta_hours?: number;
  priority?: string;
  process_type?: string;
  final_files?: string[];
  placement?: string;
  width_inches?: number;
  height_inches?: number;
  num_colors?: number;
  fabric?: string;
  sewout_required?: boolean;
  description?: string;
  billing_address?: string;
  shipping_address?: string;
  client_po?: string;
}

interface SendQuotePriceBody {
  amount: number;
  currency?: string;
}

interface CreateJobFormProps {
  mode: 'quote' | 'order';
  clients?: IClient[];
  clientsLoading?: boolean;
  clientsError?: boolean;
  onProvisionClient?: (body: NewClientProvisionBody) => Promise<IClient>;
  onCreateJob?: (body: CreateJobCardBody) => Promise<IJobCard>;
  onSendPrice?: (jobId: string, body: SendQuotePriceBody) => Promise<IJobCard>;
  onSubmit?: (id: string) => void | Promise<void>;
  onSaveDraft?: (data: Partial<ClientBriefData>) => void | Promise<void>;
  submitting?: boolean;
  savingDraft?: boolean;
}

const ORDER_TYPES = [
  { id: 'artwork', label: 'Artwork', sub: 'Logo, Vector, Illustration', icon: '🎨' },
  { id: 'digitizing', label: 'Digitizing Services', sub: 'Embroidery conversion', icon: '🧵' },
  { id: 'swatches', label: 'Embroidery Digitizing Swatches Only', sub: 'Physical sample review', icon: '🪡' },
  { id: 'extras', label: 'Patches & Extras', sub: 'Custom patches, Name drops', icon: '📦' },
  { id: 'others', label: 'Others', sub: 'Custom request', icon: '✨' },
];

const SPECIFIC_SERVICES: Record<string, string[]> = {
  artwork: [
    'Vector Artwork',
    'Product / Virtual Mock Ups',
    'Cut Contour',
    'Color Separation',
    'Creative Designs',
    'Line Art Conversions',
    'Image Rendering',
    'Color Correction',
    'Brochure Designing',
    'Clipping Path',
    'Channel Mask',
    'Business Card Designs',
    'Packaging Designs',
    'Product Branding',
    'Image Manipulation',
    'Black & White To Color',
  ],
  digitizing: ['Embroidery Digitizing', 'Embroidery Digitizing - Sewout Swatches'],
  swatches: [],
  extras: ['Custom Embroidery Patches', 'Name Drops'],
  others: [],
};

const PRIORITY_ENUM: Record<string, Priority> = {
  Normal: Priority.NORMAL,
  Rush: Priority.RUSH,
  'Super Rush': Priority.SUPER_RUSH,
};

const PROCESS_TYPE_MAP: Record<string, ProcessType> = {
  'Screen Printing': ProcessType.SCREEN_PRINTING,
  'OffSet Printing': ProcessType.OFFSET_PRINTING,
  'Digital Printing': ProcessType.DIGITAL_PRINTING,
  'Engraving': ProcessType.OTHERS,
  'Others': ProcessType.OTHERS,
};

const PLACEMENT_MAP: Record<string, Placement> = {
  'Front Of Cap': Placement.FRONT_OF_CAP,
  'Back Of Cap': Placement.BACK_OF_CAP,
  'Side Of Cap': Placement.SIDE_OF_CAP,
  'Visor': Placement.VISOR,
  'Beenie Cap': Placement.BEANIE_CAP,
  'Towel': Placement.TOWEL,
  'Bags': Placement.BAGS,
  'Left Chest': Placement.LEFT_CHEST,
  'Polo-Sleeve': Placement.SLEEVE,
  'Polo-Pocket': Placement.POCKET,
  'Full Back': Placement.FULL_BACK,
  'Full Front': Placement.FULL_FRONT,
  'Back Yoke': Placement.BACK_YOKE,
  'Others': Placement.OTHER,
};

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/x-eps',
  'application/postscript',
  'application/illustrator',
  'application/x-coreldraw',
  'application/octet-stream',
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function resolveFileType(file: File): string {
  if (file.type && ALLOWED_TYPES.has(file.type)) {
    return file.type;
  }
  // Reject files with unrecognised MIME types rather than silently treating
  // them as generic binaries — prevents executables and scripts slipping through.
  throw new Error(`File "${file.name}" has an unsupported type: "${file.type || '(empty)'}". Allowed types are PDF, images, EPS, AI, and CDR.`);
}

async function uploadSingleFile(jobId: string, file: File): Promise<void> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File "${file.name}" exceeds the 50 MB size limit.`);
  }
  const fileType = resolveFileType(file);
  const presign = await apiClient.post<{ uploadUrl: string; storageKey: string }>('/api/v1/files/upload-url', {
    job_card_id: jobId,
    file_category: FileCategory.ORIGINAL,
    file_name: file.name,
    file_type: fileType,
    file_size_bytes: file.size,
  });

  const res = await fetch(presign.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': fileType },
  });
  if (!res.ok) {
    throw new Error(`Storage upload failed for "${file.name}" (HTTP ${res.status}).`);
  }

  await apiClient.post('/api/v1/files/complete-upload', {
    job_card_id: jobId,
    storage_key: presign.storageKey,
    file_category: FileCategory.ORIGINAL,
    file_name: file.name,
    file_type: fileType,
    file_size_bytes: file.size,
  });
}

async function uploadOriginalFiles(jobId: string, files: File[]): Promise<void> {
  const results = await Promise.allSettled(files.map(file => uploadSingleFile(jobId, file)));
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length > 0) {
    const messages = failures.map(f => (f.reason instanceof Error ? f.reason.message : String(f.reason)));
    throw new Error(messages.join('\n'));
  }
}

function toNum(v: FormDataEntryValue | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function CreateJobForm({ mode, clients = [], clientsLoading = false, clientsError = false, onProvisionClient, onCreateJob, onSendPrice, onSubmit, onSaveDraft, submitting = false, savingDraft = false }: CreateJobFormProps) {
  const isOrder = mode === 'order';
  const [phase, setPhase] = useState<1 | 2>(1);
  const [clientId, setClientId] = useState('');
  const [orderType, setOrderType] = useState('');
  const [specificService, setSpecificService] = useState('');
  const [serviceError, setServiceError] = useState(false);
  const [selectedFormatOption, setSelectedFormatOption] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);
  const [confirmOrderText, setConfirmOrderText] = useState('');
  const [pendingOrderData, setPendingOrderData] = useState<ClientBriefData | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('');
  const [newClientConfirmPassword, setNewClientConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [provisioningClient, setProvisioningClient] = useState(false);
  const [newClientFieldErrors, setNewClientFieldErrors] = useState<Record<string, string>>({});
  const [selectedClientData, setSelectedClientData] = useState<IClient | null>(null);
  const [quotedPrice, setQuotedPrice] = useState('');
  const [quoteCurrency] = useState('USD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const placementSectionRef = useRef<HTMLDivElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  const [selectedProcessType, setSelectedProcessType] = useState('');
  const [selectedPlacement, setSelectedPlacement] = useState('');

  function markFieldError(id: string, message: string) {
    setFieldErrors(prev => new Set(prev).add(id));
    toast.error(message, { duration: 7000 });
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  function clearFieldError(id: string) {
    setFieldErrors(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  const hasSelection = orderType !== '';
  const specificServices = orderType ? SPECIFIC_SERVICES[orderType] : [];
  const needsService = specificServices.length > 0;

  const selectedService = useMemo(() => {
    if (orderType === 'others') return 'Others';
    if (orderType === 'swatches') return 'Digitizing Sewout';

    if (orderType === 'extras') {
      return 'Others';
    }

    if (orderType === 'digitizing') {
      if (specificService === 'Embroidery Digitizing - Sewout Swatches' || specificService === 'Digitizing Sewout') {
        return 'Digitizing Sewout';
      }
      return 'Digitizing';
    }

    if (orderType === 'artwork') {
      switch (specificService) {
        case 'Vector Artwork':
        case 'Color Separation':
        case 'Cut Contour':
        case 'Line Art Conversions':
          return 'Vector Artwork';

        case 'Creative Designs':
        case 'Product Branding':
        case 'Illustration':
        case 'Logo Designing':
          return 'Logo Designing';

        case 'Product / Virtual Mock Ups':
        case 'Image Rendering':
        case 'Color Correction':
        case 'Clipping Path':
        case 'Channel Mask':
        case 'Image Manipulation':
        case 'Black & White To Color':
        case 'Virtual Proof':
          return 'Virtual Proof';

        case 'Business Card Designs':
        case 'Business Card':
          return 'Business Card';

        case 'Brochure Designing':
        case 'Brouchers':
          return 'Brouchers';

        case 'Packaging Designs':
        case 'Carton Box Designing':
          return 'Carton Box Designing';

        default:
          return 'Vector Artwork';
      }
    }

    return '';
  }, [orderType, specificService]);

  useEffect(() => {
    setSelectedFormatOption('');
  }, [selectedService]);

  useEffect(() => {
    if (!clientDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
        setClientSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clientDropdownOpen]);

  const formatOptions = useMemo(() => {
    if (specificService === 'Custom Embroidery Patches') return [];
    switch (selectedService) {
      case 'Vector Artwork':
      case 'Business Card':
      case 'Brouchers':
      case 'Logo Designing':
      case 'Carton Box Designing':
      case 'Others':
        return [
          'PDF, EPS',
          'PDF, AI',
          'PDF, EPS, AI',
          'PDF, CDR',
          'PDF, EPS, CDR',
          'PDF, EPS, AI, CDR',
          'OTHERS',
        ];
      case 'Digitizing':
      case 'Digitizing Sewout':
        return [
          'PDF, DST',
          'DST, PDF, EMB',
          'DST, PDF, PXF',
          'DST, PDF, CND, EXP',
          'DST, PDF, CND, EXP, EMB',
          'OTHERS',
        ];
      case 'Virtual Proof':
        return ['JPEG', 'SVG', 'PDF', 'TIFF', 'OTHERS'];
      default:
        return [];
    }
  }, [selectedService, specificService]);

  function selectOrder(id: string) {
    setOrderType(id);
    setSpecificService('');
    setServiceError(false);
    setSelectedFormatOption('');
    setSelectedProcessType('');
    setSelectedPlacement('');
    const services = SPECIFIC_SERVICES[id] ?? [];
    if (services.length === 0) {
      if (id === 'swatches') {
        setSpecificService('Digitizing Sewout');
      } else if (id === 'others' || id === 'extras') {
        setSpecificService('Others');
      }
    }
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    setFiles((prev) => [...prev, ...picked]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const previews = useMemo(
    () => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)),
    [files],
  );
  useEffect(
    () => () => previews.forEach((url) => url && URL.revokeObjectURL(url)),
    [previews],
  );

  function goToPhase2() {
    if (!clientId) {
      toast.error('Please select or enter a client.');
      return;
    }
    if (!hasSelection) {
      toast.error('Please select a service type to continue.');
      return;
    }
    if (needsService && !specificService) {
      toast.error('Please select a specific service to continue.');
      setServiceError(true);
      setTimeout(() => setServiceError(false), 2000);
      return;
    }
    setPhase(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToPhase1() {
    setPhase(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resolveOrderType(service: string): OrderType {
    if (service === 'Digitizing Sewout') return OrderType.DIGITIZING_SEWOUT;
    if (service === 'Digitizing') return OrderType.DIGITIZING;
    if (service === 'Others') return OrderType.OTHERS;
    return OrderType.ARTWORK;
  }

  function resetForm(form: HTMLFormElement) {
    form.reset();
    setPhase(1);
    setClientId('');
    setOrderType('');
    setSpecificService('');
    setSelectedFormatOption('');
    setFiles([]);
    setError(null);
    setFieldErrors(new Set());
    setSelectedProcessType('');
    setSelectedPlacement('');
    setNewClientContact('');
    setNewClientPassword('');
    setNewClientConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setNewClientFieldErrors({});
    setSelectedClientData(null);
    setQuotedPrice('');
  }

  async function handleSaveDraft() {
    if (!onSaveDraft || !formRef.current) return;
    const fd = new FormData(formRef.current);

    const designName = String(fd.get('design') ?? '').trim() || 'Draft';
    const brief = String(fd.get('brief') ?? '').trim();
    const priorityLabel = String(fd.get('priority') ?? '');
    const cloudLink = String(fd.get('cloud_link') ?? '').trim();

    const order_type = resolveOrderType(selectedService);

    const finalFiles = (() => {
      if (!selectedFormatOption || selectedFormatOption === 'OTHERS') return [FinalFileFormat.OTHERS];
      const mapped: FinalFileFormat[] = [];
      selectedFormatOption.split(',').map(s => s.trim()).forEach(part => {
        if (part === 'PDF') mapped.push(FinalFileFormat.PDF);
        else if (part === 'EPS') mapped.push(FinalFileFormat.EPS);
        else if (part === 'AI') mapped.push(FinalFileFormat.AI);
        else if (part === 'CDR') mapped.push(FinalFileFormat.CDR);
        else mapped.push(FinalFileFormat.OTHERS);
      });
      return mapped.length > 0 ? mapped : [FinalFileFormat.OTHERS];
    })();

    const draftTurnaround = toNum(fd.get('eta'));

    const data: Partial<ClientBriefData> = {
      client_id: clientId !== 'new' ? clientId : undefined,
      order_type,
      project_type: isOrder ? ProjectType.LIVE : ProjectType.QUOTE,
      design_name: designName,
      ...(draftTurnaround != null ? { eta_hours: draftTurnaround } : {}),
      ...(brief ? { description: brief } : {}),
      final_files: finalFiles,
      ...(PRIORITY_ENUM[priorityLabel] ? { priority: PRIORITY_ENUM[priorityLabel] } : {}),
      ...(cloudLink ? { cloud_link: cloudLink } : {}),
      files,
    };

    const processVal = String(fd.get('process_type') ?? '');
    if (processVal && PROCESS_TYPE_MAP[processVal]) data.process_type = PROCESS_TYPE_MAP[processVal];

    const placementLabel = String(fd.get('placement') ?? '');
    if (PLACEMENT_MAP[placementLabel]) data.placement = PLACEMENT_MAP[placementLabel];

    const numColors = Number(fd.get('colors'));
    if (!Number.isNaN(numColors) && numColors > 0) data.num_colors = numColors;

    if (order_type === OrderType.DIGITIZING || order_type === OrderType.DIGITIZING_SEWOUT) {
      data.sewout_required = order_type === OrderType.DIGITIZING_SEWOUT;
      const w = toNum(fd.get('width'));
      const h = toNum(fd.get('height'));
      if (w != null) data.width_inches = w;
      if (h != null) data.height_inches = h;
    }

    const fabric = String(fd.get('fabric') ?? '').trim();
    if (fabric && order_type !== OrderType.OTHERS) data.fabric = fabric;

    await onSaveDraft(data);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || isSubmitting) return;
    const fd = new FormData(e.currentTarget);

    if (!clientId) { toast.error('Client selection is missing.'); return; }

    const designName = String(fd.get('design') ?? '').trim();
    const brief = String(fd.get('brief') ?? '').trim();
    const turnaround = toNum(fd.get('eta'));
    const priorityLabel = String(fd.get('priority') ?? '');

    const isColorSeparation = specificService === 'Color Separation';
    const isEmbroideryPatches = specificService === 'Custom Embroidery Patches';

    if (!designName) { markFieldError('design', 'Please enter a design name to continue.'); return; }
    if (!priorityLabel) { markFieldError('priority', 'Please select a priority to continue.'); return; }
    if (!brief) { markFieldError('brief', 'Please add a description for your request.'); return; }
    if (isColorSeparation) {
      const colorsVal = Number(fd.get('colors'));
      if (!colorsVal || colorsVal < 1) { markFieldError('colors', 'Number of Colors is required for Color Separation.'); return; }
    } else if (!isEmbroideryPatches && !selectedFormatOption) {
      markFieldError('format-group', 'Please select an expected output file format.');
      return;
    }

    if (selectedFormatOption === 'OTHERS') {
      const otherFormatVal = String(fd.get('format_other') ?? '').trim();
      if (!otherFormatVal) { markFieldError('format_other', 'Please specify your custom output format.'); return; }
    }

    if (selectedProcessType === 'Others') {
      const otherProcessVal = String(fd.get('process_type_other') ?? '').trim();
      if (!otherProcessVal) { markFieldError('process_type_other', 'Please specify your custom process type.'); return; }
    }

    if (selectedPlacement === 'Others') {
      const otherPlacementVal = String(fd.get('placement_other') ?? '').trim();
      if (!otherPlacementVal) { markFieldError('placement_other', 'Please specify your custom placement.'); return; }
    }

    if (selectedService === 'Logo Designing') {
      const fontStyle = String(fd.get('preferable_font_style') ?? '').trim();
      if (!fontStyle) { markFieldError('preferable_font_style', 'Please enter a preferable font style.'); return; }
      const ageGroup = String(fd.get('age_group_audience') ?? '').trim();
      if (!ageGroup) { markFieldError('age_group_audience', 'Please enter the age group / audience.'); return; }
    }

    if (selectedService === 'Carton Box Designing') {
      const flips = toNum(fd.get('num_flips'));
      if (flips == null || flips < 1) { markFieldError('num_flips', 'Please enter the number of flips.'); return; }
    }

    const order_type = resolveOrderType(selectedService);
    const cloudLink = String(fd.get('cloud_link') ?? '').trim();

    setError(null);
    setFieldErrors(new Set());

    const data: ClientBriefData = {
      client_id: clientId !== 'new' ? clientId : undefined,
      order_type,
      project_type: isOrder ? ProjectType.LIVE : ProjectType.QUOTE,
      design_name: designName,
      ...(turnaround != null ? { eta_hours: turnaround } : {}),
      description: (() => {
        let desc = brief;

        if (clientId === 'new') {
          const newClientName = String(fd.get('newClientName') ?? '').trim();
          const newClientCompany = String(fd.get('newClientCompany') ?? '').trim();
          const newClientContact = String(fd.get('newClientContact') ?? '').trim();
          const newClientEmail = String(fd.get('newClientEmail') ?? '').trim();
          desc += `\n\n[New Client: ${newClientName} | ${newClientCompany} | ${newClientContact} | ${newClientEmail}]`;
        }

        desc += `\n\n[Service Type: ${selectedService}]`;
        if (specificService && specificService !== selectedService) {
          desc += `\n[Specific Service: ${specificService}]`;
        }

        if (selectedFormatOption) {
          let formatText = selectedFormatOption;
          if (selectedFormatOption === 'OTHERS') {
            const otherFormatVal = String(fd.get('format_other') ?? '').trim();
            if (otherFormatVal) {
              formatText = `Others: ${otherFormatVal}`;
            }
          }
          desc += `\n[Expected Output Format: ${formatText}]`;
        }

        const processVal = fd.get('process_type');
        if (processVal) {
          const processOtherVal = String(fd.get('process_type_other') ?? '').trim();
          if (processVal === 'Others' && processOtherVal) {
            desc += `\n[Process Type: Others - ${processOtherVal}]`;
          } else {
            desc += `\n[Process Type: ${processVal}]`;
          }
        }

        const placementVal = fd.get('placement');
        if (placementVal) {
          const placementOtherVal = String(fd.get('placement_other') ?? '').trim();
          if (placementVal === 'Others' && placementOtherVal) {
            desc += `\n[Placement: Others - ${placementOtherVal}]`;
          }
        }

        const madeiraVal = fd.get('madeira_threads');
        if (madeiraVal) {
          desc += `\n[Do you wish Madeira threads: ${madeiraVal === 'yes' ? 'Yes' : 'No'}]`;
        }

        const colorModeVal = fd.get('color_mode');
        if (colorModeVal) {
          desc += `\n[Color Mode: ${colorModeVal}]`;
        }

        const layoutVal = fd.get('preferable_layout');
        if (layoutVal) {
          desc += `\n[Preferable Layout: ${layoutVal}]`;
        }

        const sidesVal = fd.get('num_sides');
        if (sidesVal) {
          desc += `\n[Number of Sides: ${sidesVal}]`;
        }

        const pagesVal = fd.get('num_pages');
        if (pagesVal) {
          desc += `\n[Number of Pages: ${pagesVal}]`;
        }

        const fontStyleVal = fd.get('preferable_font_style');
        if (fontStyleVal) {
          desc += `\n[Preferable Font Style: ${fontStyleVal}]`;
        }

        const ageGroupVal = fd.get('age_group_audience');
        if (ageGroupVal) {
          desc += `\n[Age Group / Audience: ${ageGroupVal}]`;
        }

        const prefColorsVal = fd.get('preferable_colors');
        if (prefColorsVal) {
          desc += `\n[Preferable Colors: ${prefColorsVal}]`;
        }

        const shapesVal = fd.get('preferable_shapes');
        if (shapesVal) {
          desc += `\n[Preferable Shapes: ${shapesVal}]`;
        }

        const flipsVal = fd.get('num_flips');
        if (flipsVal) {
          desc += `\n[Number of Flips: ${flipsVal}]`;
        }

        return desc;
      })(),
      final_files: (() => {
        const option = selectedFormatOption;
        if (!option || option === 'OTHERS') {
          return [FinalFileFormat.OTHERS];
        }

        const mapped: FinalFileFormat[] = [];
        const parts = option.split(',').map(s => s.trim());
        parts.forEach(part => {
          if (part === 'PDF') mapped.push(FinalFileFormat.PDF);
          else if (part === 'EPS') mapped.push(FinalFileFormat.EPS);
          else if (part === 'AI') mapped.push(FinalFileFormat.AI);
          else if (part === 'CDR') mapped.push(FinalFileFormat.CDR);
          else mapped.push(FinalFileFormat.OTHERS);
        });

        return mapped.length > 0 ? mapped : [FinalFileFormat.OTHERS];
      })(),
      ...(PRIORITY_ENUM[priorityLabel] ? { priority: PRIORITY_ENUM[priorityLabel] } : {}),
      ...(toNum(fd.get('colors')) != null ? { num_colors: toNum(fd.get('colors')) } : {}),
      ...(cloudLink ? { cloud_link: cloudLink } : {}),
      ...(String(fd.get('billing_address') ?? '').trim() ? { billing_address: String(fd.get('billing_address')).trim() } : {}),
      ...(String(fd.get('shipping_address') ?? '').trim() ? { shipping_address: String(fd.get('shipping_address')).trim() } : {}),
      files,
    };

    const processVal = String(fd.get('process_type') ?? '');
    if (processVal && PROCESS_TYPE_MAP[processVal]) {
      data.process_type = PROCESS_TYPE_MAP[processVal];
    }

    const placementLabel = String(fd.get('placement') ?? '');
    const isEmbDigitizingService = specificService === 'Embroidery Digitizing' || specificService === 'Embroidery Digitizing - Sewout Swatches';
    if (isEmbDigitizingService) {
      const wVal = toNum(fd.get('width'));
      const hVal = toNum(fd.get('height'));
      const hasPlacement = !!PLACEMENT_MAP[placementLabel];
      const hasWidth = wVal != null;
      const hasHeight = hVal != null;

      const scrollToSection = () => {
        placementSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };

      if (hasWidth && !hasHeight) {
        setFieldErrors(prev => new Set(prev).add('height'));
        toast.error('You entered a width — please also fill in the height to complete the dimensions.', { duration: 7000 });
        scrollToSection();
        return;
      }
      if (hasHeight && !hasWidth) {
        setFieldErrors(prev => new Set(prev).add('width'));
        toast.error('You entered a height — please also fill in the width to complete the dimensions.', { duration: 7000 });
        scrollToSection();
        return;
      }
      if (!hasPlacement && !(hasWidth && hasHeight)) {
        setFieldErrors(prev => { const n = new Set(prev); n.add('placement'); n.add('width'); n.add('height'); return n; });
        toast.error('Please choose one: select a Placement, or enter both Width & Height.', { duration: 7000 });
        scrollToSection();
        return;
      }
    }

    if (specificService === 'Custom Embroidery Patches') {
      const billing = String(fd.get('billing_address') ?? '').trim();
      const shipping = String(fd.get('shipping_address') ?? '').trim();
      if (!billing) { markFieldError('billing_address', 'Please enter a billing address.'); return; }
      if (!shipping) { markFieldError('shipping_address', 'Please enter a shipping address.'); return; }
    }

    if (PLACEMENT_MAP[placementLabel]) {
      data.placement = PLACEMENT_MAP[placementLabel];
    }

    if (order_type === OrderType.DIGITIZING || order_type === OrderType.DIGITIZING_SEWOUT) {
      data.sewout_required = order_type === OrderType.DIGITIZING_SEWOUT;

      const width = toNum(fd.get('width'));
      const height = toNum(fd.get('height'));
      if (width != null) data.width_inches = width;
      if (height != null) data.height_inches = height;
    }

    if (order_type !== OrderType.OTHERS) {
      const fabric = String(fd.get('fabric') ?? '').trim();
      if (fabric) data.fabric = fabric;
    }

    if (isOrder) {
      if (!selectedClientData) {
        toast.error('Client data is missing. Please re-select the client.');
        return;
      }
      setPendingOrderData(data);
      setConfirmOrderText('');
      setConfirmOrderOpen(true);
    } else {
      if (!onCreateJob) {
        toast.error('Job creation is not configured.');
        return;
      }
      if (!selectedClientData) {
        toast.error('Client data is missing. Please re-select the client.');
        return;
      }

      const clientPO = String(fd.get('client_po') ?? '').trim();
      const body: CreateJobCardBody = {
        client_id: selectedClientData.id,
        mail: selectedClientData.email,
        order_type: data.order_type,
        project_type: data.project_type,
        design_name: data.design_name,
        ...(data.eta_hours != null ? { eta_hours: data.eta_hours } : {}),
        ...(data.description ? { description: data.description } : {}),
        ...(data.priority ? { priority: data.priority } : {}),
        ...(data.process_type ? { process_type: data.process_type } : {}),
        ...(data.final_files?.length ? { final_files: data.final_files } : {}),
        ...(data.placement ? { placement: data.placement } : {}),
        ...(data.width_inches != null ? { width_inches: data.width_inches } : {}),
        ...(data.height_inches != null ? { height_inches: data.height_inches } : {}),
        ...(data.num_colors != null ? { num_colors: data.num_colors } : {}),
        ...(data.fabric ? { fabric: data.fabric } : {}),
        ...(data.sewout_required != null ? { sewout_required: data.sewout_required } : {}),
        ...(data.billing_address ? { billing_address: data.billing_address } : {}),
        ...(data.shipping_address ? { shipping_address: data.shipping_address } : {}),
        ...(clientPO ? { client_po: clientPO } : {}),
      };

      setIsSubmitting(true);
      try {
        const job = await onCreateJob(body);

        if (files.length > 0) {
          try {
            await uploadOriginalFiles(job.id, files);
          } catch (err) {
            toast.error('Quote created, but some files failed to upload. You can add them later.');
          }
        }

        const priceAmount = parseFloat(quotedPrice);
        if (quotedPrice && !isNaN(priceAmount) && priceAmount > 0 && onSendPrice) {
          try {
            await onSendPrice(job.id, { amount: priceAmount, currency: quoteCurrency });
            toast.success(`Quote ${job.job_id} created and price sent to client`);
          } catch {
            toast.success(`Quote ${job.job_id} created`, { duration: 4000 });
            toast.error('Price could not be sent — open the job and use "Send Price" to set it.', { duration: 8000 });
          }
        } else {
          toast.success(`Quote ${job.job_id} created successfully`);
        }

        if (onSubmit) await onSubmit(job.id);
        resetForm(e.currentTarget);
      } catch {
        // Job creation failed — error already toasted by the mutation's onError
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  async function handleConfirmedOrder() {
    if (!pendingOrderData || !selectedClientData) return;
    if (!onCreateJob) {
      toast.error('Order submission is not configured.');
      return;
    }

    setConfirmOrderOpen(false);
    setConfirmOrderText('');

    const clientPO = formRef.current
      ? String(new FormData(formRef.current).get('client_po') ?? '').trim()
      : '';

    const body: CreateJobCardBody = {
      client_id: selectedClientData.id,
      mail: selectedClientData.email,
      order_type: pendingOrderData.order_type,
      project_type: pendingOrderData.project_type,
      design_name: pendingOrderData.design_name,
      ...(pendingOrderData.eta_hours != null ? { eta_hours: pendingOrderData.eta_hours } : {}),
      ...(pendingOrderData.description ? { description: pendingOrderData.description } : {}),
      ...(pendingOrderData.priority ? { priority: pendingOrderData.priority } : {}),
      ...(pendingOrderData.process_type ? { process_type: pendingOrderData.process_type } : {}),
      ...(pendingOrderData.final_files?.length ? { final_files: pendingOrderData.final_files } : {}),
      ...(pendingOrderData.placement ? { placement: pendingOrderData.placement } : {}),
      ...(pendingOrderData.width_inches != null ? { width_inches: pendingOrderData.width_inches } : {}),
      ...(pendingOrderData.height_inches != null ? { height_inches: pendingOrderData.height_inches } : {}),
      ...(pendingOrderData.num_colors != null ? { num_colors: pendingOrderData.num_colors } : {}),
      ...(pendingOrderData.fabric ? { fabric: pendingOrderData.fabric } : {}),
      ...(pendingOrderData.sewout_required != null ? { sewout_required: pendingOrderData.sewout_required } : {}),
      ...(pendingOrderData.billing_address ? { billing_address: pendingOrderData.billing_address } : {}),
      ...(pendingOrderData.shipping_address ? { shipping_address: pendingOrderData.shipping_address } : {}),
      ...(clientPO ? { client_po: clientPO } : {}),
    };

    setIsSubmitting(true);
    try {
      const job = await onCreateJob(body);

      if (files.length > 0) {
        try {
          await uploadOriginalFiles(job.id, files);
        } catch (err) {
          toast.error('Order placed, but some files failed to upload. You can add them later.');
        }
      }

      toast.success(`Order ${job.job_id} placed successfully`);
      if (onSubmit) await onSubmit(job.id);
      if (formRef.current) resetForm(formRef.current);
      setPendingOrderData(null);
    } catch {
      // Error already toasted by the mutation's onError
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
    <form ref={formRef} onSubmit={handleSubmit} className="max-w-[920px] mx-auto">
      <div className="qf-card">
        {/* ── Phase stepper ─────────────────────────────────────── */}
        <div className="form-phase-stepper">
          <div className="fps-title-block">
            {phase === 2 && (specificService || selectedService) ? (
              <>
                <span className="fps-mode-label">{specificService || selectedService}</span>
                <span className="fps-service-label">
                  {ORDER_TYPES.find((t) => t.id === orderType)?.label ?? ''}
                </span>
              </>
            ) : (
              <span className="fps-mode-label">
                {isOrder ? 'Place New Order' : 'Request Quote'}
              </span>
            )}
            </div>

            <div className="fps-right-col">
              <div className="fps-tracker">
                <div className={cn('fps-step', phase === 1 && 'active', phase === 2 && 'done')}>
                  <div className="fps-num">
                    {phase === 2 ? <Check className="w-3 h-3" strokeWidth={3} aria-hidden /> : '1'}
                  </div>
                  <span>Client &amp; Service</span>
                </div>
                <div className={cn('fps-connector', phase === 2 && 'done')} />
                <div className={cn('fps-step', phase === 2 && 'active')}>
                  <div className="fps-num">2</div>
                  <span>Job Details</span>
                </div>
              </div>
              <div className="fps-required-note">
                All fields marked <span style={{ color: 'var(--color-crimson)', margin: '0 2px' }}>*</span> are required
              </div>
            </div>
          </div>

          <div className="qf-body">
            {/* ── PHASE 1 — Client & Service Type ──────────────────────────── */}
            {phase === 1 && (
              <div className="qf-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
                {/* Client Details Section */}
                <div className="qf-section-header" style={{ marginBottom: '20px' }}>
                  <div className="qf-step-num">A</div>
                  <span className="qf-section-title">Client Details</span>
                </div>
                
                <div style={{ marginBottom: '30px' }}>
                  <label className="fl">Select Existing Client <span style={{ color: '#c41e3a' }}>*</span></label>
                  {/* Custom searchable client dropdown */}
                  <div ref={clientDropdownRef} style={{ position: 'relative' }}>
                    {/* Trigger button */}
                    <button
                      type="button"
                      className="fi mb-2.5"
                      disabled={clientsLoading}
                      onClick={() => {
                        setClientDropdownOpen((o) => !o);
                        setClientSearch('');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        cursor: clientsLoading ? 'not-allowed' : 'pointer',
                        ...((!clientId && fieldErrors.has('client')) ? { borderColor: 'var(--color-crimson)' } : {}),
                      }}
                    >
                      <span style={{ color: clientId ? 'inherit' : 'var(--color-muted, #888)' }}>
                        {clientsLoading
                          ? 'Loading clients…'
                          : clientsError
                            ? 'Failed to load clients — try refreshing'
                            : clientId === 'new'
                              ? '+ Enter New Client'
                              : clientId
                                ? (() => { const c = clients.find((x) => x.client_id === clientId); return c ? `${c.company_name ?? c.client_name} — ${c.contact_name} (${c.client_id})` : clientId; })()
                                : '— Search or select an existing client —'}
                      </span>
                      <span style={{ fontSize: 10, marginLeft: 8, opacity: 0.5 }}>{clientDropdownOpen ? '▲' : '▼'}</span>
                    </button>

                    {/* Dropdown panel */}
                    {clientDropdownOpen && !clientsLoading && !clientsError && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          background: 'var(--color-surface, #fff)',
                          border: '1px solid var(--color-border, #e2e8f0)',
                          borderRadius: 8,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Search input */}
                        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search by name or company…"
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: 13,
                              color: 'inherit',
                            }}
                          />
                        </div>

                        {/* Scrollable list — 5 rows visible */}
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {(() => {
                            const term = clientSearch.trim().toLowerCase();
                            const filtered = term
                              ? clients.filter((c) =>
                                  (c.company_name ?? '').toLowerCase().includes(term) ||
                                  c.client_name.toLowerCase().includes(term) ||
                                  c.contact_name.toLowerCase().includes(term) ||
                                  c.client_id.toLowerCase().includes(term),
                                )
                              : clients;

                            if (filtered.length === 0) {
                              return (
                                <div style={{ padding: '10px 14px', fontSize: 13, opacity: 0.5 }}>
                                  No clients found
                                </div>
                              );
                            }

                            return filtered.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setClientId(c.client_id);
                                  setSelectedClientData(c);
                                  setClientDropdownOpen(false);
                                  setClientSearch('');
                                  setError(null);
                                }}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '9px 14px',
                                  fontSize: 13,
                                  background: clientId === c.client_id ? 'rgba(196,30,58,0.07)' : 'transparent',
                                  color: 'inherit',
                                  border: 'none',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--color-border, #f0f0f0)',
                                }}
                                onMouseEnter={(e) => { if (clientId !== c.client_id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-hover, rgba(0,0,0,0.04))'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = clientId === c.client_id ? 'rgba(196,30,58,0.07)' : 'transparent'; }}
                              >
                                <span style={{ fontWeight: 500 }}>{c.company_name ?? c.client_name}</span>
                                <span style={{ opacity: 0.6, marginLeft: 6 }}>— {c.contact_name} ({c.client_id})</span>
                              </button>
                            ));
                          })()}
                        </div>

                        {/* Enter new client */}
                        <div style={{ borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setClientId('new');
                              setClientDropdownOpen(false);
                              setClientSearch('');
                              setError(null);
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '9px 14px',
                              fontSize: 13,
                              color: 'var(--color-crimson, #c41e3a)',
                              fontWeight: 600,
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            + Enter New Client
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {clientId === 'new' ? (
                    <div
                      style={{
                        background: 'rgba(196,30,58,0.04)',
                        border: '1px dashed rgba(196,30,58,0.25)',
                        borderRadius: 10,
                        padding: 16,
                      }}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-crimson mb-3">
                        New Client Information
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="fl">Client Name *</label>
                          <input name="newClientName" className="fi" placeholder="e.g. Ravi Kumar"
                            style={newClientFieldErrors.newClientName ? { borderColor: 'var(--color-crimson)' } : undefined}
                            onChange={() => setNewClientFieldErrors(p => { const n = {...p}; delete n.newClientName; return n; })}
                          />
                          {newClientFieldErrors.newClientName && <p style={{ color: 'var(--color-crimson)', fontSize: 11, marginTop: 3 }}>{newClientFieldErrors.newClientName}</p>}
                        </div>
                        <div>
                          <label className="fl">Company Name</label>
                          <input name="newClientCompany" className="fi" placeholder="e.g. Ravi Textiles" />
                        </div>
                        <div>
                          <label className="fl">Contact Number *</label>
                          <input
                            name="newClientContact"
                            className="fi"
                            placeholder="+91 98765 43210"
                            type="tel"
                            inputMode="tel"
                            value={newClientContact}
                            onChange={(e) => {
                              // Strip non-phone chars, then cap at 15 digits
                              const filtered = e.target.value.replace(/[^+\d\s\-()]/g, '');
                              const digits = filtered.replace(/\D/g, '');
                              if (digits.length > 15) return;
                              setNewClientContact(filtered);
                              setNewClientFieldErrors(p => { const n = {...p}; delete n.newClientContact; return n; });
                            }}
                            style={newClientFieldErrors.newClientContact ? { borderColor: 'var(--color-crimson)' } : undefined}
                          />
                          {newClientFieldErrors.newClientContact && <p style={{ color: 'var(--color-crimson)', fontSize: 11, marginTop: 3 }}>{newClientFieldErrors.newClientContact}</p>}
                        </div>
                        <div>
                          <label className="fl">Email Address *</label>
                          <input name="newClientEmail" className="fi" placeholder="client@company.com" type="email"
                            style={newClientFieldErrors.newClientEmail ? { borderColor: 'var(--color-crimson)' } : undefined}
                            onChange={() => setNewClientFieldErrors(p => { const n = {...p}; delete n.newClientEmail; return n; })}
                          />
                          {newClientFieldErrors.newClientEmail && <p style={{ color: 'var(--color-crimson)', fontSize: 11, marginTop: 3 }}>{newClientFieldErrors.newClientEmail}</p>}
                        </div>
                        <div>
                          <label className="fl">Password * <span style={{ color: '#888', fontSize: 10, fontWeight: 400, textTransform: 'none' }}>(min 8 chars)</span></label>
                          <div style={{ position: 'relative' }}>
                            <input
                              className="fi"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Set a password for the client"
                              value={newClientPassword}
                              onChange={(e) => { setNewClientPassword(e.target.value); setNewClientFieldErrors(p => { const n = {...p}; delete n.password; return n; }); }}
                              autoComplete="new-password"
                              style={{ paddingRight: 72, ...(newClientFieldErrors.password ? { borderColor: 'var(--color-crimson)' } : {}) }}
                            />
                            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
                              <button type="button" tabIndex={-1} title={showPassword ? 'Hide password' : 'Show password'}
                                onClick={() => setShowPassword(v => !v)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-muted, #888)', display: 'flex', alignItems: 'center' }}>
                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                              <button type="button" tabIndex={-1} title="Copy password"
                                onClick={() => { void navigator.clipboard.writeText(newClientPassword); toast.success('Password copied'); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-muted, #888)', display: 'flex', alignItems: 'center' }}>
                                <Copy size={15} />
                              </button>
                            </div>
                          </div>
                          {newClientFieldErrors.password && <p style={{ color: 'var(--color-crimson)', fontSize: 11, marginTop: 3 }}>{newClientFieldErrors.password}</p>}
                        </div>
                        <div>
                          <label className="fl">Confirm Password *</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              className="fi"
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Repeat the password"
                              value={newClientConfirmPassword}
                              onChange={(e) => { setNewClientConfirmPassword(e.target.value); setNewClientFieldErrors(p => { const n = {...p}; delete n.confirmPassword; return n; }); }}
                              autoComplete="new-password"
                              style={{ paddingRight: 72, ...(newClientFieldErrors.confirmPassword ? { borderColor: 'var(--color-crimson)' } : {}) }}
                            />
                            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
                              <button type="button" tabIndex={-1} title={showConfirmPassword ? 'Hide password' : 'Show password'}
                                onClick={() => setShowConfirmPassword(v => !v)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-muted, #888)', display: 'flex', alignItems: 'center' }}>
                                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                              <button type="button" tabIndex={-1} title="Copy password"
                                onClick={() => { void navigator.clipboard.writeText(newClientConfirmPassword); toast.success('Password copied'); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-muted, #888)', display: 'flex', alignItems: 'center' }}>
                                <Copy size={15} />
                              </button>
                            </div>
                          </div>
                          {newClientFieldErrors.confirmPassword && <p style={{ color: 'var(--color-crimson)', fontSize: 11, marginTop: 3 }}>{newClientFieldErrors.confirmPassword}</p>}
                        </div>
                      </div>

                      {onProvisionClient && (
                        <button
                          type="button"
                          disabled={provisioningClient}
                          onClick={async () => {
                            const form = formRef.current;
                            if (!form) return;
                            const fd = new FormData(form);
                            const clientName = String(fd.get('newClientName') ?? '').trim();
                            const company = String(fd.get('newClientCompany') ?? '').trim();
                            const contact = String(fd.get('newClientContact') ?? '').trim();
                            const email = String(fd.get('newClientEmail') ?? '').trim();

                            const errors: Record<string, string> = {};

                            if (!clientName) {
                              errors.newClientName = 'Client name is required.';
                            }

                            // Contact: no letters, only phone-safe chars, 7–15 digits
                            const digitsOnly = contact.replace(/\D/g, '');
                            if (!contact) {
                              errors.newClientContact = 'Contact number is required.';
                            } else if (/[a-zA-Z]/.test(contact)) {
                              errors.newClientContact = 'Contact number must not contain letters.';
                            } else if (/[^+\d\s\-().]/.test(contact)) {
                              errors.newClientContact = 'Only digits, spaces, +, -, and brackets are allowed.';
                            } else if (digitsOnly.length < 7) {
                              errors.newClientContact = 'Must have at least 7 digits (e.g. +91 98765 43210).';
                            } else if (digitsOnly.length > 15) {
                              errors.newClientContact = 'Must not exceed 15 digits.';
                            }

                            // Email: proper format check
                            if (!email) {
                              errors.newClientEmail = 'Email address is required.';
                            } else if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
                              errors.newClientEmail = 'Enter a valid email (e.g. name@company.com).';
                            }

                            if (newClientPassword.length < 8) {
                              errors.password = 'Password must be at least 8 characters.';
                            }
                            if (newClientPassword && newClientConfirmPassword && newClientPassword !== newClientConfirmPassword) {
                              errors.confirmPassword = 'Passwords do not match.';
                            }

                            if (Object.keys(errors).length > 0) {
                              setNewClientFieldErrors(errors);
                              return;
                            }
                            setNewClientFieldErrors({});

                            setProvisioningClient(true);
                            try {
                              const created = await onProvisionClient({
                                client_name: clientName,
                                company_name: company || undefined,
                                contact_name: clientName,
                                contact_number: contact,
                                email,
                                password: newClientPassword,
                              });
                              setClientId(created.client_id);
                              setSelectedClientData(created);
                              setNewClientPassword('');
                              setNewClientConfirmPassword('');
                              toast.success(`Account created for ${created.client_name}. Login credentials sent to ${email}.`);
                            } catch (err: unknown) {
                              const code = (err as Record<string, unknown>)?.code as string | undefined;
                              const isDuplicate =
                                code === 'CLIENT_ID_TAKEN' || code === 'EMAIL_ALREADY_EXISTS';
                              if (isDuplicate) {
                                setNewClientFieldErrors((p) => ({
                                  ...p,
                                  newClientEmail: 'An account with this email already exists.',
                                }));
                              }
                              // generic error already toasted by the mutation's onError
                            } finally {
                              setProvisioningClient(false);
                            }
                          }}
                          style={{
                            marginTop: 14,
                            padding: '9px 20px',
                            background: provisioningClient ? 'rgba(196,30,58,0.4)' : '#c41e3a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: provisioningClient ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          {provisioningClient && <Loader2 size={14} className="animate-spin" />}
                          {provisioningClient ? 'Creating account…' : 'Create Client Account'}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="qf-section-header">
                  <div className="qf-step-num">B</div>
                  <span className="qf-section-title">
                    {isOrder ? 'Place New Order' : 'New Quote Request'} — Select Service Type
                  </span>
                </div>

                <div className="qf-order-grid">
                  {ORDER_TYPES.map(({ id, label, sub, icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectOrder(id)}
                      className={cn('qf-order-card', orderType === id && 'active')}
                      aria-pressed={orderType === id}
                    >
                      <span className="qf-order-icon">{icon}</span>
                      <div className="qf-order-label">{label}</div>
                      <div className="qf-order-sub">{sub}</div>
                    </button>
                  ))}
                </div>

                {hasSelection && needsService && (
                  <div style={{ marginTop: 20 }}>
                    <label className="fl" htmlFor="service">
                      SPECIFIC SERVICE <span style={{ color: '#c41e3a' }}>*</span>
                    </label>
                    <select
                      id="service"
                      name="service"
                      className="fi"
                      value={specificService}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSpecificService(value);
                      }}
                      style={serviceError ? { borderColor: 'var(--color-crimson)' } : undefined}
                    >
                      <option value="" disabled>
                        Select specific service...
                      </option>
                      {specificServices.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="phase-nav" style={{ marginTop: 28 }}>
                  <button type="button" className="btn btn-navy" onClick={goToPhase2}>
                    Continue to Job Details
                    <ArrowRight aria-hidden className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ── PHASE 2 — Job Details ───────────────────────────── */}
            {phase === 2 && (
              <>
                <div className="qf-section">
                  <div className="qf-section-header">
                    <div className="qf-step-num">2</div>
                    <span className="qf-section-title">Job Details</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <Field name="design" label="DESIGN NAME" required placeholder=" " fieldError={fieldErrors.has('design')} onChange={() => clearFieldError('design')} />

                    <Field
                      name="client_po"
                      label="CLIENT PO / REFERENCE NO."
                      placeholder=" "
                    />

                    <Field
                      name="eta"
                      label="ESTIMATED TURNAROUND (HOURS)"
                      type="number"
                      min={2}
                      placeholder="e.g. 24"
                    />

                    {/* Price — quote mode only */}
                    {!isOrder && (
                      <div>
                        <label className="fl">QUOTED PRICE (USD)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--color-text-muted, #94a3b8)', fontWeight: 600, fontSize: 14 }}>$</span>
                          <input
                            className="fi"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="e.g. 150.00"
                            value={quotedPrice}
                            onChange={(e) => setQuotedPrice(e.target.value)}
                            style={{ flex: 1 }}
                          />
                        </div>
                      </div>
                    )}

                    {(selectedService === 'Vector Artwork' ||
                      selectedService === 'Business Card' ||
                      selectedService === 'Brouchers' ||
                      selectedService === 'Logo Designing' ||
                      selectedService === 'Carton Box Designing') && (
                        <div>
                          <label className="fl" htmlFor="process_type">
                            PROCESS TYPE <span style={{ color: '#c41e3a' }}>*</span>
                          </label>
                          <select
                            id="process_type"
                            name="process_type"
                            className="fi"
                            value={selectedProcessType}
                            onChange={(e) => {
                              setSelectedProcessType(e.target.value);
                              clearFieldError('process_type');
                            }}
                            required
                          >
                            <option value="" disabled>Select process type</option>
                            <option value="Screen Printing">Screen Printing</option>
                            <option value="OffSet Printing">OffSet Printing</option>
                            <option value="Digital Printing">Digital Printing</option>
                            <option value="Engraving">Engraving</option>
                            <option value="Others">Others</option>
                          </select>
                          {selectedProcessType === 'Others' && (
                            <input
                              id="process_type_other"
                              className="fi mt-2"
                              name="process_type_other"
                              placeholder="Please specify the process type (e.g. Heat Transfer, Sublimation, Laser Engraving…)"
                              required
                              autoFocus
                              style={fieldErrors.has('process_type_other') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}
                              onChange={() => clearFieldError('process_type_other')}
                            />
                          )}
                        </div>
                      )}

                    {selectedService === 'Digitizing Sewout' && (
                      <div>
                        <label className="fl" htmlFor="madeira_threads">
                          DO YOU WISH MADEIRA THREADS <span style={{ color: '#c41e3a' }}>*</span>
                        </label>
                        <select id="madeira_threads" name="madeira_threads" className="fi" defaultValue="" required>
                          <option value="" disabled>Select option</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                    )}

                    {(selectedService === 'Digitizing' || selectedService === 'Digitizing Sewout') && (
                      <Field
                        name="fabric"
                        label="FABRIC"
                        required={specificService !== 'Embroidery Digitizing' && specificService !== 'Embroidery Digitizing - Sewout Swatches'}
                        placeholder="e.g. Cotton, Polyester, Denim"
                      />
                    )}

                    {(selectedService === 'Digitizing' ||
                      selectedService === 'Digitizing Sewout' ||
                      (selectedService === 'Virtual Proof' && specificService === 'Product / Virtual Mock Ups')) && (
                        <div ref={placementSectionRef}>
                          <label className="fl" htmlFor="placement">
                            SELECT PLACEMENT
                            {(specificService === 'Embroidery Digitizing' || specificService === 'Embroidery Digitizing - Sewout Swatches') && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4, fontSize: '11px' }}>(or fill width &amp; height)</span>
                            )}
                          </label>
                          <select
                            id="placement"
                            name="placement"
                            className="fi"
                            value={selectedPlacement}
                            onChange={(e) => {
                              setSelectedPlacement(e.target.value);
                              clearFieldError('placement');
                            }}
                            style={fieldErrors.has('placement') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}
                          >
                            <option value="" disabled>Select placement</option>
                            <optgroup label="CAP">
                              <option value="Front Of Cap">Front Of Cap</option>
                              <option value="Back Of Cap">Back Of Cap</option>
                              <option value="Side Of Cap">Side Of Cap</option>
                              <option value="Visor">Visor</option>
                              <option value="Beenie Cap">Beenie Cap</option>
                            </optgroup>
                            <optgroup label="TOWEL">
                              <option value="Towel">Towel</option>
                            </optgroup>
                            <optgroup label="BAGS">
                              <option value="Bags">Bags</option>
                            </optgroup>
                            <optgroup label="POLO">
                              <option value="Left Chest">Left Chest</option>
                              <option value="Polo-Sleeve">Polo-Sleeve</option>
                              <option value="Polo-Pocket">Polo-Pocket</option>
                              <option value="Full Back">Full Back</option>
                              <option value="Full Front">Full Front</option>
                              <option value="Back Yoke">Back Yoke</option>
                            </optgroup>
                            <optgroup label="OTHERS">
                              <option value="Others">Others</option>
                            </optgroup>
                          </select>
                          {selectedPlacement === 'Others' && (
                            <input
                              id="placement_other"
                              className="fi mt-2"
                              name="placement_other"
                              placeholder="Please specify the placement location (e.g. Left Chest + Sleeve, Back Collar…)"
                              required
                              autoFocus
                              style={fieldErrors.has('placement_other') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}
                              onChange={() => clearFieldError('placement_other')}
                            />
                          )}
                        </div>
                      )}

                    {(selectedService === 'Digitizing' || selectedService === 'Digitizing Sewout') && (
                      <>
                        <Field
                          name="width"
                          label="WIDTH (INCHES)"
                          type="number"
                          step="0.1"
                          min={0.1}
                          placeholder="e.g. 3.5"
                          fieldError={fieldErrors.has('width')}
                          onChange={() => clearFieldError('width')}
                        />
                        <Field
                          name="height"
                          label="HEIGHT (INCHES)"
                          type="number"
                          step="0.1"
                          min={0.1}
                          placeholder="e.g. 2.5"
                          fieldError={fieldErrors.has('height')}
                          onChange={() => clearFieldError('height')}
                        />
                      </>
                    )}

                    {selectedService === 'Business Card' && (
                      <>
                        <div>
                          <label className="fl" htmlFor="color_mode">
                            COLOR MODE
                          </label>
                          <select id="color_mode" name="color_mode" className="fi" defaultValue="">
                            <option value="" disabled>Select color mode</option>
                            <option value="CMYK">CMYK</option>
                            <option value="RGB">RGB</option>
                            <option value="PANTONE">PANTONE</option>
                          </select>
                        </div>
                        <Field
                          name="preferable_layout"
                          label="PREFERABLE LAYOUT"
                          placeholder="e.g. Horizontal, Vertical"
                        />
                        <Field
                          name="num_sides"
                          label="NUMBER OF SIDES"
                          type="number"
                          min={1}
                          placeholder="e.g. 2"
                        />
                      </>
                    )}

                    {selectedService === 'Brouchers' && (
                      <Field
                        name="num_pages"
                        label="NUMBER OF PAGES"
                        type="number"
                        min={1}
                        placeholder="e.g. 4"
                      />
                    )}

                    {selectedService === 'Logo Designing' && (
                      <>
                        <Field
                          name="preferable_font_style"
                          label="PREFERABLE FONT STYLE"
                          required
                          placeholder="e.g. Modern, Serif, Script"
                          fieldError={fieldErrors.has('preferable_font_style')}
                          onChange={() => clearFieldError('preferable_font_style')}
                        />
                        <Field
                          name="age_group_audience"
                          label="AGE GROUP / AUDIENCE"
                          required
                          placeholder="e.g. Teens, Professionals, General"
                          fieldError={fieldErrors.has('age_group_audience')}
                          onChange={() => clearFieldError('age_group_audience')}
                        />
                        <Field
                          name="preferable_colors"
                          label="PREFERABLE COLORS"
                          placeholder="e.g. Blue and Silver"
                        />
                        <div>
                          <label className="fl" htmlFor="preferable_shapes">
                            PREFERABLE SHAPES
                          </label>
                          <select
                            id="preferable_shapes"
                            name="preferable_shapes"
                            className="fi"
                            defaultValue=""
                          >
                            <option value="" disabled>Select shape</option>
                            {[
                              'Square', 'Rectangle', 'Circle', 'Ellipse', 'Rhombus',
                              'Parallelogram', 'Trapezoid', 'Kite', 'Equilateral Triangle',
                              'Isosceles Triangle', 'Scalene Triangle', 'Right Triangle',
                              'Regular Pentagon', 'Regular Hexagon', 'Regular Octagon',
                              'Regular Decagon'
                            ].map((shape) => (
                              <option key={shape} value={shape}>{shape}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {selectedService === 'Carton Box Designing' && (
                      <Field
                        name="num_flips"
                        label="NUMBER OF FLIPS"
                        required
                        type="number"
                        min={1}
                        placeholder="e.g. 4"
                        fieldError={fieldErrors.has('num_flips')}
                        onChange={() => clearFieldError('num_flips')}
                      />
                    )}

                    {selectedService !== 'Others' && (
                      <Field
                        name="colors"
                        label="NUMBER OF COLORS"
                        required={specificService === 'Color Separation'}
                        type="number"
                        min={1}
                        max={20}
                        placeholder=" "
                        fieldError={fieldErrors.has('colors')}
                        onChange={() => clearFieldError('colors')}
                      />
                    )}

                    <div>
                      <label className="fl" htmlFor="priority">
                        PRIORITY <span style={{ color: '#c41e3a' }}>*</span>
                      </label>
                      <select id="priority" name="priority" className="fi" defaultValue="" onChange={() => clearFieldError('priority')} style={fieldErrors.has('priority') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}>
                        <option value="" disabled>Select priority</option>
                        {['Normal', 'Rush', 'Super Rush'].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="fl" htmlFor="brief">
                      Description <span style={{ color: '#c41e3a' }}>*</span>
                    </label>
                    <textarea
                      id="brief"
                      name="brief"
                      className="fi fi-ta"
                      style={{ minHeight: 220, ...(fieldErrors.has('brief') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : {}) }}
                      placeholder=" "
                      onChange={() => clearFieldError('brief')}
                    />
                  </div>

                  {specificService === 'Custom Embroidery Patches' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="fl" htmlFor="billing_address">
                          BILLING ADDRESS <span style={{ color: '#c41e3a' }}>*</span>
                        </label>
                        <textarea
                          id="billing_address"
                          name="billing_address"
                          className="fi fi-ta"
                          style={{ minHeight: 100, ...(fieldErrors.has('billing_address') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : {}) }}
                          placeholder="Name, Street, City, State, ZIP, Country"
                          onChange={() => clearFieldError('billing_address')}
                        />
                      </div>
                      <div>
                        <label className="fl" htmlFor="shipping_address">
                          SHIPPING ADDRESS <span style={{ color: '#c41e3a' }}>*</span>
                        </label>
                        <textarea
                          id="shipping_address"
                          name="shipping_address"
                          className="fi fi-ta"
                          style={{ minHeight: 100, ...(fieldErrors.has('shipping_address') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : {}) }}
                          placeholder="Name, Street, City, State, ZIP, Country"
                          onChange={() => clearFieldError('shipping_address')}
                        />
                      </div>
                    </div>
                  )}

                  {formatOptions.length > 0 && (
                    <div id="format-group" style={fieldErrors.has('format-group') ? { padding: '8px', borderRadius: '8px', border: '1px solid var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}>
                      <label className="fl">
                        EXPECTED OUTPUT FILE FORMATS {specificService !== 'Color Separation' && <span style={{ color: '#c41e3a' }}>*</span>}
                      </label>
                      <div
                        className="flex flex-wrap gap-2 mt-2"
                        role="radiogroup"
                        aria-label="Expected output file formats"
                      >
                        {formatOptions.map((opt) => {
                          const active = selectedFormatOption === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => { setSelectedFormatOption(opt); clearFieldError('format-group'); }}
                              className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold tracking-wide transition select-none cursor-pointer',
                                active ? 'text-white' : 'text-text-muted hover:text-text',
                              )}
                              style={{
                                border: `1px solid ${active ? 'var(--color-crimson)' : 'var(--glass-border)'}`,
                                background: active ? 'rgba(196,30,58,0.18)' : 'rgba(255,255,255,0.04)',
                              }}
                            >
                              <span
                                className="flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                                style={{ border: `2px solid ${active ? 'var(--color-crimson)' : 'var(--glass-border)'}` }}
                                aria-hidden
                              >
                                {active && <span className="w-1.5 h-1.5 rounded-full block" style={{ background: 'var(--color-crimson)' }} />}
                              </span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {selectedFormatOption === 'OTHERS' && (
                        <input
                          id="format_other"
                          className="fi mt-3"
                          name="format_other"
                          placeholder="Please specify format (e.g. DST, PXF, AI, CDR)"
                          autoFocus
                          style={fieldErrors.has('format_other') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}
                          onChange={() => clearFieldError('format_other')}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* ── Section 3 — Upload Reference Files ─────────────── */}
                <div className="qf-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
                  <div className="qf-section-header">
                    <div className="qf-step-num">3</div>
                    <span className="qf-section-title">Upload Reference Files</span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <div
                    className="qf-upload-zone cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      addFiles(e.dataTransfer.files);
                    }}
                  >
                    <div className="qf-upload-icon-wrap">
                      <Upload className="w-5 h-5" aria-hidden style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <p className="qf-upload-label">
                      Drop files here or <span className="qf-upload-browse">browse</span>
                    </p>
                    <p className="qf-upload-hint">
                      PDF, AI, PSD, PNG, SVG, JPG, DST, EMB — max 500 MB per file
                    </p>
                  </div>

                  {files.length > 0 && (
                    <ul className="flex flex-col gap-1.5 mt-3">
                      {files.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[12.5px]"
                          style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)' }}
                        >
                          {previews[i] ? (
                            <img
                              src={previews[i] as string}
                              alt={f.name}
                              className="w-10 h-10 rounded-md object-cover shrink-0"
                              style={{ border: '1px solid var(--glass-border)' }}
                            />
                          ) : (
                            <span
                              className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center"
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                              aria-hidden
                            >
                              <FileText className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            </span>
                          )}
                          <span className="flex-1 min-w-0 truncate text-text-main">{f.name}</span>
                          <button
                            type="button"
                            className="text-text-faint hover:text-crimson transition shrink-0"
                            aria-label={`Remove ${f.name}`}
                            onClick={() => removeFile(i)}
                          >
                            <X className="w-3.5 h-3.5" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3">
                    <label className="fl">
                      OR LINK TO CLOUD STORAGE (GOOGLE DRIVE, WETRANSFER, DROPBOX)
                    </label>
                    <input type="url" name="cloud_link" className="fi" placeholder="https://drive.google.com/..." />
                    <p className="qf-cloud-hint">
                      Use this if your files are too large to upload directly or you prefer sharing from cloud storage.
                    </p>
                  </div>
                </div>

                {error && (
                  <div
                    className="text-[12px] mt-4 px-3 py-2 rounded-md"
                    style={{ background: 'rgba(196,30,58,0.08)', color: '#c41e3a' }}
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                {/* ── Footer nav: Back · Save Draft · Submit ─────────── */}
                <div className="flex items-center justify-between gap-2.5 flex-wrap pt-1 mt-4">
                  <button type="button" className="btn btn-outline" onClick={goToPhase1}>
                    <ArrowLeft aria-hidden className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      className="btn btn-outline disabled:opacity-60"
                      onClick={handleSaveDraft}
                      disabled={savingDraft || !onSaveDraft}
                    >
                      {savingDraft ? (
                        <Loader2 aria-hidden className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save aria-hidden className="w-4 h-4" />
                      )}
                      {savingDraft ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button type="submit" className="btn btn-navy disabled:opacity-60" disabled={submitting || isSubmitting}>
                      {(submitting || isSubmitting) ? (
                        <Loader2 aria-hidden className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send aria-hidden className="w-4 h-4" />
                      )}
                      {isOrder ? 'Submit Order' : 'Submit Quote'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </form>

    {/* Confirm Order dialog — order mode only */}
    {confirmOrderOpen && pendingOrderData && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center px-4"
        style={{
          background: 'rgba(15,23,42,0.35)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
        onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) { setConfirmOrderOpen(false); setConfirmOrderText(''); } }}
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm place order"
          className="w-full max-w-[440px] rounded-2xl overflow-hidden"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border-bright)',
            boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-4 font-semibold"
            style={{ color: 'var(--text-main)', borderBottom: '1px solid var(--glass-border)' }}
          >
            Place this order?
          </div>

          {/* Body */}
          <div className="px-5 py-4 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
            <div className="mb-2">
              <span className="font-bold" style={{ color: 'var(--text-main)' }}>{pendingOrderData.design_name}</span>
              {selectedClientData ? <> &mdash; {selectedClientData.client_name}</> : null}
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Order is placed directly into production.</li>
              <li>The client will be notified by email.</li>
              <li>This action cannot be undone.</li>
            </ul>
            <div className="mt-4">
              <label className="block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Type <span className="font-bold" style={{ color: 'var(--text-main)' }}>CONFIRM</span> to proceed
              </label>
              <input
                type="text"
                value={confirmOrderText}
                onChange={(e) => setConfirmOrderText(e.target.value)}
                placeholder="CONFIRM"
                autoFocus
                className="w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
                style={{
                  background: 'var(--glass-bg-light)',
                  border: `1px solid ${confirmOrderText.trim().toUpperCase() === 'CONFIRM' ? '#22c55e' : 'var(--glass-border)'}`,
                  color: 'var(--text-main)',
                  transition: 'border-color 0.15s',
                }}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex justify-end gap-2 px-5 py-3.5"
            style={{ borderTop: '1px solid var(--glass-border)', background: 'var(--glass-bg-light, rgba(15,23,42,0.03))' }}
          >
            <button
              type="button"
              className="btn btn-outline disabled:opacity-60"
              disabled={isSubmitting}
              onClick={() => { setConfirmOrderOpen(false); setConfirmOrderText(''); }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || confirmOrderText.trim().toUpperCase() !== 'CONFIRM'}
              className="btn btn-crimson disabled:opacity-50"
              onClick={handleConfirmedOrder}
            >
              {isSubmitting ? (
                <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send aria-hidden className="w-3.5 h-3.5" />
              )}
              {isSubmitting ? 'Placing…' : 'Place Order'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function Field({
  name,
  label,
  required,
  labelSuffix,
  fieldError,
  ...rest
}: {
  name: string;
  label: string;
  required?: boolean;
  labelSuffix?: string;
  fieldError?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="fl" htmlFor={name}>
        {label}
        {required && <span style={{ color: '#c41e3a', marginLeft: 2 }}>*</span>}
        {labelSuffix && <span className="qf-label-suffix">{labelSuffix}</span>}
      </label>
      <input
        id={name}
        name={name}
        className="fi"
        style={fieldError ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}
        {...rest}
      />
    </div>
  );
}
