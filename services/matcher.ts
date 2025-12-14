import { AnalysisResult, FileNode, ROW_MAPPINGS } from '../types';

// Regex to find text between quotes (supports normal and smart quotes)
const QUOTE_REGEX = /["“]([^"”]+)["”]/g;

// Regex for dates DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
const DATE_REGEX = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b|\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g;

// Stop words to ignore. 
const IGNORED_TOKENS = new Set([
  // Email prefixes 
  'fw', 'fwd', 're', 'enc', 'tr', 'subject', 'assunto', 'encaminhado', 'copy', 'copia',
  // Common stop words (PT/EN)
  'de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'os', 'as', 'em', 'na', 'no', 'nas', 'nos', 'com', 'para', 'por',
  'of', 'the', 'and', 'in', 'at', 'to', 'for', 'with', 'by', 'from'
]);

export const getTargetFolderForRow = (rowIndex: number): string | null => {
  const mapping = ROW_MAPPINGS.find(m => rowIndex >= m.start && rowIndex <= m.end);
  return mapping ? mapping.folder : null;
};

export const extractMetadata = (cellContent: string) => {
  const queries: string[] = [];
  const dates: string[] = [];
  let match;

  // Extract Dates
  // We keep extracting dates to help with scoring IF a quote is found, 
  // but the presence of a date alone will not trigger a search if queries remains empty.
  DATE_REGEX.lastIndex = 0;
  while ((match = DATE_REGEX.exec(cellContent)) !== null) {
    dates.push(match[0]); 
  }

  // Extract Quotes
  QUOTE_REGEX.lastIndex = 0;
  while ((match = QUOTE_REGEX.exec(cellContent)) !== null) {
    if (match[1] && match[1].trim().length > 0) {
      queries.push(match[1].trim());
    }
  }

  // PREVIOUSLY: There was a fallback here to use the whole text if no quotes were found.
  // REMOVED: Now we strictly only return content found in quotes.

  return { queries, dates };
};

// Helper to create date permutations (e.g., 20-04-2010 -> 20100420, 2010-04-20)
// This helps match Excel dates to File naming conventions
const getDatePermutations = (dateStr: string): string[] => {
  // Normalize separators to simple space or empty for permutation generation
  const parts = dateStr.split(/[\/\-\.\s]/);
  
  // Filter out empty parts in case of double spaces
  const cleanParts = parts.filter(p => p.length > 0);
  
  if (cleanParts.length !== 3) return [dateStr];

  let day, month, year;
  
  // Naive heuristics for date parsing
  if (cleanParts[0].length === 4) { // YYYY-MM-DD
    year = cleanParts[0]; month = cleanParts[1]; day = cleanParts[2];
  } else { // DD-MM-YYYY (PT standard)
    day = cleanParts[0]; month = cleanParts[1]; year = cleanParts[2];
  }

  // Pad numbers
  day = day.padStart(2, '0');
  month = month.padStart(2, '0');

  return [
    `${day}${month}${year}`,    // 20042010
    `${year}${month}${day}`,    // 20100420
    `${day}-${month}-${year}`,  // 20-04-2010
    `${year}-${month}-${day}`,  // 2010-04-20
    `${year}_${month}_${day}`,  // 2010_04_20
    `${year}.${month}.${day}`,  // 2010.04.20
    `${day}_${month}_${year}`,  // 20_04_2010
    `${day}.${month}.${year}`,  // 20.04.2010
    `${day} ${month} ${year}`   // 20 04 2010
  ];
};

const tokenize = (str: string): string[] => {
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    // Replace non-alphanumeric chars AND underscores with spaces.
    // This allows "RE_Mapas" to become "re" "mapas" and "RE: Mapas" to become "re" "mapas"
    .replace(/[\W_]+/g, ' ') 
    .split(/\s+/)
    .filter(t => t.length > 0)
    .filter(t => !IGNORED_TOKENS.has(t));
};

export const findBestMatch = (
  queries: string[], 
  dates: string[], 
  availableFiles: FileNode[]
): { status: AnalysisResult['matchStatus'], file?: FileNode, candidates?: FileNode[] } => {
  
  if (queries.length === 0) return { status: 'NO_QUERY' };

  let allCandidates: { file: FileNode, score: number }[] = [];

  // Pre-calculate date permutations for the search
  const dateSearchTerms = dates.flatMap(d => getDatePermutations(d));

  for (const query of queries) {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) continue;

    for (const file of availableFiles) {
      const fileTokens = tokenize(file.name);
      if (fileTokens.length === 0) continue;

      // Calculate Intersection
      const intersection = queryTokens.filter(qt => fileTokens.includes(qt));
      const matchCount = intersection.length;

      if (matchCount === 0) continue;

      // Base Scores
      const fileCoverage = matchCount / fileTokens.length;
      const queryCoverage = matchCount / queryTokens.length;
      let score = Math.max(fileCoverage, queryCoverage);
      
      // --- CRITICAL BOOSTS ---

      // 1. Date Matching (Strong Signal for Emails)
      // Checks if the file name contains the date mentioned in the Excel
      const cleanFileName = file.name.replace(/[^0-9]/g, '');
      const dateMatch = dateSearchTerms.some(term => {
        const cleanTerm = term.replace(/[^0-9]/g, '');
        // We check if the full date string exists inside the filename
        return cleanFileName.includes(cleanTerm) && cleanTerm.length >= 6; 
      });
      
      if (dateMatch) {
        score += 0.40; // Increased boost for date match as requested
      }

      // 2. Extension Specificity
      // If query has 'image.tif', boost files ending in .tif
      const queryExt = query.split('.').pop()?.toLowerCase();
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      
      // Simple check: if query token actually mentions the extension
      if (queryExt && fileExt && queryExt === fileExt && queryExt.length > 2) {
         score += 0.20; 
      }

      // 3. Exact Sequence Bonus
      // If "mapas finais" appears exactly in "RE_Mapas_Finais.pdf"
      // Normalized check
      const normQuery = query.toLowerCase().replace(/[\W_]+/g, '');
      const normFile = file.name.toLowerCase().replace(/[\W_]+/g, '');
      if (normFile.includes(normQuery)) {
        score += 0.15;
      }

      // 4. Thresholding
      if (score >= 0.55) { // Slightly lower threshold to catch "fuzzy" underscore matches
        allCandidates.push({ file, score });
      }
    }
  }

  // Deduplicate
  const uniqueCandidates = new Map<string, { file: FileNode, score: number }>();
  allCandidates.forEach(c => {
    const existing = uniqueCandidates.get(c.file.path);
    if (!existing || c.score > existing.score) {
      uniqueCandidates.set(c.file.path, c);
    }
  });

  const sortedCandidates = Array.from(uniqueCandidates.values())
    .sort((a, b) => b.score - a.score);

  if (sortedCandidates.length === 0) {
    return { status: 'NOT_FOUND' };
  }

  const best = sortedCandidates[0];
  const runnerUp = sortedCandidates[1];

  // Relaxed winner condition: if score is very high (> 1.2 due to bonuses), it's a winner
  // Or if it beats the runner up by a margin
  if (best.score > 1.2 || !runnerUp || (best.score > runnerUp.score + 0.1)) {
    return { status: 'FOUND', file: best.file };
  }

  return { 
    status: 'AMBIGUOUS', 
    candidates: sortedCandidates.slice(0, 5).map(c => c.file) 
  };
};