import React, { useRef } from 'react';
import { UploadCloud, FolderInput, FileSpreadsheet, Save, FolderOpen, FileJson } from 'lucide-react';

interface Props {
  onExcelUpload: (file: File) => void;
  onFolderUpload: (files: FileList) => void;
  onLoadProject: (file: File) => void;
  excelFile: File | null;
  folderCount: number;
  projectLoaded: boolean;
}

export const FileUploader: React.FC<Props> = ({ 
  onExcelUpload, 
  onFolderUpload, 
  onLoadProject,
  excelFile, 
  folderCount,
  projectLoaded
}) => {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-full max-w-5xl flex flex-col gap-8">
      
      {/* Option A: Resume */}
      <div className="w-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="bg-slate-100 text-slate-500 rounded-full w-6 h-6 flex items-center justify-center text-xs">A</span>
            Retomar Trabalho
        </h3>
        <div 
            className={`border-2 border-dashed rounded-xl p-6 flex items-center gap-4 cursor-pointer transition-colors group
              ${projectLoaded ? 'border-purple-500 bg-purple-50' : 'border-slate-300 hover:border-purple-500 hover:bg-slate-50'}`}
            onClick={() => projectInputRef.current?.click()}
        >
            <div className={`p-4 rounded-full ${projectLoaded ? 'bg-purple-200' : 'bg-slate-100 group-hover:bg-purple-100'}`}>
                <FolderOpen className={`w-8 h-8 ${projectLoaded ? 'text-purple-700' : 'text-slate-500 group-hover:text-purple-600'}`} />
            </div>
            <div className="flex-1">
                <h4 className="font-semibold text-lg text-slate-800">
                    {projectLoaded ? "Projeto Carregado com Sucesso" : "Carregar Projeto Existente (.json)"}
                </h4>
                <p className="text-sm text-slate-500 mt-1">
                    {projectLoaded 
                        ? "O ficheiro de projeto foi importado. Agora, por favor carregue a pasta de ficheiros abaixo para restabelecer as ligações." 
                        : "Importe um ficheiro .json que guardou anteriormente para recuperar todo o seu progresso."}
                </p>
            </div>
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={projectInputRef}
              onChange={(e) => e.target.files?.[0] && onLoadProject(e.target.files[0])}
            />
            {projectLoaded && <div className="text-purple-600 font-bold text-sm px-4">OK</div>}
        </div>
      </div>

      <div className="flex items-center gap-4 px-8">
        <div className="h-px bg-slate-200 flex-1"></div>
        <span className="text-xs text-slate-400 font-bold">OU INICIAR NOVO</span>
        <div className="h-px bg-slate-200 flex-1"></div>
      </div>

      {/* Option B: New Project */}
      <div className={`w-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-opacity duration-300 ${projectLoaded ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="bg-slate-100 text-slate-500 rounded-full w-6 h-6 flex items-center justify-center text-xs">B</span>
            Novo Projeto
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {/* Excel Upload Card */}
            <div 
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer relative min-h-[200px]
                ${excelFile ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'}`}
            onClick={() => !projectLoaded && excelInputRef.current?.click()}
            >
            <FileSpreadsheet className={`w-12 h-12 mb-4 ${excelFile ? 'text-green-600' : 'text-slate-400'}`} />
            <h3 className="text-lg font-semibold text-slate-800">1. Carregar Excel</h3>
            <p className="text-sm text-slate-500 text-center mt-2">
                {excelFile ? excelFile.name : "Selecione o ficheiro Excel (.xlsx)"}
            </p>
            <input 
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                ref={excelInputRef}
                onChange={(e) => e.target.files?.[0] && onExcelUpload(e.target.files[0])}
            />
            </div>

            {/* Folder Upload Card */}
            <div 
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer relative min-h-[200px]
                ${folderCount > 0 ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'}
                ${projectLoaded ? 'pointer-events-auto opacity-100 grayscale-0 ring-4 ring-purple-100' : ''}`} // Override opacity for this card if project is loaded
            style={projectLoaded ? { pointerEvents: 'auto', opacity: 1, filter: 'none' } : {}}
            onClick={() => folderInputRef.current?.click()}
            >
            {projectLoaded && folderCount === 0 && (
                <span className="absolute top-4 right-4 text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded animate-pulse">
                PASSO 2 OBRIGATÓRIO
                </span>
            )}
            
            <FolderInput className={`w-12 h-12 mb-4 ${folderCount > 0 ? 'text-green-600' : 'text-slate-400'}`} />
            <h3 className="text-lg font-semibold text-slate-800">
                {projectLoaded ? "2. Carregar Pasta (Obrigatório)" : "2. Carregar Pasta Raiz"}
            </h3>
            <p className="text-sm text-slate-500 text-center mt-2">
                {folderCount > 0 ? `${folderCount} ficheiros carregados` : "Selecione a pasta com 'Ponto 1', etc."}
            </p>
            <input 
                type="file" 
                // @ts-ignore
                webkitdirectory="" 
                directory="" 
                multiple 
                className="hidden" 
                ref={folderInputRef}
                onChange={(e) => e.target.files && onFolderUpload(e.target.files)}
            />
            </div>
        </div>
      </div>
    </div>
  );
};