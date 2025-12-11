import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ProjectState, Track, Clip, TrackType } from '../types';
import { Video, Mic, Type, Scissors, Trash2, ZoomIn, ZoomOut, Link, MoreHorizontal, MousePointer2 } from 'lucide-react';

interface TimelineProps {
  state: ProjectState;
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onSplitClip: () => void;
  onDeleteClip: () => void;
  onZoom: (delta: number) => void;
}

const WaveformVisualizer = ({ width, color = "#10b981", height = 24 }: { width: number, color?: string, height?: number }) => {
    // Memoize the path so it doesn't flicker on re-renders unless dimensions change
    const pathData = useMemo(() => {
        if (width <= 0) return '';
        const points = [];
        // Determine number of bars based on width, limit density for performance
        const barWidth = 3;
        const gap = 1;
        const numBars = Math.ceil(width / (barWidth + gap));
        
        for (let i = 0; i < numBars; i++) {
            // Pseudorandom height for waveform look
            // We use sin/cos to make it look somewhat structured like audio, not just white noise
            const x = i * (barWidth + gap);
            const noise = Math.random() * 0.3; // noise factor
            const structure = (Math.sin(i * 0.2) + 1) / 2; // slow wave
            const structure2 = (Math.cos(i * 0.8) + 1) / 2; // fast wave
            
            const normalizedHeight = (structure * 0.5 + structure2 * 0.3 + noise) * 0.8;
            const barH = Math.max(2, normalizedHeight * height); 
            const y = (height - barH) / 2;
            
            // Using a simple path for all bars is more efficient than many rects
            points.push(`M ${x},${y} v ${barH}`);
        }
        return points.join(' ');
    }, [width, height]);

    return (
        <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none opacity-80" preserveAspectRatio="none">
             <path d={pathData} stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" fill="none" />
        </svg>
    );
}

