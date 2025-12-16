import React, { useRef, useEffect } from 'react';
import { Clip, ProjectState } from '../types';
import { Play, Pause, SkipBack, SkipForward, Maximize2, ScanFace, Sparkles } from 'lucide-react';

interface PlayerProps {
  projectState: ProjectState;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
}

// Global state for Web Audio API
let audioContext: AudioContext | null = null;
const audioNodes = new Map<HTMLMediaElement, { source: MediaElementAudioSourceNode, panner: StereoPannerNode }>();

const initAudioContext = () => {
    if (audioContext) return;
    try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    } catch (e) {
        console.error("Web Audio API is not supported.");
    }
};

const setupAudioNode = (mediaElement: HTMLMediaElement) => {
    if (!audioContext || audioNodes.has(mediaElement)) return;
    try {
        const source = audioContext.createMediaElementSource(mediaElement);
        const panner = audioContext.createStereoPanner();
        source.connect(panner).connect(audioContext.destination);
        audioNodes.set(mediaElement, { source, panner });
    } catch (e) {
        console.warn("Error creating audio source for element:", e);
    }
};


// Sub-component to handle non-visual audio playback (background music, etc.)
const AudioTrackPlayer: React.FC<{ clip: Clip; projectState: ProjectState }> = ({ clip, projectState }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audioContext && !audioNodes.has(audio)) {
            setupAudioNode(audio);
        }

        const targetTime = projectState.currentTime - clip.startOffset + clip.sourceStart;
        
        if (projectState.isPlaying) {
            if (Math.abs(audio.currentTime - targetTime) > 0.25) audio.currentTime = targetTime;
            if (audio.paused) audio.play().catch(() => {});
        } else {
            audio.pause();
            if (Math.abs(audio.currentTime - targetTime) > 0.05) audio.currentTime = targetTime;
        }

        const track = projectState.tracks.find(t => t.id === clip.trackId);
        const anySolo = projectState.tracks.some(t => t.isSolo);
        const isMuted = track ? (track.isMuted || (anySolo && !track.isSolo)) : false;

        audio.volume = isMuted ? 0 : Math.min(1, Math.max(0, (clip.properties.volume ?? 100) / 100));

        const nodes = audioNodes.get(audio);
        if (nodes && audioContext) {
            const panValue = (clip.properties.pan ?? 0) / 50; // -1 to 1
            nodes.panner.pan.setValueAtTime(panValue, audioContext.currentTime);
        }
        
    }, [projectState.currentTime, projectState.isPlaying, clip, projectState.tracks]);

    return <audio ref={audioRef} src={clip.src} crossOrigin="anonymous" />;
};

