import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Send, Save, Upload, Check, ArrowRight, ArrowLeft, X, Loader2, FileText, Sparkles, Shirt, Box, Type, Shield, Layers, Palette, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  FinalFileFormat,
  OrderType,
  Placement,
  Priority,
  ProcessType,
  ProjectType,
} from '@contracts';

import { cn } from '@lib/utils';
import { handleStructuredPaste } from '@lib/paste-html';
import { FilePreviewModal } from './FilePreviewModal';


export interface ClientBriefData {
  order_type: OrderType;
  project_type: ProjectType;
  design_name: string;
  specific_type?: string;
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
  /** Client's own PO / reference number (up to 15 alphanumeric chars). */
  client_po?: string;
  /** Optional cloud-storage link, appended to notes server-side by the page. */
  cloud_link?: string;
  /** Reference files to upload after the job card is created. */
  files: File[];
}

// The backend's FinalFileFormat enum only recognizes PDF/EPS/AI/CDR — every
// other token (DST, EMB, CND, EXP, PXF, JPEG, TIFF, SVG, ...) used by the
// Digitizing/Virtual Proof preset options has no enum value and must collapse
// to a single OTHERS sentinel. Mapping each unrecognized token to its own
// OTHERS entry (the previous per-token approach) produced duplicate OTHERS
// entries that re-rendered the same "[Expected Output Format: ...]" note
// once per entry on the admin side. The full breakdown is preserved
// separately in that note, so collapsing here loses no information.
function mapFormatOptionToFinalFiles(option: string): FinalFileFormat[] {
  if (!option || option === 'OTHERS') return [FinalFileFormat.OTHERS];
  const KNOWN: Record<string, FinalFileFormat> = {
    PDF: FinalFileFormat.PDF,
    EPS: FinalFileFormat.EPS,
    AI: FinalFileFormat.AI,
    CDR: FinalFileFormat.CDR,
  };
  const parts = option.split(',').map((s) => s.trim());
  if (parts.every((p) => KNOWN[p])) {
    return parts.map((p) => KNOWN[p]);
  }
  return [FinalFileFormat.OTHERS];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AdminBriefFormProps {
  mode: 'quote' | 'order';
  clients?: Array<Record<string, any>>;
  clientsLoading?: boolean;
  clientsError?: boolean | string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onProvisionClient?: (...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreateJob?: (...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSendPrice?: (...args: any[]) => Promise<any>;
  onSubmit?: (data: ClientBriefData) => void | Promise<void>;
  onSaveDraft?: (data: Partial<ClientBriefData>) => void | Promise<void>;
  submitting?: boolean;
  savingDraft?: boolean;
  draftMode?: boolean;
}

const SvgArtwork = () => (
  <svg width="44" height="44" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--color-crimson)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', margin: '0 auto' }}>
    <path d="M23 26L17 14H29L23 26Z" />
    <circle cx="23" cy="20" r="1.5" />
    <path d="M12 16C15 10 31 10 34 16" />
    <circle cx="10" cy="16" r="2" />
    <circle cx="36" cy="16" r="2" />
    <circle cx="23" cy="9" r="2" />
    <path d="M23 26V34" />
    <path d="M19 34H27" />
    <circle cx="13" cy="34" r="2" />
    <path d="M15 34H17" />
    <circle cx="33" cy="34" r="2" />
    <path d="M29 34H31" />
    <path d="M23 34V38" />
  </svg>
);

const SvgDigitizing = () => (
  <svg width="44" height="44" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--color-crimson)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', margin: '0 auto' }}>
    <path d="M32 10L12 30" strokeWidth="2.5" />
    <path d="M34 8L31 11" strokeWidth="2.5" />
    <path d="M33 9C38 4 44 10 40 15C35 20 25 15 20 20C15 25 22 32 18 36C15 39 10 39 10 39" />
    <path d="M12 36L18 36L14 39L20 39" />
  </svg>
);

const SvgSwatches = () => (
  <svg width="44" height="44" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--color-crimson)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', margin: '0 auto' }}>
    <path d="M16 10H30" strokeWidth="2.5" />
    <path d="M14 10V14H32V10" />
    <path d="M16 36H30" strokeWidth="2.5" />
    <path d="M14 32V36H32V32" />
    <path d="M18 14V32" />
    <path d="M28 14V32" />
    <path d="M18 18L28 21L18 24L28 27L18 30" />
  </svg>
);

const SvgPatches = () => (
  <svg width="44" height="44" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--color-crimson)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', margin: '0 auto' }}>
    <path d="M23 8L11 12V22C11 31 23 38 23 38C23 38 35 31 35 22V12L23 8Z" strokeWidth="2.5" />
    <path d="M23 12L15 15V22C15 28 23 33 23 33C23 33 31 28 31 22V15L23 12Z" />
    <path d="M23 18L24.5 21H28L25 23L26 26.5L23 24.5L20 26.5L21 23L18 21H21.5L23 18Z" fill="var(--color-crimson)" />
  </svg>
);

