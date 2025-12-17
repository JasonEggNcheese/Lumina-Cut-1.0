import { ProjectState, Clip, MediaAsset, TrackType } from '../types';

// Helper functions adapted from Player.tsx
const getTransitionStyle = (clip: Clip, currentTime: number) => {
    if (!clip.transition) return { opacity: 1 };
    const timeIntoClip = currentTime - clip.startOffset;
    const duration = clip.transition.duration;
    if (timeIntoClip >= duration) return { opacity: 1 };
    const progress = Math.max(0, timeIntoClip / duration);
    switch (clip.transition.type) {
        case 'fade': case 'dissolve': return { opacity: progress, transform: '' };
        case 'slide-left': return { opacity: 1, transform: `translateX(${(1 - progress) * 100}%)` };
        case 'slide-right': return { opacity: 1, transform: `translateX(${-(1 - progress) * 100}%)` };
        case 'zoom': return { opacity: 1, transform: `scale(${progress})` };
        case 'wipe': return { opacity: 1, clipPath: `inset(0 ${100 - (progress * 100)}% 0 0)` };
        default: return { opacity: 1, transform: '' };
    }
};

const getBaseTransform = (clip: Clip, canvasWidth: number, canvasHeight: number) => {
    const scale = (clip.properties.scale || 100) / 100;
    const posX = (clip.properties.position?.x || 0) / 100 * canvasWidth;
    const posY = (clip.properties.position?.y || 0) / 100 * canvasHeight;
    const rotation = clip.properties.rotation || 0;
    return { scale, posX, posY, rotation };
};


