import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnalysisResult, FileNode } from '../types';
import { CheckCircle, AlertTriangle, XCircle, Wand2, Filter, Copy, Check, FileWarning, EyeOff, Eye, Search, Plus, X, FolderCheck } from 'lucide-react';

interface Props {
  results: AnalysisResult[];
  allFiles: FileNode[]; // Passed from App to allow global search
  onResolveWithAI: (result: AnalysisResult) => void;
  onUpdateResult: (result: AnalysisResult) => void;
  isResolving: boolean;
}

type FilterType = 'ALL' | 'FOUND' | 'AMBIGUOUS' | 'NOT_FOUND' | 'IGNORED';

// Helper component to highlight text
const HighlightedText: React.FC<{ text: string; highlights: string[] }> = ({ text, highlights }) => {
  if (!text) return null;
  if (!highlights || highlights.length === 0) return <span className="text-slate-800">{text}</span>;

  const parts = text.split(new RegExp(`(${highlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'));

  return (
    <span className="text-slate-800">
      {parts.map((part, i) => {
        const isHighlight = highlights.some(h => h.toLowerCase() === part.toLowerCase());
        return isHighlight ? (
          <span key={i} className="bg-yellow-200 text-slate-900 font-medium rounded px-0.5 border border-yellow-300">
            {part}
          </span>
        ) : (
          part
        );
      })}
    </span>
  );
};

// --- New Component: Multi-File Search & Select ---
const FileMultiSelect: React.FC<{
  currentSelections: FileNode[] | undefined;
  candidates: FileNode[] | undefined;
  allFiles: FileNode[];
  targetFolder: string | null;
  onUpdate: (files: FileNode[]) => void;
  status: string;
}> = ({ currentSelections = [], candidates = [], allFiles, targetFolder, onUpdate, status }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddFile = (file: FileNode) => {
    // Prevent duplicates
    if (!currentSelections.some(f => f.path === file.path)) {
      onUpdate([...currentSelections, file]);
    }
    setSearchTerm("");
    setShowDropdown(false);
  };

  const handleRemoveFile = (path: string) => {
    onUpdate(currentSelections.filter(f => f.path !== path));
  };

  // Helper to check if file belongs to target folder
  const isTargetFolderFile = (file: FileNode) => {
    if (!targetFolder) return false;
    // Simple check: does the path include the folder name (e.g. "Ponto 1")
    return file.path.includes(targetFolder);
  };

  // Filter & Sort Logic:
  const filteredOptions = useMemo(() => {
    if (searchTerm.length === 0) {
        return candidates; // Show initial candidates if no search
    }

    const lowerTerm = searchTerm.toLowerCase();
    
    // 1. Filter by name
    const matches = allFiles.filter(f => f.name.toLowerCase().includes(lowerTerm));

    // 2. Sort: Target Folder files first, then alphabetical
    return matches.sort((a, b) => {
        const aInTarget = isTargetFolderFile(a);
        const bInTarget = isTargetFolderFile(b);

        if (aInTarget && !bInTarget) return -1;
        if (!aInTarget && bInTarget) return 1;
        
        return a.name.localeCompare(b.name);
    }).slice(0, 20); // Limit to 20 results for performance
  }, [searchTerm, allFiles, candidates, targetFolder]);

  return (
    <div className="space-y-2 relative w-full min-w-[200px]">
      
      {/* 1. Selected Chips */}
      <div className="flex flex-wrap gap-1 mb-1">
        {currentSelections.map(f => (
          <span key={f.path} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800 border border-blue-200 max-w-full break-all">
            <span className="truncate max-w-[150px]">{f.name}</span>
            <button onClick={() => handleRemoveFile(f.path)} className="ml-1 text-blue-500 hover:text-blue-700">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* 2. Search Input */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center border border-slate-300 rounded bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
          <Search className="w-4 h-4 text-slate-400 ml-2" />
          <input 
            type="text" 
            placeholder={currentSelections.length > 0 ? "Adicionar mais..." : "Pesquisar em todas as pastas..."}
            className="w-full p-2 text-xs outline-none bg-transparent"
            value={searchTerm}
            onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />
        </div>

        {/* 3. Dropdown Results */}
        {showDropdown && (
          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded shadow-lg z-50 max-h-60 overflow-y-auto">
             {searchTerm.length === 0 && candidates && candidates.length > 0 && (
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 bg-slate-50 uppercase tracking-wider">
                    Sugestões Iniciais
                </div>
             )}
             
             {filteredOptions && filteredOptions.length > 0 ? (
                 filteredOptions.map(f => {
                   const isSelected = currentSelections.some(s => s.path === f.path);
                   if (isSelected) return null; // Hide already selected
                   
                   const isTarget = isTargetFolderFile(f);

                   return (
                     <button
                        key={f.path}
                        className={`w-full text-left px-3 py-2 text-xs border-b border-slate-50 last:border-0 flex flex-col group transition-colors
                            ${isTarget ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-blue-50 text-slate-700'}`}
                        onClick={() => handleAddFile(f)}
                     >
                        <div className="flex items-center justify-between w-full">
                            <span className={`truncate font-medium ${isTarget ? 'text-green-800' : 'text-slate-700'}`}>
                                {f.name}
                            </span>
                            <Plus className={`w-3 h-3 opacity-0 group-hover:opacity-100 ${isTarget ? 'text-green-600' : 'text-blue-500'}`} />
                        </div>
                        
                        {/* Subtext showing path, especially useful if searching global */}
                        <div className="flex items-center gap-1 mt-0.5">
                            {isTarget && <FolderCheck className="w-3 h-3 text-green-600" />}
                            <span className={`truncate text-[10px] ${isTarget ? 'text-green-600 font-semibold' : 'text-slate-400'}`}>
                                {isTarget ? "Pasta Alvo" : f.path}
                            </span>
                        </div>
                     </button>
                   );
                 })
             ) : (
                <div className="p-3 text-xs text-slate-400 text-center">
                    {searchTerm ? "Nenhum ficheiro encontrado." : "Escreva para pesquisar em todas as pastas..."}
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};


