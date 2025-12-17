import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProjectState, Track, TrackType, Clip, MediaAsset, AspectRatio, TransitionType, ClipProperties, Marker } from './types';
import { Timeline } from './components/Timeline';
import { Player } from './components/Player';
import { MediaLibrary } from './components/MediaLibrary';
import { AIAssistant } from './components/AIAssistant';
import { Inspector } from './components/Inspector';
import { TransitionsPanel } from './components/TransitionsPanel';
import { TextOverlayPanel } from './components/TextOverlayPanel';
import { ExportModal } from './components/ExportModal';
import { Button } from './components/Button';
import { Download, Sparkles, Layout, Clapperboard, Scissors, Wand2, Palette, Music, FileVideo, MonitorSmartphone, Zap, Type, Camera, FilePlus } from 'lucide-react';
import html2canvas from 'html2canvas';
import { exportProject } from './services/exportService';

const INITIAL_TRACKS: Track[] = [
  { id: 't1', type: TrackType.TEXT, name: 'Text', isMuted: false, isLocked: false, isSolo: false, isRecordArmed: false },
  { id: '1', type: TrackType.VIDEO, name: 'Video 1', isMuted: false, isLocked: false, isSolo: false, isRecordArmed: false },
  { id: '2', type: TrackType.VIDEO, name: 'Video 2', isMuted: false, isLocked: false, isSolo: false, isRecordArmed: false },
  { id: '3', type: TrackType.AUDIO, name: 'Audio 1', isMuted: false, isLocked: false, isSolo: false, isRecordArmed: false },
  { id: '4', type: TrackType.AUDIO, name: 'Audio 2', isMuted: false, isLocked: false, isSolo: false, isRecordArmed: false },
];

const INITIAL_PROJECT_STATE: ProjectState = {
    tracks: INITIAL_TRACKS,
    clips: [],
    markers: [],
    currentTime: 0,
    duration: 30,
    zoom: 20, // pixels per second
    isPlaying: false,
    aspectRatio: '16:9'
};

