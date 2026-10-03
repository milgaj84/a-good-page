import type { KeyValueStore } from './ports';

export const EXPORT_FORMATS = ['pdf', 'docx', 'epub', 'md'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const FORMAT_INFO: Record<ExportFormat, { label: string; extension: string; button: string }> = {
  pdf: { label: 'PDF', extension: 'pdf', button: 'Export PDF' },
  docx: { label: 'Word (.docx)', extension: 'docx', button: 'Export Word' },
  epub: { label: 'E-book (.epub)', extension: 'epub', button: 'Export E-book' },
  md: { label: 'Markdown (.md)', extension: 'md', button: 'Export Markdown' },
};

export interface ExportOptions {
  format: ExportFormat;
  titlePage: boolean;
  contents: boolean;
  pageNumbers: boolean;
  /** Empty means "use the page or project name". Not remembered between exports. */
  title: string;
  subtitle: string;
  author: string;
}

export const DEFAULT_EXPORT_OPTIONS: Readonly<ExportOptions> = Object.freeze({
  format: 'pdf', titlePage: false, contents: false, pageNumbers: true, title: '', subtitle: '', author: '',
});

const MAX_TEXT = 200;
const clean = (value: unknown): string => (typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, MAX_TEXT) : '');
const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

export function sanitizeExportOptions(raw: unknown): ExportOptions {
  const o = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_EXPORT_OPTIONS;
  return {
    format: (EXPORT_FORMATS as readonly unknown[]).includes(o.format) ? (o.format as ExportFormat) : d.format,
    titlePage: flag(o.titlePage, d.titlePage),
    contents: flag(o.contents, d.contents),
    pageNumbers: flag(o.pageNumbers, d.pageNumbers),
    title: clean(o.title),
    subtitle: clean(o.subtitle),
    author: clean(o.author),
  };
}

/** The title shown on the title page and in the file: what was typed, else the page or project name. */
export function effectiveTitle(options: ExportOptions, fallback: string): string {
  return options.title.trim() || fallback;
}

export const EXPORT_OPTIONS_KEY = 'agp.export.options.v1';

/** Remembers how you like your exports: format, title page, contents, page numbers and author. */
export class ExportOptionsStore {
  constructor(private readonly store: KeyValueStore) {}

  load(): ExportOptions {
    try { return sanitizeExportOptions(JSON.parse(this.store.get(EXPORT_OPTIONS_KEY) ?? 'null')); }
    catch { return { ...DEFAULT_EXPORT_OPTIONS }; }
  }

  save(options: ExportOptions): void {
    const { title: _title, subtitle: _subtitle, ...remembered } = options;
    this.store.set(EXPORT_OPTIONS_KEY, JSON.stringify(remembered));
  }
}
