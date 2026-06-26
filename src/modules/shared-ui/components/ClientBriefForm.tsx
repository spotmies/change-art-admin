import { useState, type FormEvent } from 'react';
import { Send, Save, Upload, Check } from 'lucide-react';
import { cn } from '@lib/utils';

interface ClientBriefFormProps {
  mode: 'quote' | 'order';
  onSubmit?: (id: string) => void;
}

const ORDER_TYPES = [
  { id: 'artwork', label: 'Artwork', sub: 'Logo, Vector, Illustration', icon: '🎨' },
  { id: 'digitizing', label: 'Digitizing Services', sub: 'Embroidery conversion', icon: '🧵' },
  { id: 'swatches', label: 'Swatches', sub: 'Physical sample review', icon: '🪡' },
  { id: 'extras', label: 'Patches & Extras', sub: 'Custom patches, Name drops', icon: '📦' },
];

const SPECIFIC_SERVICES: Record<string, string[]> = {
  artwork: ['Vector Logo', 'Logo Refinement', 'Illustration', 'Brand Identity', 'Custom Artwork'],
  digitizing: ['Standard Embroidery', '3D Puff', 'Applique', 'Running Stitch', 'Cross Stitch'],
  swatches: ['Color Matching', 'Fabric Swatch Review', 'Rush Swatch'],
  extras: ['Custom Patch', 'Name Drop', 'Heat Transfer', 'Woven Label', 'Emblem'],
};

const OUTPUT_FORMATS = ['PDF', 'EPS', 'AI', 'CDR', 'OTHERS'];