const SvgOthers = () => (
  <svg width="44" height="44" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--color-crimson)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', margin: '0 auto' }}>
    <circle cx="15" cy="23" r="3.5" fill="var(--color-crimson)" />
    <circle cx="23" cy="23" r="3.5" fill="var(--color-crimson)" />
    <circle cx="31" cy="23" r="3.5" fill="var(--color-crimson)" />
  </svg>
);

const ORDER_TYPES = [
  { id: 'artwork', label: 'Artwork', sub: 'Logo, Vector, Illustration', icon: <SvgArtwork /> },
  { id: 'digitizing', label: 'Digitizing Services', sub: 'Embroidery conversion', icon: <SvgDigitizing /> },
  { id: 'swatches', label: 'Embroidery Digitizing Swatches Only', sub: 'Physical sample review', icon: <SvgSwatches /> },
  { id: 'extras', label: 'Patches & Extras', sub: 'Custom patches', icon: <SvgPatches /> },
  { id: 'others', label: 'Others', sub: 'Custom request', icon: <SvgOthers /> },
];
interface SpecificServiceOption {
  label: string;
  sub: string;
  icon: React.ReactNode;
}

const SPECIFIC_SERVICES: Record<string, SpecificServiceOption[]> = {
  artwork: [
    { label: 'Vector Artwork', sub: 'High quality vector conversion.', icon: <Palette className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Product / Virtual Mock Ups', sub: 'Virtual mockups for products.', icon: <ImageIcon className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Cut Contour', sub: 'Cut contour paths.', icon: <Sparkles className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Color Separation', sub: 'Color separation for printing.', icon: <Layers className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Creative Designs', sub: 'Custom creative designs.', icon: <Palette className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Line Art Conversions', sub: 'Convert images to line art.', icon: <Sparkles className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Image Rendering', sub: 'High quality rendering.', icon: <ImageIcon className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Color Correction', sub: 'Color grading and correction.', icon: <Palette className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Brochure Designing', sub: 'Design brochures and flyers.', icon: <FileText className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Clipping Path', sub: 'Clipping paths and masks.', icon: <Sparkles className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Channel Mask', sub: 'Channel masking services.', icon: <Layers className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Business Card Designs', sub: 'Custom business cards.', icon: <FileText className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Packaging Designs', sub: 'Product packaging designs.', icon: <Box className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Product Branding', sub: 'Branding and identity.', icon: <Sparkles className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Image Manipulation', sub: 'Photo manipulation.', icon: <ImageIcon className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Black & White To Color', sub: 'Colorize old photos.', icon: <Palette className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
    { label: 'Name Drops', sub: 'Custom name drops.', icon: <Type className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
  ],
  digitizing: [
    { label: 'Embroidery Digitizing', sub: 'High quality embroidery digitizing for logos, monograms & more.', icon: <SvgDigitizing /> },
    { label: 'Embroidery Digitizing - Sewout Swatches', sub: 'Digitizing with sewout swatches for approval before production.', icon: <Shirt className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> },
  ],
  swatches: [],
  extras: [
    { label: 'Custom Embroidery Patches', sub: 'Custom patches.', icon: <Shield className="w-8 h-8" style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 0, 68, 0.6))', color: 'var(--color-crimson)', margin: '0 auto' }} /> }
  ],
  others: [],
};

// ─── UI label → backend enum maps ─────────────────────────────────────────────

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

function toNum(v: FormDataEntryValue | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function AdminBriefForm({
  mode,
  clients: _clients = [],
  clientsLoading: _clientsLoading,
  clientsError: _clientsError,
  onProvisionClient: _onProvisionClient,
  onCreateJob: _onCreateJob,
  onSendPrice: _onSendPrice,
  onSubmit,
  onSaveDraft,
  submitting = false,
  savingDraft = false,
  draftMode = false
}: AdminBriefFormProps) {
  const isOrder = mode === 'order';
  const [clientId, _setClientId] = useState('');
  const [_clientSearch, _setClientSearch] = useState('');
  const [_isProvisioning, _setIsProvisioning] = useState(false);
  const [_isNewClientFormOpen, _setIsNewClientFormOpen] = useState(false);

  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [orderType, setOrderType] = useState('');
  const [specificService, setSpecificService] = useState('');
  const [selectedFormatOption, setSelectedFormatOption] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewFileIndex, setPreviewFileIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);
  const [confirmOrderText, setConfirmOrderText] = useState('');
  const [pendingOrderData, setPendingOrderData] = useState<ClientBriefData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const placementSectionRef = useRef<HTMLDivElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  const [selectedProcessType, setSelectedProcessType] = useState('');
  const [selectedPlacement, setSelectedPlacement] = useState('');
  // CLIENT PO — max 15 alphanumeric chars, controlled so we can enforce the rule on every keystroke
  const [clientPo, setClientPo] = useState('');
  const CLIENT_PO_MAX = 15;


  const DESIGN_NAME_MAX = 150;
  const FABRIC_MAX = 60;
  const COLORS_MAX = 20;
  const DIMENSION_MAX_LEN = 7; // e.g. "99999.9"
  const DESCRIPTION_MAX = 1500;
  const [designName, setDesignName] = useState('');
  const [fabricValue, setFabricValue] = useState('');
  const [colorsValue, setColorsValue] = useState('');
  const [widthValue, setWidthValue] = useState('');
  const [heightValue, setHeightValue] = useState('');
  const [briefValue, setBriefValue] = useState('');
  const briefRef = useRef<HTMLTextAreaElement>(null);

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

  // Reset output file format when selected service changes
  useEffect(() => {
    setSelectedFormatOption('');
  }, [selectedService]);

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
    setSelectedFormatOption('');
    setSelectedProcessType('');
    setSelectedPlacement('');
    setFabricValue('');
    setColorsValue('');
    setWidthValue('');
    setHeightValue('');
    const services = SPECIFIC_SERVICES[id] ?? [];
    if (services.length === 0) {
      if (id === 'swatches') {
        setSpecificService('Digitizing Sewout');
        window.setTimeout(advanceToPhase3, 220);
      } else if (id === 'extras') {
        setSpecificService('Others');
        window.setTimeout(advanceToPhase3, 220);
      } else if (id === 'others') {
        setSpecificService('Others');
        window.setTimeout(advanceToPhase3, 220);
      }
    } else {
      window.setTimeout(() => {
        setPhase(2);
        document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 220);
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

  function advanceToPhase3() {
    setPhase(3);
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToPhase2() {
    if (!hasSelection) {
      toast.error('Please select a service type to continue.');
      return;
    }
    const services = SPECIFIC_SERVICES[orderType] ?? [];
    setPhase(services.length === 0 ? 3 : 2);
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToPhase3() {
    if (needsService && !specificService) {
      toast.error('Please select a specific service to continue.');
      return;
    }
    setPhase(3);
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToPhase1() {
    setPhase(1);
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToPhase(target: 1 | 2 | 3) {
    if (target === phase) return;
    if (target === 2 && !hasSelection) return;
    if (target === 3 && needsService && !specificService) return;
    setPhase(target);
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resolveOrderType(service: string): OrderType {
    if (service === 'Digitizing Sewout') {
      return OrderType.DIGITIZING_SEWOUT;
    }
    if (service === 'Digitizing') {
      return OrderType.DIGITIZING;
    }
    if (service === 'Others') {
      return OrderType.OTHERS;
    }
    return OrderType.ARTWORK;
  }

  async function handleSaveDraft() {
    if (!onSaveDraft || !formRef.current) return;
    const fd = new FormData(formRef.current);

    const designName = String(fd.get('design') ?? '').trim();
    const brief = String(fd.get('brief') ?? '').trim();
    const priorityLabel = String(fd.get('priority') ?? '');
    const cloudLink = String(fd.get('cloud_link') ?? '').trim();

    // Validate required fields before saving draft
    if (!designName) { markFieldError('design', 'Please enter a design name before saving.'); return; }
    if (!priorityLabel) { markFieldError('priority', 'Please select a priority before saving.'); return; }
    if (!brief) { markFieldError('brief', 'Please add a description before saving.'); return; }

    const order_type = resolveOrderType(selectedService);

    const finalFiles = mapFormatOptionToFinalFiles(selectedFormatOption);

    const draftDescription = (() => {
      if (!brief) return undefined;
      return brief;
    })();

    const data: Partial<ClientBriefData> = {
      order_type,
      project_type: isOrder ? ProjectType.LIVE : ProjectType.QUOTE,
      design_name: designName,
      specific_type: specificService || selectedService || undefined,
      ...(draftDescription ? { description: draftDescription } : {}),
      final_files: finalFiles,
      ...(PRIORITY_ENUM[priorityLabel] ? { priority: PRIORITY_ENUM[priorityLabel] } : {}),
      ...(cloudLink ? { cloud_link: cloudLink } : {}),
      ...(String(fd.get('client_po') ?? '').trim() ? { client_po: String(fd.get('client_po')).trim().toUpperCase() } : {}),
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
    if (submitting) return;
    const fd = new FormData(e.currentTarget);

    const designName = String(fd.get('design') ?? '').trim();
    const brief = String(fd.get('brief') ?? '').trim();
    const priorityLabel = String(fd.get('priority') ?? '');

    const isColorSeparation = specificService === 'Color Separation';
    const isEmbroideryPatches = specificService === 'Custom Embroidery Patches';

    if (!designName) { markFieldError('design', 'Please enter a design name to continue.'); return; }
    if (!clientId) { markFieldError('client', 'Please select a client.'); return; }
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

    if (selectedPlacement === 'Others') {
      const otherPlacementVal = String(fd.get('placement_other') ?? '').trim();
      if (!otherPlacementVal) { markFieldError('placement_other', 'Please specify your custom placement.'); return; }
    }

    if (selectedService === 'Logo Designing' && specificService !== 'Creative Designs') {
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
      order_type,
      project_type: isOrder ? ProjectType.LIVE : ProjectType.QUOTE,
      design_name: designName,
      specific_type: specificService || selectedService || undefined,
      description: (() => {
        let desc = brief;

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
      final_files: mapFormatOptionToFinalFiles(selectedFormatOption),
      ...(PRIORITY_ENUM[priorityLabel] ? { priority: PRIORITY_ENUM[priorityLabel] } : {}),
      ...(toNum(fd.get('colors')) != null ? { num_colors: toNum(fd.get('colors')) } : {}),
      ...(cloudLink ? { cloud_link: cloudLink } : {}),
      ...(String(fd.get('billing_address') ?? '').trim() ? { billing_address: String(fd.get('billing_address')).trim() } : {}),
      ...(String(fd.get('shipping_address') ?? '').trim() ? { shipping_address: String(fd.get('shipping_address')).trim() } : {}),
      ...(String(fd.get('client_po') ?? '').trim() ? { client_po: String(fd.get('client_po')).trim().toUpperCase() } : {}),
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

    setPendingOrderData(data);
    setConfirmOrderOpen(true);
  }

  async function handleConfirmedOrder() {
    if (!pendingOrderData) return;
    setConfirmOrderOpen(false);
    setConfirmOrderText('');
    await onSubmit?.(pendingOrderData);
    setPendingOrderData(null);
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} className="max-w-[920px] mx-auto">
        {/* ── Phase stepper (separate bar card) ─────────────────── */}
        <div className="form-phase-stepper">
          <div className="fps-tracker">
            {/* Step 1 — Service Type */}
            <button
              type="button"
              className={cn('fps-step', phase === 1 && 'active', phase >= 2 && 'done')}
              onClick={() => goToPhase(1)}
              disabled={phase < 2}
              aria-current={phase === 1 ? 'step' : undefined}
            >
              <div className="fps-num">
                {phase >= 2 ? <Check className="w-3 h-3" strokeWidth={3} aria-hidden /> : '1'}
              </div>
              <div className="fps-step-info">
                <span className="fps-step-label">Service Type</span>
                <span className="fps-step-status">
                  {phase >= 2 ? 'Completed' : 'InProgress'}
                </span>
              </div>
            </button>

            <div className={cn('fps-connector', phase >= 2 && 'done')} />

            {/* Step 2 — Specific Service */}
            <button
              type="button"
              className={cn('fps-step', phase === 2 && 'active', phase >= 3 && 'done')}
              onClick={() => goToPhase(2)}
              disabled={!(phase >= 3 || (phase === 1 && hasSelection))}
              aria-current={phase === 2 ? 'step' : undefined}
            >
              <div className="fps-num">
                {phase >= 3 ? <Check className="w-3 h-3" strokeWidth={3} aria-hidden /> : '2'}
              </div>
              <div className="fps-step-info">
                <span className="fps-step-label">Specific Service</span>
                <span className="fps-step-status">
                  {phase >= 3 ? 'Completed' : phase === 2 ? 'InProgress' : 'Pending'}
                </span>
              </div>
            </button>

            <div className={cn('fps-connector', phase >= 3 && 'done')} />

            {/* Step 3 — Project Details */}
            <div className={cn('fps-step', phase === 3 && 'active')}>
              <div className="fps-num">3</div>
              <div className="fps-step-info">
                <span className="fps-step-label">Project Details</span>
                <span className="fps-step-status">
                  {phase === 3 ? 'InProgress' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="qf-card">
          {/* Back link inside main card — visible on phases 2 & 3 */}
          {phase > 1 && (
            <div className="fps-back-row">
              <button
                type="button"
                className="fps-back-link"
                onClick={() => {
                  if (phase === 3 && needsService) {
                    goToPhase(2);
                  } else {
                    goToPhase(1);
                  }
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to {phase === 3 && needsService ? 'Specific Service' : 'Service Type'}
              </button>
            </div>
          )}

          <div className="qf-body">
            {/* ── PHASE 1 — Service Type ──────────────────────────── */}
            {phase === 1 && (
              <div className="qf-phase-panel">
                <div className="qf-phase-heading">
                  <div className="qf-step-bubble">1</div>
                  <h2 className="qf-phase-title">Select Service Type</h2>
                  <p className="qf-phase-sub">Please select the type of service you need. You will choose the specific service in the next step.</p>
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

                {/* Help banner */}
                <div className="qf-help-banner">
                  <div className="qf-help-inner">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-crimson)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                    <div>
                      <div className="qf-help-title">Need help choosing?</div>
                      <div className="qf-help-desc">Our team is here to help you select the right service for your requirement. You can discuss after submitting your request.</div>
                    </div>
                  </div>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" aria-hidden><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.6 19.79 19.79 0 0 1 1.58 3a2 2 0 0 1 1.99-2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                </div>

                <div className="phase-nav" style={{ marginTop: 24 }}>
                  <button type="button" className="btn btn-crimson" onClick={goToPhase2}>
                    Continue
                    <ArrowRight aria-hidden className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ── PHASE 2 — Specific Service ──────────────────────────── */}
            {phase === 2 && (
              <div className="qf-phase-panel">
                <div className="qf-phase-heading">
                  <div className="qf-step-bubble">2</div>
                  <h2 className="qf-phase-title">Select Specific Service</h2>
                  <p className="qf-phase-sub">
                    Choose the {ORDER_TYPES.find((t) => t.id === orderType)?.label} service you need.<br />
                    Each service is designed to meet your specific requirements.
                  </p>
                </div>

                <div className="qf-services-grid">
                  {SPECIFIC_SERVICES[orderType]?.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        setSpecificService(s.label);
                        window.setTimeout(advanceToPhase3, 220);
                      }}
                      className={cn('qf-service-card', specificService === s.label && 'active')}
                      aria-pressed={specificService === s.label}
                    >
                      <span className="qf-order-icon">{s.icon}</span>
                      <div className="qf-service-label">{s.label}</div>
                      <div className="qf-service-sub">{s.sub}</div>
                    </button>
                  ))}
                </div>

                <div className="phase-nav" style={{ marginTop: 24, justifyContent: 'center' }}>
                  <button type="button" className="btn btn-crimson" onClick={goToPhase3}>
                    Continue to Project Details <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ── PHASE 3 — Project Details ───────────────────────────── */}
            {phase === 3 && (
              <>
                <div className="qf-section">
                  <div className="qf-section-header">
                    <div className="qf-step-num">3</div>
                    <span className="qf-section-title">Project Details</span>
                  </div>



                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    {/* Design Name — controlled for live char count */}
                    <div>
                      <label className="fl" htmlFor="design">
                        DESIGN NAME <span style={{ color: '#c41e3a' }}>*</span>
                        <span
                          className="qf-label-suffix"
                          style={{
                            float: 'right',
                            fontWeight: 500,
                            letterSpacing: 0,
                            color: designName.length >= DESIGN_NAME_MAX ? '#ff3355' : 'var(--text-faint)',
                            textShadow: designName.length >= DESIGN_NAME_MAX ? '0 0 8px rgba(255,51,85,0.5)' : undefined,
                          }}
                        >
                          {designName.length}/{DESIGN_NAME_MAX}
                        </span>
                      </label>
                      <input
                        id="design"
                        name="design"
                        className="fi"
                        type="text"
                        placeholder=" "
                        maxLength={DESIGN_NAME_MAX}
                        value={designName}
                        onChange={(e) => { setDesignName(e.target.value); clearFieldError('design'); }}
                        style={{
                          ...(fieldErrors.has('design') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : {}),
                          ...(designName.length >= DESIGN_NAME_MAX ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.18)' } : {}),
                        }}
                      />
                      {designName.length >= DESIGN_NAME_MAX && (
                        <p role="alert" style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: '#ff3355', textShadow: '0 0 8px rgba(255,51,85,0.5)' }}>
                          Maximum {DESIGN_NAME_MAX} characters reached.
                        </p>
                      )}
                    </div>

                    {/* ── CLIENT PO — 15-char alphanumeric, controlled ── */}
                    <div>
                      <label className="fl" htmlFor="client_po">
                        CLIENT PO / REFERENCE NO.
                        <span
                          className="qf-label-suffix"
                          style={{
                            float: 'right',
                            fontWeight: 500,
                            letterSpacing: 0,
                            color: clientPo.length >= CLIENT_PO_MAX
                              ? '#ff3355'
                              : 'var(--text-faint)',
                            textShadow: clientPo.length >= CLIENT_PO_MAX
                              ? '0 0 8px rgba(255,51,85,0.5)'
                              : undefined,
                          }}
                        >
                          {clientPo.length}/{CLIENT_PO_MAX}
                        </span>
                      </label>
                      <input
                        id="client_po"
                        name="client_po"
                        className="fi"
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        placeholder="e.g. PO12345"
                        maxLength={CLIENT_PO_MAX}
                        value={clientPo}
                        onChange={(e) => {
                          // Strip any character that is not A-Z, a-z, 0-9; enforce max length
                          const sanitized = e.target.value
                            .replace(/[^A-Za-z0-9]/g, '')
                            .slice(0, CLIENT_PO_MAX)
                            .toUpperCase();
                          setClientPo(sanitized);
                        }}
                        style={{
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          ...(clientPo.length >= CLIENT_PO_MAX
                            ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.18)' }
                            : undefined),
                        }}
                      />
                      {clientPo.length >= CLIENT_PO_MAX && (
                        <p
                          role="alert"
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#ff3355',
                            textShadow: '0 0 8px rgba(255,51,85,0.5)',
                          }}
                        >
                          Maximum {CLIENT_PO_MAX} characters reached.
                        </p>
                      )}
                    </div>

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
                            defaultValue=""
                            required
                            onChange={(e) => setSelectedProcessType(e.target.value)}
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
                              className="fi mt-2"
                              name="process_type_other"
                              placeholder="Please specify the process type (e.g. Heat Transfer, Sublimation, Laser Engraving…)"
                              autoFocus
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
                      <div>
                        <label className="fl" htmlFor="fabric">
                          FABRIC
                          {specificService !== 'Embroidery Digitizing' && specificService !== 'Embroidery Digitizing - Sewout Swatches' && (
                            <span style={{ color: '#c41e3a', marginLeft: 2 }}>*</span>
                          )}
                          <span
                            className="qf-label-suffix"
                            style={{
                              float: 'right',
                              fontWeight: 500,
                              letterSpacing: 0,
                              color: fabricValue.length >= FABRIC_MAX ? '#ff3355' : 'var(--text-faint)',
                              textShadow: fabricValue.length >= FABRIC_MAX ? '0 0 8px rgba(255,51,85,0.5)' : undefined,
                            }}
                          >
                            {fabricValue.length}/{FABRIC_MAX}
                          </span>
                        </label>
                        <input
                          id="fabric"
                          name="fabric"
                          className="fi"
                          type="text"
                          placeholder="e.g. Cotton, Polyester, Denim"
                          maxLength={FABRIC_MAX}
                          value={fabricValue}
                          onChange={(e) => setFabricValue(e.target.value)}
                          style={fabricValue.length >= FABRIC_MAX ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.18)' } : undefined}
                        />
                        {fabricValue.length >= FABRIC_MAX && (
                          <p role="alert" style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: '#ff3355', textShadow: '0 0 8px rgba(255,51,85,0.5)' }}>
                            Maximum {FABRIC_MAX} characters reached.
                          </p>
                        )}
                      </div>
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
                        {/* Width — controlled for char count display */}
                        <div>
                          <label className="fl" htmlFor="width">
                            WIDTH (INCHES)
                            <span
                              className="qf-label-suffix"
                              style={{
                                float: 'right',
                                fontWeight: 500,
                                letterSpacing: 0,
                                color: widthValue.length >= DIMENSION_MAX_LEN ? '#ff3355' : 'var(--text-faint)',
                              }}
                            >
                              {widthValue.length}/{DIMENSION_MAX_LEN}
                            </span>
                          </label>
                          <input
                            id="width"
                            name="width"
                            className="fi"
                            type="text"
                            inputMode="decimal"
                            placeholder="e.g. 3.5"
                            maxLength={DIMENSION_MAX_LEN}
                            value={widthValue}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9.]/g, '').slice(0, DIMENSION_MAX_LEN);
                              setWidthValue(v);
                              clearFieldError('width');
                            }}
                            style={fieldErrors.has('width') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}
                          />
                        </div>
                        {/* Height — controlled for char count display */}
                        <div>
                          <label className="fl" htmlFor="height">
                            HEIGHT (INCHES)
                            <span
                              className="qf-label-suffix"
                              style={{
                                float: 'right',
                                fontWeight: 500,
                                letterSpacing: 0,
                                color: heightValue.length >= DIMENSION_MAX_LEN ? '#ff3355' : 'var(--text-faint)',
                              }}
                            >
                              {heightValue.length}/{DIMENSION_MAX_LEN}
                            </span>
                          </label>
                          <input
                            id="height"
                            name="height"
                            className="fi"
                            type="text"
                            inputMode="decimal"
                            placeholder="e.g. 2.5"
                            maxLength={DIMENSION_MAX_LEN}
                            value={heightValue}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9.]/g, '').slice(0, DIMENSION_MAX_LEN);
                              setHeightValue(v);
                              clearFieldError('height');
                            }}
                            style={fieldErrors.has('height') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}
                          />
                        </div>
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
                          required={specificService !== 'Creative Designs'}
                          placeholder="e.g. Modern, Serif, Script"
                          fieldError={fieldErrors.has('preferable_font_style')}
                          onChange={() => clearFieldError('preferable_font_style')}
                        />
                        <Field
                          name="age_group_audience"
                          label="AGE GROUP / AUDIENCE"
                          required={specificService !== 'Creative Designs'}
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
                      <div>
                        <label className="fl" htmlFor="colors">
                          NUMBER OF COLORS
                          {specificService === 'Color Separation' && <span style={{ color: '#c41e3a', marginLeft: 2 }}>*</span>}
                          <span
                            className="qf-label-suffix"
                            style={{
                              float: 'right',
                              fontWeight: 500,
                              letterSpacing: 0,
                              color: Number(colorsValue) >= COLORS_MAX ? '#ff3355' : 'var(--text-faint)',
                              textShadow: Number(colorsValue) >= COLORS_MAX ? '0 0 8px rgba(255,51,85,0.5)' : undefined,
                            }}
                          >
                            {colorsValue !== '' ? colorsValue : '0'}/{COLORS_MAX}
                          </span>
                        </label>
                        <input
                          id="colors"
                          name="colors"
                          className="fi"
                          type="text"
                          inputMode="numeric"
                          placeholder=" "
                          maxLength={2}
                          value={colorsValue}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            const n = Number(raw);
                            const clamped = raw === '' ? '' : String(Math.min(n, COLORS_MAX));
                            setColorsValue(clamped);
                            clearFieldError('colors');
                          }}
                          style={{
                            ...(fieldErrors.has('colors') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : {}),
                            ...(Number(colorsValue) >= COLORS_MAX ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.18)' } : {}),
                          }}
                        />
                        {Number(colorsValue) >= COLORS_MAX && (
                          <p role="alert" style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: '#ff3355', textShadow: '0 0 8px rgba(255,51,85,0.5)' }}>
                            Maximum {COLORS_MAX} colors allowed.
                          </p>
                        )}
                      </div>
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
                      <span
                        className="qf-label-suffix"
                        style={{
                          float: 'right',
                          fontWeight: 500,
                          letterSpacing: 0,
                          color: briefValue.length >= DESCRIPTION_MAX ? '#ff3355' : 'var(--text-faint)',
                          textShadow: briefValue.length >= DESCRIPTION_MAX ? '0 0 8px rgba(255,51,85,0.5)' : undefined,
                        }}
                      >
                        {briefValue.length}/{DESCRIPTION_MAX}
                      </span>
                    </label>
                    <textarea
                      ref={briefRef}
                      id="brief"
                      name="brief"
                      className="fi fi-ta"
                      maxLength={DESCRIPTION_MAX}
                      value={briefValue}
                      onChange={(e) => { setBriefValue(e.target.value); clearFieldError('brief'); }}
                      onPaste={(e) => handleStructuredPaste(e, (next, _start, end) => {
                        const truncated = next.slice(0, DESCRIPTION_MAX);
                        setBriefValue(truncated);
                        clearFieldError('brief');
                        const caret = Math.min(end, truncated.length);
                        requestAnimationFrame(() => briefRef.current?.setSelectionRange(caret, caret));
                      })}
                      style={{
                        minHeight: 220,
                        ...(fieldErrors.has('brief') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : {}),
                        ...(briefValue.length >= DESCRIPTION_MAX ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.18)' } : {}),
                      }}
                      placeholder=" "
                    />
                    {briefValue.length >= DESCRIPTION_MAX && (
                      <p role="alert" style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: '#ff3355', textShadow: '0 0 8px rgba(255,51,85,0.5)' }}>
                        Maximum {DESCRIPTION_MAX} characters reached.
                      </p>
                    )}
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
                    id="brief-file-input"
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  {/* label+htmlFor: native browser file picker — never blocked in production */}
                  <label
                    htmlFor="brief-file-input"
                    className="qf-upload-zone cursor-pointer"
                    tabIndex={0}
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
                  </label>

                  {files.length > 0 && (
                    <ul className="flex flex-col gap-1.5 mt-3">
                      {files.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[12.5px] cursor-pointer hover:brightness-125 transition"
                          style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)' }}
                          onClick={() => setPreviewFileIndex(i)}
                          role="button"
                          tabIndex={0}
                          aria-label={`Preview ${f.name}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setPreviewFileIndex(i);
                            }
                          }}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(i);
                            }}
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
                      className="btn btn-navy disabled:opacity-60"
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
                    {!draftMode && (
                      <button type="submit" className="btn btn-navy disabled:opacity-60" disabled={submitting}>
                        {submitting ? (
                          <Loader2 aria-hidden className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send aria-hidden className="w-4 h-4" />
                        )}
                        {isOrder ? 'Submit Order' : 'Submit Quote Request'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </form>

      {/* Confirm dialog — requires typing "confirm" for both quote and order modes */}
      {confirmOrderOpen && pendingOrderData && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{
            background: 'rgba(3, 6, 15, 0.78)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !submitting) { setConfirmOrderOpen(false); setConfirmOrderText(''); } }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isOrder ? 'Confirm place order' : 'Confirm quote request'}
            className="w-full max-w-[420px] rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(8, 14, 30, 0.96)',
              border: '1px solid var(--glass-border-bright)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{ borderBottom: '1px solid var(--glass-border)' }}
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                style={isOrder
                  ? { background: 'rgba(196,30,58,0.18)', border: '1px solid rgba(196,30,58,0.4)' }
                  : { background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.4)' }}
              >
                {isOrder
                  ? <Send className="w-4 h-4" style={{ color: '#c41e3a' }} strokeWidth={2.5} aria-hidden />
                  : <FileText className="w-4 h-4" style={{ color: '#3B82F6' }} strokeWidth={2.5} aria-hidden />}
              </div>
              <span className="text-white font-semibold text-[15px]">
                {isOrder ? 'Place Order' : 'Submit Quote Request'}
              </span>
            </div>

            {/* Body */}
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {isOrder ? (
                  <>
                    You are about to submit&nbsp;
                    <span className="font-bold text-white break-all">{pendingOrderData.design_name}</span>&nbsp;
                    as a <span className="font-bold text-white">Live Order</span>. Our Client Servicing team will be notified immediately and production will begin shortly. Once placed, this order <span className="font-semibold text-white">cannot be edited</span> — you have a 10-minute window to cancel if needed.
                  </>
                ) : (
                  <>
                    You are about to send a quote request for&nbsp;
                    <span className="font-bold text-white break-all">{pendingOrderData.design_name}</span>.&nbsp;
                    Our Client Servicing team will review your requirements and get back to you with pricing. <span className="font-semibold text-white">No order will be placed</span> — a quote is completely non-binding.
                  </>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirm-order-input"
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Type&nbsp;
                  <span style={{ color: isOrder ? '#c41e3a' : '#3B82F6' }}>CONFIRM</span>
                  &nbsp;to {isOrder ? 'place order' : 'submit quote'}
                </label>
                <input
                  id="confirm-order-input"
                  type="text"
                  autoFocus
                  autoComplete="off"
                  value={confirmOrderText}
                  onChange={(e) => setConfirmOrderText(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && !submitting) { setConfirmOrderOpen(false); setConfirmOrderText(''); }
                    if (e.key === 'Enter' && confirmOrderText.trim().toUpperCase() === 'CONFIRM' && !submitting) handleConfirmedOrder();
                  }}
                  placeholder="CONFIRM"
                  className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none transition"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: confirmOrderText.trim().toUpperCase() === 'CONFIRM'
                      ? `1.5px solid ${isOrder ? '#c41e3a' : '#3B82F6'}`
                      : '1.5px solid var(--glass-border-bright)',
                    color: '#ffffff',
                    caretColor: isOrder ? '#c41e3a' : '#3B82F6',
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex justify-end gap-2 px-5 py-3.5"
              style={{ borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}
            >
              <button
                type="button"
                className="btn btn-outline"
                disabled={submitting}
                onClick={() => { setConfirmOrderOpen(false); setConfirmOrderText(''); }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                disabled={confirmOrderText.trim().toUpperCase() !== 'CONFIRM' || submitting}
                className={isOrder ? 'btn btn-crimson disabled:opacity-50' : 'btn disabled:opacity-50'}
                style={!isOrder ? {
                  background: confirmOrderText.trim().toUpperCase() === 'CONFIRM' ? '#3B82F6' : 'rgba(59,130,246,0.4)',
                  color: '#ffffff',
                  border: '1px solid rgba(59,130,246,0.6)',
                } : undefined}
                onClick={handleConfirmedOrder}
              >
                {submitting ? (
                  <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" />
                ) : isOrder ? (
                  <Send aria-hidden className="w-3.5 h-3.5" />
                ) : (
                  <FileText aria-hidden className="w-3.5 h-3.5" />
                )}
                {submitting
                  ? (isOrder ? 'Placing Live Order…' : 'Submitting Quote…')
                  : (isOrder ? 'Place Live Order' : 'Submit Quote')}
              </button>
            </div>
          </div>
        </div>
      )}

      <FilePreviewModal
        source={
          previewFileIndex !== null && files[previewFileIndex]
            ? { kind: 'local', file: files[previewFileIndex] }
            : null
        }
        onClose={() => setPreviewFileIndex(null)}
      />
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
