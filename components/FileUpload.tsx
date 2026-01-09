
import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, FileStack, Lock, Camera, X } from 'lucide-react';
import Button from './Button';

interface FileUploadProps {
  onFilesSelect: (files: (File | Blob)[]) => void;
  isProcessing: boolean;
  isDisabled?: boolean;
  disabledMessage?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect, isProcessing, isDisabled, disabledMessage }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

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
            setError("Only PDF, JPG, and PNG are allowed.");
            hasError = true;
            continue;
        }
        if (file.size > 10 * 1024 * 1024) {
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

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Camera access denied:", err);
      setError("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            onFilesSelect([blob]);
            stopCamera();
          }
        }, 'image/jpeg', 0.95);
      }
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

  const triggerClick = (e: React.MouseEvent) => {
    if (isDisabled) return;
    inputRef.current?.click();
  };

  return (
    <div className="w-full space-y-4">
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
                <p className="text-sm font-medium text-slate-700">Extracting details...</p>
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
                <p className="text-xs text-slate-500">Multiple PDF, PNG, or JPG supported</p>
              </div>
            </>
          )}
        </div>
      </div>

      {!isDisabled && !isProcessing && (
        <Button 
          variant="secondary" 
          className="w-full h-12" 
          onClick={startCamera}
          icon={<Camera className="w-5 h-5" />}
        >
          Quick Camera Scan
        </Button>
      )}
      
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
            <button onClick={stopCamera} className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full">
                <X className="w-8 h-8" />
            </button>
            <div className="relative w-full max-w-2xl aspect-[3/4] bg-slate-900 rounded-xl overflow-hidden">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                    <button 
                        onClick={capturePhoto}
                        className="w-20 h-20 bg-white rounded-full border-8 border-white/30 flex items-center justify-center active:scale-90 transition-all"
                    >
                        <div className="w-12 h-12 bg-indigo-600 rounded-full"></div>
                    </button>
                </div>
            </div>
            <p className="mt-4 text-white font-medium">Position receipt within the frame</p>
        </div>
      )}
      
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
