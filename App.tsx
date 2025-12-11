import React, { useState, useEffect } from 'react';
import { ProjectState, Track, TrackType, Clip, MediaAsset, AspectRatio, TransitionType } from './types';
import { Timeline } from './components/Timeline';
import { Player } from './components/Player';
import { MediaLibrary } from './components/MediaLibrary';
import { AIAssistant } from './components/AIAssistant';
import { Inspector } from './components/Inspector';
import { TransitionsPanel } from './components/TransitionsPanel';
import { Button } from './components/Button';
import { Download, Sparkles, Layout, Clapperboard, Scissors, Wand2, Palette, Music, FileVideo, MonitorSmartphone, Zap } from 'lucide-react';

// Initial Mock Data
const INITIAL_TRACKS: Track[] = [
  { id: '1', type: TrackType.VIDEO, name: 'Video 1', isMuted: false, isLocked: false, isSolo: false, isRecordArmed: false },
  { id: '2', type: TrackType.VIDEO, name: 'Video 2', isMuted: false, isLocked: false, isSolo: false, isRecordArmed: false },
  { id: '3', type: TrackType.AUDIO, name: 'Audio 1', isMuted: false, isLocked: false, isSolo: false, isRecordArmed: false },
  { id: '4', type: TrackType.AUDIO, name: 'Audio 2', isMuted: false, isLocked: false, isSolo: false, isRecordArmed: false },
];