const App: React.FC = () => {
  const playerRef = useRef<HTMLDivElement>(null);
  const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT_STATE);
  const [clipboard, setClipboard] = useState<Clip | null>(null);

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showInspector, setShowInspector] = useState(true);
  const [activeTab, setActiveTab] = useState('edit');
  
  const [showMediaLibrary, setShowMediaLibrary] = useState(true);
  const [showTransitions, setShowTransitions] = useState(false);
  const [showTextPanel, setShowTextPanel] = useState(false);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  
  // Load project from localStorage on initial render
  useEffect(() => {
    const savedData = localStorage.getItem('luminaCutProject');
    if (savedData) {
        try {
            const { project: savedProject, assets: savedAssets } = JSON.parse(savedData);
            if (savedProject && savedAssets) {
                // Restore project state, ensuring playback is paused.
                setProject({ ...savedProject, isPlaying: false });
                setAssets(savedAssets);
                console.log("Project loaded from localStorage.");
            } else {
                 setProject(INITIAL_PROJECT_STATE);
                 setAssets([]);
            }
        } catch (error) {
            console.error("Failed to load project from localStorage:", error);
            setProject(INITIAL_PROJECT_STATE);
            setAssets([]);
        }
    } else {
        // No saved data, start with a fresh project
        setProject(INITIAL_PROJECT_STATE);
        setAssets([]);
        console.log("No saved project found. Starting a new project.");
    }
  }, []);

  // Auto-save project to localStorage whenever it changes
  useEffect(() => {
    // Debounce saving to avoid excessive writes, especially during seeking.
    const handler = setTimeout(() => {
        // Create a savable version of the project state.
        const projectToSave = {
            ...project,
            isPlaying: false, // Always save in a non-playing state
        };
        const dataToSave = { project: projectToSave, assets };
        localStorage.setItem('luminaCutProject', JSON.stringify(dataToSave));
    }, 1000); // 1-second debounce

    return () => {
        clearTimeout(handler);
    };
  }, [project, assets]);


  useEffect(() => {
      if (window.innerWidth < 768) {
          setShowMediaLibrary(false);
          setShowInspector(false);
          setShowTransitions(false);
          setShowTextPanel(false);
      }
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime: number;

    const loop = (time: number) => {
      if (lastTime) {
        const delta = (time - lastTime) / 1000;
        setProject(prev => {
          if (!prev.isPlaying) return prev;
          const selectedClip = prev.clips.find(c => c.selected && c.properties.speedRamp?.enabled);
          let speedMultiplier = 1.0;
          if(selectedClip) {
              const rampPoints = selectedClip.properties.speedRamp?.points || [];
              if(rampPoints.length > 0) {
                  speedMultiplier = rampPoints.reduce((acc, p) => acc + p.speed, 0) / rampPoints.length;
              }
          }

          const nextTime = prev.currentTime + (delta * speedMultiplier);
          if (nextTime >= prev.duration) {
             return { ...prev, isPlaying: false, currentTime: prev.duration };
          }
          return { ...prev, currentTime: nextTime };
        });
      }
      lastTime = time;
      if (project.isPlaying) {
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    if (project.isPlaying) {
      animationFrameId = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [project.isPlaying, project.duration]); // Added project.duration dependency

  // Handlers
  const togglePlay = () => setProject(p => ({ ...p, isPlaying: !p.isPlaying }));
  
  const handleSeek = (time: number) => {
    setProject(p => ({ ...p, currentTime: Math.max(0, Math.min(time, p.duration)) }));
  };

  const addAsset = (asset: MediaAsset) => {
    setAssets(prev => [...prev, asset]);
  };

  const addTextClip = (name: string, properties: Partial<ClipProperties>) => {
    const textTrack = project.tracks.find(t => t.type === TrackType.TEXT);
    if (!textTrack) return;

    const newClip: Clip = {
        id: Math.random().toString(36).substr(2, 9),
        assetId: 'text', name, trackId: textTrack.id, startOffset: project.currentTime, duration: 5,
        sourceStart: 0, type: 'text', src: '', selected: true, properties: { ...properties }
    };
    
    const updatedClips = project.clips.map(c => ({ ...c, selected: false }));
    setProject(p => ({
        ...p, clips: [...updatedClips, newClip],
        duration: Math.max(p.duration, newClip.startOffset + newClip.duration + 5)
    }));
    setShowInspector(true);
    if (window.innerWidth < 768) setShowTextPanel(false);
  };

  const addToTimeline = (asset: MediaAsset) => {
    const newClip: Clip = {
      id: Math.random().toString(36).substr(2, 9), assetId: asset.id, name: asset.name,
      trackId: project.tracks.find(t => 
        (asset.type === 'audio' && t.type === TrackType.AUDIO) || 
        (asset.type !== 'audio' && t.type === TrackType.VIDEO)
      )?.id || project.tracks[0].id,
      startOffset: project.currentTime, duration: asset.duration, sourceStart: 0,
      type: asset.type, src: asset.src, selected: true,
      thumbnail: asset.thumbnail,
      properties: {
        opacity: 100, scale: 100, position: { x: 0, y: 0 }, volume: 100, pan: 0,
        brightness: 0, contrast: 0, saturation: 100, speed: 1, reversed: false,
        speedRamp: { enabled: false, points: [{time: 0, speed: 1}, {time: 0.5, speed: 1}, {time: 1, speed: 1}]}
      }
    };
    const updatedClips = project.clips.map(c => ({ ...c, selected: false }));
    setProject(p => ({
        ...p, clips: [...updatedClips, newClip],
        duration: Math.max(p.duration, newClip.startOffset + newClip.duration + 10)
    }));
    setShowInspector(true);
    if (window.innerWidth < 768) setShowMediaLibrary(false);
  };

  const selectClip = (id: string | null) => {
    setProject(p => ({
      ...p, clips: p.clips.map(c => ({ ...c, selected: c.id === id }))
    }));
    if (id) setShowInspector(true);
  };

  const updateClip = (id: string, updates: Partial<Clip>) => {
    setProject(p => ({
      ...p, clips: p.clips.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const handleApplyTransition = (clipId: string, type: TransitionType) => {
      setProject(p => ({
          ...p, clips: p.clips.map(c => c.id === clipId ? { ...c, transition: { type, duration: 1.0 } } : c)
      }));
  };

  const deleteSelectedClip = () => {
    setProject(p => ({ ...p, clips: p.clips.filter(c => !c.selected) }));
  };

  const splitClip = () => {
    const selectedClip = project.clips.find(c => c.selected);
    if (!selectedClip || (project.currentTime <= selectedClip.startOffset) || (project.currentTime >= selectedClip.startOffset + selectedClip.duration)) return;

    const splitPoint = project.currentTime - selectedClip.startOffset;
    const part1: Clip = { ...selectedClip, duration: splitPoint, selected: false };
    const part2: Clip = { ...selectedClip, id: Math.random().toString(36).substr(2, 9), startOffset: project.currentTime, sourceStart: selectedClip.sourceStart + splitPoint, duration: selectedClip.duration - splitPoint, selected: true, transition: undefined };

    setProject(p => ({ ...p, clips: p.clips.filter(c => c.id !== selectedClip.id).concat([part1, part2]) }));
  };

  const handleFreezeFrame = () => {
    const selectedClip = project.clips.find(c => c.selected && c.type === 'video');
    if (!selectedClip || (project.currentTime < selectedClip.startOffset) || (project.currentTime > selectedClip.startOffset + selectedClip.duration)) {
      alert("Please select a video clip and place the playhead over it.");
      return;
    }

    const video = document.createElement('video');
    video.src = selectedClip.src;
    video.currentTime = (project.currentTime - selectedClip.startOffset) + selectedClip.sourceStart;
    video.crossOrigin = "anonymous";

    video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');

        const newAsset: MediaAsset = {
            id: `freeze_${Date.now()}`, name: `${selectedClip.name}_freeze.jpg`,
            type: 'image', src: dataUrl, duration: 2
        };
        addAsset(newAsset);

        const newImageClip: Clip = {
            id: Math.random().toString(36).substr(2, 9), assetId: newAsset.id, name: newAsset.name,
            trackId: selectedClip.trackId, startOffset: project.currentTime, duration: 2,
            sourceStart: 0, type: 'image', src: newAsset.src, selected: true, properties: {}
        };

        const originalEnd = selectedClip.startOffset + selectedClip.duration;
        const splitPoint = project.currentTime - selectedClip.startOffset;
        
        const part1 = { ...selectedClip, duration: splitPoint, selected: false };
        const part2 = { ...selectedClip, id: Math.random().toString(36).substr(2, 9), startOffset: project.currentTime + 2, sourceStart: selectedClip.sourceStart + splitPoint, duration: selectedClip.duration - splitPoint, selected: false };

        setProject(p => ({
            ...p,
            clips: [
                ...p.clips.filter(c => c.id !== selectedClip.id && c.startOffset < project.currentTime + 2),
                part1,
                newImageClip,
                part2,
                ...p.clips.filter(c => c.id !== selectedClip.id && c.startOffset >= project.currentTime + 2).map(c => ({...c, startOffset: c.startOffset + 2}))
            ],
            duration: Math.max(p.duration, originalEnd + 2)
        }));
    };
  };
  
  const handleSnapshot = () => {
    if (playerRef.current) {
        html2canvas(playerRef.current, { useCORS: true, allowTaint: true }).then(canvas => {
            const link = document.createElement('a');
            link.download = `lumina_snapshot_${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
        });
    }
  };
  
  const handleNewProject = () => {
    if (window.confirm("Are you sure you want to start a new project? This will clear your current timeline.")) {
        localStorage.removeItem('luminaCutProject');
        setProject(INITIAL_PROJECT_STATE);
        setAssets([]);
    }
  };
  
  const handleCopyClip = useCallback(() => {
    const selectedClip = project.clips.find(c => c.selected);
    if (selectedClip) {
        setClipboard(selectedClip);
    }
  }, [project.clips]);

  const handlePasteClip = useCallback(() => {
    if (!clipboard) return;

    const originalTrack = project.tracks.find(t => t.id === clipboard.trackId);
    let targetTrackId = (originalTrack && originalTrack.type === clipboard.type)
      ? originalTrack.id
      : project.tracks.find(t => t.type === clipboard.type)?.id;

    if (!targetTrackId) {
        alert(`No suitable track of type '${clipboard.type}' found to paste the clip.`);
        return;
    }
    
    const newClip: Clip = {
        ...clipboard,
        id: Math.random().toString(36).substr(2, 9),
        startOffset: project.currentTime,
        trackId: targetTrackId,
        selected: true,
    };

    setProject(p => {
        const updatedClips = p.clips.map(c => ({ ...c, selected: false }));
        return {
            ...p,
            clips: [...updatedClips, newClip],
            duration: Math.max(p.duration, newClip.startOffset + newClip.duration + 10),
        };
    });
  }, [clipboard, project.tracks, project.currentTime]);

  const handleDetachAudio = (clipId: string) => {
    const videoClip = project.clips.find(c => c.id === clipId);
    if (!videoClip || videoClip.type !== 'video') return;

    const audioTrack = project.tracks.find(t => t.type === TrackType.AUDIO);
    if (!audioTrack) {
        alert("No audio track available to detach audio to.");
        return;
    }

    const newAudioClip: Clip = {
        ...videoClip,
        id: Math.random().toString(36).substr(2, 9),
        type: 'audio',
        trackId: audioTrack.id,
        properties: { // Reset video-specific properties, keep audio ones
            volume: videoClip.properties.volume ?? 100,
            pan: videoClip.properties.pan ?? 0,
            equalizer: videoClip.properties.equalizer,
            speed: videoClip.properties.speed,
            reversed: videoClip.properties.reversed,
            speedRamp: videoClip.properties.speedRamp,
        },
        transition: undefined,
        thumbnail: undefined,
    };
    
    const updatedVideoClip = {
        ...videoClip,
        properties: {
            ...videoClip.properties,
            audioSourceEnabled: false,
        }
    };

    setProject(p => ({
        ...p,
        clips: [
            ...p.clips.filter(c => c.id !== clipId),
            updatedVideoClip,
            newAudioClip
        ]
    }));
  };

  const handleStartExport = async (resolution: { width: number; height: number; name: string }) => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Initializing...');
    try {
        await exportProject(project, assets, resolution, (progress, status) => {
            setExportProgress(progress);
            setExportStatus(status);
        });
    } catch (error) {
        console.error("Export failed:", error);
        alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsExporting(false);
        setShowExportModal(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            handleCopyClip();
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            handlePasteClip();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopyClip, handlePasteClip]);


  const handleZoom = (delta: number) => setProject(p => ({ ...p, zoom: Math.max(1, Math.min(200, p.zoom + delta)) }));
  const handleAspectRatioChange = (ratio: AspectRatio) => setProject(p => ({ ...p, aspectRatio: ratio }));
  const toggleTrackMute = (trackId: string) => setProject(p => ({ ...p, tracks: p.tracks.map(t => t.id === trackId ? { ...t, isMuted: !t.isMuted } : t) }));
  const toggleTrackSolo = (trackId: string) => setProject(p => ({ ...p, tracks: p.tracks.map(t => t.id === trackId ? { ...t, isSolo: !t.isSolo } : t) }));
  const toggleTrackRecord = (trackId: string) => setProject(p => ({ ...p, tracks: p.tracks.map(t => t.id === trackId ? { ...t, isRecordArmed: !t.isRecordArmed } : t) }));
  
  const handleAddMarker = (time: number) => {
      const label = prompt('Enter marker name:', `Marker ${project.markers.length + 1}`);
      if (!label) return;
      const newMarker: Marker = { id: Math.random().toString(36).substr(2, 9), time, label, color: '#34d399' };
      setProject(p => ({ ...p, markers: [...p.markers, newMarker] }));
  };
  const handleUpdateMarker = (id: string, updates: Partial<Marker>) => setProject(p => ({ ...p, markers: p.markers.map(m => m.id === id ? { ...m, ...updates } : m) }));
  const handleDeleteMarker = (id: string) => setProject(p => ({ ...p, markers: p.markers.filter(m => m.id !== id) }));

  const handleNavClick = (id: string) => {
      setActiveTab(id);
      if (window.innerWidth < 768) {
          setShowMediaLibrary(id === 'media');
          setShowTransitions(id === 'transitions');
          setShowTextPanel(id === 'text');
          setShowInspector(id === 'color');
          setShowAiPanel(false);
      } else {
          setShowMediaLibrary(id === 'media');
          setShowTransitions(id === 'transitions');
          setShowTextPanel(id === 'text');
      }
  };

  const selectedClip = project.clips.find(c => c.selected);
  const NavItem = ({ id, icon: Icon, label }: any) => (
    <button onClick={() => handleNavClick(id)} className={`flex flex-col items-center justify-center h-full px-2 md:px-4 min-w-[50px] md:min-w-[70px] border-b-2 transition-colors ${activeTab === id ? 'border-violet-500 text-white bg-gray-800' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}>
        <Icon size={18} className="mb-1" />
        <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-wider">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-gray-200 font-sans overflow-hidden">
      <header className="h-12 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-2 md:px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
            <Layout className="text-violet-500 hidden md:block" />
            <div className="flex flex-col">
                <h1 className="text-sm font-bold text-white tracking-wide leading-none">Lumina</h1>
                <span className="text-[8px] md:text-[10px] text-gray-500 font-mono">PRO STUDIO</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleNewProject} title="New Project" className="ml-2">
                <FilePlus size={16} />
            </Button>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
             <div className="hidden md:flex items-center bg-gray-800 rounded-md p-0.5 border border-gray-700">
                {(['16:9', '9:16', '1:1', '4:5'] as AspectRatio[]).map(ratio => (
                    <button key={ratio} onClick={() => handleAspectRatioChange(ratio)} className={`text-[10px] px-2 py-1 rounded transition-colors ${project.aspectRatio === ratio ? 'bg-violet-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}>{ratio}</button>
                ))}
             </div>
             <div className="h-4 w-px bg-gray-800 hidden md:block"></div>
             <Button variant="ghost" size="sm" onClick={handleSnapshot} title="Take Snapshot"><Camera size={16} /></Button>
             <Button variant="ghost" size="sm" onClick={() => setShowAiPanel(!showAiPanel)} active={showAiPanel}>
                <Sparkles size={16} className={`mr-0 md:mr-2 ${showAiPanel ? 'text-violet-400' : ''}`} /> 
                <span className="hidden md:inline">Lumina AI</span>
             </Button>
             <div className="h-4 w-px bg-gray-800 mx-2 hidden md:block"></div>
             <Button variant="primary" size="sm" className="bg-violet-600 hover:bg-violet-500 text-xs px-2 md:px-4" onClick={() => setShowExportModal(true)}>
                <Download size={14} className="mr-0 md:mr-2" />
                <span className="hidden md:inline">Export</span>
             </Button>
        </div>
      </header>
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className={`fixed inset-0 z-40 bg-gray-900 md:static md:inset-auto md:z-auto md:block transition-all duration-200 ${showMediaLibrary || showTransitions || showTextPanel ? 'block' : 'hidden'}`}>
            <MediaLibrary assets={assets} onAddAsset={addAsset} onAddToTimeline={addToTimeline} onCloseMobile={() => setShowMediaLibrary(false)} onClearAssets={() => setAssets([])} />
            {showTransitions && <TransitionsPanel onCloseMobile={() => setShowTransitions(false)} />}
            {showTextPanel && <TextOverlayPanel onAddTextClip={addTextClip} onCloseMobile={() => setShowTextPanel(false)} />}
        </div>
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900 h-full">
            <div className="flex-shrink-0 bg-black relative border-b border-gray-800 h-[35vh] md:flex-1 md:h-auto md:min-h-0">
                <Player projectState={project} onTogglePlay={togglePlay} onSeek={handleSeek} playerRef={playerRef} />
            </div>
            <div className="h-8 md:h-10 bg-gray-850 border-b border-gray-800 flex items-center px-4 justify-between shrink-0">
                 <div className="flex items-center text-xs text-gray-400 gap-4"><span className="hover:text-white cursor-pointer hidden md:inline">Snapping: On</span><span className="hover:text-white cursor-pointer hidden md:inline">Linked Selection</span></div>
                 <div className="flex items-center gap-2"><span className="text-[10px] md:text-xs text-gray-500">{project.clips.length} Clips</span></div>
            </div>
            <div className="flex-1 flex flex-col shrink-0 min-h-0">
                <Timeline state={project} onSeek={handleSeek} onSelectClip={selectClip} onUpdateClip={updateClip} onSplitClip={splitClip} onDeleteClip={deleteSelectedClip} onZoom={handleZoom} onToggleTrackMute={toggleTrackMute} onToggleTrackSolo={toggleTrackSolo} onToggleTrackRecord={toggleTrackRecord} onApplyTransition={handleApplyTransition} onAddMarker={handleAddMarker} onUpdateMarker={handleUpdateMarker} onDeleteMarker={handleDeleteMarker} onFreezeFrame={handleFreezeFrame} onCopyClip={handleCopyClip} onPasteClip={handlePasteClip} isPasteEnabled={clipboard !== null} />
            </div>
        </div>
        {showAiPanel && (<div className="fixed inset-0 z-50 md:static md:inset-auto md:z-auto"><AIAssistant onClose={() => setShowAiPanel(false)} /></div>)}
        {showInspector && (<div className="fixed inset-0 z-40 md:static md:inset-auto md:z-auto"><Inspector clip={selectedClip} onUpdateClip={updateClip} onClose={() => setShowInspector(false)} projectAspectRatio={project.aspectRatio} onDetachAudio={handleDetachAudio} /></div>)}
        {showExportModal && 
            <ExportModal 
                onClose={() => setShowExportModal(false)}
                onExport={handleStartExport}
                isExporting={isExporting}
                progress={exportProgress}
                status={exportStatus}
            />
        }
      </div>
      <div className="h-14 bg-gray-950 border-t border-gray-800 flex items-center justify-around md:justify-center shrink-0 z-50">
          <NavItem id="media" icon={FileVideo} label="Media" /><NavItem id="text" icon={Type} label="Text" /><NavItem id="transitions" icon={Zap} label="Trans" /><NavItem id="edit" icon={Clapperboard} label="Edit" /><NavItem id="color" icon={Palette} label="Color" /><div className="hidden md:flex"><NavItem id="fairlight" icon={Music} label="Fairlight" /><NavItem id="cut" icon={Scissors} label="Cut" /></div><NavItem id="deliver" icon={Download} label="Deliver" />
      </div>
    </div>
  );
};

export default App;