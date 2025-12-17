import React, { useState } from 'react';
import { Download, Film, Loader2, X } from 'lucide-react';

interface ExportModalProps {
  onClose: () => void;
  onExport: (resolution: { width: number; height: number; name: string }) => void;
  isExporting: boolean;
  progress: number;
  status: string;
}

const resolutions = [
  { name: '720p', width: 1280, height: 720 },
  { name: '1080p', width: 1920, height: 1080 },
];

export const ExportModal: React.FC<ExportModalProps> = ({ onClose, onExport, isExporting, progress, status }) => {
  const [selectedRes, setSelectedRes] = useState(resolutions[0]);

  return (
    <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-850 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md mx-4 text-white">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="font-semibold flex items-center gap-2"><Download size={16} /> Export Video</h2>
          {!isExporting && <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>}
        </div>
        
        {isExporting ? (
          <div className="p-6 text-center">
            <Loader2 className="animate-spin text-violet-400 mx-auto mb-4" size={32} />
            <h3 className="font-semibold mb-2">{status}</h3>
            <p className="text-sm text-gray-400 mb-4">Please keep this tab open. Rendering can be slow.</p>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div className="bg-violet-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress * 100}%` }}></div>
            </div>
            <p className="text-xs font-mono mt-2 text-gray-500">{(progress * 100).toFixed(1)}%</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-300 mb-2 block">Resolution</label>
              <div className="flex bg-gray-900/50 rounded-md p-1 border border-gray-700">
                {resolutions.map(res => (
                  <button
                    key={res.name}
                    onClick={() => setSelectedRes(res)}
                    className={`flex-1 p-2 rounded text-sm transition-colors ${selectedRes.name === res.name ? 'bg-violet-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-700'}`}
                  >
                    {res.name} ({res.width}x{res.height})
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-300 mb-2 block">Format</label>
              <div className="bg-gray-900/50 p-3 rounded-md border border-gray-700 flex items-center gap-2">
                <Film size={16} className="text-gray-500" />
                <span className="font-mono text-sm">MP4</span>
                <span className="text-xs text-gray-500">(H.264 + AAC)</span>
              </div>
            </div>

            <button
              onClick={() => onExport(selectedRes)}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Download size={16} />
              Start Export
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
