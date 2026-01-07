import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, FileStack, Lock } from 'lucide-react';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  isProcessing: boolean;
  isDisabled?: boolean;
  disabledMessage?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect, isProcessing, isDisabled, disabledMessage }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDisabled) return;
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndProcessFiles = (fileList: FileList | File[]) => {
    if (isDisabled) return;
    
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const files: File[] = Array.from(fileList);
    const validFiles: File[] = [];
    let hasError = false;

    if (files.length === 0) return;

    for (const file of files) {
        if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
            setError("Some files were skipped. Only PDF, JPG, and PNG are allowed.");
            hasError = true;
            continue;
        }
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            setError(`File ${file.name} is too large (max 10MB).`);
            hasError = true;
            continue;
        }
        validFiles.push(file);
    }

    if (!hasError) setError(null);
    if (validFiles.length > 0) {
        onFilesSelect(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFiles(e.target.files);
    }
  };

  const triggerClick = () => {
    if (!isDisabled) inputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div 
        className={`relative group flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out overflow-hidden
          ${isDisabled 
            ? "border-slate-200 bg-slate-50 cursor-not-allowed" 
            : dragActive 
                ? "border-indigo-500 bg-indigo-50 cursor-pointer" 
                : "border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 cursor-pointer"
          }
          ${isProcessing ? "opacity-50 pointer-events-none" : ""}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={triggerClick}
      >
        <input 
          ref={inputRef}
          type="file" 
          multiple
          className="hidden" 
          onChange={handleChange}
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          disabled={isDisabled}
        />

        <div className="flex flex-col items-center text-center p-6 space-y-3">
          {isProcessing ? (
             <div className="flex flex-col items-center animate-pulse">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                    <svg className="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">Processing invoices...</p>
                <p className="text-xs text-slate-500 mt-1">Extracting data with AI</p>
             </div>
          ) : isDisabled ? (
             <div className="flex flex-col items-center text-slate-400">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <Lock className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-500">{disabledMessage || "Upload disabled"}</p>
             </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <FileStack className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">
                  <span className="text-indigo-600">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-500">PDF, PNG, or JPG (max 10MB)</p>
                <p className="text-xs text-indigo-500 font-medium pt-1">Multiple files supported</p>
              </div>
            </>
          )}
        </div>
      </div>
      
      {error && (
        <div className="mt-2 flex items-center text-sm text-red-600 animate-fadeIn">
          <AlertCircle className="w-4 h-4 mr-1.5" />
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUpload;