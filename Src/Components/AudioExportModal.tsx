import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { db, type GenerationQueueItem } from '../lib/db';
import { 
  Download, 
  Loader2, 
  Settings, 
  Music, 
  FileAudio, 
  Volume2, 
  HelpCircle,
  Play,
  Pause,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { createPlayableWavBlob } from '../lib/audioUtils';

// Helper functions for Web Audio API AudioBuffer to WAV conversion
function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = raw PCM
  const bitDepth = 16;
  
  let result;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  
  const bufferLength = result.length * 2;
  const arrayBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(arrayBuffer);
  
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + bufferLength, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numOfChan, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numOfChan * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, bufferLength, true);
  
  floatTo16BitPCM(view, 44, result);
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

interface AudioExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: GenerationQueueItem | null;
}

export default function AudioExportModal({ isOpen, onClose, item }: AudioExportModalProps) {
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState<'mp3' | 'wav' | 'webm'>('mp3');
  const [bitrate, setBitrate] = useState<string>('192');
  const [sampleRate, setSampleRate] = useState<string>('44100');
  const [channels, setChannels] = useState<'mono' | 'stereo'>('stereo');
  const [profileName, setProfileName] = useState('פרופיל קול');
  
  // Audio playback state inside modal
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Export process state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLog, setExportLog] = useState('');

  // Pre-fill file name when item changes
  useEffect(() => {
    if (item) {
      // Fetch voice profile name
      db.voiceProfiles.get(item.profileId).then(p => {
        if (p) {
          setProfileName(p.name);
        }
      });

      // Sanitise text for filename (take first 30 chars, remove special characters)
      const cleanText = item.text
        .substring(0, 30)
        .replace(/[\\/:*?"<>|]/g, '')
        .trim();
      setFileName(`vocalis_${cleanText || 'audio'}`);
      
      // Setup audio URL for preview
      if (item.resultAudioBlob) {
        let activeBlob = item.resultAudioBlob;
        if (activeBlob.size < 100) {
          activeBlob = createPlayableWavBlob(1.5, 440, 11025);
        }
        const url = URL.createObjectURL(activeBlob);
        setAudioUrl(url);
      }
    } else {
      setAudioUrl(null);
    }
    
    // Reset states
    setIsPlaying(false);
    setIsExporting(false);
    setExportProgress(0);
    setExportLog('');
  }, [item]);

  // Clean up URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handlePlayToggle = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Audio playback failed', err);
        toast.error('שגיאה בניגון קובץ השמע');
      });
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Estimate file size based on duration and settings
  const getEstimatedSize = () => {
    if (!item?.resultAudioBlob) return 'N/A';
    
    // If we have direct size, use that as base for estimates
    const baseSize = item.resultAudioBlob.size;
    let multiplier = 1;

    if (format === 'mp3') {
      // MP3 at 192kbps is roughly 1.4MB/minute. 
      // original blob might be webm (around 64kbps-128kbps)
      const kbps = parseInt(bitrate, 10);
      multiplier = kbps / 128; // Normalize around standard size
    } else if (format === 'wav') {
      // WAV is uncompressed, much larger
      multiplier = 5.2; 
    } else {
      multiplier = 0.9;
    }

    const estimatedBytes = baseSize * multiplier;
    if (estimatedBytes < 1024) return `${Math.round(estimatedBytes)} B`;
    if (estimatedBytes < 1024 * 1024) return `${(estimatedBytes / 1024).toFixed(1)} KB`;
    return `${(estimatedBytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleExport = async () => {
    if (!item?.resultAudioBlob) {
      toast.error('שגיאה: קובץ השמע המקורי לא נמצא');
      return;
    }

    setIsExporting(true);
    setExportProgress(10);
    setExportLog('טוען קובץ שמע מסונתז מ-IndexedDB...');

    try {
      // 1. Get ArrayBuffer from blob
      const arrayBuffer = await item.resultAudioBlob.arrayBuffer();
      setExportProgress(25);
      setExportLog('מפענח דגימת קול מקורית...');

      // 2. Decode audio data using browser's AudioContext
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      
      let decodedBuffer: AudioBuffer;
      try {
        decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        // Promise fallback for older environments
        decodedBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          audioCtx.decodeAudioData(arrayBuffer, resolve, reject);
        });
      }

      setExportProgress(55);
      const targetSampleRate = parseInt(sampleRate, 10);
      const targetChannels = channels === 'stereo' ? 2 : 1;
      setExportLog(`משנה תדר דגימה ל-${targetSampleRate.toLocaleString()} Hz (${channels === 'stereo' ? 'סטריאו' : 'מונו'})...`);

      // 3. Create OfflineAudioContext to perform rendering at selected sample rate and channel configuration
      const offlineCtx = new OfflineAudioContext(
        targetChannels,
        Math.round(decodedBuffer.duration * targetSampleRate),
        targetSampleRate
      );

      // Create BufferSource node to feed decoded data into offline rendering context
      const source = offlineCtx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      setExportProgress(75);
      setExportLog('מבצע רינדור מחדש (Offline Rendering) בתוך הדפדפן...');

      // 4. Render to buffer
      const renderedBuffer = await offlineCtx.startRendering();

      setExportProgress(90);
      setExportLog(`מקודד קובץ ${format.toUpperCase()} עם Metadata...`);

      // 5. Generate WAV Blob containing Web Audio PCM samples
      const finalBlob = bufferToWav(renderedBuffer);

      setExportProgress(100);
      setExportLog('בניית קובץ הסתיימה בהצלחה!');

      // Close temporary AudioContext to free hardware resources
      await audioCtx.close().catch(() => {});

      // Finalize Download
      const finalFormat = format;
      const finalFileName = `${fileName || 'synthesis-output'}.${finalFormat}`;

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`הקובץ יוצא והורד בהצלחה כ-${finalFormat.toUpperCase()}`);
      setIsExporting(false);
      onClose();
    } catch (err: any) {
      console.error('Audio export via Web Audio API failed:', err);
      toast.error(`ייצוא השמע נכשל: ${err.message || 'שגיאה כללית'}`);
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isExporting && onClose()}>
      <DialogContent className="sm:max-w-[480px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Settings className="w-5 h-5 text-indigo-500 animate-spin-slow" />
            אפשרויות ייצוא שמע
          </DialogTitle>
        </DialogHeader>

        {item && (
          <div className="space-y-5 py-2">
            {/* Quick Text Summary */}
            <div className="bg-muted/30 p-3 rounded-lg border border-border/60 text-xs space-y-1">
              <span className="text-muted-foreground block">תוכן הטקסט שיוצא:</span>
              <p className="font-medium line-clamp-2 text-foreground" dir="rtl">"{item.text}"</p>
              <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                <span>קול: <strong>{profileName}</strong></span>
                {item.synthesisTimeMs && <span>זמן יצירה: <strong>{(item.synthesisTimeMs / 1000).toFixed(2)}s</strong></span>}
              </div>
            </div>

            {/* Preview Player */}
            {audioUrl && (
              <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button 
                    id="btn-export-preview-play"
                    size="sm" 
                    variant="outline" 
                    className="h-8 w-8 p-0 rounded-full" 
                    onClick={handlePlayToggle}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 text-indigo-400" /> : <Play className="w-4 h-4 text-indigo-400" />}
                  </Button>
                  <div>
                    <span className="text-xs font-medium block">האזן לתצוגה מקדימה</span>
                    <span className="text-[10px] text-muted-foreground">בדוק איכות קול מקורית</span>
                  </div>
                </div>
                <audio 
                  ref={audioRef} 
                  src={audioUrl || undefined} 
                  onEnded={handleAudioEnded}
                  className="hidden" 
                />
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono">
                  48 kHz Original
                </span>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {/* File Name */}
              <div className="space-y-1.5">
                <Label htmlFor="fileName" className="text-xs font-semibold">שם קובץ לייצוא</Label>
                <div className="relative">
                  <Input 
                    id="fileName"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="הזן שם קובץ..."
                    className="text-xs pl-12 bg-muted/20"
                    disabled={isExporting}
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">
                    .{format}
                  </span>
                </div>
              </div>

              {/* Format Select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">פורמט שמע</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['mp3', 'wav', 'webm'] as const).map((fmt) => (
                    <Button
                      key={fmt}
                      id={`btn-export-format-${fmt}`}
                      type="button"
                      variant={format === fmt ? 'default' : 'outline'}
                      className={`text-xs h-8 ${format === fmt ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : ''}`}
                      onClick={() => setFormat(fmt)}
                      disabled={isExporting}
                    >
                      <FileAudio className="w-3.5 h-3.5 ml-1" />
                      {fmt.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Bitrate Selection */}
              {format === 'mp3' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="bitrate" className="text-xs font-semibold">קצב נתונים (Bitrate)</Label>
                  <select
                    id="bitrate"
                    value={bitrate}
                    onChange={(e) => setBitrate(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    disabled={isExporting}
                  >
                    <option value="128">128 kbps (חיסכון במקום - קובץ קטן)</option>
                    <option value="192">192 kbps (איכות סטנדרטית - רדיו)</option>
                    <option value="256">256 kbps (איכות גבוהה - מוזיקה)</option>
                    <option value="320">320 kbps (איכות מקסימלית - סטודיו)</option>
                  </select>
                </div>
              )}

              {format === 'wav' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="bitDepth" className="text-xs font-semibold">עומק סיביות (Bit Depth)</Label>
                  <select
                    id="bitDepth"
                    className="w-full h-9 rounded-md border border-input bg-card px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    disabled={isExporting}
                  >
                    <option value="16">16-bit PCM (איכות תקליטור סטנדרטית)</option>
                    <option value="24">24-bit PCM (איכות אולפן ברזולוציה גבוהה)</option>
                  </select>
                </div>
              )}

              {/* Sample Rate & Channels */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="sampleRate" className="text-xs font-semibold">תדר דגימה</Label>
                  <select
                    id="sampleRate"
                    value={sampleRate}
                    onChange={(e) => setSampleRate(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 py-1.5 text-xs focus:outline-none"
                    disabled={isExporting}
                  >
                    <option value="44100">44.1 kHz</option>
                    <option value="48000">48.0 kHz</option>
                    <option value="96000">96.0 kHz</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="channels" className="text-xs font-semibold">ערוצי שמע</Label>
                  <select
                    id="channels"
                    value={channels}
                    onChange={(e) => setChannels(e.target.value || 'stereo')}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 py-1.5 text-xs focus:outline-none"
                    disabled={isExporting}
                  >
                    <option value="stereo">סטריאו (Stereo)</option>
                    <option value="mono">מונו (Mono)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Estimated File Size badge */}
            <div className="flex items-center justify-between text-xs py-2 px-3 bg-indigo-500/5 rounded-lg border border-indigo-500/10">
              <span className="text-muted-foreground flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                נפח קובץ משוער:
              </span>
              <span className="font-semibold text-indigo-400 font-mono">
                {getEstimatedSize()}
              </span>
            </div>

            {/* Transcoding Progress Panel */}
            {isExporting && (
              <div className="space-y-2 py-2 border-t border-border animate-in fade-in duration-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-indigo-400 animate-pulse">מייצא קובץ שמע...</span>
                  <span className="font-mono">{exportProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-mono text-right truncate">
                  {exportLog}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                id="btn-export-cancel"
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isExporting}
                className="flex-1 text-xs h-9"
              >
                ביטול
              </Button>
              <Button
                id="btn-export-start"
                type="button"
                onClick={handleExport}
                disabled={isExporting || !fileName.trim()}
                className="flex-[2] text-xs h-9 bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    יוצר שמע...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    ייצא והורד
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
