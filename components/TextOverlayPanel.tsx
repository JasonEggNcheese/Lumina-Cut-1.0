import React from 'react';
import { ClipProperties } from '../types';
import { CaseSensitive, AlignLeft, Bold, Type, X } from 'lucide-react';

interface TextOverlayPanelProps {
  onAddTextClip: (name: string, properties: Partial<ClipProperties>) => void;
  onCloseMobile?: () => void;
}

type TextPreset = {
  name: string;
  properties: Partial<ClipProperties>;
  icon: any;
}

const PRESETS: TextPreset[] = [
  { 
    name: 'Basic Title', 
    icon: Type,
    properties: { 
      textContent: 'Basic Title', 
      fontSize: 72, 
      fontColor: '#FFFFFF', 
      fontWeight: 'bold', 
      textAlign: 'center',
      position: { x: 0, y: -20 },
      opacity: 100,
    } 
  },
  { 
    name: 'Lower Third', 
    icon: AlignLeft,
    properties: { 
      textContent: 'Lower Third\nDescription text',
      fontSize: 36, 
      fontColor: '#FFFFFF', 
      fontWeight: 'normal',
      textAlign: 'left',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      position: { x: -25, y: 35 },
      scale: 100,
      opacity: 100,
    } 
  },
  {
    name: 'Bold Caption',
    icon: Bold,
    properties: {
      textContent: 'BOLD CAPTION',
      fontSize: 80,
      fontColor: '#FFFF00',
      fontWeight: 'bold',
      textAlign: 'center',
      position: { x: 0, y: 0 },
      opacity: 100,
    }
  },
  {
    name: 'Simple Subtitle',
    icon: CaseSensitive,
    properties: {
      textContent: 'This is a subtitle.',
      fontSize: 24,
      fontColor: '#FFFFFF',
      fontWeight: 'normal',
      textAlign: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      position: { x: 0, y: 40 },
      opacity: 100,
    }
  }
];

export const TextOverlayPanel: React.FC<TextOverlayPanelProps> = ({ onAddTextClip, onCloseMobile }) => {
  return (
    <div className="w-full md:w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full shadow-2xl md:shadow-none z-20">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Type className="text-blue-400" size={18} />
            Text Overlays
        </h2>
        {onCloseMobile && (
           <button onClick={onCloseMobile} className="md:hidden text-gray-400 hover:text-white p-1">
             <X size={20} />
           </button>
        )}
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-400 mb-4">
            Click to add a text overlay to the timeline at the current playhead position.
        </p>

        <div className="grid grid-cols-1 gap-3">
            {PRESETS.map((preset) => (
                <button 
                    key={preset.name}
                    onClick={() => onAddTextClip(preset.name, preset.properties)}
                    className="bg-gray-800 p-3 rounded-lg border border-gray-700 hover:bg-gray-750 hover:border-blue-500/50 cursor-pointer transition-all group flex items-center gap-4 text-left"
                >
                    <div className="w-10 h-10 bg-gray-900 rounded-md flex items-center justify-center text-gray-500 group-hover:text-blue-400 transition-colors">
                        <preset.icon size={20} />
                    </div>
                    <div>
                        <span className="text-sm font-medium text-gray-300 group-hover:text-white">{preset.name}</span>
                    </div>
                </button>
            ))}
        </div>
      </div>
    </div>
  );
};
