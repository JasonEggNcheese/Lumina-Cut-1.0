import React, { useState } from 'react';
import { Clip, VisualEffect, VisualEffectType } from '../types';
import { Sliders, Aperture, Music2, Wand2, X, ScanFace, Loader2, CheckCircle2, Eye, Crop, MonitorSmartphone, StretchHorizontal, Timer, Plus, Trash2, Droplets, Palette, Sun, Zap, CircleDashed } from 'lucide-react';
import { detectMaskableObjects, analyzeReframeFocus, generateExtendedFrames } from '../services/geminiService';

interface InspectorProps {
  clip: Clip | undefined;
  onUpdateClip: (id: string, updates: Partial<Clip>) => void;
  onClose: () => void;
  projectAspectRatio: string;
}

const Slider = ({ label, value, min, max, step = 1, onChange, unit = '' }: any) => (
  <div className="mb-4">
    <div className="flex justify-between mb-1">
      <label className="text-xs text-gray-400 font-medium">{label}</label>
      <span className="text-xs text-gray-500 font-mono">{value}{unit}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      step={step}
      value={value} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500 hover:accent-violet-400"
    />
  </div>
);

const AVAILABLE_EFFECTS: { type: VisualEffectType; name: string; icon: any }[] = [
    { type: 'blur', name: 'Gaussian Blur', icon: Droplets },
    { type: 'sepia', name: 'Vintage Sepia', icon: Palette },
    { type: 'grayscale', name: 'Noir B&W', icon: Sun },
    { type: 'hue', name: 'Psychedelic', icon: Zap },
    { type: 'invert', name: 'Negative', icon: CircleDashed },
    { type: 'vignette', name: 'Vignette', icon: CircleDashed },
];

