import React, { useRef, useEffect } from 'react';
import { Clip, ProjectState } from '../types';
import { Play, Pause, SkipBack, SkipForward, Maximize2, ScanFace, Sparkles } from 'lucide-react';

interface PlayerProps {
  projectState: ProjectState;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
}

// Sub-component to handle non-visual audio playback (background music, etc.)
const AudioTrackPlayer: React.FC<{ clip: Clip; projectState: ProjectState }> = ({ clip, projectState }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const targetTime = projectState.currentTime - clip.startOffset + clip.sourceStart;
        
        // Sync Logic
        if (projectState.isPlaying) {
            // Only adjust if drift is significant to prevent audio glitching
            if (Math.abs(audio.currentTime - targetTime) > 0.25) {
                audio.currentTime = targetTime;
            }
            if (audio.paused) {
                 audio.play().catch(() => {});
            }
        } else {
            audio.pause();
            if (Math.abs(audio.currentTime - targetTime) > 0.05) {
                 audio.currentTime = targetTime;
            }
        }

        // Check track mute/solo status
        const track = projectState.tracks.find(t => t.id === clip.trackId);
        
        // Global Solo Check
        const anySolo = projectState.tracks.some(t => t.isSolo);
        
        const isMuted = track ? (track.isMuted || (anySolo && !track.isSolo)) : false;

        // Update Volume/Pan
        audio.volume = isMuted ? 0 : Math.min(1, Math.max(0, (clip.properties.volume ?? 100) / 100));
        
    }, [projectState.currentTime, projectState.isPlaying, clip.startOffset, clip.sourceStart, clip.properties.volume, projectState.tracks, clip.trackId]);

    return <audio ref={audioRef} src={clip.src} />;
};