export const exportProject = async (
    project: ProjectState,
    assets: MediaAsset[],
    resolution: { width: number; height: number; name: string },
    onProgress: (progress: number, status: string) => void
): Promise<void> => {
    const FRAME_RATE = 30;
    const canvas = document.createElement('canvas');
    canvas.width = resolution.width;
    canvas.height = resolution.height;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) {
        throw new Error("Could not create canvas context for export.");
    }

    // 1. Preload all media assets
    onProgress(0, "Loading media assets...");
    const mediaElements = new Map<string, HTMLVideoElement | HTMLImageElement>();
    const assetPromises = assets.map(asset => new Promise<void>(resolve => {
        if (asset.type === 'video') {
            const video = document.createElement('video');
            video.src = asset.src;
            video.crossOrigin = "anonymous";
            video.muted = true;
            video.oncanplaythrough = () => { mediaElements.set(asset.id, video); resolve(); };
            video.onerror = () => resolve();
        } else if (asset.type === 'image') {
            const img = new Image();
            img.src = asset.src;
            img.crossOrigin = "anonymous";
            img.onload = () => { mediaElements.set(asset.id, img); resolve(); };
            img.onerror = () => resolve();
        } else {
            resolve();
        }
    }));
    await Promise.all(assetPromises);

    // 2. Setup Audio Mixer
    onProgress(0.05, "Compositing audio...");
    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();
    const audioElements = new Map<string, { el: HTMLAudioElement, source: MediaElementAudioSourceNode }>();
    const audioSetupPromises = project.clips
        .filter(c => c.type === 'audio' || c.type === 'video')
        .map(clip => new Promise<void>(resolve => {
            const audio = document.createElement('audio');
            audio.src = clip.src;
            audio.crossOrigin = "anonymous";
            audio.oncanplaythrough = () => {
                const source = audioCtx.createMediaElementSource(audio);
                source.connect(destination);
                audioElements.set(clip.id, { el: audio, source });
                resolve();
            };
            audio.onerror = () => resolve();
        }));
    await Promise.all(audioSetupPromises);
    
    // 3. Setup MediaRecorder
    const audioTrack = destination.stream.getAudioTracks()[0];
    const canvasStream = canvas.captureStream(FRAME_RATE);
    const videoTrack = canvasStream.getVideoTracks()[0];
    const combinedStream = new MediaStream([videoTrack, audioTrack]);

    const MimeType = 'video/mp4; codecs=avc1.42E01E,mp4a.40.2';
    if (!MediaRecorder.isTypeSupported(MimeType)) {
        throw new Error("MP4 export is not supported in this browser. Please try Chrome on desktop.");
    }
    const recorder = new MediaRecorder(combinedStream, { mimeType: MimeType, videoBitsPerSecond: 5000000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    
    const exportPromise = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Lumina-Export-${resolution.name}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            resolve();
        };
        recorder.onerror = (e) => reject(e);
    });

    recorder.start();

    // 4. Render Frame by Frame
    const totalFrames = Math.floor(project.duration * FRAME_RATE);
    for (let frame = 0; frame <= totalFrames; frame++) {
        const currentTime = frame / FRAME_RATE;
        onProgress(0.1 + (frame / totalFrames) * 0.9, `Rendering frame ${frame}/${totalFrames}`);

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const activeClips = project.clips
            .filter(c => currentTime >= c.startOffset && currentTime < c.startOffset + c.duration)
            .sort((a, b) => project.tracks.findIndex(t => t.id === a.trackId) - project.tracks.findIndex(t => t.id === b.trackId));

        const seekPromises: Promise<void>[] = [];
        activeClips.forEach(clip => {
            const timeInClip = currentTime - clip.startOffset;
            const audioNode = audioElements.get(clip.id);
            if (audioNode) {
                audioNode.el.volume = (clip.properties.volume ?? 100) / 100;
                audioNode.el.currentTime = clip.sourceStart + timeInClip;
                audioNode.el.play().catch(() => {});
            }

            if (clip.type === 'video') {
                const mediaEl = mediaElements.get(clip.assetId) as HTMLVideoElement;
                if (mediaEl) {
                    const sourceTime = clip.sourceStart + timeInClip;
                    if (Math.abs(mediaEl.currentTime - sourceTime) > 0.1) {
                        mediaEl.currentTime = sourceTime;
                        seekPromises.push(new Promise(res => { mediaEl.onseeked = () => res(); }));
                    }
                }
            }
        });
        
        audioElements.forEach((node, clipId) => {
            if (!activeClips.some(c => c.id === clipId)) node.el.pause();
        });
        
        if(seekPromises.length > 0) await Promise.all(seekPromises);
        
        // Draw visual clips
        for (const clip of activeClips) {
            ctx.save();
            const props = clip.properties;
            
            // Transitions & Transforms
            const transition = getTransitionStyle(clip, currentTime);
            const baseTransform = getBaseTransform(clip, canvas.width, canvas.height);
            ctx.globalAlpha = ((props.opacity ?? 100) / 100) * (transition.opacity ?? 1);

            ctx.translate(canvas.width / 2 + baseTransform.posX, canvas.height / 2 + baseTransform.posY);
            ctx.rotate(baseTransform.rotation * Math.PI / 180);
            ctx.scale(baseTransform.scale, baseTransform.scale);
            
            // CSS Filters
            let filterString = `brightness(${1 + (props.brightness || 0)/100}) contrast(${1 + (props.contrast || 0)/100}) saturate(${(props.saturation || 100)/100})`;
            // Note: More complex effects from Player.tsx are omitted for simplicity.
            ctx.filter = filterString;

            if (clip.type === 'video' || clip.type === 'image') {
                const mediaEl = mediaElements.get(clip.assetId);
                if (mediaEl) {
                    const elWidth = (mediaEl as HTMLVideoElement).videoWidth || mediaEl.width;
                    const elHeight = (mediaEl as HTMLVideoElement).videoHeight || mediaEl.height;
                    const canvasAspect = canvas.width / canvas.height;
                    const mediaAspect = elWidth / elHeight;

                    let drawWidth, drawHeight, offsetX, offsetY;
                    if (canvasAspect > mediaAspect) { // Canvas is wider
                        drawHeight = canvas.height;
                        drawWidth = drawHeight * mediaAspect;
                    } else { // Canvas is taller or same aspect
                        drawWidth = canvas.width;
                        drawHeight = drawWidth / mediaAspect;
                    }
                    offsetX = -drawWidth / 2;
                    offsetY = -drawHeight / 2;
                    ctx.drawImage(mediaEl, offsetX, offsetY, drawWidth, drawHeight);
                }
            } else if (clip.type === 'text') {
                ctx.fillStyle = props.fontColor || '#FFFFFF';
                ctx.font = `${props.fontWeight || 'normal'} ${props.fontSize || 24}px ${props.fontFamily || 'sans-serif'}`;
                ctx.textAlign = props.textAlign || 'center';
                ctx.textBaseline = 'middle';
                if(props.backgroundColor) {
                    ctx.fillStyle = props.backgroundColor;
                    // simple background rect
                }
                ctx.fillStyle = props.fontColor || '#FFFFFF';
                ctx.fillText(props.textContent || '', 0, 0);
            }
            ctx.restore();
        }
        await new Promise(res => setTimeout(res, 10)); // give time for draw
    }

    // 5. Finalize
    recorder.stop();
    audioCtx.close();
    onProgress(1, "Finalizing video...");
    await exportPromise;
};
