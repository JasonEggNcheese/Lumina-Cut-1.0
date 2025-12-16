
export enum TrackType {
  VIDEO = 'video',
  AUDIO = 'audio',
  TEXT = 'text'
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export interface MediaAsset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  src: string;
  duration: number; // in seconds
  thumbnail?: string;
}

export type VisualEffectType = 'blur' | 'sepia' | 'grayscale' | 'invert' | 'hue' | 'vignette';

export interface VisualEffect {
  id: string;
  type: VisualEffectType;
  name: string;
  intensity: number; // 0 to 100
}

export type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'wipe' | 'zoom' | 'dissolve';

export interface Transition {
  type: TransitionType;
  duration: number; // seconds
}

export interface ChromaKey {
  enabled: boolean;
  keyColor: string; // hex color e.g. #00ff00
  tolerance: number; // 0-100
  feather: number; // 0-100
  distance?: number; // 0-100
  shadow?: number; // 0-100
}

export interface ClipProperties {
  // Video & General
  opacity?: number;
  scale?: number;
  position?: { x: number; y: number }; // Percentage offset (-50 to 50)
  brightness?: number;
  contrast?: number;
  saturation?: number;
  temperature?: number;
  
  // Visual Effects
  effects?: VisualEffect[];
  chromaKey?: ChromaKey;

  // Audio
  volume?: number;
  pan?: number;

  // AI Magic Mask
  detectedObjects?: string[];
  activeMaskId?: string | null;
  maskOverlayVisible?: boolean;

  // AI Smart Extend
  aiExtendedDuration?: number; // Seconds added to the end via AI

  // Text
  textContent?: string;
  fontFamily?: string;
  fontSize?: number; // in pixels
  fontWeight?: 'normal' | 'bold';
  fontColor?: string; // hex color
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string; // hex color with alpha
}

export interface Clip {
  id: string;
  assetId: string;
  name: string;
  trackId: string;
  startOffset: number; // Time on the timeline (seconds) when this clip starts
  duration: number; // Duration of the clip in the timeline
  sourceStart: number; // Start time within the original source file
  type: 'video' | 'image' | 'audio' | 'text';
  src: string;
  selected?: boolean;
  properties: ClipProperties;
  transition?: Transition; // Entry transition
}

export interface Track {
  id:string;
  type: TrackType;
  name: string;
  isMuted: boolean;
  isLocked: boolean;
  isSolo: boolean;
  isRecordArmed: boolean;
}

export interface Marker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface ProjectState {
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
  currentTime: number; // Current playhead position in seconds
  duration: number; // Total project duration
  zoom: number; // Pixels per second
  isPlaying: boolean;
  aspectRatio: AspectRatio;
}