export const ResultsTable: React.FC<Props> = ({ results, allFiles, onResolveWithAI, onUpdateResult, isResolving }) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [copied, setCopied] = useState(false);
  const [copiedFailures, setCopiedFailures] = useState(false);

  const validResults = results.filter(r => r.matchStatus !== 'NO_QUERY');
  
  // Filter logic: IGNORED is now a separate "bucket"
  const filteredResults = validResults.filter(r => {
    if (activeFilter === 'IGNORED') return r.isIgnored;
    
    // For other filters, exclude ignored items
    if (r.isIgnored) return false;

    if (activeFilter === 'ALL') return true;
    return r.matchStatus === activeFilter;
  });

  const handleCopyQuotedText = () => {
    const textList = filteredResults
      .flatMap(r => r.extractedQueries.map(q => `"${q}"`)) 
      .join('\n');

    if (!textList) {
      alert("Não existem textos citados na seleção atual.");
      return;
    }

    navigator.clipboard.writeText(textList).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyFailuresOriginal = () => {
    const failures = validResults.filter(r => r.matchStatus === 'NOT_FOUND' && !r.isIgnored);
    const textList = failures.map(r => r.originalContent).join('\n');

    if (!textList) {
      alert("Não existem itens com falha para copiar.");
      return;
    }

    navigator.clipboard.writeText(textList).then(() => {
      setCopiedFailures(true);
      setTimeout(() => setCopiedFailures(false), 2000);
    });
  };

  // Logic to handle update from the multi-select component
  const handleSelectionUpdate = (result: AnalysisResult, files: FileNode[]) => {
    // We DO NOT auto-update the status to FOUND anymore unless it was already found.
    // We just update the manualResolutions list.
    // The user must click the "Validate" button to change status.
    
    onUpdateResult({
      ...result,
      manualResolutions: files,
    });
  };

  const confirmMatch = (result: AnalysisResult) => {
    onUpdateResult({
        ...result,
        matchStatus: 'FOUND',
        isIgnored: false
    });
  };

  const toggleIgnore = (result: AnalysisResult) => {
    onUpdateResult({
      ...result,
      isIgnored: !result.isIgnored
    });
  };

  const getTabClass = (type: FilterType) => {
    const base = "px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ";
    if (activeFilter === type) {
      return base + "border-blue-500 text-blue-600 bg-blue-50";
    }
    return base + "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50";
  };

  // Calculate counts based on the new logic (Ignored are separate)
  const counts = {
    ALL: validResults.filter(r => !r.isIgnored).length,
    FOUND: validResults.filter(r => r.matchStatus === 'FOUND' && !r.isIgnored).length,
    AMBIGUOUS: validResults.filter(r => r.matchStatus === 'AMBIGUOUS' && !r.isIgnored).length,
    NOT_FOUND: validResults.filter(r => r.matchStatus === 'NOT_FOUND' && !r.isIgnored).length,
    IGNORED: validResults.filter(r => r.isIgnored).length,
  };

  return (
    <div className="w-full bg-white rounded-lg shadow border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Header Controls */}
      <div className="bg-white border-b border-slate-200">
        <div className="p-4 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Resultados
          </h3>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopyQuotedText}
              disabled={filteredResults.length === 0}
              className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-all shadow-sm
                ${copied 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'}`}
            >
              {copied ? <Check className="w-3 h-3 mr-2" /> : <Copy className="w-3 h-3 mr-2" />}
              {copied ? "Copiado!" : "Copiar Textos (Filtro Atual)"}
            </button>

            <button
              onClick={handleCopyFailuresOriginal}
              disabled={counts.NOT_FOUND === 0}
              className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-all shadow-sm
                ${copiedFailures 
                  ? 'bg-red-100 text-red-800 border border-red-200' 
                  : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'}`}
            >
              {copiedFailures ? <Check className="w-3 h-3 mr-2" /> : <FileWarning className="w-3 h-3 mr-2" />}
              {copiedFailures ? "Lista de Falhas Copiada!" : "Copiar Originais (Falhas)"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-2 overflow-x-auto">
          <button onClick={() => setActiveFilter('ALL')} className={getTabClass('ALL')}>
            Todos <span className="bg-slate-200 px-2 rounded-full text-xs text-slate-700 ml-1">{counts.ALL}</span>
          </button>
          <button onClick={() => setActiveFilter('FOUND')} className={getTabClass('FOUND')}>
            <CheckCircle className="w-4 h-4 text-green-500" />
            Encontrados <span className="bg-green-100 px-2 rounded-full text-xs text-green-700 ml-1">{counts.FOUND}</span>
          </button>
          <button onClick={() => setActiveFilter('AMBIGUOUS')} className={getTabClass('AMBIGUOUS')}>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Ambíguos <span className="bg-amber-100 px-2 rounded-full text-xs text-amber-700 ml-1">{counts.AMBIGUOUS}</span>
          </button>
          <button onClick={() => setActiveFilter('NOT_FOUND')} className={getTabClass('NOT_FOUND')}>
            <XCircle className="w-4 h-4 text-red-500" />
            Falhas <span className="bg-red-100 px-2 rounded-full text-xs text-red-700 ml-1">{counts.NOT_FOUND}</span>
          </button>
          <button onClick={() => setActiveFilter('IGNORED')} className={getTabClass('IGNORED')}>
            <EyeOff className="w-4 h-4 text-slate-500" />
            Ignorados <span className="bg-slate-200 px-2 rounded-full text-xs text-slate-700 ml-1">{counts.IGNORED}</span>
          </button>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm text-left relative">
          <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-3 w-16 text-center">Linha</th>
              <th className="p-3 w-24">Pasta</th>
              <th className="p-3">Conteúdo (Coluna C)</th>
              <th className="p-3 w-32">Estado</th>
              <th className="p-3 min-w-[300px]">Ficheiro(s) Selecionado(s) / Pesquisa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredResults.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center">
                    <Filter className="w-8 h-8 mb-2 opacity-20" />
                    <p>Nenhum resultado encontrado para o filtro "{activeFilter}".</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredResults.map((res) => (
                <tr key={res.rowId} className={`hover:bg-slate-50 transition-colors ${res.isIgnored ? 'bg-slate-50' : ''}`}>
                  <td className="p-3 text-center text-slate-500 font-mono border-r border-slate-100">{res.rowId}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold whitespace-nowrap border border-blue-100">
                      {res.targetFolder || "N/A"}
                    </span>
                  </td>
                  <td className="p-3 max-w-md">
                     <div className={`text-sm font-mono p-2 rounded border shadow-sm leading-relaxed whitespace-pre-wrap break-words
                         ${res.isIgnored ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white border-slate-100'}`}>
                        <HighlightedText text={res.originalContent} highlights={res.extractedQueries} />
                     </div>
                  </td>
                  <td className="p-3">
                    {res.isIgnored ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600"><EyeOff className="w-3 h-3 mr-1"/> Ignorado</span>
                    ) : (
                      <>
                        {res.matchStatus === 'FOUND' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> OK</span>}
                        {res.matchStatus === 'AMBIGUOUS' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"><AlertTriangle className="w-3 h-3 mr-1"/> Ambíguo</span>}
                        {res.matchStatus === 'NOT_FOUND' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1"/> Falha</span>}
                      </>
                    )}
                  </td>
                  <td className="p-3 text-slate-600 font-mono text-xs align-top">
                    <div className="flex flex-col gap-2">
                        
                        {/* Auto Match Display (only if no manual override and Found) */}
                        {(!res.manualResolutions || res.manualResolutions.length === 0) && res.matchStatus === 'FOUND' && res.matchedFile && (
                             <div className="mb-2 p-2 bg-green-50 border border-green-100 rounded flex items-center justify-between">
                                <span className="text-green-800 font-semibold">{res.matchedFile.name}</span>
                             </div>
                        )}

                        {/* Search & Multi-Select Component */}
                        <FileMultiSelect 
                            allFiles={allFiles}
                            candidates={res.candidates}
                            currentSelections={res.manualResolutions || []}
                            targetFolder={res.targetFolder}
                            status={res.matchStatus}
                            onUpdate={(files) => handleSelectionUpdate(res, files)}
                        />

                        {/* Action Buttons specific to state */}
                        <div className="flex justify-between items-center mt-1">
                             
                             {/* VALIDATE BUTTON: Only show if we have manual files BUT it is NOT yet marked as FOUND */}
                             {res.manualResolutions && res.manualResolutions.length > 0 && res.matchStatus !== 'FOUND' && !res.isIgnored && (
                                <button 
                                    onClick={() => confirmMatch(res)}
                                    className="inline-flex items-center px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded shadow-sm text-xs font-bold transition-all animate-in fade-in zoom-in"
                                >
                                    <Check className="w-3 h-3 mr-1" />
                                    Validar
                                </button>
                             )}

                             {/* AI Button for Ambiguous */}
                             {res.matchStatus === 'AMBIGUOUS' && (!res.manualResolutions || res.manualResolutions.length === 0) && !res.isIgnored && (
                                <button 
                                    onClick={() => onResolveWithAI(res)}
                                    disabled={isResolving}
                                    className="inline-flex items-center px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs font-medium transition-colors"
                                >
                                    <Wand2 className="w-3 h-3 mr-1" />
                                    Sugerir c/ IA
                                </button>
                             )}

                             {/* Ignore Button: Visible for Ambiguous and Not Found (if not ignored) */}
                             {(res.matchStatus === 'NOT_FOUND' || res.matchStatus === 'AMBIGUOUS') && (!res.manualResolutions || res.manualResolutions.length === 0) && (
                                <button 
                                    onClick={() => toggleIgnore(res)}
                                    className={`ml-auto px-2 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1
                                        ${res.isIgnored 
                                            ? 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300' 
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                >
                                    {res.isIgnored ? <Eye className="w-3 h-3"/> : <EyeOff className="w-3 h-3"/>}
                                    {res.isIgnored ? "Considerar" : "Ignorar"}
                                </button>
                             )}
                        </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};