export function ClientBriefForm({ mode, onSubmit }: ClientBriefFormProps) {
  const isOrder = mode === 'order';
  const [orderType, setOrderType] = useState('artwork');
  const [formats, setFormats] = useState<string[]>(['PDF']);
  const [error, setError] = useState<string | null>(null);

  function toggleFormat(fmt: string) {
    setFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt],
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!fd.get('design')) return setError('Design name is required');
    if (!fd.get('brief')) return setError('Please describe what you need');
    setError(null);
    const newId = `Q-2025-${String(80 + Math.floor(Math.random() * 50)).padStart(4, '0')}`;
    onSubmit?.(newId);
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-[780px] mx-auto">
      <div className="qf-card">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="qf-header">
          <span className="qf-header-dot" />
          <span className="qf-header-title">New Quote Request</span>
          <span className="qf-required-note">
            All fields marked <span style={{ color: '#c41e3a' }}>*</span> are required
          </span>
        </div>

        <div className="qf-body">

          {/* ── Section 1 — Select Order Type ──────────────────── */}
          <div className="qf-section">
            <div className="qf-section-header">
              <div className="qf-step-num">1</div>
              <span className="qf-section-title">Select Order Type</span>
            </div>

            <div className="qf-order-grid">
              {ORDER_TYPES.map(({ id, label, sub, icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setOrderType(id)}
                  className={cn('qf-order-card', orderType === id && 'active')}
                  aria-pressed={orderType === id}
                >
                  <span className="qf-order-icon">{icon}</span>
                  <div className="qf-order-label">{label}</div>
                  <div className="qf-order-sub">{sub}</div>
                </button>
              ))}
            </div>

            <div>
              <label className="fl" htmlFor="service">
                SPECIFIC SERVICE <span style={{ color: '#c41e3a' }}>*</span>
              </label>
              <select id="service" name="service" className="fi">
                <option value="">Select specific service...</option>
                {SPECIFIC_SERVICES[orderType].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Section 2 — Job Details ─────────────────────────── */}
          <div className="qf-section">
            <div className="qf-section-header">
              <div className="qf-step-num">2</div>
              <span className="qf-section-title">Job Details</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Field
                name="design"
                label="DESIGN NAME"
                required
                placeholder="e.g. Winter Collection Print"
              />
              <Field
                name="client_po"
                label="CLIENT PO / REFERENCE NO."
                placeholder="e.g. PO-2025-0042 (optional)"
              />
              <SelectField
                name="process_type"
                label="PROCESS TYPE"
                options={['Screen Printing', 'Digital Print', 'Embroidery', 'Sublimation', 'Heat Transfer']}
              />
              <SelectField
                name="complexity"
                label="DESIGN COMPLEXITY"
                defaultValue="Medium"
                options={['Simple', 'Medium', 'Complex', 'Premium']}
              />
              <Field
                name="colors"
                label="NUMBER OF COLORS"
                type="number"
                defaultValue="4"
                min={1}
                max={20}
              />
              <SelectField
                name="priority"
                label="PRIORITY"
                defaultValue="Normal"
                options={['Normal', 'Rush', 'Super Rush']}
              />
              <Field
                name="turnaround"
                label="YOUR ESTIMATED TURNAROUND (HOURS)"
                required
                type="number"
                defaultValue="8"
                min={1}
              />
              <Field
                name="budget"
                label="PROPOSED BUDGET ($)"
                labelSuffix=" (OPTIONAL)"
                type="number"
                placeholder="e.g. 150"
              />
            </div>

            <p className="qf-eta-note">Client Servicing will confirm the final ETA after review.</p>

            <div className="mb-4">
              <label className="fl" htmlFor="brief">
                DESIGN BRIEF / DESCRIPTION <span style={{ color: '#c41e3a' }}>*</span>
              </label>
              <textarea
                id="brief"
                name="brief"
                className="fi fi-ta"
                style={{ minHeight: 108 }}
                placeholder="Describe what you need — design references, brand guidelines, colour codes, fabric or substrate, intended use, anything we should know…"
              />
            </div>

            <div>
              <label className="fl">EXPECTED OUTPUT FILE FORMATS</label>
              <div className="qf-formats">
                {OUTPUT_FORMATS.map((fmt) => {
                  const checked = formats.includes(fmt);
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => toggleFormat(fmt)}
                      className={cn('qf-format-chip', checked && 'checked')}
                      aria-pressed={checked}
                    >
                      <span className="qf-format-chip-box">
                        {checked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                      </span>
                      {fmt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Section 3 — Upload Reference Files ─────────────── */}
          <div className="qf-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
            <div className="qf-section-header">
              <div className="qf-step-num">3</div>
              <span className="qf-section-title">Upload Reference Files</span>
            </div>

            <div className="qf-upload-zone">
              <div className="qf-upload-icon-wrap">
                <Upload className="w-5 h-5" aria-hidden style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="qf-upload-label">
                Drop files here or{' '}
                <span className="qf-upload-browse">browse</span>
              </p>
              <p className="qf-upload-hint">
                PDF, AI, PSD, PNG, SVG, JPG, DST, EMB — max 500 MB per file
              </p>
            </div>

            <div>
              <label className="fl">
                OR LINK TO CLOUD STORAGE (GOOGLE DRIVE, WETRANSFER, DROPBOX)
              </label>
              <input
                type="url"
                name="cloud_link"
                className="fi"
                placeholder="https://drive.google.com/..."
              />
              <p className="qf-cloud-hint">
                Use this if your files are too large to upload directly or you prefer sharing from cloud storage.
              </p>
            </div>
          </div>

          {/* ── Error ────────────────────────────────────────────── */}
          {error && (
            <div
              className="text-[12px] mt-4 px-3 py-2 rounded-md"
              style={{ background: 'rgba(196,30,58,0.08)', color: '#c41e3a' }}
              role="alert"
            >
              {error}
            </div>
          )}

          {/* ── Footer ───────────────────────────────────────────── */}
          <div className="qf-footer">
            <button type="button" className="btn qf-btn-draft">
              <Save aria-hidden className="w-4 h-4" />
              Save Draft
            </button>
            <button type="submit" className="btn qf-btn-submit">
              <Send aria-hidden className="w-4 h-4" />
              {isOrder ? 'Place Order' : 'Submit Quote Request'}
            </button>
          </div>

        </div>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  required,
  labelSuffix,
  ...rest
}: {
  name: string;
  label: string;
  required?: boolean;
  labelSuffix?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="fl" htmlFor={name}>
        {label}
        {required && <span style={{ color: '#c41e3a', marginLeft: 2 }}>*</span>}
        {labelSuffix && <span className="qf-label-suffix">{labelSuffix}</span>}
      </label>
      <input id={name} name={name} className="fi" {...rest} />
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
  ...rest
}: {
  name: string;
  label: string;
  options: string[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="fl" htmlFor={name}>{label}</label>
      <select id={name} name={name} className="fi" {...rest}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