export const Player: React.FC<PlayerProps> = ({ projectState, onTogglePlay, onSeek }) => {
  const videoElementsRef = useRef(new Map<string, HTMLVideoElement>());
  
  const getActiveVisualClips = (): Clip[] => {
    const anySolo = projectState.tracks.some(t => t.isSolo);
    const trackOrder = projectState.tracks.map(t => t.id);

    return projectState.clips
      .filter(c => {
        const track = projectState.tracks.find(t => t.id === c.trackId);
        if (!track || track.isMuted || (anySolo && !track.isSolo)) return false;
        return (c.type === 'video' || c.type === 'image') &&
               projectState.currentTime >= c.startOffset && 
               projectState.currentTime < c.startOffset + c.duration;
      })
      .sort((a, b) => trackOrder.indexOf(a.trackId) - trackOrder.indexOf(b.trackId));
  };

  const getActiveTextClips = (): Clip[] => {
      const anySolo = projectState.tracks.some(t => t.isSolo);
      return projectState.clips.filter(c => {
          const track = projectState.tracks.find(t => t.id === c.trackId);
          if (!track || track.isMuted || (anySolo && !track.isSolo)) return false;
          return c.type === 'text' &&
                 projectState.currentTime >= c.startOffset &&
                 projectState.currentTime < c.startOffset + c.duration;
      }).sort((a,b) => projectState.tracks.findIndex(t => t.id === a.trackId) - projectState.tracks.findIndex(t => t.id === b.trackId));
  };

  const getAudibleOnlyClips = (visualClipIds: Set<string>): Clip[] => {
      return projectState.clips.filter(c => 
          !visualClipIds.has(c.id) &&
          c.type === 'audio' &&
          projectState.currentTime >= c.startOffset && 
          projectState.currentTime < c.startOffset + c.duration
      );
  };

  const activeVisualClips = getActiveVisualClips();
  const activeTextClips = getActiveTextClips();
  const audibleOnlyClips = getAudibleOnlyClips(new Set(activeVisualClips.map(c => c.id)));

  useEffect(() => {
    activeVisualClips.forEach(clip => {
      if (clip.type !== 'video') return;
      const video = videoElementsRef.current.get(clip.id);
      if (!video) return;
      
      if (audioContext && !audioNodes.has(video)) {
          setupAudioNode(video);
      }
      
      let targetTime = projectState.currentTime - clip.startOffset + clip.sourceStart;
      
      if (projectState.isPlaying) {
          if (Math.abs(video.currentTime - targetTime) > 0.25) video.currentTime = targetTime;
          if (video.paused) video.play().catch(() => {});
      } else {
          video.pause();
          if (Math.abs(video.currentTime - targetTime) > 0.05) video.currentTime = targetTime;
      }

      const track = projectState.tracks.find(t => t.id === clip.trackId);
      const anySolo = projectState.tracks.some(t => t.isSolo);
      const isMuted = track ? (track.isMuted || (anySolo && !track.isSolo)) : false;

      video.volume = isMuted ? 0 : Math.min(1, Math.max(0, (clip.properties.volume ?? 100) / 100));

      const nodes = audioNodes.get(video);
      if (nodes && audioContext) {
          const panValue = (clip.properties.pan ?? 0) / 50;
          nodes.panner.pan.setValueAtTime(panValue, audioContext.currentTime);
      }
    });
  }, [projectState.currentTime, projectState.isPlaying, activeVisualClips, projectState.tracks]);

  const handleTogglePlay = () => {
      initAudioContext();
      if(audioContext && audioContext.state === 'suspended') {
          audioContext.resume();
      }
      onTogglePlay();
  }

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

  const getTransitionStyle = (clip: Clip) => {
      if (!clip.transition) return { opacity: 1 };
      const timeIntoClip = projectState.currentTime - clip.startOffset;
      const duration = clip.transition.duration;
      if (timeIntoClip >= duration) return { opacity: 1 };
      const progress = timeIntoClip / duration;

      switch (clip.transition.type) {
          case 'fade': case 'dissolve': return { opacity: progress };
          case 'slide-left': return { opacity: 1, transform: `translateX(${(1 - progress) * 100}%)` };
          case 'slide-right': return { opacity: 1, transform: `translateX(${-(1 - progress) * 100}%)` };
          case 'zoom': return { opacity: 1, transform: `scale(${progress})` };
          case 'wipe': return { opacity: 1, clipPath: `inset(0 ${100 - (progress * 100)}% 0 0)` };
          default: return { opacity: 1 };
      }
  };

  const getFilterString = (clip: Clip, forChroma: boolean = false) => {
    const { brightness, contrast, saturation, effects, chromaKey } = clip.properties;
    let filter = '';
    
    if (forChroma) {
        // Only apply tolerance filter to the video for chroma keying
        return `contrast(${1 + ((chromaKey?.tolerance || 0) / 25)})`;
    }

    // Base color grading
    filter += `brightness(${1 + (brightness || 0)/100}) contrast(${1 + (contrast || 0)/100}) saturate(${(saturation || 100)/100})`;

    // Standard effects
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

    // Chroma key related filters applied to the container
    if (chromaKey?.enabled) {
        const feather = chromaKey.feather || 0;
        const shadow = chromaKey.shadow || 0;
        if (feather > 0) filter += ` blur(${feather / 30}px)`;
        if (shadow > 0) filter += ` drop-shadow(0px ${shadow / 10}px ${shadow / 5}px rgba(0,0,0,${shadow / 125}))`;
    }
    
    return filter;
  };
  
  const getMergedTransform = (clip: Clip) => {
    const props = clip.properties;
    const chroma = props.chromaKey;
    const distance = chroma?.enabled ? (chroma.distance || 0) : 0;
    
    const base = `scale(${(props.scale || 100) / 100}) translate(${props.position?.x || 0}%, ${props.position?.y || 0}%)`;
    const transitionTransform = getTransitionStyle(clip).transform || '';
    const distanceTransform = `scale(${1 - (distance / 2000)}) translateY(-${distance / 10}%)`;

    return `${base} ${transitionTransform} ${distanceTransform}`;
  };

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-gray-950">
        {audibleOnlyClips.map(clip => <AudioTrackPlayer key={clip.id} clip={clip} projectState={projectState} />)}
        <div 
            className={`relative bg-black shadow-2xl overflow-hidden transition-all duration-300 border border-gray-800 ${projectState.aspectRatio === '16:9' ? 'w-full h-full' : ''}`}
            style={projectState.aspectRatio === '16:9' ? {} : getAspectRatioStyle()}
        >
            {activeVisualClips.length === 0 ? (
                <div className="text-gray-700 flex flex-col items-center h-full justify-center">
                    <div className="w-16 h-16 border-2 border-gray-800 rounded-full flex items-center justify-center mb-4">
                        <Play className="ml-1 opacity-20" size={32} />
                    </div>
                    <p>No Signal</p>
                </div>
            ) : (
                activeVisualClips.map((clip, index) => {
                    const props = clip.properties;
                    const transitionStyle = getTransitionStyle(clip);
                    
                    const isExtendedFrame = props.aiExtendedDuration && 
                        (projectState.currentTime > (clip.startOffset + clip.duration - props.aiExtendedDuration));
                    
                    const hasVignette = props.effects?.some(e => e.type === 'vignette');
                    const vignetteIntensity = props.effects?.find(e => e.type === 'vignette')?.intensity || 0;
                    const chroma = props.chromaKey;

                    const setVideoRef = (el: HTMLVideoElement | null) => {
                        if (el) videoElementsRef.current.set(clip.id, el);
                        else videoElementsRef.current.delete(clip.id);
                    };

                    const clipTransform = getMergedTransform(clip);
                    const clipFilter = getFilterString(clip);

                    const content = clip.type === 'video' ? (
                        <video
                            ref={setVideoRef}
                            src={clip.src}
                            className="w-full h-full object-cover"
                            style={{
                                objectFit: projectState.aspectRatio === '16:9' ? 'contain' : 'cover',
                                filter: chroma?.enabled ? getFilterString(clip, true) : undefined,
                                mixBlendMode: chroma?.enabled ? 'difference' : 'normal',
                            }}
                            playsInline crossOrigin="anonymous"
                        />
                    ) : (
                        <img 
                            src={clip.src} alt={clip.name} className="w-full h-full object-cover" 
                            style={{
                                objectFit: projectState.aspectRatio === '16:9' ? 'contain' : 'cover',
                                filter: chroma?.enabled ? getFilterString(clip, true) : undefined,
                                mixBlendMode: chroma?.enabled ? 'difference' : 'normal',
                            }}
                        />
                    );

                    return (
                        <div 
                            key={clip.id} 
                            className="absolute inset-0 w-full h-full"
                            style={{ 
                                zIndex: index,
                                transform: clipTransform,
                                clipPath: transitionStyle.clipPath,
                            }}
                        >
                            <div
                                className="w-full h-full"
                                style={{
                                    opacity: ((props.opacity ?? 100) / 100) * (transitionStyle.opacity ?? 1),
                                    filter: clipFilter,
                                    mixBlendMode: chroma?.enabled ? 'screen' : 'normal',
                                    backgroundColor: chroma?.enabled ? chroma.keyColor : 'transparent',
                                }}
                            >
                                {content}
                            </div>
                            
                            {/* Per-Clip Overlays (positioned relative to the transformed clip) */}
                            {hasVignette && <div className="absolute inset-0 pointer-events-none" style={{background: `radial-gradient(circle, transparent ${100 - vignetteIntensity}%, black 150%)`}} />}
                            {isExtendedFrame && (
                                <div className="absolute top-4 right-4 bg-emerald-900/80 border border-emerald-500/50 backdrop-blur-sm text-emerald-100 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg animate-pulse">
                                    <Sparkles size={12} className="text-emerald-400" /> AI Generated
                                </div>
                            )}
                            {props.activeMaskId && props.maskOverlayVisible && !isExtendedFrame && (
                                <div className="absolute inset-0 pointer-events-none mix-blend-overlay">
                                    <div className="absolute bg-red-500/40 blur-xl rounded-full transition-all duration-300 ease-linear animate-pulse border-2 border-red-500/50"
                                        style={{ width: '30%', height: '40%', left: `${35 + Math.sin(projectState.currentTime) * 5}%`, top: `${25 + Math.cos(projectState.currentTime * 1.5) * 5}%` }}>
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap opacity-80 flex items-center gap-1">
                                            <ScanFace size={10} /> {props.activeMaskId}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })
            )}

            {/* Text Overlays on top of all visual clips */}
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: activeVisualClips.length }}>
                {activeTextClips.map(clip => {
                    const props = clip.properties;
                    const transition = getTransitionStyle(clip);
                    return (
                        <div
                            key={clip.id}
                            className="absolute p-4 box-border w-full h-full flex justify-center items-center"
                            style={{
                                opacity: ((props.opacity ?? 100) / 100) * (transition.opacity ?? 1),
                                ...transition
                            }}
                        >
                            <div
                                style={{
                                    transform: getMergedTransform(clip),
                                    color: props.fontColor || '#FFFFFF',
                                    fontSize: `${props.fontSize || 24}px`,
                                    fontWeight: props.fontWeight || 'normal',
                                    textAlign: props.textAlign || 'center',
                                    fontFamily: props.fontFamily || 'sans-serif',
                                    backgroundColor: props.backgroundColor || 'transparent',
                                    whiteSpace: 'pre-wrap',
                                    padding: '0.2em 0.5em',
                                    borderRadius: '0.2em',
                                    lineHeight: 1.2
                                }}
                            >
                                {props.textContent}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
      </div>
      <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-6">
         <div className="flex items-center gap-2 text-sm font-mono text-gray-400 w-24">{formatTime(projectState.currentTime)}</div>
         <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-white" onClick={() => onSeek(0)}><SkipBack size={20} /></button>
            <button className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors" onClick={handleTogglePlay}>
                {projectState.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>
            <button className="text-gray-400 hover:text-white" onClick={() => onSeek(projectState.duration)}><SkipForward size={20} /></button>
         </div>
         <div className="flex items-center gap-2 w-24 justify-end"><button className="text-gray-400 hover:text-white"><Maximize2 size={18} /></button></div>
      </div>
    </div>
  );
};
