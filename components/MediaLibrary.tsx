import React from 'react';
import { MediaAsset } from '../types';
import { Upload, Music, Image as ImageIcon, Video as VideoIcon, Plus, X, Trash2 } from 'lucide-react';
import { Button } from './Button';

interface MediaLibraryProps {
  assets: MediaAsset[];
  onAddAsset: (asset: MediaAsset) => void;
  onAddToTimeline: (asset: MediaAsset) => void;
  onCloseMobile?: () => void;
  onClearAssets: () => void;
}

const generateVideoThumbnail = (videoUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.crossOrigin = 'anonymous';
        video.currentTime = 1; // Seek to 1 second

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg'));
            } else {
                resolve('');
            }
        };
        video.onerror = () => resolve('');
    });
};

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ assets, onAddAsset, onAddToTimeline, onCloseMobile, onClearAssets }) => {
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    let type: 'video' | 'audio' | 'image' = 'image';
    
    if (file.type.startsWith('video')) type = 'video';
    else if (file.type.startsWith('audio')) type = 'audio';

    let duration = type === 'image' ? 5 : 15;
    let thumbnail: string | undefined = undefined;

    if (type === 'video' || type === 'audio') {
        try {
            const media = document.createElement(type);
            media.src = url;
            media.preload = 'metadata';
            
            await new Promise((resolve, reject) => {
                media.onloadedmetadata = () => {
                    if (isFinite(media.duration)) duration = media.duration;
                    resolve(null);
                };
                media.onerror = reject;
                setTimeout(() => reject(new Error('Media metadata timeout')), 2000);
            });
            
            if (type === 'video') {
                thumbnail = await generateVideoThumbnail(url);
            }
        } catch (e) {
            console.warn("Could not determine media duration or thumbnail", e);
        }
    }

    const newAsset: MediaAsset = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type,
      src: url,
      duration: duration,
      thumbnail
    };
    
    onAddAsset(newAsset);
    event.target.value = '';
  };

  return (
    <div className="w-full md:w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full shadow-2xl md:shadow-none">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Media</h2>
        <div className="flex items-center gap-2">
            {assets.length > 0 && 
                <Button variant="ghost" size="sm" onClick={onClearAssets} className="text-gray-500 hover:text-red-400 p-1 h-auto" title="Clear All Media">
                    <Trash2 size={14} />
                </Button>
            }
            {onCloseMobile && (
               <button onClick={onCloseMobile} className="md:hidden text-gray-400 hover:text-white p-1">
                 <X size={20} />
               </button>
            )}
        </div>
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
        {assets.length === 0 && (
            <div className="text-center py-10 text-gray-600">
                <ImageIcon size={32} className="mx-auto mb-2" />
                <p className="text-sm">Your media library is empty.</p>
                <p className="text-xs">Upload files to get started.</p>
            </div>
        )}
        {assets.map((asset) => (
          <div key={asset.id} className="group relative bg-gray-800 rounded-md p-2 hover:ring-1 hover:ring-violet-500 transition-all flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-950 rounded overflow-hidden flex-shrink-0 flex items-center justify-center text-gray-600">
                {asset.thumbnail ? <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover" /> :
                 asset.type === 'video' ? <VideoIcon size={20} /> : 
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
