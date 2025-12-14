export interface RowMapping {
  start: number;
  end: number;
  folder: string;
}

// Maps specific Excel row ranges to Folder names as per user requirement
export const ROW_MAPPINGS: RowMapping[] = [
  { start: 4, end: 10, folder: "Ponto 1" },
  { start: 13, end: 41, folder: "Ponto 2" },
  { start: 45, end: 286, folder: "Ponto 3" },
  { start: 289, end: 312, folder: "Ponto 4" },
  { start: 316, end: 532, folder: "Ponto 5" },
  { start: 882, end: 921, folder: "Ponto 6" },
  { start: 924, end: 1478, folder: "Ponto 7" },
  { start: 1481, end: 1782, folder: "Ponto 8" },
  { start: 1784, end: 2194, folder: "Ponto 9" },
  // Missing Ponto 10, 11 in instructions, skipping to 12
  { start: 2199, end: 2443, folder: "Ponto 12" },
  { start: 2446, end: 2500, folder: "Ponto 13" },
];

export interface FileNode {
  name: string;
  path: string; // Relative path from root upload
  lastModified: number;
  fileObject?: File; // Optional because it is lost during JSON save/load until rehydration
}

export interface AnalysisResult {
  rowId: number; // 1-based index matches Excel row
  originalContent: string;
  targetFolder: string | null;
  extractedQueries: string[];
  extractedDates: string[]; // DD/MM/YYYY
  matchStatus: 'FOUND' | 'NOT_FOUND' | 'AMBIGUOUS' | 'NO_QUERY';
  matchedFile?: FileNode;
  candidates?: FileNode[]; // For ambiguous matches
  aiSuggestion?: string;
  
  // New fields for manual resolution (Support multiple files)
  manualResolutions?: FileNode[]; 
  isIgnored?: boolean; // If true, do not report as error in Excel
}

export enum AppStep {
  UPLOAD = 'UPLOAD',
  PREVIEW = 'PREVIEW',
  PROCESSING = 'PROCESSING',
  RESULTS = 'RESULTS'
}