import * as XLSX from 'xlsx';
import { AnalysisResult, FileNode } from '../types';

export const readExcelFile = async (file: File): Promise<any[][]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        // Get raw data as array of arrays
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const generateAndDownloadExcel = (originalData: any[][], results: AnalysisResult[]) => {
  // Create a deep copy to avoid mutating state
  const newData = originalData.map(row => [...row]);

  results.forEach(res => {
    const rowIndex = res.rowId - 1; // Convert 1-based to 0-based array index
    
    // Ensure row exists
    if (!newData[rowIndex]) newData[rowIndex] = [];

    // Determine the final list of files for this row
    let finalFiles: FileNode[] = [];

    if (res.manualResolutions && res.manualResolutions.length > 0) {
      finalFiles = res.manualResolutions;
    } else if (res.matchedFile) {
      finalFiles = [res.matchedFile];
    }

    if (finalFiles.length > 0) {
      // CASE: LINK GENERATED (One or Multiple)
      
      // Excel cells (standard) only support ONE hyperlink target.
      // We will link to the FIRST file, but list ALL names in the cell text.
      
      const fileNames = finalFiles.map(f => f.name).join(", ");
      const primaryFile = finalFiles[0];
      const relativePath = primaryFile.path; 
      
      const cellValue = {
        t: 's', 
        v: finalFiles.length > 1 ? `(Múltiplos) ${fileNames}` : fileNames, // Display Text
        l: { 
            Target: relativePath, 
            Tooltip: finalFiles.length > 1 
                ? "Abre: " + primaryFile.name + ". (Outros ficheiros listados no texto)" 
                : "Abrir ficheiro local: " + primaryFile.name 
        } 
      };
      newData[rowIndex][3] = cellValue;

    } else if (res.matchStatus === 'AMBIGUOUS' && finalFiles.length === 0) {
      // CASE: AMBIGUOUS UNRESOLVED
      const candidateNames = res.candidates?.map(c => c.name).join(", ") || "";
      newData[rowIndex][3] = `AMBÍGUO: ${candidateNames}`;

    } else if (res.matchStatus === 'NOT_FOUND' && !res.isIgnored) {
      // CASE: FAILURE (And not ignored)
      newData[rowIndex][3] = "FALHA - Verificar Manualmente";
    }
    // If NO_QUERY or Ignored, we leave it blank or as is.
  });

  const ws = XLSX.utils.aoa_to_sheet(newData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Links Gerados");
  
  XLSX.writeFile(wb, "Analise_Com_Links.xlsx");
};