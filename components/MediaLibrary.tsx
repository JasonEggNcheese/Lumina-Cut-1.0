import React from 'react';
import { MediaAsset } from '../types';
import { Upload, Music, Image as ImageIcon, Video as VideoIcon, Plus } from 'lucide-react';
import { Button } from './Button';

interface MediaLibraryProps {
  assets: MediaAsset[];
  onAddAsset: (asset: MediaAsset) => void;
  onAddToTimeline: (asset: MediaAsset) => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ assets, onAddAsset, onAddToTimeline }) => {
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
      
      // In a real app, we would load the media to get actual duration
      // For this demo, we mock duration based on type
      const mockDuration = type === 'image' ? 5 : 15; 

      const newAsset: MediaAsset = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type,
        src: url,
        duration: mockDuration
      };
      onAddAsset(newAsset);
    }
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
    <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white mb-4">Media</h2>
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-750 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-6 h-6 text-gray-400 mb-2" />
            <p className="text-xs text-gray-400">Click to upload media</p>
          </div>
          <input type="file" className="hidden" onChange={handleFileUpload} accept="video/*,image/*,audio/*" />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {assets.map((asset) => (
          <div key={asset.id} className="group relative bg-gray-800 rounded-md p-2 hover:ring-1 hover:ring-violet-500 transition-all flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-950 rounded overflow-hidden flex-shrink-0 flex items-center justify-center text-gray-600">
              {asset.type === 'video' ? <VideoIcon size={20} /> : 
               asset.type === 'audio' ? <Music size={20} /> : 
               <ImageIcon size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{asset.name}</p>
              <p className="text-xs text-gray-500">{asset.duration}s • {asset.type}</p>
            </div>
            <Button 
              variant="icon" 
              size="sm" 
              className="opacity-0 group-hover:opacity-100 absolute right-2 bg-gray-900 shadow-sm"
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