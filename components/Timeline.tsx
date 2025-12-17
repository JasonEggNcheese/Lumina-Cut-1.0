import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ProjectState, Track, Clip, TrackType, TransitionType, Marker } from '../types';
import { Video, Mic, Type, Scissors, Trash2, ZoomIn, ZoomOut, MoreHorizontal, MousePointer2, Flag, Snowflake, Copy, ClipboardPaste } from 'lucide-react';

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
  onAddMarker: (time: number) => void;
  onUpdateMarker: (id: string, updates: Partial<Marker>) => void;
  onDeleteMarker: (id: string) => void;
  onFreezeFrame: () => void;
  onCopyClip: () => void;
  onPasteClip: () => void;
  isPasteEnabled: boolean;
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

interface MarkerDragState {
    markerId: string;
    startX: number;
    initialTime: number;
}

interface ContextMenu {
    x: number;
    y: number;
    markerId: string;
}

const WaveformVisualizer = ({ width, color = "#10b981", height = 24 }: { width: number, color?: string, height?: number }) => {
    const pathData = useMemo(() => {
        if (width <= 0) return '';
        const points = [];
        const barWidth = 2; const gap = 2;
        const numBars = Math.floor(width / (barWidth + gap));
        const midY = height / 2;
        for (let i = 0; i < numBars; i++) {
            const x = i * (barWidth + gap);
            const structure = Math.pow(Math.sin(i * 0.1), 2) * Math.cos(i * 0.05);
            const detail = (Math.sin(i * 0.5) + 1) / 2;
            const normalizedHeight = (0.6 * structure + 0.4 * detail) * midY * 0.8;
            points.push(`M ${x},${midY - normalizedHeight} v ${normalizedHeight * 2}`);
        }
        return points.join(' ');
    }, [width, height]);

    return <svg width="100%" height={height} className="absolute top-1/2 -translate-y-1/2 pointer-events-none opacity-80" preserveAspectRatio="none"><path d={pathData} stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" fill="none" /></svg>;
}

