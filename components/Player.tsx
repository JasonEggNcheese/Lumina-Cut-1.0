import React, { useRef, useEffect } from 'react';
import { Clip, ProjectState } from '../types';
import { Play, Pause, SkipBack, SkipForward, Maximize2, ScanFace, Sparkles } from 'lucide-react';

interface PlayerProps {
  projectState: ProjectState;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
}

export const Player: React.FC<PlayerProps> = ({ projectState, onTogglePlay, onSeek }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // In a real editor, this would be a canvas or a complex composition engine.
  // For this simulated SPA, we will render the top-most visible video clip at current time.
  // Audio would be handled by WebAudio API ideally, but we'll skip complex audio mixing for this demo level.

  const getCurrentVisibleClip = (): Clip | undefined => {
    // Sort tracks by order (visual z-index usually top tracks cover bottom ones)
    // Find clips that overlap with currentTime
    // Return the one from the highest visual priority track (e.g. Video 2 > Video 1)
    
    // Simple logic: Find first video/image clip in any track that covers current time
    return projectState.clips
      .filter(c => c.type !== 'audio')
      .find(c => projectState.currentTime >= c.startOffset && projectState.currentTime < c.startOffset + c.duration);
  };

  const activeClip = getCurrentVisibleClip();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getAspectRatioStyle = () => {
      switch(projectState.aspectRatio) {
          case '9:16': return { width: '33.75vh', height: '60vh' }; // 9/16 = 0.5625 ratio. if h=60vh, w=33.75
          case '1:1': return { width: '50vh', height: '50vh' };
          case '4:5': return { width: '40vh', height: '50vh' };
          case '16:9': default: return { width: '100%', height: '100%', maxWidth: 'aspect-video' }; 
      }
  };

  // Logic to determine if we are in the "Extended" portion of the clip
  const isExtendedFrame = activeClip && activeClip.properties.aiExtendedDuration && 
    (projectState.currentTime > (activeClip.startOffset + activeClip.duration - activeClip.properties.aiExtendedDuration));

  // Construct CSS Filters from properties and effects
  const getFilterString = () => {
    if (!activeClip) return '';
    
    const { brightness, contrast, saturation, effects } = activeClip.properties;
    let filter = `brightness(${1 + (brightness || 0)/100}) contrast(${1 + (contrast || 0)/100}) saturate(${(saturation || 100)/100})`;
    
    if (effects) {
        effects.forEach(e => {
            switch(e.type) {
                case 'blur': filter += ` blur(${e.intensity / 5}px)`; break;
                case 'sepia': filter += ` sepia(${e.intensity / 100})`; break;
                case 'grayscale': filter += ` grayscale(${e.intensity / 100})`; break;
                case 'invert': filter += ` invert(${e.intensity / 100})`; break;
                case 'hue': filter += ` hue-rotate(${e.intensity * 3.6}deg)`; break;
            }
        });
    }

    if (isExtendedFrame) {
        filter += ` sepia(0.3) grayscale(0.2)`;
    }

    return filter;
  };

  const hasVignette = activeClip?.properties.effects?.some(e => e.type === 'vignette');
  const vignetteIntensity = activeClip?.properties.effects?.find(e => e.type === 'vignette')?.intensity || 0;

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-gray-950" ref={containerRef}>
        
        {/* Aspect Ratio Container */}
        <div 
            className={`relative bg-black shadow-2xl overflow-hidden transition-all duration-300 border border-gray-800
                ${projectState.aspectRatio === '16:9' ? 'w-full h-full' : ''}`}
            style={projectState.aspectRatio === '16:9' ? {} : getAspectRatioStyle()}
        >
            {activeClip ? (
            activeClip.type === 'video' || activeClip.type === 'image' ? (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    {/* Simulated Rendering */}
                    {/* Note: In a real app we'd seek the video element to (currentTime - startOffset + sourceStart) */}
                    {activeClip.type === 'video' ? (
                        <div 
                            className="relative w-full h-full flex items-center justify-center"
                        >
                            <img 
                            src={activeClip.src.startsWith('blob') ? 'https://picsum.photos/seed/video/800/450' : activeClip.src} 
                            alt="Video Frame" 
                            className={`absolute object-cover transition-transform duration-200 ${isExtendedFrame ? 'grayscale-[0.5]' : ''}`}
                            style={{ 
                                width: '100%',
                                height: '100%',
                                objectFit: projectState.aspectRatio === '16:9' ? 'contain' : 'cover',
                                transform: `
                                    scale(${(activeClip.properties.scale || 100) / 100})
                                    translate(${activeClip.properties.position?.x || 0}%, ${activeClip.properties.position?.y || 0}%)
                                `,
                                filter: getFilterString()
                            }} 
                            />
                            
                            {/* Vignette Overlay */}
                            {hasVignette && (
                                <div 
                                    className="absolute inset-0 pointer-events-none z-10"
                                    style={{
                                        background: `radial-gradient(circle, transparent ${100 - vignetteIntensity}%, black 150%)`
                                    }}
                                />
                            )}
                            
                            {/* Smart Extend Indicator */}
                            {isExtendedFrame && (
                                <div className="absolute top-4 right-4 bg-emerald-900/80 border border-emerald-500/50 backdrop-blur-sm text-emerald-100 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg z-20 animate-pulse">
                                    <Sparkles size={12} className="text-emerald-400" />
                                    AI Generated Frames
                                </div>
                            )}

                            {/* Magic Mask Overlay Simulation */}
                            {activeClip.properties.activeMaskId && activeClip.properties.maskOverlayVisible && !isExtendedFrame && (
                                <div className="absolute inset-0 pointer-events-none mix-blend-overlay z-20">
                                    {/* Simulated tracking blob - moves slightly with time to fake tracking */}
                                    <div 
                                        className="absolute bg-red-500/40 blur-xl rounded-full transition-all duration-300 ease-linear animate-pulse border-2 border-red-500/50"
                                        style={{
                                            width: '30%',
                                            height: '40%',
                                            left: `${35 + Math.sin(projectState.currentTime) * 5}%`,
                                            top: `${25 + Math.cos(projectState.currentTime * 1.5) * 5}%`,
                                        }}
                                    >
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap opacity-80 flex items-center gap-1">
                                            <ScanFace size={10} />
                                            {activeClip.properties.activeMaskId}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="bg-black/50 px-3 py-1 rounded text-sm font-mono opacity-0 hover:opacity-100 transition-opacity">
                                    [Video Playing: {activeClip.name}] <br/>
                                    Source Time: {formatTime(projectState.currentTime - activeClip.startOffset + activeClip.sourceStart)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="relative w-full h-full">
                            <img 
                                src={activeClip.src} 
                                alt="Active Clip" 
                                className="absolute object-cover transition-transform" 
                                style={{ 
                                    width: '100%',
                                    height: '100%',
                                    objectFit: projectState.aspectRatio === '16:9' ? 'contain' : 'cover',
                                    transform: `
                                        scale(${(activeClip.properties.scale || 100) / 100})
                                        translate(${activeClip.properties.position?.x || 0}%, ${activeClip.properties.position?.y || 0}%)
                                    `,
                                    filter: getFilterString()
                                }} 
                            />
                            {hasVignette && (
                                <div 
                                    className="absolute inset-0 pointer-events-none z-10"
                                    style={{
                                        background: `radial-gradient(circle, transparent ${100 - vignetteIntensity}%, black 150%)`
                                    }}
                                />
                            )}
                        </div>
                    )}
                </div>
            ) : null
            ) : (
            <div className="text-gray-700 flex flex-col items-center h-full justify-center">
                <div className="w-16 h-16 border-2 border-gray-800 rounded-full flex items-center justify-center mb-4">
                    <Play className="ml-1 opacity-20" size={32} />
                </div>
                <p>No Signal</p>
            </div>
            )}
        </div>
      </div>

      {/* Controls */}
      <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-6">
         <div className="flex items-center gap-2 text-sm font-mono text-gray-400 w-24">
            {formatTime(projectState.currentTime)}
         </div>

         <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-white" onClick={() => onSeek(0)}>
                <SkipBack size={20} />
            </button>
            <button 
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors"
                onClick={onTogglePlay}
            >
                {projectState.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>
            <button className="text-gray-400 hover:text-white" onClick={() => onSeek(projectState.duration)}>
                <SkipForward size={20} />
            </button>
         </div>

         <div className="flex items-center gap-2 w-24 justify-end">
            <button className="text-gray-400 hover:text-white">
                <Maximize2 size={18} />
            </button>
         </div>
      </div>
    </div>
  );
};