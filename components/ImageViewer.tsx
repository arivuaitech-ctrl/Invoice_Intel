import React from 'react';
import { X, Download, FileText } from 'lucide-react';

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  title: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ isOpen, onClose, imageUrl, title }) => {
  if (!isOpen || !imageUrl) return null;

  // Case-insensitive check for PDF
  const isPdf = imageUrl.toLowerCase().startsWith('data:application/pdf');

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        
        {/* Backdrop */}
        <div 
            className="fixed inset-0 bg-slate-900/90 transition-opacity backdrop-blur-sm" 
            aria-hidden="true"
            onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-2xl transform transition-all sm:max-w-4xl w-full border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-800 px-4 py-3 flex justify-between items-center shrink-0">
                <h3 className="text-white text-sm font-medium flex items-center gap-2 truncate max-w-[70%]">
                  {isPdf ? <FileText className="w-4 h-4 text-indigo-400" /> : null}
                  Viewing: {title}
                </h3>
                <div className="flex items-center gap-2">
                     <a 
                        href={imageUrl} 
                        download={`receipt-${title.replace(/\s+/g, '_')}.${isPdf ? 'pdf' : 'png'}`}
                        className="bg-white/10 text-slate-200 hover:text-white hover:bg-white/20 rounded p-1.5 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        title="Download File"
                     >
                        <Download className="w-5 h-5" />
                    </a>
                    <button 
                        onClick={onClose} 
                        className="bg-white/10 text-slate-200 hover:text-white hover:bg-white/20 rounded p-1.5 transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="relative w-full flex-1 bg-slate-100 flex items-center justify-center p-4 overflow-auto min-h-[50vh]">
                {isPdf ? (
                  <iframe 
                      src={imageUrl} 
                      className="w-full h-[70vh] border-0 bg-white rounded shadow-sm"
                      title="PDF Viewer"
                  >
                      <div className="flex flex-col items-center justify-center h-full p-8 text-slate-500">
                          <FileText className="w-12 h-12 mb-4 text-slate-400" />
                          <p className="text-lg font-medium">Unable to display PDF inline.</p>
                          <a 
                            href={imageUrl} 
                            download={`receipt-${title}.${isPdf ? 'pdf' : 'png'}`}
                            className="mt-2 text-indigo-600 hover:text-indigo-800 underline"
                          >
                            Click here to download
                          </a>
                      </div>
                  </iframe>
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                     <img 
                        src={imageUrl} 
                        alt="Receipt" 
                        className="max-w-full max-h-[75vh] object-contain shadow-md rounded bg-white"
                        style={{ minWidth: '200px', minHeight: '200px' }} // Ensure it takes space
                    />
                  </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;