export const Timeline: React.FC<TimelineProps> = ({ 
  state, onSeek, onSelectClip, onUpdateClip, onSplitClip, onDeleteClip, onZoom,
  onToggleTrackMute, onToggleTrackSolo, onToggleTrackRecord, onApplyTransition,
  onAddMarker, onUpdateMarker, onDeleteMarker, onFreezeFrame,
  onCopyClip, onPasteClip, isPasteEnabled
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingHeader, setIsDraggingHeader] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [markerDragState, setMarkerDragState] = useState<MarkerDragState | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const timeToPx = (time: number) => time * state.zoom;
  const pxToTime = (px: number) => px / state.zoom;
  const getHeaderWidth = () => window.innerWidth < 768 ? 50 : 200;

  const handleTimelineInteraction = (clientX: number) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left - getHeaderWidth();
    if (offsetX < 0) return;
    onSeek(Math.max(0, pxToTime(offsetX)));
  };

  const handleTimelineHeaderClick = (e: React.MouseEvent) => {
    handleTimelineInteraction(e.clientX);
    if (contextMenu) setContextMenu(null);
  };

  const handleHeaderMouseMove = (e: React.MouseEvent) => { if (isDraggingHeader) handleTimelineInteraction(e.clientX); };
  const handleHeaderTouchMove = (e: React.TouchEvent) => { if (isDraggingHeader) handleTimelineInteraction(e.touches[0].clientX); };
  const handleHeaderMouseUp = () => setIsDraggingHeader(false);

  const handleClipMouseDown = (e: React.MouseEvent | React.TouchEvent, clip: Clip) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    onSelectClip(clip.id);
    setDragState({ clipId: clip.id, startX: clientX, initialStartOffset: clip.startOffset, initialTrackId: clip.trackId, initialDuration: clip.duration, initialSourceStart: clip.sourceStart, type: 'move' });
  };

  const handleResizeLeftDown = (e: React.MouseEvent | React.TouchEvent, clip: Clip) => {
    e.preventDefault(); e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    onSelectClip(clip.id);
    setDragState({ clipId: clip.id, startX: clientX, initialStartOffset: clip.startOffset, initialTrackId: clip.trackId, initialDuration: clip.duration, initialSourceStart: clip.sourceStart, type: 'resize-left' });
  };

  const handleResizeRightDown = (e: React.MouseEvent | React.TouchEvent, clip: Clip) => {
    e.preventDefault(); e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    onSelectClip(clip.id);
    setDragState({ clipId: clip.id, startX: clientX, initialStartOffset: clip.startOffset, initialTrackId: clip.trackId, initialDuration: clip.duration, initialSourceStart: clip.sourceStart, type: 'resize-right' });
  };
  
  const handleMarkerMouseDown = (e: React.MouseEvent | React.TouchEvent, marker: Marker) => {
      e.stopPropagation();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      setMarkerDragState({ markerId: marker.id, startX: clientX, initialTime: marker.time });
  };

  const handleMarkerContextMenu = (e: React.MouseEvent, marker: Marker) => {
      e.preventDefault(); e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, markerId: marker.id });
  };
  
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };

  const handleDropTransition = (e: React.DragEvent, clip: Clip) => {
      e.preventDefault(); e.stopPropagation();
      const type = e.dataTransfer.getData('transitionType') as TransitionType;
      if (type && onApplyTransition && (clip.type === 'video' || clip.type === 'image' || clip.type === 'text')) {
          onApplyTransition(clip.id, type);
      }
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
        if (isDraggingHeader) {
            if (timelineRef.current) {
                 const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                 const rect = timelineRef.current.getBoundingClientRect();
                 const offsetX = clientX - rect.left - getHeaderWidth();
                 onSeek(Math.max(0, pxToTime(offsetX)));
            }
        }
        
        const snapPoints = [0, state.currentTime, ...state.markers.map(m => m.time)];
        state.clips.forEach(c => { snapPoints.push(c.startOffset, c.startOffset + c.duration); });
        const snapThreshold = pxToTime(10);
        
        if (dragState) {
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const deltaX = clientX - dragState.startX;
            let deltaTime = pxToTime(deltaX);
            const clip = state.clips.find(c => c.id === dragState.clipId);
            if (!clip) return;
            const clipSnapPoints = snapPoints.filter(p => p !== clip.startOffset && p !== clip.startOffset + clip.duration);
            let snapCandidate = null;

            if (dragState.type === 'move') {
                let newStart = Math.max(0, dragState.initialStartOffset + deltaTime);
                let closestDist = snapThreshold;
                for (const point of clipSnapPoints) {
                    const distStart = Math.abs(newStart - point);
                    if (distStart < closestDist) { closestDist = distStart; newStart = point; snapCandidate = point; }
                    const distEnd = Math.abs(newStart + clip.duration - point);
                    if (distEnd < closestDist) { closestDist = distEnd; newStart = point - clip.duration; snapCandidate = point; }
                }
                setSnapLine(snapCandidate);

                let newTrackId = dragState.initialTrackId;
                if (timelineRef.current) {
                    const rect = timelineRef.current.getBoundingClientRect();
                    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
                    const trackIndex = Math.floor((y - 32) / 96);
                    if (trackIndex >= 0 && trackIndex < state.tracks.length) {
                        const targetTrack = state.tracks[trackIndex];
                        const canDrop = ((clip.type === 'video' || clip.type === 'image') && targetTrack.type === TrackType.VIDEO) || (clip.type === 'audio' && targetTrack.type === TrackType.AUDIO) || (clip.type === 'text' && targetTrack.type === TrackType.TEXT);
                        if (canDrop) newTrackId = targetTrack.id;
                    }
                }
                onUpdateClip(clip.id, { startOffset: newStart, trackId: newTrackId });
            } else if (dragState.type === 'resize-left') {
                let newStart = dragState.initialStartOffset + deltaTime;
                let closestDist = snapThreshold;
                for (const point of clipSnapPoints) {
                    const dist = Math.abs(newStart - point);
                    if (dist < closestDist) { closestDist = dist; newStart = point; snapCandidate = point; }
                }
                deltaTime = newStart - dragState.initialStartOffset;
                const newDuration = dragState.initialDuration - deltaTime;
                const newSourceStart = dragState.initialSourceStart + deltaTime;
                if (newDuration >= 0.1 && newSourceStart >= 0) {
                    setSnapLine(snapCandidate);
                    onUpdateClip(clip.id, { startOffset: newStart, duration: newDuration, sourceStart: newSourceStart });
                }
            } else if (dragState.type === 'resize-right') {
                let newEnd = dragState.initialStartOffset + dragState.initialDuration + deltaTime;
                let closestDist = snapThreshold;
                for (const point of clipSnapPoints) {
                    const dist = Math.abs(newEnd - point);
                    if (dist < closestDist) { closestDist = dist; newEnd = point; snapCandidate = point; }
                }
                const newDuration = newEnd - dragState.initialStartOffset;
                if (newDuration >= 0.1) {
                    setSnapLine(snapCandidate);
                    onUpdateClip(clip.id, { duration: newDuration });
                }
            }
        }
        
        if (markerDragState) {
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const deltaX = clientX - markerDragState.startX;
            let newTime = Math.max(0, markerDragState.initialTime + pxToTime(deltaX));
            const markerSnapPoints = snapPoints.filter(p => p !== markerDragState.initialTime);
            let closestDist = snapThreshold;
            let snapCandidate = null;
            for (const point of markerSnapPoints) {
                const dist = Math.abs(newTime - point);
                if (dist < closestDist) { closestDist = dist; newTime = point; snapCandidate = point; }
            }
            setSnapLine(snapCandidate);
            onUpdateMarker(markerDragState.markerId, { time: newTime });
        }
    };
    const handleGlobalUp = () => { setIsDraggingHeader(false); setDragState(null); setMarkerDragState(null); setSnapLine(null); };
    const handleGlobalClick = () => { if(contextMenu) setContextMenu(null); }

    if (isDraggingHeader || dragState || markerDragState) {
        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('touchmove', handleGlobalMove, { passive: false });
        window.addEventListener('mouseup', handleGlobalUp);
        window.addEventListener('touchend', handleGlobalUp);
    }
    window.addEventListener('click', handleGlobalClick);

    return () => {
        window.removeEventListener('mousemove', handleGlobalMove);
        window.removeEventListener('touchmove', handleGlobalMove);
        window.removeEventListener('mouseup', handleGlobalUp);
        window.removeEventListener('touchend', handleGlobalUp);
        window.removeEventListener('click', handleGlobalClick);
    };
  }, [isDraggingHeader, dragState, markerDragState, state, onUpdateClip, onSeek, onUpdateMarker, contextMenu]);

  const renderRuler = () => {
    const ticks = [];
    const step = state.zoom > 50 ? 1 : state.zoom > 20 ? 5 : 10;
    const totalSeconds = Math.max(state.duration + 10, 60);
    for (let i = 0; i <= totalSeconds; i += step) {
      ticks.push(<div key={i} className="absolute top-0 h-4 border-l border-gray-600 text-[10px] text-gray-500 pl-1 select-none pointer-events-none" style={{ left: timeToPx(i) }}>{i % (step * 2) === 0 ? `${Math.floor(i/60)}:${(i%60).toString().padStart(2,'0')}` : ''}</div>);
    }
    return ticks;
  };

  const getTrackIcon = (type: TrackType) => {
    switch (type) {
      case TrackType.VIDEO: return <Video size={16} />;
      case TrackType.AUDIO: return <Mic size={16} />;
      case TrackType.TEXT: return <Type size={16} />;
    }
  };
  
  const selectedClip = state.clips.find(c => c.selected);

  return (
    <div className="flex flex-col h-full bg-gray-900 select-none text-white">
      <div className="h-10 border-b border-gray-800 bg-gray-850 flex items-center px-2 md:px-4 justify-between shrink-0">
        <div className="flex items-center gap-2">
            <div className="hidden md:flex bg-gray-800 rounded p-0.5 mr-2"><button className="p-1 rounded bg-gray-700 shadow text-white"><MousePointer2 size={14}/></button></div>
            <button onClick={onSplitClip} className="p-2 md:p-1.5 rounded bg-gray-800 md:bg-transparent hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-30" title="Split (S)"><Scissors size={16} /></button>
            <button onClick={onFreezeFrame} className="p-2 md:p-1.5 rounded bg-gray-800 md:bg-transparent hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-30" title="Freeze Frame"><Snowflake size={16} /></button>
            <div className="h-4 w-px bg-gray-700 mx-1 hidden md:block"></div>
            <button onClick={onCopyClip} disabled={!selectedClip} className="p-2 md:p-1.5 rounded bg-gray-800 md:bg-transparent hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300" title="Copy (Cmd+C)"><Copy size={16} /></button>
            <button onClick={onPasteClip} disabled={!isPasteEnabled} className="p-2 md:p-1.5 rounded bg-gray-800 md:bg-transparent hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300" title="Paste (Cmd+V)"><ClipboardPaste size={16} /></button>
            <div className="h-4 w-px bg-gray-700 mx-1 hidden md:block"></div>
            <button onClick={onDeleteClip} className="p-2 md:p-1.5 rounded bg-gray-800 md:bg-transparent hover:bg-gray-700 text-gray-300 hover:text-red-400 disabled:opacity-30" title="Delete (Del)"><Trash2 size={16} /></button>
            <button onClick={() => onAddMarker(state.currentTime)} className="p-2 md:p-1.5 rounded bg-gray-800 md:bg-transparent hover:bg-gray-700 text-gray-300 hover:text-white" title="Add Marker (M)"><Flag size={16} /></button>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => onZoom(-10)} className="p-1 hover:text-violet-400"><ZoomOut size={16} /></button>
            <div className="w-12 md:w-20 h-1 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-violet-500" style={{ width: `${Math.min(100, (state.zoom / 100) * 100)}%` }} /></div>
            <button onClick={() => onZoom(10)} className="p-1 hover:text-violet-400"><ZoomIn size={16} /></button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden relative" onMouseMove={handleHeaderMouseMove} onTouchMove={handleHeaderTouchMove}>
        <div className="w-[50px] md:w-[200px] flex-shrink-0 border-r border-gray-800 bg-gray-900 z-10 flex flex-col pt-8 transition-all duration-300">
            {state.tracks.map(track => (
                <div key={track.id} className="h-24 border-b border-gray-800 px-0 md:px-3 flex flex-col justify-center items-center md:items-stretch group hover:bg-gray-850 transition-colors relative">
                    <div className="flex items-center justify-center md:justify-between text-gray-400 mb-0 md:mb-1"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">{getTrackIcon(track.type)}<span className="hidden md:inline">{track.name}</span></span><MoreHorizontal size={14} className="hidden md:block opacity-0 group-hover:opacity-100 cursor-pointer" /></div>
                    <div className="hidden md:flex gap-2 mt-2">
                         <button onClick={() => onToggleTrackMute(track.id)} className={`text-xs px-2 py-0.5 rounded ${track.isMuted ? 'bg-red-500/80 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'}`}>M</button>
                         <button onClick={() => onToggleTrackSolo(track.id)} className={`text-xs px-2 py-0.5 rounded ${track.isSolo ? 'bg-yellow-500 text-black font-bold' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'}`}>S</button>
                         <button onClick={() => onToggleTrackRecord(track.id)} className={`text-xs px-2 py-0.5 rounded ${track.isRecordArmed ? 'bg-red-600 text-white font-bold animate-pulse' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'}`}>R</button>
                    </div>
                </div>
            ))}
        </div>
        <div className="flex-1 relative overflow-x-auto overflow-y-hidden bg-gray-950 touch-pan-x" ref={timelineRef} onClick={handleTimelineHeaderClick}>
            <div className="h-8 border-b border-gray-800 bg-gray-900 sticky top-0 z-10 w-full" style={{ minWidth: '100%', width: timeToPx(state.duration) + 500 }}>
                {renderRuler()}
                {state.markers.map(marker => (
                    <div key={marker.id} className="absolute top-0 h-8 flex flex-col items-center group cursor-pointer touch-none" style={{ left: timeToPx(marker.time) }} onMouseDown={(e) => handleMarkerMouseDown(e, marker)} onClick={(e) => { e.stopPropagation(); onSeek(marker.time); }} onContextMenu={(e) => handleMarkerContextMenu(e, marker)}>
                        <div className="w-3 h-3 rotate-45 -mt-1.5" style={{ backgroundColor: marker.color }}></div><div className="h-full w-px" style={{ backgroundColor: marker.color }}></div><div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">{marker.label}</div>
                    </div>
                ))}
                <div className="absolute top-0 h-8 w-10 -ml-5 z-20 cursor-ew-resize group flex justify-center touch-none" style={{ left: timeToPx(state.currentTime) }} onMouseDown={(e) => { e.stopPropagation(); setIsDraggingHeader(true); }} onTouchStart={(e) => { e.stopPropagation(); setIsDraggingHeader(true); }}><div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-violet-500" /></div>
            </div>
            {contextMenu && (<div className="fixed z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg text-white text-xs" style={{ top: contextMenu.y, left: contextMenu.x }}><button onClick={() => { onDeleteMarker(contextMenu.markerId); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-red-800/50 flex items-center gap-2"><Trash2 size={12} /> Delete Marker</button></div>)}
            <div className="relative" style={{ minWidth: '100%', width: timeToPx(state.duration) + 500 }}>
                <div className="absolute top-0 bottom-0 w-px bg-violet-500 z-20 pointer-events-none" style={{ left: timeToPx(state.currentTime), height: state.tracks.length * 96 }} />
                {snapLine !== null && <div className="absolute top-0 bottom-0 w-px bg-yellow-400 z-30 pointer-events-none shadow-[0_0_10px_rgba(250,204,21,0.5)]" style={{ left: timeToPx(snapLine), height: state.tracks.length * 96 }} />}
                {state.tracks.map(track => (
                    <div key={track.id} className="h-24 border-b border-gray-800 relative bg-gray-950/50">
                        <div className="absolute inset-0 w-full h-full pointer-events-none opacity-5 bg-[linear-gradient(90deg,transparent_49%,#fff_50%,transparent_51%)]" style={{ backgroundSize: `${state.zoom * 10}px 100%` }}></div>
                        {state.clips.filter(c => c.trackId === track.id).map(clip => {
                            const width = timeToPx(clip.duration); const aiDuration = clip.properties.aiExtendedDuration || 0; const aiWidth = timeToPx(aiDuration); const isDragging = dragState?.clipId === clip.id && dragState.type === 'move';
                            return (
                                <div key={clip.id} className={`absolute top-2 bottom-2 rounded-md overflow-hidden cursor-pointer border ring-offset-1 ring-offset-gray-900 transition-shadow touch-none group ${clip.selected ? 'border-violet-400 ring-2 ring-violet-500 z-10' : 'border-gray-700 hover:border-gray-500'} ${clip.type === 'audio' ? 'bg-emerald-900/30' : clip.type === 'text' ? 'bg-blue-900/30' : 'bg-violet-900/30'} ${isDragging ? 'opacity-80 scale-[1.01] shadow-xl z-50 cursor-grabbing' : 'cursor-grab'}`} style={{ left: timeToPx(clip.startOffset), width: Math.max(2, width) }} onMouseDown={(e) => handleClipMouseDown(e, clip)} onTouchStart={(e) => handleClipMouseDown(e, clip)} onDragOver={handleDragOver} onDrop={(e) => handleDropTransition(e, clip)}>
                                    {clip.type === 'video' && clip.thumbnail && (
                                        <div className="absolute inset-0 w-full h-full flex overflow-hidden">
                                            {Array(Math.ceil(width / 70)).fill(0).map((_, i) => (
                                                <img key={i} src={clip.thumbnail} className="w-auto h-full" style={{ transform: `translateX(-${(i % 2) * 20}px)` }} />
                                            ))}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                        </div>
                                    )}
                                    {clip.type === 'audio' && <WaveformVisualizer width={width} height={60} color="#34d399" />}
                                    {clip.transition && <div className="absolute left-0 top-0 bottom-0 bg-yellow-500/50 border-r border-yellow-500 z-20 flex items-center justify-center overflow-hidden" style={{ width: timeToPx(clip.transition.duration) }} title={`${clip.transition.type} (${clip.transition.duration}s)`}><div className="bg-yellow-400/20 w-full h-full absolute animate-pulse"></div></div>}
                                    {aiDuration > 0 && <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 border-l-2 border-dashed border-emerald-500/50 z-0" style={{ width: aiWidth }}><div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:4px_4px]"></div></div>}
                                    <div className="absolute top-0 left-0 right-0 px-2 py-1 text-xs truncate text-white/90 drop-shadow-md select-none bg-black/20 z-10 pointer-events-none">{clip.name}</div>
                                    {clip.type === 'text' && <div className="p-2 pt-6 text-center text-xs text-white/80 overflow-hidden pointer-events-none whitespace-pre-wrap">{clip.properties.textContent}</div>}
                                    {clip.selected && (<><div className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 z-30 flex items-center justify-center group-hover:bg-white/5 transition-colors" onMouseDown={(e) => handleResizeLeftDown(e, clip)} onTouchStart={(e) => handleResizeLeftDown(e, clip)}><div className="w-1 h-4 bg-white/50 rounded-full"></div></div><div className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 z-30 flex items-center justify-center group-hover:bg-white/5 transition-colors" onMouseDown={(e) => handleResizeRightDown(e, clip)} onTouchStart={(e) => handleResizeRightDown(e, clip)}><div className="w-1 h-4 bg-white/50 rounded-full"></div></div></>)}
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