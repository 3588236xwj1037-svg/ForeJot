export type NoteColor = "paper";
export type ChineseFont = "simsun" | "kaiti" | "fangsong" | "simhei";
export type EnglishFont = "times" | "segoe" | "arial" | "verdana";
export type AppFont = ChineseFont | EnglishFont;
export type BodyFontSize = "small1" | "second" | "small2" | "third" | "small3" | "fourth" | "small4" | "fifth";
export type ExportFormat = "pdf" | "word" | "latex" | "html" | "markdown";
export type UiLanguage = "zh" | "en";
export type UiLanguageSource = "installer" | "user";

export interface Note {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  createdAt: number;
  updatedAt: number;
}

export interface NoteAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface MarkdownImportResult {
  body: string;
  attachments: Record<string, NoteAttachment>;
  unresolvedLocalImages?: Array<{ source: string; alt: string }>;
}

export interface AppState {
  notes: Note[];
  attachments: Record<string, NoteAttachment>;
  selectedId: string | null;
  settings: {
    alwaysOnTop: boolean;
    launchAtLogin: boolean;
    sidebarCollapsed: boolean;
    sidebarWidth: number;
    opacity: number;
    chineseFontFamily: ChineseFont;
    englishFontFamily: EnglishFont;
    deleteWithBackspace: boolean;
    confirmBeforeDelete: boolean;
    exportFormat: ExportFormat;
    uiLanguage: UiLanguage;
    uiLanguageSource: UiLanguageSource;
    installerLanguage: UiLanguage;
    installerLanguageGeneration: number | null;
  };
}

export interface ExportRequest {
  format: ExportFormat;
  title: string;
  html: string;
  markdown: string;
  latex: string;
  assets: { fileName: string; dataUrl: string }[];
}

export interface DesktopApi {
  loadState: () => Promise<AppState>;
  saveState: (state: AppState) => Promise<boolean>;
  setAlwaysOnTop: (enabled: boolean) => Promise<boolean>;
  setLaunchAtLogin: (enabled: boolean) => Promise<boolean>;
  minimize: () => void;
  hide: () => void;
  isMaximized: () => Promise<boolean>;
  toggleMaximize: () => Promise<boolean>;
  onMaximizeChange: (callback: (maximized: boolean) => void) => () => void;
  setUiLanguage: (language: UiLanguage) => Promise<UiLanguage>;
  exportFile: (request: ExportRequest) => Promise<{ cancelled: boolean; path?: string; error?: string }>;
  openExternal: (url: string) => Promise<boolean>;
  readClipboardText: () => Promise<string>;
  importMarkdownFile?: (file: File) => Promise<MarkdownImportResult>;
  onCreateNote: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
