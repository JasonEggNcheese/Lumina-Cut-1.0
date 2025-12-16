import React, { useState } from 'react';
import { Clip, VisualEffect, VisualEffectType, ChromaKey, TransitionType } from '../types';
import { Sliders, Aperture, Music2, Wand2, X, ScanFace, Loader2, CheckCircle2, Eye, Crop, MonitorSmartphone, StretchHorizontal, Timer, Plus, Trash2, Droplets, Palette, Sun, Zap, CircleDashed, Pipette, Type, AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
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

const TRANSITIONS: { type: TransitionType; name: string }[] = [
  { type: 'fade', name: 'Cross Dissolve' },
  { type: 'slide-left', name: 'Slide Left' },
  { type: 'slide-right', name: 'Slide Right' },
  { type: 'zoom', name: 'Zoom In' },
  { type: 'wipe', name: 'Linear Wipe' },
  { type: 'dissolve', name: 'Glitch' },
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
  
  const updateChromaKeyProp = (key: keyof ChromaKey, value: any) => {
      const currentChromaKey = clip.properties.chromaKey || { enabled: false, keyColor: '#00ff00', tolerance: 20, feather: 10 };
      updateProp('chromaKey', { ...currentChromaKey, [key]: value });
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
  
  const handleTransitionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as TransitionType | 'none';
    if (type === 'none') {
        handleRemoveTransition();
    } else {
        onUpdateClip(clip.id, {
            transition: {
                type,
                duration: clip.transition?.duration || 1.0,
            },
        });
    }
  };

  const handleTransitionDurationChange = (duration: number) => {
      if (clip.transition) {
          onUpdateClip(clip.id, {
              transition: { ...clip.transition, duration },
          });
      }
  };

  const handleRemoveTransition = () => {
      onUpdateClip(clip.id, { transition: undefined });
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

  const chroma = clip.properties.chromaKey || { enabled: false, keyColor: '#00ff00', tolerance: 20, feather: 10 };

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

        {/* Text Tools */}
        {clip.type === 'text' && (
            <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Type size={14} /> Text
                </h3>
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                    <textarea 
                        value={clip.properties.textContent || ''}
                        onChange={(e) => updateProp('textContent', e.target.value)}
                        className="w-full bg-gray-900/50 text-sm text-gray-200 p-2 rounded-md border border-gray-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none resize-y mb-4"
                        rows={3}
                    />
                    <Slider 
                        label="Font Size" 
                        value={clip.properties.fontSize ?? 24} 
                        min={8} max={200} 
                        onChange={(v: number) => updateProp('fontSize', v)} 
                        unit="px"
                    />
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-xs text-gray-400 font-medium mb-1 block">Color</label>
                            <input type="color" value={clip.properties.fontColor || '#FFFFFF'} onChange={e => updateProp('fontColor', e.target.value)} className="w-full h-8 p-0 border-none rounded cursor-pointer bg-gray-700" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 font-medium mb-1 block">Background</label>
                            <input type="color" value={clip.properties.backgroundColor || '#000000'} onChange={e => updateProp('backgroundColor', e.target.value)} className="w-full h-8 p-0 border-none rounded cursor-pointer bg-gray-700" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-medium mb-2 block">Alignment</label>
                        <div className="flex bg-gray-900/50 rounded-md p-1">
                            {(['left', 'center', 'right'] as const).map(align => (
                                <button key={align} onClick={() => updateProp('textAlign', align)} className={`flex-1 p-1.5 rounded-sm text-gray-400 transition-colors ${clip.properties.textAlign === align ? 'bg-violet-600 text-white' : 'hover:bg-gray-700'}`}>
                                    {align === 'left' ? <AlignLeft size={16}/> : align === 'center' ? <AlignCenter size={16}/> : <AlignRight size={16}/>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* General Transform Tools */}
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

        {/* Transitions Section */}
        {(clip.type === 'video' || clip.type === 'image' || clip.type === 'text') && (
            <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Zap size={14} /> Transition
                </h3>
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm text-gray-300">Effect</label>
                        <select
                            value={clip.transition?.type || 'none'}
                            onChange={handleTransitionChange}
                            className="bg-gray-700 text-xs text-white p-2 rounded border border-gray-600 focus:outline-none focus:border-violet-500"
                        >
                            <option value="none">None</option>
                            {TRANSITIONS.map(t => (
                                <option key={t.type} value={t.type}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    {clip.transition && (
                        <>
                            <Slider
                                label="Duration"
                                value={clip.transition.duration.toFixed(1)}
                                min={0.1}
                                max={3}
                                step={0.1}
                                onChange={handleTransitionDurationChange}
                                unit="s"
                            />
                            <button
                                onClick={handleRemoveTransition}
                                className="w-full mt-2 text-xs text-red-400 hover:bg-red-900/50 p-2 rounded flex items-center justify-center gap-2 transition-colors"
                            >
                                <Trash2 size={14} /> Remove Transition
                            </button>
                        </>
                    )}
                </div>
            </div>
        )}

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
                    <Pipette size={14} /> Chroma Key
                </h3>
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-3">
                        <label htmlFor="chroma-toggle" className="text-sm text-gray-300">Enable Effect</label>
                        <button 
                            id="chroma-toggle"
                            onClick={() => updateChromaKeyProp('enabled', !chroma.enabled)}
                            className={`w-10 h-5 rounded-full transition-colors flex items-center p-1 ${chroma.enabled ? 'bg-green-500 justify-end' : 'bg-gray-700 justify-start'}`}
                        >
                            <div className="w-3 h-3 bg-white rounded-full shadow-md"></div>
                        </button>
                    </div>
                    {chroma.enabled && (
                        <>
                            <div className="flex items-center gap-2 mb-4">
                                <label className="text-xs text-gray-400 font-medium">Key Color</label>
                                <input 
                                    type="color" 
                                    value={chroma.keyColor}
                                    onChange={(e) => updateChromaKeyProp('keyColor', e.target.value)}
                                    className="w-8 h-6 p-0 border-none rounded cursor-pointer bg-gray-700"
                                />
                                <button onClick={() => updateChromaKeyProp('keyColor', '#00ff00')} className="w-4 h-4 rounded-full bg-green-500 border border-gray-900"></button>
                                <button onClick={() => updateChromaKeyProp('keyColor', '#0000ff')} className="w-4 h-4 rounded-full bg-blue-500 border border-gray-900"></button>
                            </div>
                            <Slider 
                                label="Tolerance"
                                value={chroma.tolerance}
                                min={0} max={100}
                                onChange={(v: number) => updateChromaKeyProp('tolerance', v)}
                            />
                            <Slider 
                                label="Feather"
                                value={chroma.feather}
                                min={0} max={100}
                                onChange={(v: number) => updateChromaKeyProp('feather', v)}
                            />
                        </>
                    )}
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
