import React, { useRef, useEffect } from 'react';
import { Clip, ProjectState } from '../types';
import { Play, Pause, SkipBack, SkipForward, Maximize2, ScanFace, Sparkles } from 'lucide-react';

interface PlayerProps {
  projectState: ProjectState;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  playerRef: React.RefObject<HTMLDivElement>;
}

// Global state for Web Audio API
let audioContext: AudioContext | null = null;
const audioNodes = new Map<HTMLMediaElement, { source: MediaElementAudioSourceNode, panner: StereoPannerNode }>();

// --- Speed Ramping Logic ---
// Function to get the speed at a certain progress point (0-1) along the clip
const getSpeedAtProgress = (progress: number, points: {time: number, speed: number}[]) => {
    if (!points || points.length === 0) return 1;
    // Find the two points the progress is between
    let p1 = points[0], p2 = points[points.length - 1];
    for(let i = 0; i < points.length - 1; i++) {
        if (progress >= points[i].time && progress <= points[i+1].time) {
            p1 = points[i];
            p2 = points[i+1];
            break;
        }
    }
    // Linear interpolation between the two points
    const timeDiff = p2.time - p1.time;
    if (timeDiff === 0) return p1.speed;
    const progressInSegment = (progress - p1.time) / timeDiff;
    return p1.speed + (p2.speed - p1.speed) * progressInSegment;
};

// Calculate the total duration of the source media that would be played given the ramp
const calculateRampedSourceDuration = (timelineDuration: number, points: {time: number, speed: number}[]) => {
    let area = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        const segmentTimelineDuration = (p2.time - p1.time) * timelineDuration;
        const avgSpeed = (p1.speed + p2.speed) / 2;
        area += segmentTimelineDuration * avgSpeed;
    }
    return area;
};

// Calculate the source media time that corresponds to a given progress (0-1) on the timeline
const calculateSourceTimeAtProgress = (progress: number, timelineDuration: number, points: {time: number, speed: number}[]) => {
    let sourceTime = 0;
    let lastPoint = points[0];

    for (let i = 1; i < points.length; i++) {
        const currentPoint = points[i];
        if (progress > currentPoint.time) {
            const segmentDuration = (currentPoint.time - lastPoint.time) * timelineDuration;
            const avgSpeed = (lastPoint.speed + currentPoint.speed) / 2;
            sourceTime += segmentDuration * avgSpeed;
        } else {
            const segmentProgress = (progress - lastPoint.time) / (currentPoint.time - lastPoint.time);
            if (isNaN(segmentProgress) || segmentProgress === -Infinity || segmentProgress === Infinity) break;
            const speedAtProgress = lastPoint.speed + (currentPoint.speed - lastPoint.speed) * segmentProgress;
            const avgSpeed = (lastPoint.speed + speedAtProgress) / 2;
            const timeInSegment = segmentProgress * (currentPoint.time - lastPoint.time) * timelineDuration;
            sourceTime += timeInSegment * avgSpeed;
            break;
        }
        lastPoint = currentPoint;
    }
    return sourceTime;
};


const initAudioContext = () => {
    if (audioContext) return;
    try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') audioContext.resume();
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
    } catch (e) { console.warn("Error creating audio source:", e); }
};

const AudioTrackPlayer: React.FC<{ clip: Clip; projectState: ProjectState }> = ({ clip, projectState }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audioContext && !audioNodes.has(audio)) setupAudioNode(audio);
        
        const props = clip.properties;
        const isRamping = props.speedRamp?.enabled;
        
        if (isRamping) {
            audio.pause();
            const progress = (projectState.currentTime - clip.startOffset) / clip.duration;
            const sourceTime = calculateSourceTimeAtProgress(progress, clip.duration, props.speedRamp.points);
            audio.currentTime = clip.sourceStart + sourceTime;
        } else {
            audio.playbackRate = props.speed || 1;
            const targetTime = projectState.currentTime - clip.startOffset + clip.sourceStart;
            if (projectState.isPlaying && !props.reversed) {
                if (Math.abs(audio.currentTime - targetTime) > 0.25) audio.currentTime = targetTime;
                if (audio.paused) audio.play().catch(() => {});
            } else {
                audio.pause();
                if (Math.abs(audio.currentTime - targetTime) > 0.05) audio.currentTime = targetTime;
            }
        }

        const track = projectState.tracks.find(t => t.id === clip.trackId);
        const anySolo = projectState.tracks.some(t => t.isSolo);
        const isMuted = track ? (track.isMuted || (anySolo && !track.isSolo)) : false;
        audio.volume = isMuted || props.reversed || isRamping ? 0 : Math.min(1, Math.max(0, (props.volume ?? 100) / 100));

        const nodes = audioNodes.get(audio);
        if (nodes && audioContext) {
            const panValue = (props.pan ?? 0) / 50;
            nodes.panner.pan.setValueAtTime(panValue, audioContext.currentTime);
        }
    }, [projectState.currentTime, projectState.isPlaying, clip, projectState.tracks]);
    return <audio ref={audioRef} src={clip.src} crossOrigin="anonymous" />;
};