export const Timeline: React.FC<TimelineProps> = ({ 
  state, 
  onSeek, 
  onSelectClip, 
  onSplitClip, 
  onDeleteClip,
  onZoom 
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingHeader, setIsDraggingHeader] = useState(false);

  // Convert time to pixels
  const timeToPx = (time: number) => time * state.zoom;
  // Convert pixels to time
  const pxToTime = (px: number) => px / state.zoom;

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - 200; // 200 is header width
    if (offsetX < 0) return;
    
    const newTime = Math.max(0, pxToTime(offsetX));
    onSeek(newTime);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingHeader && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const offsetX = e.clientX - rect.left - 200;
        if (offsetX >= 0) {
            onSeek(pxToTime(offsetX));
        }
    }
  };

  const handleMouseUp = () => {
    setIsDraggingHeader(false);
  };

  useEffect(() => {
    if (isDraggingHeader) {
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHeader]);

  // Generate ticks
  const renderRuler = () => {
    const ticks = [];
    const step = state.zoom > 50 ? 1 : state.zoom > 20 ? 5 : 10; // Seconds per tick based on zoom
    const totalSeconds = Math.max(state.duration + 10, 60); // Min 60s timeline

    for (let i = 0; i <= totalSeconds; i += step) {
      ticks.push(
        <div 
          key={i} 
          className="absolute top-0 h-4 border-l border-gray-600 text-[10px] text-gray-500 pl-1 select-none pointer-events-none"
          style={{ left: timeToPx(i) }}
        >
          {i % (step * 2) === 0 ? formatTimeShort(i) : ''}
        </div>
      );
    }
    return ticks;
  };

  const formatTimeShort = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getTrackIcon = (type: TrackType) => {
    switch (type) {
      case TrackType.VIDEO: return <Video size={14} />;
      case TrackType.AUDIO: return <Mic size={14} />;
      case TrackType.TEXT: return <Type size={14} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 select-none text-white">
      {/* Timeline Toolbar */}
      <div className="h-10 border-b border-gray-800 bg-gray-850 flex items-center px-4 justify-between">
        <div className="flex items-center gap-2">
            <div className="flex bg-gray-800 rounded p-0.5 mr-2">
                 <button className="p-1 rounded bg-gray-700 shadow text-white"><MousePointer2 size={14}/></button>
                 <button className="p-1 rounded text-gray-400 hover:text-white"><Scissors size={14}/></button>
            </div>
            <button 
                onClick={onSplitClip}
                className="p-1.5 rounded hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-30"
                title="Split (S)"
            >
                <Scissors size={16} />
            </button>
            <button 
                onClick={onDeleteClip}
                className="p-1.5 rounded hover:bg-gray-700 text-gray-300 hover:text-red-400 disabled:opacity-30"
                title="Delete (Del)"
            >
                <Trash2 size={16} />
            </button>
        </div>

        <div className="flex items-center gap-2">
            <button onClick={() => onZoom(-10)} className="p-1 hover:text-violet-400"><ZoomOut size={16} /></button>
            <div className="w-20 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-violet-500" 
                    style={{ width: `${Math.min(100, (state.zoom / 100) * 100)}%` }} 
                />
            </div>
            <button onClick={() => onZoom(10)} className="p-1 hover:text-violet-400"><ZoomIn size={16} /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative" onMouseMove={handleMouseMove}>
        {/* Track Headers (Left) */}
        <div className="w-[200px] flex-shrink-0 border-r border-gray-800 bg-gray-900 z-10 flex flex-col pt-8">
            {state.tracks.map(track => (
                <div key={track.id} className="h-24 border-b border-gray-800 px-3 flex flex-col justify-center group hover:bg-gray-850 transition-colors relative">
                    <div className="flex items-center justify-between text-gray-400 mb-1">
                        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                            {getTrackIcon(track.type)}
                            {track.name}
                        </span>
                        <MoreHorizontal size={14} className="opacity-0 group-hover:opacity-100 cursor-pointer" />
                    </div>
                    <div className="flex gap-2 mt-2">
                         <button className={`text-xs px-2 py-0.5 rounded ${track.isMuted ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-500'}`}>
                            {track.isMuted ? 'M' : 'M'}
                         </button>
                         <button className="text-xs px-2 py-0.5 bg-gray-800 text-gray-500 rounded">S</button>
                         <button className="text-xs px-2 py-0.5 bg-gray-800 text-gray-500 rounded">R</button>
                    </div>
                </div>
            ))}
        </div>

        {/* Timeline Area (Right) */}
        <div 
            className="flex-1 relative overflow-x-auto overflow-y-hidden bg-gray-950" 
            ref={timelineRef}
            onClick={handleTimelineClick}
        >
            {/* Time Ruler */}
            <div 
                className="h-8 border-b border-gray-800 bg-gray-900 sticky top-0 z-10 w-full"
                style={{ minWidth: '100%', width: timeToPx(state.duration) + 500 }}
            >
                {renderRuler()}
                {/* Playhead Header Handle */}
                <div 
                    className="absolute top-0 h-8 w-4 -ml-2 z-20 cursor-ew-resize group"
                    style={{ left: timeToPx(state.currentTime) }}
                    onMouseDown={(e) => { e.stopPropagation(); setIsDraggingHeader(true); }}
                >
                    <div className="w-0 h-0 mx-auto border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-violet-500" />
                </div>
            </div>

            {/* Tracks & Clips */}
            <div className="relative" style={{ minWidth: '100%', width: timeToPx(state.duration) + 500 }}>
                
                {/* Playhead Line */}
                <div 
                    className="absolute top-0 bottom-0 w-px bg-violet-500 z-20 pointer-events-none"
                    style={{ left: timeToPx(state.currentTime), height: state.tracks.length * 96 }} // 96px = h-24
                />

                {state.tracks.map(track => (
                    <div key={track.id} className="h-24 border-b border-gray-800 relative bg-gray-950/50">
                        {/* Grid Lines */}
                        <div className="absolute inset-0 w-full h-full pointer-events-none opacity-5 bg-[linear-gradient(90deg,transparent_49%,#fff_50%,transparent_51%)]" style={{ backgroundSize: `${state.zoom * 10}px 100%` }}></div>

                        {state.clips.filter(c => c.trackId === track.id).map(clip => {
                            const width = timeToPx(clip.duration);
                            const aiDuration = clip.properties.aiExtendedDuration || 0;
                            const aiWidth = timeToPx(aiDuration);

                            return (
                                <div 
                                    key={clip.id}
                                    className={`absolute top-2 bottom-2 rounded-md overflow-hidden cursor-pointer border ring-offset-1 ring-offset-gray-900 transition-shadow
                                        ${clip.selected ? 'border-violet-400 ring-2 ring-violet-500 z-10' : 'border-gray-700 hover:border-gray-500'}
                                        ${clip.type === 'audio' ? 'bg-emerald-900/30' : 'bg-violet-900/30'}
                                    `}
                                    style={{
                                        left: timeToPx(clip.startOffset),
                                        width: Math.max(2, width)
                                    }}
                                    onClick={(e) => { e.stopPropagation(); onSelectClip(clip.id); }}
                                >
                                    {/* Waveform Visualization (Audio Only) */}
                                    {clip.type === 'audio' && clip.selected && (
                                        <div className="absolute inset-0 top-3 bottom-0 opacity-80">
                                            <WaveformVisualizer width={width} color="#34d399" height={70} />
                                        </div>
                                    )}

                                    {/* AI Extended Region Indicator */}
                                    {aiDuration > 0 && (
                                        <div 
                                            className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 border-l-2 border-dashed border-emerald-500/50 z-0"
                                            style={{ width: aiWidth }}
                                            title="AI Extended Frames"
                                        >
                                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:4px_4px]"></div>
                                        </div>
                                    )}
                                    
                                    {/* Clip Label */}
                                    <div className="absolute top-0 left-0 right-0 px-2 py-1 text-xs truncate text-white/90 drop-shadow-md select-none bg-black/20 z-10">
                                        {clip.name}
                                    </div>
                                    
                                    {/* Thumbnails (Video Only - simplified) */}
                                    {clip.type === 'video' && width > 50 && (
                                        <div className="absolute inset-0 opacity-20 pointer-events-none flex overflow-hidden">
                                           {/* Mock filmstrip */}
                                           {Array.from({length: Math.ceil(width/100)}).map((_, i) => (
                                                <div key={i} className="h-full aspect-video border-r border-white/10 bg-gray-800"></div>
                                           ))}
                                        </div>
                                    )}

                                    {/* Resize Handles */}
                                    {clip.selected && (
                                        <>
                                            <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-20"></div>
                                            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-20"></div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};