import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Download, 
  RotateCcw, 
  Sparkles, 
  Clock,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { createPlayableWavBlob } from '../lib/audioUtils';

interface MiniAudioPlayerProps {
  audioBlob: Blob;
  title?: string;
  onDownload?: () => void;
  id?: string;
}

export default function MiniAudioPlayer({ audioBlob, title, onDownload, id }: MiniAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState([80]); // standard scale 0-100
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Generate URL for blob and reset audio state on change
  useEffect(() => {
    if (!audioBlob) return;
    let activeBlob = audioBlob;
    if (activeBlob.size < 100) {
      activeBlob = createPlayableWavBlob(1.5, 440, 11025);
    }
    const url = URL.createObjectURL(activeBlob);
    setAudioUrl(url);

    // Reset state
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    return () => {
      URL.revokeObjectURL(url);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [audioBlob, id]);

  // Sync state with HTML5 audio actions
  const startProgressTimer = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    progressIntervalRef.current = window.setInterval(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, 100);
  };

  const stopProgressTimer = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopProgressTimer();
    } else {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          startProgressTimer();
        })
        .catch(err => {
          console.error('Audio playback failed', err);
          toast.error('שגיאה בהשמעת קובץ השמע');
        });
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    stopProgressTimer();
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && !progressIntervalRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Skip forward or backward by 5 seconds
  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    let newTime = audioRef.current.currentTime + seconds;
    if (newTime < 0) newTime = 0;
    if (newTime > duration) newTime = duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Volume operations
  const handleVolumeChange = (newVal: number[]) => {
    setVolume(newVal);
    if (audioRef.current) {
      audioRef.current.volume = newVal[0] / 100;
      if (newVal[0] > 0) {
        setIsMuted(false);
      }
    }
  };

  const handleMuteToggle = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.volume = nextMuted ? 0 : volume[0] / 100;
  };

  // Progress slide scrubbing
  const handleProgressChange = (val: number[]) => {
    const targetTime = val[0];
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '0:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gradient-to-l from-indigo-950/40 to-muted/30 border border-indigo-500/20 rounded-xl p-4 space-y-3.5 transition-all duration-300 shadow-sm" id={`mini-player-${id || 'generic'}`}>
      <audio 
        ref={audioRef}
        src={audioUrl || undefined}
        onEnded={handleAudioEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        className="hidden"
      />

      {/* Top Meta info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 rounded-md border border-indigo-500/20 text-indigo-400">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-right">
            <span className="text-[10px] text-indigo-400/80 uppercase tracking-wider font-mono block">נגן תצוגה מקדימה</span>
            <span className="text-xs font-semibold text-foreground truncate max-w-[200px] block" dir="rtl">
              {title || 'קובץ שמע מסונתז'}
            </span>
          </div>
        </div>

        {onDownload && (
          <Button 
            id={`btn-mini-player-download-${id}`}
            size="sm" 
            variant="ghost" 
            onClick={onDownload}
            className="h-7 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/20 gap-1 px-2"
          >
            <Download className="w-3 h-3" />
            ייצא קובץ
          </Button>
        )}
      </div>

      {/* Progress Bar & Timing */}
      <div className="space-y-1" dir="ltr">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono text-muted-foreground w-8 select-none">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1">
            <Slider 
              value={[currentTime]} 
              max={duration || 100} 
              step={0.05} 
              onValueChange={handleProgressChange}
              className="py-1 cursor-pointer [&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&_[role=slider]]:border-indigo-500"
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground w-8 select-none text-right">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Controls: Speed, Play, Volume */}
      <div className="flex items-center justify-between pt-1">
        {/* Playback rate & skip controls */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => handleSkip(-5)}
            title="חזור 5 שניות"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            id={`btn-mini-player-play-${id}`}
            size="sm"
            variant="default"
            className="h-9 w-9 p-0 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 flex items-center justify-center transition-transform hover:scale-105"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white translate-x-[1px]" />
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => handleSkip(5)}
            title="דלג 5 שניות"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Volume controls */}
        <div className="flex items-center gap-2 max-w-[100px] md:max-w-[130px] w-full" dir="ltr">
          <button 
            onClick={handleMuteToggle}
            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
          >
            {isMuted || volume[0] === 0 ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
          <div className="flex-1">
            <Slider
              value={isMuted ? [0] : volume}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
              className="py-1 [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