export const Player: React.FC<PlayerProps> = ({ projectState, onTogglePlay, onSeek, playerRef }) => {
  const videoElementsRef = useRef(new Map<string, HTMLVideoElement>());
  
  const getActiveVisualClips = (): Clip[] => {
    const anySolo = projectState.tracks.some(t => t.isSolo);
    const trackOrder = projectState.tracks.map(t => t.id);
    return projectState.clips
      .filter(c => {
        const track = projectState.tracks.find(t => t.id === c.trackId);
        // Mute should not affect visibility, only audio, which is handled by the video element's volume.
        if (!track || (anySolo && !track.isSolo)) return false;
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
        // Mute should not affect text visibility.
        if (!track || (anySolo && !track.isSolo)) return false;
        return c.type === 'text' && projectState.currentTime >= c.startOffset && projectState.currentTime < c.startOffset + c.duration;
    }).sort((a,b) => projectState.tracks.findIndex(t => t.id === b.trackId) - projectState.tracks.findIndex(t => t.id === a.trackId));
  }

  const getAudibleOnlyClips = (visualClipIds: Set<string>): Clip[] => projectState.clips.filter(c => 
      !visualClipIds.has(c.id) && (c.type === 'audio' || c.type === 'video') &&
      projectState.currentTime >= c.startOffset && projectState.currentTime < c.startOffset + c.duration
  );

  const activeVisualClips = getActiveVisualClips();
  const activeTextClips = getActiveTextClips();
  const audibleOnlyClips = getAudibleOnlyClips(new Set(activeVisualClips.map(c => c.id)));

  useEffect(() => {
    activeVisualClips.forEach(clip => {
      if (clip.type !== 'video') return;
      const video = videoElementsRef.current.get(clip.id);
      if (!video) return;
      if (audioContext && !audioNodes.has(video)) setupAudioNode(video);
      
      const props = clip.properties;
      const isRamping = props.speedRamp?.enabled;

      if (isRamping) {
          video.pause();
          const progress = (projectState.currentTime - clip.startOffset) / clip.duration;
          if (progress >= 0 && progress <= 1) {
              const sourceTime = calculateSourceTimeAtProgress(progress, clip.duration, props.speedRamp.points);
              video.currentTime = clip.sourceStart + sourceTime;
          }
      } else if (props.reversed) {
          video.pause();
          const timeFromClipEnd = (clip.startOffset + clip.duration) - projectState.currentTime;
          const targetSourceTime = clip.sourceStart + timeFromClipEnd * (props.speed || 1);
          video.currentTime = Math.max(clip.sourceStart, targetSourceTime);
      } else {
          video.playbackRate = props.speed || 1;
          const targetTime = projectState.currentTime - clip.startOffset + clip.sourceStart;
          if (projectState.isPlaying) {
              if (Math.abs(video.currentTime - targetTime) > 0.25) video.currentTime = targetTime;
              if (video.paused) video.play().catch(() => {});
          } else {
              video.pause();
              if (Math.abs(video.currentTime - targetTime) > 0.05) video.currentTime = targetTime;
          }
      }

      const track = projectState.tracks.find(t => t.id === clip.trackId);
      const anySolo = projectState.tracks.some(t => t.isSolo);
      const isMuted = track ? (track.isMuted || (anySolo && !track.isSolo)) : false;
      video.volume = isMuted || props.reversed || isRamping ? 0 : Math.min(1, Math.max(0, (props.volume ?? 100) / 100));

      const nodes = audioNodes.get(video);
      if (nodes && audioContext) {
          const panValue = (props.pan ?? 0) / 50;
          nodes.panner.pan.setValueAtTime(panValue, audioContext.currentTime);
      }
    });
  }, [projectState.currentTime, projectState.isPlaying, activeVisualClips, projectState.tracks]);

  const handleTogglePlay = () => {
      initAudioContext();
      if(audioContext && audioContext.state === 'suspended') audioContext.resume();
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

  const getBaseTransform = (clip: Clip) => `scale(${(clip.properties.scale || 100) / 100}) translate(${clip.properties.position?.x || 0}%, ${clip.properties.position?.y || 0}%) rotateZ(${clip.properties.rotation || 0}deg)`;

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-gray-950">
        {audibleOnlyClips.map(clip => <AudioTrackPlayer key={clip.id} clip={clip} projectState={projectState} />)}
        <div 
            ref={playerRef}
            className={`relative bg-black shadow-2xl overflow-hidden transition-all duration-300 border border-gray-800 ${projectState.aspectRatio === '16:9' ? 'w-full h-full' : ''}`}
            style={projectState.aspectRatio === '16:9' ? {} : getAspectRatioStyle()}
        >
            {activeVisualClips.length === 0 && (
                <div className="text-gray-700 flex flex-col items-center h-full justify-center">
                    <div className="w-16 h-16 border-2 border-gray-800 rounded-full flex items-center justify-center mb-4"><Play className="ml-1 opacity-20" size={32} /></div><p>No Signal</p>
                </div>
            )}
            <div className="absolute inset-0 w-full h-full">
                {activeVisualClips.map((clip, index) => {
                    const props = clip.properties;
                    const transitionStyle = getTransitionStyle(clip);
                    const chroma = props.chromaKey;
                    const setVideoRef = (el: HTMLVideoElement | null) => {
                        if (el) {
                            videoElementsRef.current.set(clip.id, el);
                        } else {
                            videoElementsRef.current.delete(clip.id);
                        }
                    };
                    const baseTransform = getBaseTransform(clip);
                    const transitionTransform = transitionStyle.transform || '';
                    const distance = chroma?.enabled ? (chroma.distance || 0) : 0;
                    const distanceTransform = `scale(${1 - (distance / 2000)}) translateY(-${distance / 10}%)`;
                    const finalTransform = `${baseTransform} ${distanceTransform} ${transitionTransform}`;
                    let preKeyingFilter = `brightness(${1 + (props.brightness || 0)/100}) contrast(${1 + (props.contrast || 0)/100}) saturate(${(props.saturation || 100)/100})`;
                    if (props.effects) {
                        props.effects.forEach(e => {
                            if (e.type !== 'vignette' && e.type !== 'scanLines') {
                                const i = e.intensity;
                                switch(e.type) {
                                    case 'blur': preKeyingFilter += ` blur(${i / 5}px)`; break;
                                    case 'sepia': preKeyingFilter += ` sepia(${i / 100})`; break;
                                    case 'grayscale': preKeyingFilter += ` grayscale(${i / 100})`; break;
                                    case 'invert': preKeyingFilter += ` invert(${i / 100})`; break;
                                    case 'hue': preKeyingFilter += ` hue-rotate(${i * 3.6}deg)`; break;
                                    case 'sharpen': preKeyingFilter += ` contrast(${1 + i/50})`; break;
                                    case 'sketch': preKeyingFilter += ` grayscale(1) contrast(${1 + i/10})`; break;
                                    case 'spotRemover': preKeyingFilter += ` blur(${i/25}px) contrast(${1 - i/200})`; break;
                                    case 'rgbShift': 
                                        const offset = i / 20;
                                        preKeyingFilter += ` drop-shadow(${offset}px 0 0 #ff0000) drop-shadow(-${offset}px 0 0 #00ffff)`;
                                        break;
                                    case 'glitch':
                                        const glitchTime = projectState.currentTime;
                                        const flicker = Math.abs(Math.sin(glitchTime * 47) * Math.sin(glitchTime * 23));
                                        if (flicker > 0.9) {
                                            const intensityFactor = i / 100;
                                            const offsetX = (Math.random() - 0.5) * 15 * intensityFactor;
                                            const offsetY = (Math.random() - 0.5) * 5 * intensityFactor;
                                            preKeyingFilter += ` contrast(2) saturate(0.2) drop-shadow(${offsetX}px ${offsetY}px 0 #ff00c4) drop-shadow(-${offsetX}px -${offsetY}px 0 #00ffff)`;
                                        }
                                        break;
                                }
                            }
                        });
                    }
                    if (chroma?.enabled) preKeyingFilter += ` contrast(${1 + ((chroma.tolerance || 0) / 25)})`;
                    let postKeyingFilter = '';
                    if (chroma?.enabled) {
                        if (chroma.feather > 0) postKeyingFilter += ` blur(${chroma.feather / 30}px)`;
                        if (chroma.shadow > 0) postKeyingFilter += ` drop-shadow(0px ${chroma.shadow / 10}px ${chroma.shadow / 5}px rgba(0,0,0,${chroma.shadow / 125}))`;
                    }
                    const isExtendedFrame = props.aiExtendedDuration && (projectState.currentTime > (clip.startOffset + clip.duration - props.aiExtendedDuration));
                    const hasVignette = props.effects?.some(e => e.type === 'vignette');
                    const vignetteIntensity = props.effects?.find(e => e.type === 'vignette')?.intensity || 0;
                    const hasScanLines = props.effects?.some(e => e.type === 'scanLines');
                    const scanLinesIntensity = props.effects?.find(e => e.type === 'scanLines')?.intensity || 50;
                    const mediaStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: projectState.aspectRatio === '16:9' ? 'contain' : 'cover', filter: preKeyingFilter, mixBlendMode: chroma?.enabled ? 'difference' : 'normal' };
                    const mediaElement = clip.type === 'video' ? <video ref={setVideoRef} src={clip.src} style={mediaStyle} playsInline crossOrigin="anonymous" /> : <img src={clip.src} alt={clip.name} style={mediaStyle} />;
                    const content = chroma?.enabled ? <div style={{ backgroundColor: chroma.keyColor, mixBlendMode: 'screen', width: '100%', height: '100%' }}>{mediaElement}</div> : mediaElement;
                    return (
                        <div key={clip.id} className="absolute inset-0 w-full h-full" style={{ zIndex: index, transform: finalTransform, clipPath: transitionStyle.clipPath, opacity: ((props.opacity ?? 100) / 100) * (transitionStyle.opacity ?? 1), filter: postKeyingFilter }}>
                            {content}
                            {hasVignette && <div className="absolute inset-0 pointer-events-none" style={{background: `radial-gradient(circle, transparent ${100 - vignetteIntensity}%, black 150%)`}} />}
                            {hasScanLines && <div className="absolute inset-0 pointer-events-none opacity-20" style={{background: `repeating-linear-gradient(transparent 0, rgba(0,0,0,${scanLinesIntensity/100}) 3px, transparent 4px)`}} />}
                            {isExtendedFrame && <div className="absolute top-4 right-4 bg-emerald-900/80 border border-emerald-500/50 backdrop-blur-sm text-emerald-100 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg animate-pulse"><Sparkles size={12} className="text-emerald-400" /> AI Generated</div>}
                            {props.activeMaskId && props.maskOverlayVisible && !isExtendedFrame && <div className="absolute inset-0 pointer-events-none mix-blend-overlay"><div className="absolute bg-red-500/40 blur-xl rounded-full transition-all duration-300 ease-linear animate-pulse border-2 border-red-500/50" style={{ width: '30%', height: '40%', left: `${35 + Math.sin(projectState.currentTime) * 5}%`, top: `${25 + Math.cos(projectState.currentTime * 1.5) * 5}%` }}><div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap opacity-80 flex items-center gap-1"><ScanFace size={10} /> {props.activeMaskId}</div></div></div>}
                        </div>
                    );
                })}
            </div>
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: activeVisualClips.length }}>
                {activeTextClips.map((clip, index) => {
                    const props = clip.properties; const transition = getTransitionStyle(clip); const baseTransform = getBaseTransform(clip);
                    return (<div key={clip.id} className="absolute p-4 box-border w-full h-full flex justify-center items-center" style={{ zIndex: index, opacity: ((props.opacity ?? 100) / 100) * (transition.opacity ?? 1) }}><div style={{ transform: `${baseTransform} ${transition.transform || ''}`, color: props.fontColor || '#FFFFFF', fontSize: `${props.fontSize || 24}px`, fontWeight: props.fontWeight || 'normal', textAlign: props.textAlign || 'center', fontFamily: props.fontFamily || 'sans-serif', backgroundColor: props.backgroundColor || 'transparent', whiteSpace: 'pre-wrap', padding: '0.2em 0.5em', borderRadius: '0.2em', lineHeight: 1.2 }}>{props.textContent}</div></div>)
                })}
            </div>
        </div>
      </div>
      <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-6">
         <div className="flex items-center gap-2 text-sm font-mono text-gray-400 w-24">{formatTime(projectState.currentTime)}</div>
         <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-white" onClick={() => onSeek(0)}><SkipBack size={20} /></button>
            <button className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors" onClick={handleTogglePlay}>{projectState.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}</button>
            <button className="text-gray-400 hover:text-white" onClick={() => onSeek(projectState.duration)}><SkipForward size={20} /></button>
         </div>
         <div className="flex items-center gap-2 w-24 justify-end"><button className="text-gray-400 hover:text-white"><Maximize2 size={18} /></button></div>
      </div>
    </div>
  );
};