const App: React.FC = () => {
  const [project, setProject] = useState<ProjectState>({
    tracks: INITIAL_TRACKS,
    clips: [],
    currentTime: 0,
    duration: 30,
    zoom: 20, // pixels per second
    isPlaying: false,
    aspectRatio: '16:9'
  });

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showInspector, setShowInspector] = useState(true);
  const [activeTab, setActiveTab] = useState('edit');
  
  // Panel Visibility States
  const [showMediaLibrary, setShowMediaLibrary] = useState(true);
  const [showTransitions, setShowTransitions] = useState(false);

  // Adjust default visibility for mobile on load
  useEffect(() => {
      if (window.innerWidth < 768) {
          setShowMediaLibrary(false);
          setShowInspector(false);
          setShowTransitions(false);
      }
  }, []);

  // Playback Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime: number;

    const loop = (time: number) => {
      if (lastTime) {
        const delta = (time - lastTime) / 1000;
        setProject(prev => {
          if (!prev.isPlaying) return prev;
          const nextTime = prev.currentTime + delta;
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
  }, [project.isPlaying]);

  // Handlers
  const togglePlay = () => setProject(p => ({ ...p, isPlaying: !p.isPlaying }));
  
  const handleSeek = (time: number) => {
    setProject(p => ({ ...p, currentTime: Math.max(0, Math.min(time, p.duration)) }));
  };

  const addAsset = (asset: MediaAsset) => {
    setAssets(prev => [...prev, asset]);
  };

  const addToTimeline = (asset: MediaAsset) => {
    const newClip: Clip = {
      id: Math.random().toString(36).substr(2, 9),
      assetId: asset.id,
      name: asset.name,
      trackId: project.tracks.find(t => 
        (asset.type === 'audio' && t.type === TrackType.AUDIO) || 
        (asset.type !== 'audio' && t.type === TrackType.VIDEO)
      )?.id || project.tracks[0].id,
      startOffset: project.currentTime,
      duration: asset.duration,
      sourceStart: 0,
      type: asset.type,
      src: asset.src,
      selected: true,
      properties: {
        opacity: 100,
        scale: 100,
        position: { x: 0, y: 0 },
        volume: 100,
        pan: 0,
        brightness: 0,
        contrast: 0,
        saturation: 100
      }
    };

    // Deselect others
    const updatedClips = project.clips.map(c => ({ ...c, selected: false }));
    
    setProject(p => ({
        ...p,
        clips: [...updatedClips, newClip],
        duration: Math.max(p.duration, newClip.startOffset + newClip.duration + 10)
    }));
    
    // Auto show inspector on add, close media on mobile
    setShowInspector(true);
    if (window.innerWidth < 768) {
        setShowMediaLibrary(false);
    }
  };

  const selectClip = (id: string | null) => {
    setProject(p => ({
      ...p,
      clips: p.clips.map(c => ({ ...c, selected: c.id === id }))
    }));
    if (id) {
        setShowInspector(true);
    }
  };

  const updateClip = (id: string, updates: Partial<Clip>) => {
    setProject(p => ({
      ...p,
      clips: p.clips.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const handleApplyTransition = (clipId: string, type: TransitionType) => {
      setProject(p => ({
          ...p,
          clips: p.clips.map(c => c.id === clipId ? { ...c, transition: { type, duration: 1.0 } } : c)
      }));
  };

  const deleteSelectedClip = () => {
    setProject(p => ({
      ...p,
      clips: p.clips.filter(c => !c.selected)
    }));
  };

  const splitClip = () => {
    const selectedClip = project.clips.find(c => c.selected);
    if (!selectedClip) return;
    if (project.currentTime <= selectedClip.startOffset || project.currentTime >= selectedClip.startOffset + selectedClip.duration) return;

    const splitPoint = project.currentTime - selectedClip.startOffset;
    const part1: Clip = { ...selectedClip, duration: splitPoint, selected: false };
    const part2: Clip = { ...selectedClip, id: Math.random().toString(36).substr(2, 9), startOffset: project.currentTime, sourceStart: selectedClip.sourceStart + splitPoint, duration: selectedClip.duration - splitPoint, selected: true, transition: undefined };

    setProject(p => ({
        ...p,
        clips: p.clips.filter(c => c.id !== selectedClip.id).concat([part1, part2])
    }));
  };

  const handleZoom = (delta: number) => {
    setProject(p => ({ ...p, zoom: Math.max(1, Math.min(200, p.zoom + delta)) }));
  };

  const handleAspectRatioChange = (ratio: AspectRatio) => {
      setProject(p => ({ ...p, aspectRatio: ratio }));
  }

  const toggleTrackMute = (trackId: string) => {
    setProject(p => ({
        ...p,
        tracks: p.tracks.map(t => t.id === trackId ? { ...t, isMuted: !t.isMuted } : t)
    }));
  };

  const toggleTrackSolo = (trackId: string) => {
    setProject(p => ({
        ...p,
        tracks: p.tracks.map(t => t.id === trackId ? { ...t, isSolo: !t.isSolo } : t)
    }));
  };

  const toggleTrackRecord = (trackId: string) => {
     setProject(p => ({
        ...p,
        tracks: p.tracks.map(t => t.id === trackId ? { ...t, isRecordArmed: !t.isRecordArmed } : t)
    }));
  };

  const handleNavClick = (id: string) => {
      setActiveTab(id);
      
      // Responsive Panel Logic
      if (window.innerWidth < 768) {
          setShowMediaLibrary(false);
          setShowTransitions(false);
          setShowInspector(false);
          setShowAiPanel(false);

          if (id === 'media') setShowMediaLibrary(true);
          else if (id === 'transitions') setShowTransitions(true);
          else if (id === 'color') setShowInspector(true);
      } else {
          // Desktop Logic - toggle panels
          if (id === 'media') {
              setShowMediaLibrary(true);
              setShowTransitions(false);
          } else if (id === 'transitions') {
              setShowTransitions(true);
              setShowMediaLibrary(false);
          }
      }
  };

  const selectedClip = project.clips.find(c => c.selected);

  const NavItem = ({ id, icon: Icon, label }: any) => (
    <button 
        onClick={() => handleNavClick(id)}
        className={`flex flex-col items-center justify-center h-full px-2 md:px-4 min-w-[50px] md:min-w-[70px] border-b-2 transition-colors ${activeTab === id ? 'border-violet-500 text-white bg-gray-800' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}
    >
        <Icon size={18} className="mb-1" />
        <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-wider">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-gray-200 font-sans overflow-hidden">
      {/* App Header */}
      <header className="h-12 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-2 md:px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
            <Layout className="text-violet-500 hidden md:block" />
            <div className="flex flex-col">
                <h1 className="text-sm font-bold text-white tracking-wide leading-none">Lumina</h1>
                <span className="text-[8px] md:text-[10px] text-gray-500 font-mono">PRO STUDIO</span>
            </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
             {/* Aspect Ratio Selector */}
             <div className="hidden md:flex items-center bg-gray-800 rounded-md p-0.5 border border-gray-700">
                {(['16:9', '9:16', '1:1', '4:5'] as AspectRatio[]).map(ratio => (
                    <button
                        key={ratio}
                        onClick={() => handleAspectRatioChange(ratio)}
                        className={`text-[10px] px-2 py-1 rounded transition-colors ${project.aspectRatio === ratio ? 'bg-violet-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                    >
                        {ratio}
                    </button>
                ))}
             </div>

             <div className="h-4 w-px bg-gray-800 hidden md:block"></div>

             <Button variant="ghost" size="sm" onClick={() => setShowAiPanel(!showAiPanel)} active={showAiPanel}>
                <Sparkles size={16} className={`mr-0 md:mr-2 ${showAiPanel ? 'text-violet-400' : ''}`} /> 
                <span className="hidden md:inline">Lumina AI</span>
             </Button>
             <div className="h-4 w-px bg-gray-800 mx-2 hidden md:block"></div>
             <Button variant="primary" size="sm" className="bg-violet-600 hover:bg-violet-500 text-xs px-2 md:px-4">
                <Download size={14} className="mr-0 md:mr-2" />
                <span className="hidden md:inline">Export</span>
             </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left: Media Pool */}
        <div className={`fixed inset-0 z-40 bg-gray-900 md:static md:inset-auto md:z-auto md:block ${showMediaLibrary ? 'block' : 'hidden'} transition-all duration-200`}>
            <MediaLibrary 
                assets={assets} 
                onAddAsset={addAsset} 
                onAddToTimeline={addToTimeline} 
                onCloseMobile={() => setShowMediaLibrary(false)}
            />
        </div>

        {/* Left: Transitions Panel */}
        <div className={`fixed inset-0 z-40 bg-gray-900 md:static md:inset-auto md:z-auto md:block ${showTransitions ? 'block' : 'hidden'} transition-all duration-200`}>
             <TransitionsPanel onCloseMobile={() => setShowTransitions(false)} />
        </div>

        {/* Center: Viewport & Timeline */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900 h-full">
            {/* Top: Preview Player */}
            <div className="flex-shrink-0 bg-black relative border-b border-gray-800 h-[35vh] md:flex-1 md:h-auto md:min-h-0">
                <Player 
                    projectState={project} 
                    onTogglePlay={togglePlay}
                    onSeek={handleSeek}
                />
            </div>

            {/* Middle Toolbar / Tools strip */}
            <div className="h-8 md:h-10 bg-gray-850 border-b border-gray-800 flex items-center px-4 justify-between shrink-0">
                 <div className="flex items-center text-xs text-gray-400 gap-4">
                    <span className="hover:text-white cursor-pointer hidden md:inline">Snapping: On</span>
                    <span className="hover:text-white cursor-pointer hidden md:inline">Linked Selection</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] md:text-xs text-gray-500">{project.clips.length} Clips</span>
                 </div>
            </div>

            {/* Bottom: Timeline */}
            <div className="flex-1 flex flex-col shrink-0 min-h-0">
                <Timeline 
                    state={project}
                    onSeek={handleSeek}
                    onSelectClip={selectClip}
                    onUpdateClip={updateClip}
                    onSplitClip={splitClip}
                    onDeleteClip={deleteSelectedClip}
                    onZoom={handleZoom}
                    onToggleTrackMute={toggleTrackMute}
                    onToggleTrackSolo={toggleTrackSolo}
                    onToggleTrackRecord={toggleTrackRecord}
                    onApplyTransition={handleApplyTransition}
                />
            </div>
        </div>

        {/* Right: Inspector or AI - Overlay on Mobile */}
        {showAiPanel && (
             <div className="fixed inset-0 z-50 md:static md:inset-auto md:z-auto">
                 <AIAssistant onClose={() => setShowAiPanel(false)} />
             </div>
        )}
        
        {showInspector && (
             <div className="fixed inset-0 z-40 md:static md:inset-auto md:z-auto">
                <Inspector 
                    clip={selectedClip} 
                    onUpdateClip={updateClip} 
                    onClose={() => setShowInspector(false)}
                    projectAspectRatio={project.aspectRatio}
                />
             </div>
        )}
      </div>

      {/* Bottom Page Navigation (Mobile Friendly) */}
      <div className="h-14 bg-gray-950 border-t border-gray-800 flex items-center justify-around md:justify-center shrink-0 z-50">
          <NavItem id="media" icon={FileVideo} label="Media" />
          <NavItem id="transitions" icon={Zap} label="Trans" />
          <NavItem id="cut" icon={Scissors} label="Cut" />
          <NavItem id="edit" icon={Clapperboard} label="Edit" />
          <NavItem id="color" icon={Palette} label="Color" />
          <div className="hidden md:flex">
             <NavItem id="fairlight" icon={Music} label="Fairlight" />
          </div>
          <NavItem id="deliver" icon={Download} label="Deliver" />
      </div>
    </div>
  );
};

export default App;