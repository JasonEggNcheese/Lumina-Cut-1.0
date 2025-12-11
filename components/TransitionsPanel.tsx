
import React from 'react';
import { TransitionType } from '../types';
import { Layers, MoveLeft, MoveRight, Maximize, VenetianMask, Zap, X } from 'lucide-react';

interface TransitionsPanelProps {
  onCloseMobile?: () => void;
}

const TRANSITIONS: { type: TransitionType; name: string; icon: any }[] = [
  { type: 'fade', name: 'Cross Dissolve', icon: Layers },
  { type: 'slide-left', name: 'Slide Left', icon: MoveLeft },
  { type: 'slide-right', name: 'Slide Right', icon: MoveRight },
  { type: 'zoom', name: 'Zoom In', icon: Maximize },
  { type: 'wipe', name: 'Linear Wipe', icon: VenetianMask },
  { type: 'dissolve', name: 'Glitch', icon: Zap },
];

export const TransitionsPanel: React.FC<TransitionsPanelProps> = ({ onCloseMobile }) => {
  
  const handleDragStart = (e: React.DragEvent, type: TransitionType) => {
    e.dataTransfer.setData('transitionType', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="w-full md:w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full shadow-2xl md:shadow-none z-20">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="text-yellow-400" size={18} />
            Transitions
        </h2>
        {onCloseMobile && (
           <button onClick={onCloseMobile} className="md:hidden text-gray-400 hover:text-white p-1">
             <X size={20} />
           </button>
        )}
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-400 mb-4">
            Drag and drop these transitions onto the start of video clips in the timeline.
        </p>

        <div className="grid grid-cols-2 gap-3">
            {TRANSITIONS.map((t) => (
                <div 
                    key={t.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, t.type)}
                    className="bg-gray-800 p-3 rounded-lg border border-gray-700 hover:bg-gray-750 hover:border-yellow-500/50 cursor-grab active:cursor-grabbing transition-all group flex flex-col items-center gap-2"
                >
                    <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-gray-500 group-hover:text-yellow-400 transition-colors">
                        <t.icon size={20} />
                    </div>
                    <span className="text-xs font-medium text-gray-300 group-hover:text-white">{t.name}</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};