export const Inspector: React.FC<InspectorProps> = ({ clip, onUpdateClip, onClose, projectAspectRatio }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReframing, setIsReframing] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [extensionSeconds, setExtensionSeconds] = useState(2);

  if (!clip) {
    return (
      <div className="w-full md:w-80 bg-gray-900 border-l border-gray-800 p-8 flex flex-col items-center justify-center text-gray-500 h-full">
        <Sliders size={48} className="mb-4 opacity-20" />
        <p className="text-sm text-center">Select a clip to view properties</p>
        <button onClick={onClose} className="mt-8 md:hidden text-gray-400 underline">Close Inspector</button>
      </div>
    );
  }

  const updateProp = (key: string, value: any) => {
    onUpdateClip(clip.id, {
      properties: {
        ...clip.properties,
        [key]: value
      }
    });
  };

  const updatePropNested = (parent: string, key: string, value: any) => {
      const currentParent = (clip.properties as any)[parent] || {};
      onUpdateClip(clip.id, {
          properties: {
              ...clip.properties,
              [parent]: {
                  ...currentParent,
                  [key]: value
              }
          }
      });
  };

  const handleAddEffect = (type: VisualEffectType) => {
      const newEffect: VisualEffect = {
          id: Math.random().toString(36).substr(2, 9),
          type,
          name: AVAILABLE_EFFECTS.find(e => e.type === type)?.name || 'Effect',
          intensity: 50
      };
      const currentEffects = clip.properties.effects || [];
      updateProp('effects', [...currentEffects, newEffect]);
  };

  const handleRemoveEffect = (id: string) => {
      const currentEffects = clip.properties.effects || [];
      updateProp('effects', currentEffects.filter(e => e.id !== id));
  };

  const handleUpdateEffectIntensity = (id: string, intensity: number) => {
      const currentEffects = clip.properties.effects || [];
      updateProp('effects', currentEffects.map(e => e.id === id ? { ...e, intensity } : e));
  };

  const handleAnalyzeObjects = async () => {
    setIsAnalyzing(true);
    try {
        const objects = await detectMaskableObjects(clip.name);
        updateProp('detectedObjects', objects);
    } catch (e) {
        console.error(e);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleAutoReframe = async () => {
      setIsReframing(true);
      try {
          let targetScale = 100;
          if (projectAspectRatio === '9:16') {
             targetScale = 315; 
          } else if (projectAspectRatio === '1:1') {
             targetScale = 177;
          } else if (projectAspectRatio === '4:5') {
             targetScale = 222;
          }

          const result = await analyzeReframeFocus(clip.name);
          updateProp('scale', targetScale);
          updateProp('position', { x: -result.xOffset, y: 0 });
      } catch (e) {
          console.error(e);
      } finally {
          setIsReframing(false);
      }
  }

  const handleSmartExtend = async () => {
      setIsExtending(true);
      try {
          const success = await generateExtendedFrames(clip.name, extensionSeconds);
          if (success) {
              const currentAiDuration = clip.properties.aiExtendedDuration || 0;
              
              // Update both the total duration and the AI property atomically
              onUpdateClip(clip.id, { 
                  duration: clip.duration + extensionSeconds,
                  properties: {
                      ...clip.properties,
                      aiExtendedDuration: currentAiDuration + extensionSeconds
                  }
              });
          }
      } catch(e) {
          console.error(e);
      } finally {
          setIsExtending(false);
      }
  };

  const handleRemoveSmartExtend = () => {
      const ext = clip.properties.aiExtendedDuration || 0;
      if (ext === 0) return;

      onUpdateClip(clip.id, { 
          duration: Math.max(0.5, clip.duration - ext),
          properties: {
              ...clip.properties,
              aiExtendedDuration: 0
          }
      });
  };

  const toggleMask = (obj: string) => {
    const newValue = clip.properties.activeMaskId === obj ? null : obj;
    updateProp('activeMaskId', newValue);
    if (newValue) {
        updateProp('maskOverlayVisible', true);
    }
  };

  return (
    <div className="w-full md:w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full z-20 shadow-xl">
      <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-850">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Sliders size={16} className="text-violet-400" />
          Inspector
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18}/></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-24 md:pb-4">
        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            Information
          </h3>
          <div className="bg-gray-800 rounded p-3 text-xs text-gray-300 space-y-2">
            <div className="flex justify-between"><span>Name</span> <span className="text-white truncate max-w-[120px]">{clip.name}</span></div>
            <div className="flex justify-between"><span>Duration</span> <span className="text-white">{clip.duration.toFixed(2)}s</span></div>
            <div className="flex justify-between"><span>Type</span> <span className="uppercase text-violet-400">{clip.type}</span></div>
          </div>
        </div>

        {/* Video / Image Tools */}
        {(clip.type === 'video' || clip.type === 'image') && (
          <>
             {/* Smart Reframe Section */}
             <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2 text-pink-400">
                    <Crop size={14} /> Smart Reframe
                </h3>
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                     <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                        Convert horizontal footage for {projectAspectRatio} aspect ratio by intelligently tracking the subject.
                     </p>
                     <button 
                        onClick={handleAutoReframe}
                        disabled={isReframing || projectAspectRatio === '16:9'}
                        className={`w-full py-2 rounded text-xs flex items-center justify-center gap-2 border transition-all
                            ${projectAspectRatio === '16:9' 
                                ? 'bg-gray-800 text-gray-500 border-transparent cursor-not-allowed' 
                                : 'bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 border-pink-500/30 hover:border-pink-500/50'
                            }`}
                     >
                        {isReframing ? <Loader2 className="animate-spin" size={14} /> : <MonitorSmartphone size={14} />}
                        {isReframing ? 'Reframing...' : 'Auto Reframe Clip'}
                     </button>
                </div>
             </div>

             {/* Smart Extend Section */}
             <div className="mb-6">
                 <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2 text-emerald-400">
                     <StretchHorizontal size={14} /> Smart Extend
                 </h3>
                 <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                     <p className="text-xs text-gray-400 mb-3">
                         Generate new frames to extend clip length.
                     </p>
                     <div className="flex items-center gap-2 mb-3">
                         <Timer size={14} className="text-gray-500" />
                         <input 
                            type="range" 
                            min="0.5" 
                            max="5" 
                            step="0.5"
                            value={extensionSeconds}
                            onChange={(e) => setExtensionSeconds(parseFloat(e.target.value))}
                            className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                         />
                         <span className="text-xs font-mono text-gray-300 w-8 text-right">{extensionSeconds}s</span>
                     </div>
                     <button 
                        onClick={handleSmartExtend}
                        disabled={isExtending}
                        className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs py-2 rounded border border-emerald-500/30 hover:border-emerald-500/50 transition-colors flex items-center justify-center gap-2"
                     >
                         {isExtending ? <Loader2 className="animate-spin" size={14} /> : <StretchHorizontal size={14} />}
                         {isExtending ? 'Generating Frames...' : 'Generate Frames'}
                     </button>
                     {clip.properties.aiExtendedDuration ? (
                        <div className="mt-2 flex items-center justify-between text-[10px] text-emerald-500/80">
                             <span className="flex items-center gap-1"><CheckCircle2 size={10} /> Added {clip.properties.aiExtendedDuration}s</span>
                             <button 
                                onClick={handleRemoveSmartExtend}
                                className="text-gray-500 hover:text-red-400 underline decoration-red-400/30"
                             >
                                Remove
                             </button>
                        </div>
                     ) : null}
                 </div>
             </div>

             {/* Magic Mask Section */}
             <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2 text-violet-300">
                    <ScanFace size={14} /> Magic Mask
                </h3>
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                    {!clip.properties.detectedObjects ? (
                        <div className="text-center py-4">
                            <p className="text-xs text-gray-400 mb-3">Use AI to track objects automatically.</p>
                            <button 
                                onClick={handleAnalyzeObjects}
                                disabled={isAnalyzing}
                                className="w-full bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs py-2 rounded border border-violet-500/30 transition-colors flex items-center justify-center gap-2"
                            >
                                {isAnalyzing ? <Loader2 className="animate-spin" size={14}/> : <ScanFace size={14} />}
                                {isAnalyzing ? 'Analyzing Frames...' : 'Detect Objects'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-gray-400">Detected Objects</span>
                                <button 
                                    className={`text-xs p-1 rounded hover:bg-gray-700 ${clip.properties.maskOverlayVisible ? 'text-violet-400' : 'text-gray-500'}`}
                                    onClick={() => updateProp('maskOverlayVisible', !clip.properties.maskOverlayVisible)}
                                    title="Toggle Mask Overlay"
                                >
                                    <Eye size={14} />
                                </button>
                             </div>
                             <div className="flex flex-wrap gap-2">
                                {clip.properties.detectedObjects.map(obj => (
                                    <button
                                        key={obj}
                                        onClick={() => toggleMask(obj)}
                                        className={`px-3 py-1.5 rounded-full text-xs border transition-all flex items-center gap-1.5
                                            ${clip.properties.activeMaskId === obj 
                                                ? 'bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-900/50' 
                                                : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'}`}
                                    >
                                        {obj}
                                        {clip.properties.activeMaskId === obj && <CheckCircle2 size={10} />}
                                    </button>
                                ))}
                             </div>
                             <button 
                                onClick={() => updateProp('detectedObjects', undefined)}
                                className="mt-3 text-[10px] text-gray-500 hover:text-gray-300 underline w-full text-center"
                             >
                                Reset Analysis
                             </button>
                        </div>
                    )}
                </div>
             </div>

             <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Wand2 size={14} /> Transform
              </h3>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <Slider 
                  label="Opacity" 
                  value={clip.properties.opacity ?? 100} 
                  min={0} max={100} 
                  onChange={(v: number) => updateProp('opacity', v)} 
                  unit="%"
                />
                <Slider 
                  label="Scale" 
                  value={clip.properties.scale ?? 100} 
                  min={10} max={300} 
                  onChange={(v: number) => updateProp('scale', v)} 
                  unit="%"
                />
                <div className="grid grid-cols-2 gap-4">
                     <Slider 
                        label="Pos X" 
                        value={clip.properties.position?.x ?? 0} 
                        min={-100} max={100} 
                        onChange={(v: number) => updatePropNested('position', 'x', v)} 
                     />
                     <Slider 
                        label="Pos Y" 
                        value={clip.properties.position?.y ?? 0} 
                        min={-100} max={100} 
                        onChange={(v: number) => updatePropNested('position', 'y', v)} 
                     />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Aperture size={14} /> Color Grading
              </h3>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <Slider 
                  label="Exposure" 
                  value={clip.properties.brightness ?? 0} 
                  min={-100} max={100} 
                  onChange={(v: number) => updateProp('brightness', v)} 
                />
                <Slider 
                  label="Contrast" 
                  value={clip.properties.contrast ?? 0} 
                  min={-100} max={100} 
                  onChange={(v: number) => updateProp('contrast', v)} 
                />
                <Slider 
                  label="Saturation" 
                  value={clip.properties.saturation ?? 100} 
                  min={0} max={200} 
                  onChange={(v: number) => updateProp('saturation', v)} 
                  unit="%"
                />
                <Slider 
                  label="Temperature" 
                  value={clip.properties.temperature ?? 0} 
                  min={-50} max={50} 
                  onChange={(v: number) => updateProp('temperature', v)} 
                />
              </div>
            </div>
            
            <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Droplets size={14} /> Effects Browser
                </h3>
                
                {/* Applied Effects List */}
                {clip.properties.effects && clip.properties.effects.length > 0 && (
                    <div className="mb-4 space-y-2">
                        {clip.properties.effects.map(effect => (
                            <div key={effect.id} className="bg-gray-800 rounded p-3 border border-gray-700 relative group">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-semibold text-gray-300 flex items-center gap-2">
                                        <Wand2 size={12} className="text-violet-400" /> {effect.name}
                                    </span>
                                    <button 
                                        onClick={() => handleRemoveEffect(effect.id)}
                                        className="text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" max="100" 
                                    value={effect.intensity}
                                    onChange={(e) => handleUpdateEffectIntensity(effect.id, parseFloat(e.target.value))}
                                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                                />
                                <div className="flex justify-between mt-1">
                                    <span className="text-[10px] text-gray-500">Intensity</span>
                                    <span className="text-[10px] text-gray-400">{effect.intensity}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Available Effects Grid */}
                <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_EFFECTS.map(effect => (
                        <button 
                            key={effect.type} 
                            onClick={() => handleAddEffect(effect.type)}
                            className="bg-gray-800/50 hover:bg-violet-900/20 hover:border-violet-500/50 border border-gray-700/50 p-2 rounded text-xs text-left transition-all group flex flex-col items-center justify-center py-4 gap-2"
                        >
                            <effect.icon className="text-gray-400 group-hover:text-violet-400 transition-colors" size={20} />
                            <span className="text-gray-400 group-hover:text-white">{effect.name}</span>
                            <div className="opacity-0 group-hover:opacity-100 absolute inset-0 bg-violet-500/10 flex items-center justify-center rounded transition-opacity pointer-events-none">
                                <Plus size={16} className="text-violet-300" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
          </>
        )}

        {/* Audio Tools */}
        {(clip.type === 'audio' || clip.type === 'video') && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Music2 size={14} /> Audio Post
            </h3>
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
              <Slider 
                label="Volume" 
                value={clip.properties.volume ?? 100} 
                min={0} max={200} 
                onChange={(v: number) => updateProp('volume', v)} 
                unit="%"
              />
              <Slider 
                label="Pan" 
                value={clip.properties.pan ?? 0} 
                min={-50} max={50} 
                onChange={(v: number) => updateProp('pan', v)} 
              />
              <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                 <span className="text-xs text-gray-400">Equalizer</span>
                 <button className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Open EQ</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};