import React, { useState, useMemo } from 'react';
import { FileUploader } from './components/FileUploader';
import { ResultsTable } from './components/ResultsTable';
import { readExcelFile, generateAndDownloadExcel } from './services/excelHelper';
import { getTargetFolderForRow, extractMetadata, findBestMatch } from './services/matcher';
import { resolveAmbiguityWithAI } from './services/geminiService';
import { AppStep, FileNode, AnalysisResult } from './types';
import { FileSearch, Download, RefreshCw, AlertOctagon, Save } from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [rawExcelData, setRawExcelData] = useState<any[][]>([]);
  const [fileMap, setFileMap] = useState<Map<string, FileNode[]>>(new Map());
  const [folderFileCount, setFolderFileCount] = useState(0);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [projectLoaded, setProjectLoaded] = useState(false);

  // Flattened list of all files for global search
  const allFiles = useMemo(() => {
    const files: FileNode[] = [];
    fileMap.forEach((nodes) => {
        files.push(...nodes);
    });
    return files;
  }, [fileMap]);

  // Check for API key on mount (optional feature check)
  React.useEffect(() => {
    if (!process.env.API_KEY) {
      setApiKeyMissing(true);
    }
  }, []);

  const handleFolderUpload = (files: FileList) => {
    const map = new Map<string, FileNode[]>();
    const allFilesMap = new Map<string, File>(); // Map relative path to File object for reconciliation
    let count = 0;

    Array.from(files).forEach(file => {
      allFilesMap.set(file.webkitRelativePath, file);

      // path looks like "RootName/Ponto 1/subfolder/file.ext"
      const pathParts = file.webkitRelativePath.split('/');
      const pontoFolder = pathParts.find(p => p.toLowerCase().startsWith('ponto '));
      
      if (pontoFolder) {
        const key = pontoFolder;
        const existing = map.get(key) || [];
        existing.push({
          name: file.name,
          path: file.webkitRelativePath,
          lastModified: file.lastModified,
          fileObject: file
        });
        map.set(key, existing);
        count++;
      }
    });

    setFileMap(map);
    setFolderFileCount(count);

    // RECONCILIATION: If a project was loaded, we need to re-attach the real File objects to the results
    if (projectLoaded && results.length > 0) {
      reconcileFiles(results, allFilesMap);
    }
  };

  const reconcileFiles = (currentResults: AnalysisResult[], fileSource: Map<string, File>) => {
    const updatedResults = currentResults.map(res => {
      // Re-attach to matchedFile
      if (res.matchedFile && !res.matchedFile.fileObject) {
        const f = fileSource.get(res.matchedFile.path);
        if (f) res.matchedFile.fileObject = f;
      }
      
      // Re-attach to manualResolutions (Array)
      if (res.manualResolutions) {
        res.manualResolutions.forEach(mr => {
            if (!mr.fileObject) {
                const f = fileSource.get(mr.path);
                if (f) mr.fileObject = f;
            }
        });
      }

      // Re-attach to candidates
      if (res.candidates) {
        res.candidates.forEach(c => {
          if (!c.fileObject) {
            const f = fileSource.get(c.path);
            if (f) c.fileObject = f;
          }
        });
      }
      return res;
    });
    setResults(updatedResults);
    // If we have results and now files, we can probably go to Results screen if Excel is also there (or optional)
    if (updatedResults.length > 0) {
       setStep(AppStep.RESULTS);
    }
  };

  const processExcel = async () => {
    // If project is loaded, we skip reprocessing the excel file and just check if we are ready to view results.
    if (projectLoaded) {
        if (folderFileCount === 0) {
            alert("Para retomar o projeto, é obrigatório carregar a pasta com os ficheiros originais.");
            return;
        }
        // If folders are loaded, reconcileFiles should have already triggered navigation, 
        // but if not, we force it here if results exist.
        if (results.length > 0) {
             setStep(AppStep.RESULTS);
        } else {
             alert("O projeto carregado não contém resultados. Por favor inicie um novo projeto.");
        }
        return;
    }

    if (!excelFile || fileMap.size === 0) return;
    setIsProcessing(true);
    setStep(AppStep.PROCESSING);

    try {
      const data = await readExcelFile(excelFile);
      setRawExcelData(data);
      
      const analysisResults: AnalysisResult[] = [];

      for (let i = 0; i < data.length; i++) {
        const rowNum = i + 1; // 1-based index
        const targetFolder = getTargetFolderForRow(rowNum);

        // Column C is index 2
        const contentC = data[i][2]; 

        if (targetFolder && typeof contentC === 'string') {
          const { queries, dates } = extractMetadata(contentC);
          
          if (queries.length > 0) {
            // Get files for this Ponto
            const filesInFolder = fileMap.get(targetFolder) || [];
            
            // Perform match
            const matchResult = findBestMatch(queries, dates, filesInFolder);
            
            analysisResults.push({
              rowId: rowNum,
              originalContent: contentC,
              targetFolder,
              extractedQueries: queries,
              extractedDates: dates,
              matchStatus: matchResult.status,
              matchedFile: matchResult.file,
              candidates: matchResult.candidates
            });
          } else {
             // Record as no query but valid row range
             analysisResults.push({
              rowId: rowNum,
              originalContent: contentC,
              targetFolder,
              extractedQueries: [],
              extractedDates: dates,
              matchStatus: 'NO_QUERY'
            });
          }
        }
      }

      setResults(analysisResults);
      setStep(AppStep.RESULTS);

    } catch (e) {
      console.error(e);
      alert("Erro ao processar ficheiro Excel.");
      setStep(AppStep.UPLOAD);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateResult = (updatedResult: AnalysisResult) => {
    setResults(prev => prev.map(r => r.rowId === updatedResult.rowId ? updatedResult : r));
  };

  const handleResolveAI = async (result: AnalysisResult) => {
    if (!result.candidates || result.candidates.length === 0) return;
    
    setIsProcessing(true);
    const bestFileName = await resolveAmbiguityWithAI(result.originalContent, result.candidates);
    setIsProcessing(false);

    if (bestFileName) {
      const matched = result.candidates.find(c => c.name === bestFileName);
      if (matched) {
        handleUpdateResult({
           ...result, 
           manualResolutions: [matched], // Set as array
           matchStatus: 'FOUND' // Auto-move to found when AI resolves
        });
      } else {
        alert("A IA sugeriu um nome que não foi encontrado na lista original.");
      }
    } else {
      alert("A IA não conseguiu determinar uma correspondência clara.");
    }
  };

  const handleExport = () => {
    generateAndDownloadExcel(rawExcelData, results);
  };

  const handleSaveProject = () => {
    // Serialize results. Note: File objects are not serializable and will be lost.
    // We rely on paths to reconnect them later.
    const projectData = {
        timestamp: new Date().toISOString(),
        rawExcelData, // Save excel data if needed, though usually large. 
        results
    };
    
    const jsonString = JSON.stringify(projectData, (key, value) => {
        if (key === 'fileObject') return undefined;
        return value;
    }, 2);

    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `projeto_links_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target?.result as string);
            if (json.results && Array.isArray(json.results)) {
                
                // Migrate legacy manualResolution to array if loading old save
                const migratedResults = json.results.map((r: any) => {
                    if (r.manualResolution && (!r.manualResolutions || r.manualResolutions.length === 0)) {
                        r.manualResolutions = [r.manualResolution];
                    }
                    
                    // IMPORTANT: If a row has manual resolutions, force status to FOUND
                    if (r.manualResolutions && r.manualResolutions.length > 0) {
                        r.matchStatus = 'FOUND';
                    }

                    return r;
                });

                setResults(migratedResults);
                if (json.rawExcelData) setRawExcelData(json.rawExcelData);
                
                // Set flag so we know we are waiting for files
                setProjectLoaded(true);
                
                // If user hasn't uploaded files yet, stay on Upload but show progress
                alert("Projeto carregado com sucesso!\n\nIMPORTANTE: Por favor, carregue novamente a Pasta Raiz com os ficheiros para que a aplicação possa restabelecer as ligações físicas.");
                
                setStep(AppStep.UPLOAD);
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao ler ficheiro de projeto.");
        }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <FileSearch size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Excel Link Manager</h1>
            <p className="text-xs text-slate-500">Automatização de Hiperligações Locais</p>
          </div>
        </div>
        
        <div className="flex gap-2">
            {step === AppStep.RESULTS && (
            <>
                <button 
                    onClick={handleSaveProject}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center shadow-sm transition-all text-sm font-medium border border-slate-300"
                >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Projeto
                </button>
                <button 
                    onClick={handleExport}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-all text-sm font-medium"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Excel
                </button>
            </>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-6 relative">
        
        {step === AppStep.UPLOAD && (
          <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="text-center max-w-2xl">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Vamos preparar os seus ficheiros</h2>
              <p className="text-slate-600">
                Selecione se pretende retomar um trabalho anterior ou iniciar um novo.
              </p>
            </div>
            
            <FileUploader 
              onExcelUpload={setExcelFile} 
              onFolderUpload={handleFolderUpload}
              onLoadProject={handleLoadProject}
              excelFile={excelFile}
              folderCount={folderFileCount}
              projectLoaded={projectLoaded}
            />

            <button 
              disabled={(!excelFile && !projectLoaded) || folderFileCount === 0}
              onClick={processExcel}
              className={`px-8 py-3 rounded-xl font-semibold text-lg shadow-lg transition-all transform hover:scale-105
                ${((!excelFile && !projectLoaded) || folderFileCount === 0) 
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              {projectLoaded ? "Retomar Trabalho (Verificar Ficheiros)" : "Iniciar Análise"}
            </button>
          </div>
        )}

        {step === AppStep.PROCESSING && (
          <div className="flex flex-col items-center justify-center h-full">
            <RefreshCw className="w-16 h-16 text-blue-500 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-slate-800">A processar ficheiros...</h2>
            <p className="text-slate-500">A analisar {folderFileCount} documentos.</p>
          </div>
        )}

        {step === AppStep.RESULTS && (
          <div className="h-full flex flex-col gap-4">
             {apiKeyMissing && (
               <div className="bg-amber-50 border border-amber-200 p-3 rounded-md flex items-start gap-3 text-sm text-amber-800 shrink-0">
                 <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0" />
                 <div>
                   <span className="font-bold">Aviso API Key:</span> A funcionalidade de IA Gemini não está disponível. 
                   A correspondência algorítmica padrão funcionará normalmente.
                 </div>
               </div>
             )}
            <ResultsTable 
              results={results} 
              allFiles={allFiles} 
              onResolveWithAI={handleResolveAI}
              onUpdateResult={handleUpdateResult}
              isResolving={isProcessing}
            />
          </div>
        )}
      </main>

      {/* Overlay Loading for AI ops */}
      {isProcessing && step === AppStep.RESULTS && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-2xl border flex flex-col items-center">
            <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mb-2" />
            <p className="font-medium text-slate-700">Consultando Gemini AI...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;