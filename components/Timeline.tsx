import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ProjectState, Track, Clip, TrackType, TransitionType } from '../types';
import { Video, Mic, Type, Scissors, Trash2, ZoomIn, ZoomOut, MoreHorizontal, MousePointer2 } from 'lucide-react';

interface TimelineProps {
  state: ProjectState;
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, updates: Partial<Clip>) => void;
  onSplitClip: () => void;
  onDeleteClip: () => void;
  onZoom: (delta: number) => void;
  onToggleTrackMute: (trackId: string) => void;
  onToggleTrackSolo: (trackId: string) => void;
  onToggleTrackRecord: (trackId: string) => void;
  onApplyTransition?: (clipId: string, type: TransitionType) => void;
}

interface DragState {
  clipId: string;
  startX: number;
  initialStartOffset: number;
  initialTrackId: string;
  initialDuration: number;
  initialSourceStart: number;
  type: 'move' | 'resize-left' | 'resize-right';
}

const WaveformVisualizer = ({ width, color = "#10b981", height = 24 }: { width: number, color?: string, height?: number }) => {
    const pathData = useMemo(() => {
        if (width <= 0) return '';
        const points = [];
        const barWidth = 3;
        const gap = 1;
        const numBars = Math.ceil(width / (barWidth + gap));
        
        for (let i = 0; i < numBars; i++) {
            const x = i * (barWidth + gap);
            const noise = Math.random() * 0.3; 
            const structure = (Math.sin(i * 0.2) + 1) / 2; 
            const structure2 = (Math.cos(i * 0.8) + 1) / 2; 
            
            const normalizedHeight = (structure * 0.5 + structure2 * 0.3 + noise) * 0.8;
            const barH = Math.max(2, normalizedHeight * height); 
            const y = (height - barH) / 2;
            
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
  onUpdateClip,
  onSplitClip, 
  onDeleteClip,
  onZoom,
  onToggleTrackMute,
  onToggleTrackSolo,
  onToggleTrackRecord,
  onApplyTransition
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingHeader, setIsDraggingHeader] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);

  // Convert time to pixels
  const timeToPx = (time: number) => time * state.zoom;
  // Convert pixels to time
  const pxToTime = (px: number) => px / state.zoom;

  // Header Width Calculation
  const getHeaderWidth = () => window.innerWidth < 768 ? 50 : 200;

  // -- Event Handlers for Playhead Scrubbing --
  const handleTimelineInteraction = (clientX: number) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left - getHeaderWidth();
    
    if (offsetX < 0) return;
    const newTime = Math.max(0, pxToTime(offsetX));
    onSeek(newTime);
  };

  const handleTimelineHeaderClick = (e: React.MouseEvent) => {
    handleTimelineInteraction(e.clientX);
  };

  const handleHeaderMouseMove = (e: React.MouseEvent) => {
    if (isDraggingHeader) handleTimelineInteraction(e.clientX);
  };

  const handleHeaderTouchMove = (e: React.TouchEvent) => {
    if (isDraggingHeader) handleTimelineInteraction(e.touches[0].clientX);
  };

  const handleHeaderMouseUp = () => setIsDraggingHeader(false);


  // -- Event Handlers for Clip Dragging --

  const handleClipMouseDown = (e: React.MouseEvent | React.TouchEvent, clip: Clip) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    
    onSelectClip(clip.id);
    setDragState({
        clipId: clip.id,
        startX: clientX,
        initialStartOffset: clip.startOffset,
        initialTrackId: clip.trackId,
        initialDuration: clip.duration,
        initialSourceStart: clip.sourceStart,
        type: 'move'
    });
  };

  const handleResizeLeftDown = (e: React.MouseEvent | React.TouchEvent, clip: Clip) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    onSelectClip(clip.id);
    setDragState({
        clipId: clip.id,
        startX: clientX,
        initialStartOffset: clip.startOffset,
        initialTrackId: clip.trackId,
        initialDuration: clip.duration,
        initialSourceStart: clip.sourceStart,
        type: 'resize-left'
    });
  };

  const handleResizeRightDown = (e: React.MouseEvent | React.TouchEvent, clip: Clip) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    onSelectClip(clip.id);
    setDragState({
        clipId: clip.id,
        startX: clientX,
        initialStartOffset: clip.startOffset,
        initialTrackId: clip.trackId,
        initialDuration: clip.duration,
        initialSourceStart: clip.sourceStart,
        type: 'resize-right'
    });
  };
  
  // Transition Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
  };

  const handleDropTransition = (e: React.DragEvent, clip: Clip) => {
      e.preventDefault();
      e.stopPropagation();
      const type = e.dataTransfer.getData('transitionType') as TransitionType;
      if (type && onApplyTransition && (clip.type === 'video' || clip.type === 'image')) {
          onApplyTransition(clip.id, type);
      }
  };

  // Global Drag Listener
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
        if (isDraggingHeader) {
            if (timelineRef.current) {
                 const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                 const rect = timelineRef.current.getBoundingClientRect();
                 const offsetX = clientX - rect.left - getHeaderWidth();
                 const newTime = Math.max(0, pxToTime(offsetX));
                 onSeek(newTime);
            }
        }
        
        if (dragState) {
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const deltaX = clientX - dragState.startX;
            let deltaTime = pxToTime(deltaX);

            const clip = state.clips.find(c => c.id === dragState.clipId);
            if (!clip) return;

            // Generate Snap Points
            const snapPoints = [0, state.currentTime];
             state.clips.forEach(c => {
                if (c.id !== clip.id) {
                    snapPoints.push(c.startOffset);
                    snapPoints.push(c.startOffset + c.duration);
                }
            });
            const SNAP_THRESHOLD_PX = 10;
            const snapThreshold = pxToTime(SNAP_THRESHOLD_PX);
            let snapCandidate = null;

            if (dragState.type === 'move') {
                let newStart = Math.max(0, dragState.initialStartOffset + deltaTime);

                // Check Start Snapping
                let closestDist = snapThreshold;
                for (const point of snapPoints) {
                    // Check Start
                    const distStart = Math.abs(newStart - point);
                    if (distStart < closestDist) {
                        closestDist = distStart;
                        newStart = point;
                        snapCandidate = point;
                    }
                    
                    // Check End (move start so end aligns)
                    const newEnd = newStart + clip.duration;
                    const distEnd = Math.abs(newEnd - point);
                    if (distEnd < closestDist) {
                        closestDist = distEnd;
                        newStart = point - clip.duration;
                        snapCandidate = point;
                    }
                }
                setSnapLine(snapCandidate);
                onUpdateClip(clip.id, { startOffset: newStart });

            } else if (dragState.type === 'resize-left') {
                let newStart = dragState.initialStartOffset + deltaTime;
                
                // Snap New Start
                let closestDist = snapThreshold;
                for (const point of snapPoints) {
                    const dist = Math.abs(newStart - point);
                    if (dist < closestDist) {
                        closestDist = dist;
                        newStart = point;
                        snapCandidate = point;
                    }
                }
                
                // Recalculate delta based on snapped start
                deltaTime = newStart - dragState.initialStartOffset;
                
                const newDuration = dragState.initialDuration - deltaTime;
                const newSourceStart = dragState.initialSourceStart + deltaTime;

                if (newDuration >= 0.1 && newSourceStart >= 0) {
                    setSnapLine(snapCandidate);
                    onUpdateClip(clip.id, { 
                        startOffset: newStart,
                        duration: newDuration,
                        sourceStart: newSourceStart
                    });
                }

            } else if (dragState.type === 'resize-right') {
                let newEnd = dragState.initialStartOffset + dragState.initialDuration + deltaTime;

                // Snap New End
                let closestDist = snapThreshold;
                for (const point of snapPoints) {
                    const dist = Math.abs(newEnd - point);
                    if (dist < closestDist) {
                        closestDist = dist;
                        newEnd = point;
                        snapCandidate = point;
                    }
                }

                // Recalculate delta
                const newDuration = newEnd - dragState.initialStartOffset;
                
                if (newDuration >= 0.1) {
                    setSnapLine(snapCandidate);
                    onUpdateClip(clip.id, { duration: newDuration });
                }
            }
        }
    };

    const handleGlobalUp = () => {
        setIsDraggingHeader(false);
        setDragState(null);
        setSnapLine(null);
    };

    if (isDraggingHeader || dragState) {
        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('touchmove', handleGlobalMove, { passive: false });
        window.addEventListener('mouseup', handleGlobalUp);
        window.addEventListener('touchend', handleGlobalUp);
    }

    return () => {
        window.removeEventListener('mousemove', handleGlobalMove);
        window.removeEventListener('touchmove', handleGlobalMove);
        window.removeEventListener('mouseup', handleGlobalUp);
        window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDraggingHeader, dragState, state.zoom, state.clips, state.currentTime]);


  // Generate ticks
  const renderRuler = () => {
    const ticks = [];
    const step = state.zoom > 50 ? 1 : state.zoom > 20 ? 5 : 10;
    const totalSeconds = Math.max(state.duration + 10, 60);

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
      case TrackType.VIDEO: return <Video size={16} />;
      case TrackType.AUDIO: return <Mic size={16} />;
      case TrackType.TEXT: return <Type size={16} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 select-none text-white">
      {/* Timeline Toolbar */}
      <div className="h-10 border-b border-gray-800 bg-gray-850 flex items-center px-2 md:px-4 justify-between shrink-0">
        <div className="flex items-center gap-2">
            <div className="hidden md:flex bg-gray-800 rounded p-0.5 mr-2">
                 <button className="p-1 rounded bg-gray-700 shadow text-white"><MousePointer2 size={14}/></button>
            </div>
            <button 
                onClick={onSplitClip}
                className="p-2 md:p-1.5 rounded bg-gray-800 md:bg-transparent hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-30"
                title="Split (S)"
            >
                <Scissors size={16} />
            </button>
            <button 
                onClick={onDeleteClip}
                className="p-2 md:p-1.5 rounded bg-gray-800 md:bg-transparent hover:bg-gray-700 text-gray-300 hover:text-red-400 disabled:opacity-30"
                title="Delete (Del)"
            >
                <Trash2 size={16} />
            </button>
        </div>

        <div className="flex items-center gap-2">
            <button onClick={() => onZoom(-10)} className="p-1 hover:text-violet-400"><ZoomOut size={16} /></button>
            <div className="w-12 md:w-20 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-violet-500" 
                    style={{ width: `${Math.min(100, (state.zoom / 100) * 100)}%` }} 
                />
            </div>
            <button onClick={() => onZoom(10)} className="p-1 hover:text-violet-400"><ZoomIn size={16} /></button>
        </div>
      </div>

      <div 
        className="flex flex-1 overflow-hidden relative" 
        onMouseMove={handleHeaderMouseMove}
        onTouchMove={handleHeaderTouchMove}
      >
        {/* Track Headers (Left) - Responsive Width */}
        <div className="w-[50px] md:w-[200px] flex-shrink-0 border-r border-gray-800 bg-gray-900 z-10 flex flex-col pt-8 transition-all duration-300">
            {state.tracks.map(track => (
                <div key={track.id} className="h-24 border-b border-gray-800 px-0 md:px-3 flex flex-col justify-center items-center md:items-stretch group hover:bg-gray-850 transition-colors relative">
                    <div className="flex items-center justify-center md:justify-between text-gray-400 mb-0 md:mb-1">
                        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                            {getTrackIcon(track.type)}
                            <span className="hidden md:inline">{track.name}</span>
                        </span>
                        <MoreHorizontal size={14} className="hidden md:block opacity-0 group-hover:opacity-100 cursor-pointer" />
                    </div>
                    <div className="hidden md:flex gap-2 mt-2">
                         <button 
                            onClick={() => onToggleTrackMute(track.id)}
                            className={`text-xs px-2 py-0.5 rounded ${track.isMuted ? 'bg-red-500/80 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'}`}
                         >
                            {track.isMuted ? 'M' : 'M'}
                         </button>
                         <button 
                            onClick={() => onToggleTrackSolo(track.id)}
                            className={`text-xs px-2 py-0.5 rounded ${track.isSolo ? 'bg-yellow-500 text-black font-bold' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'}`}
                         >
                            S
                         </button>
                         <button 
                            onClick={() => onToggleTrackRecord(track.id)}
                            className={`text-xs px-2 py-0.5 rounded ${track.isRecordArmed ? 'bg-red-600 text-white font-bold animate-pulse' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'}`}
                         >
                            R
                         </button>
                    </div>
                </div>
            ))}
        </div>

        {/* Timeline Area (Right) */}
        <div 
            className="flex-1 relative overflow-x-auto overflow-y-hidden bg-gray-950 touch-pan-x" 
            ref={timelineRef}
            onClick={handleTimelineHeaderClick}
        >
            {/* Time Ruler */}
            <div 
                className="h-8 border-b border-gray-800 bg-gray-900 sticky top-0 z-10 w-full"
                style={{ minWidth: '100%', width: timeToPx(state.duration) + 500 }}
            >
                {renderRuler()}
                {/* Playhead Header Handle */}
                <div 
                    className="absolute top-0 h-8 w-10 -ml-5 z-20 cursor-ew-resize group flex justify-center touch-none"
                    style={{ left: timeToPx(state.currentTime) }}
                    onMouseDown={(e) => { e.stopPropagation(); setIsDraggingHeader(true); }}
                    onTouchStart={(e) => { e.stopPropagation(); setIsDraggingHeader(true); }}
                >
                    {/* Enlarged touch target for mobile */}
                    <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-violet-500" />
                </div>
            </div>

            {/* Tracks & Clips */}
            <div className="relative" style={{ minWidth: '100%', width: timeToPx(state.duration) + 500 }}>
                
                {/* Playhead Line */}
                <div 
                    className="absolute top-0 bottom-0 w-px bg-violet-500 z-20 pointer-events-none"
                    style={{ left: timeToPx(state.currentTime), height: state.tracks.length * 96 }} 
                />

                {/* Snapping Guide Line */}
                {snapLine !== null && (
                    <div 
                        className="absolute top-0 bottom-0 w-px bg-yellow-400 z-30 pointer-events-none shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                        style={{ left: timeToPx(snapLine), height: state.tracks.length * 96 }} 
                    />
                )}

                {state.tracks.map(track => (
                    <div key={track.id} className="h-24 border-b border-gray-800 relative bg-gray-950/50">
                        {/* Grid Lines */}
                        <div className="absolute inset-0 w-full h-full pointer-events-none opacity-5 bg-[linear-gradient(90deg,transparent_49%,#fff_50%,transparent_51%)]" style={{ backgroundSize: `${state.zoom * 10}px 100%` }}></div>

                        {state.clips.filter(c => c.trackId === track.id).map(clip => {
                            const width = timeToPx(clip.duration);
                            const aiDuration = clip.properties.aiExtendedDuration || 0;
                            const aiWidth = timeToPx(aiDuration);
                            const isDragging = dragState?.clipId === clip.id && dragState.type === 'move';

                            return (
                                <div 
                                    key={clip.id}
                                    className={`absolute top-2 bottom-2 rounded-md overflow-hidden cursor-pointer border ring-offset-1 ring-offset-gray-900 transition-shadow touch-none group
                                        ${clip.selected ? 'border-violet-400 ring-2 ring-violet-500 z-10' : 'border-gray-700 hover:border-gray-500'}
                                        ${clip.type === 'audio' ? 'bg-emerald-900/30' : 'bg-violet-900/30'}
                                        ${isDragging ? 'opacity-80 scale-[1.01] shadow-xl z-50 cursor-grabbing' : 'cursor-grab'}
                                    `}
                                    style={{
                                        left: timeToPx(clip.startOffset),
                                        width: Math.max(2, width)
                                    }}
                                    onMouseDown={(e) => handleClipMouseDown(e, clip)}
                                    onTouchStart={(e) => handleClipMouseDown(e, clip)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDropTransition(e, clip)}
                                >
                                    {/* Waveform Visualization (Audio Only) */}
                                    {clip.type === 'audio' && clip.selected && (
                                        <div className="absolute inset-0 top-3 bottom-0 opacity-80">
                                            <WaveformVisualizer width={width} color="#34d399" height={70} />
                                        </div>
                                    )}
                                    
                                    {/* Transition Indicator */}
                                    {clip.transition && (
                                        <div 
                                            className="absolute left-0 top-0 bottom-0 bg-yellow-500/50 border-r border-yellow-500 z-20 flex items-center justify-center overflow-hidden"
                                            style={{ width: timeToPx(clip.transition.duration) }}
                                            title={`${clip.transition.type} (${clip.transition.duration}s)`}
                                        >
                                           <div className="bg-yellow-400/20 w-full h-full absolute animate-pulse"></div>
                                        </div>
                                    )}

                                    {/* AI Extended Region Indicator */}
                                    {aiDuration > 0 && (
                                        <div 
                                            className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 border-l-2 border-dashed border-emerald-500/50 z-0"
                                            style={{ width: aiWidth }}
                                        >
                                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:4px_4px]"></div>
                                        </div>
                                    )}
                                    
                                    {/* Clip Label */}
                                    <div className="absolute top-0 left-0 right-0 px-2 py-1 text-xs truncate text-white/90 drop-shadow-md select-none bg-black/20 z-10 pointer-events-none">
                                        {clip.name}
                                    </div>
                                    
                                    {/* Resize Handles */}
                                    {clip.selected && (
                                        <>
                                            <div 
                                                className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 z-30 flex items-center justify-center group-hover:bg-white/5 transition-colors"
                                                onMouseDown={(e) => handleResizeLeftDown(e, clip)}
                                                onTouchStart={(e) => handleResizeLeftDown(e, clip)}
                                            >
                                                <div className="w-1 h-4 bg-white/50 rounded-full"></div>
                                            </div>
                                            <div 
                                                className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 z-30 flex items-center justify-center group-hover:bg-white/5 transition-colors"
                                                onMouseDown={(e) => handleResizeRightDown(e, clip)}
                                                onTouchStart={(e) => handleResizeRightDown(e, clip)}
                                            >
                                                <div className="w-1 h-4 bg-white/50 rounded-full"></div>
                                            </div>
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