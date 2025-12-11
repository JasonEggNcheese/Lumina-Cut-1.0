import React from 'react';
import { MediaAsset } from '../types';
import { Upload, Music, Image as ImageIcon, Video as VideoIcon, Plus, X } from 'lucide-react';
import { Button } from './Button';

interface MediaLibraryProps {
  assets: MediaAsset[];
  onAddAsset: (asset: MediaAsset) => void;
  onAddToTimeline: (asset: MediaAsset) => void;
  onCloseMobile?: () => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ assets, onAddAsset, onAddToTimeline, onCloseMobile }) => {
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    let type: 'video' | 'audio' | 'image' = 'image';
    
    if (file.type.startsWith('video')) type = 'video';
    else if (file.type.startsWith('audio')) type = 'audio';

    let duration = type === 'image' ? 5 : 15; // Default fallback

    // Attempt to get actual duration for video/audio
    if (type === 'video' || type === 'audio') {
        try {
            const media = type === 'video' ? document.createElement('video') : document.createElement('audio');
            media.src = url;
            media.preload = 'metadata';
            
            await new Promise((resolve) => {
                media.onloadedmetadata = () => {
                    if (isFinite(media.duration)) {
                        duration = media.duration;
                    }
                    resolve(null);
                };
                media.onerror = () => resolve(null);
                // Safety timeout
                setTimeout(() => resolve(null), 1000);
            });
        } catch (e) {
            console.warn("Could not determine media duration", e);
        }
    }

    const newAsset: MediaAsset = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type,
      src: url,
      duration: duration
    };
    
    onAddAsset(newAsset);
    
    // Reset the input value to allow selecting the same file again
    event.target.value = '';
  };

  // Pre-populate with some stock content if empty
  React.useEffect(() => {
    if (assets.length === 0) {
      const stockAssets: MediaAsset[] = [
        { id: 'stock1', name: 'Neon City', type: 'video', src: 'https://picsum.photos/800/450', duration: 10, thumbnail: 'https://picsum.photos/id/1/200/200' },
        { id: 'stock2', name: 'Abstract Beat', type: 'audio', src: '#', duration: 30 },
        { id: 'stock3', name: 'Sunset Vibe', type: 'image', src: 'https://picsum.photos/id/10/800/450', duration: 5 },
      ];
      stockAssets.forEach(onAddAsset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full md:w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full shadow-2xl md:shadow-none">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Media</h2>
        {/* Mobile Close Button */}
        {onCloseMobile && (
           <button onClick={onCloseMobile} className="md:hidden text-gray-400 hover:text-white p-1">
             <X size={20} />
           </button>
        )}
      </div>
      
      <div className="p-4 border-b border-gray-800">
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-750 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-6 h-6 text-gray-400 mb-2" />
            <p className="text-xs text-gray-400">Tap to upload media</p>
          </div>
          <input type="file" className="hidden" onChange={handleFileUpload} accept="video/*,image/*,audio/*" />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 md:pb-4 custom-scrollbar">
        {assets.map((asset) => (
          <div key={asset.id} className="group relative bg-gray-800 rounded-md p-2 hover:ring-1 hover:ring-violet-500 transition-all flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-950 rounded overflow-hidden flex-shrink-0 flex items-center justify-center text-gray-600">
              {asset.type === 'video' ? <VideoIcon size={20} /> : 
               asset.type === 'audio' ? <Music size={20} /> : 
               <ImageIcon size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{asset.name}</p>
              <p className="text-xs text-gray-500">{asset.duration.toFixed(1)}s • {asset.type}</p>
            </div>
            <Button 
              variant="icon" 
              size="sm" 
              className="md:opacity-0 group-hover:opacity-100 absolute right-2 bg-gray-900 shadow-sm"
              onClick={() => onAddToTimeline(asset)}
              title="Add to timeline"
            >
              <Plus size={14} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};