export const Player: React.FC<PlayerProps> = ({ projectState, onTogglePlay, onSeek }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // 1. Identify the Visible Clip (Top-most Video/Image layer)
  const getVisibleClip = (): Clip | undefined => {
    // Find all video/image clips active at current time
    // Also consider Solo status: if ANY track is soloed, only clips from SOLOED tracks are candidates.
    const anySolo = projectState.tracks.some(t => t.isSolo);

    const activeVisuals = projectState.clips.filter(c => {
        const track = projectState.tracks.find(t => t.id === c.trackId);
        if (!track) return false;

        // If track is muted, it's not visible
        if (track.isMuted) return false;
        
        // If Solo mode is active, track MUST be soloed to be visible
        if (anySolo && !track.isSolo) return false;

        return (
            (c.type === 'video' || c.type === 'image') &&
            projectState.currentTime >= c.startOffset && 
            projectState.currentTime < c.startOffset + c.duration
        );
    });
    
    // Sort by track ID or just take the last one (assuming last in array is top layer)
    // A better approach would be to look up Track order, but for now we assume array order = render order.
    return activeVisuals[activeVisuals.length - 1];
  };

  // 2. Identify Audio Clips (Background music, SFX, or hidden video tracks)
  const getAudibleClips = (visibleClipId: string | undefined): Clip[] => {
      // Audio clips also need to respect solo mode (filtered inside the player logic for volume, but we can optimize here too)
      return projectState.clips.filter(c => {
          const isActive = projectState.currentTime >= c.startOffset && projectState.currentTime < c.startOffset + c.duration;
          const isNotVisible = c.id !== visibleClipId; // Don't play audio for the clip already rendered in the video tag
          // We play audio for: 'audio' types AND 'video' types that aren't the visible one (e.g. video acting as backing track)
          return isActive && isNotVisible; 
      });
  };

  const activeClip = getVisibleClip();
  const backgroundClips = getAudibleClips(activeClip?.id);

  // Sync Logic for the Main Visual Video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip || activeClip.type !== 'video') return;

    let targetTime = projectState.currentTime - activeClip.startOffset + activeClip.sourceStart;
    
    // AI Extension Logic
    const aiExtension = activeClip.properties.aiExtendedDuration || 0;
    const isExtensionZone = aiExtension > 0 && (projectState.currentTime > (activeClip.startOffset + activeClip.duration - aiExtension));
    
    // If in extension zone, we just let the video pause or hold at the end. 
    // Usually standard video player behavior is fine, we just pause syncing if we are past duration.
    
    if (projectState.isPlaying && !isExtensionZone) {
        if (Math.abs(video.currentTime - targetTime) > 0.25) {
            video.currentTime = targetTime;
        }
        if (video.paused) {
             video.play().catch(() => {});
        }
    } else {
        video.pause();
        // If scrubbing
        if (!isExtensionZone && Math.abs(video.currentTime - targetTime) > 0.05) {
             video.currentTime = targetTime;
        }
    }

    // Check track mute/solo status
    const track = projectState.tracks.find(t => t.id === activeClip.trackId);
    
    // Check Global Solo
    const anySolo = projectState.tracks.some(t => t.isSolo);
    
    const isMuted = track ? (track.isMuted || (anySolo && !track.isSolo)) : false;

    // Volume for active video
    video.volume = isMuted ? 0 : Math.min(1, Math.max(0, (activeClip.properties.volume ?? 100) / 100));

  }, [projectState.currentTime, projectState.isPlaying, activeClip, projectState.tracks]);


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getAspectRatioStyle = () => {
      switch(projectState.aspectRatio) {
          case '9:16': return { width: '33.75vh', height: '60vh' }; 
          case '1:1': return { width: '50vh', height: '50vh' };
          case '4:5': return { width: '40vh', height: '50vh' };
          case '16:9': default: return { width: '100%', height: '100%', maxWidth: 'aspect-video' }; 
      }
  };

  const isExtendedFrame = activeClip && activeClip.properties.aiExtendedDuration && 
    (projectState.currentTime > (activeClip.startOffset + activeClip.duration - activeClip.properties.aiExtendedDuration));

  // Determine transition styles
  const getTransitionStyle = () => {
      if (!activeClip || !activeClip.transition) return {};

      const timeIntoClip = projectState.currentTime - activeClip.startOffset;
      const duration = activeClip.transition.duration;

      if (timeIntoClip >= duration) return {};

      const progress = timeIntoClip / duration; // 0 to 1

      switch (activeClip.transition.type) {
          case 'fade':
          case 'dissolve':
              return { opacity: progress };
          case 'slide-left':
              return { transform: `translateX(${(1 - progress) * 100}%)` };
          case 'slide-right':
              return { transform: `translateX(${-(1 - progress) * 100}%)` };
          case 'zoom':
              return { transform: `scale(${progress})` };
          case 'wipe':
              return { clipPath: `inset(0 ${100 - (progress * 100)}% 0 0)` };
          default:
              return {};
      }
  };

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
  
  const transitionStyle = getTransitionStyle();
  const baseTransform = activeClip ? `scale(${(activeClip.properties.scale || 100) / 100}) translate(${activeClip.properties.position?.x || 0}%, ${activeClip.properties.position?.y || 0}%)` : '';
  // Merge base transform with transition transform if both exist
  const mergedTransform = transitionStyle.transform ? `${baseTransform} ${transitionStyle.transform}` : baseTransform;

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-gray-950" ref={containerRef}>
        
        {/* Background Audio Players */}
        {backgroundClips.map(clip => (
            <AudioTrackPlayer key={clip.id} clip={clip} projectState={projectState} />
        ))}

        {/* Aspect Ratio Container */}
        <div 
            className={`relative bg-black shadow-2xl overflow-hidden transition-all duration-300 border border-gray-800
                ${projectState.aspectRatio === '16:9' ? 'w-full h-full' : ''}`}
            style={projectState.aspectRatio === '16:9' ? {} : getAspectRatioStyle()}
        >
            {activeClip ? (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    {activeClip.type === 'video' ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                            <video
                                ref={videoRef}
                                src={activeClip.src}
                                className={`absolute object-cover transition-transform duration-200 ${isExtendedFrame ? 'grayscale-[0.5]' : ''}`}
                                style={{ 
                                    width: '100%',
                                    height: '100%',
                                    objectFit: projectState.aspectRatio === '16:9' ? 'contain' : 'cover',
                                    filter: getFilterString(),
                                    ...transitionStyle,
                                    // Override transform since we merged it manually
                                    transform: mergedTransform
                                }}
                                playsInline
                                // Removed muted attribute to enable sound
                            />
                            {hasVignette && (
                                <div 
                                    className="absolute inset-0 pointer-events-none z-10"
                                    style={{
                                        background: `radial-gradient(circle, transparent ${100 - vignetteIntensity}%, black 150%)`
                                    }}
                                />
                            )}
                            
                            {isExtendedFrame && (
                                <div className="absolute top-4 right-4 bg-emerald-900/80 border border-emerald-500/50 backdrop-blur-sm text-emerald-100 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg z-20 animate-pulse">
                                    <Sparkles size={12} className="text-emerald-400" />
                                    AI Generated Frames
                                </div>
                            )}

                            {activeClip.properties.activeMaskId && activeClip.properties.maskOverlayVisible && !isExtendedFrame && (
                                <div className="absolute inset-0 pointer-events-none mix-blend-overlay z-20">
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
                                    filter: getFilterString(),
                                    ...transitionStyle,
                                    transform: mergedTransform
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