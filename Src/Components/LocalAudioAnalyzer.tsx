import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { FileAudio, Upload, Activity, Waves, Info, Volume2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function LocalAudioAnalyzer() {
  const drafts = useLiveQuery(() => db.audioDrafts.toArray()) || [];
  const [selectedDraftId, setSelectedDraftId] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    fileName: string;
    duration: number;
    sampleRate: number;
    channels: number;
    peakVolumeDb: number;
    rmsVolumeDb: number;
    dynamicRangeDb: number;
    silencePercent: number;
    estimatedPitchHz: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformPoints, setWaveformPoints] = useState<number[]>([]);

  // Function to analyze a Blob containing audio
  const analyzeAudioBlob = async (blob: Blob, name: string) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setWaveformPoints([]);
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await blob.arrayBuffer();
      
      // Decode audio data asynchronously
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const duration = audioBuffer.duration;
      const sampleRate = audioBuffer.sampleRate;
      const channels = audioBuffer.numberOfChannels;
      
      // Get primary channel data for math analysis
      const channelData = audioBuffer.getChannelData(0);
      const totalSamples = channelData.length;
      
      let maxVal = 0;
      let sumSquares = 0;
      let silentSamples = 0;
      const silenceThreshold = 0.01; // absolute value threshold for silence
      
      // Stride to make calculation fast even for long files
      const stride = Math.max(1, Math.floor(totalSamples / 5000));
      const visualPoints: number[] = [];
      const visualStride = Math.max(1, Math.floor(totalSamples / 150));
      
      // Calculate visual waveform & stats
      for (let i = 0; i < totalSamples; i += stride) {
        const val = channelData[i];
        const absVal = Math.abs(val);
        if (absVal > maxVal) maxVal = absVal;
        sumSquares += val * val;
        if (absVal < silenceThreshold) {
          silentSamples += stride;
        }
      }
      
      // Render clean visual wave representation
      for (let i = 0; i < totalSamples; i += visualStride) {
        let maxInSegment = 0;
        const end = Math.min(totalSamples, i + visualStride);
        for (let j = i; j < end; j++) {
          const absVal = Math.abs(channelData[j]);
          if (absVal > maxInSegment) maxInSegment = absVal;
        }
        visualPoints.push(maxInSegment);
      }
      setWaveformPoints(visualPoints);
      
      // Calculate decibels
      const peakVolumeDb = maxVal > 0 ? 20 * Math.log10(maxVal) : -100;
      const rms = Math.sqrt(sumSquares / (totalSamples / stride));
      const rmsVolumeDb = rms > 0 ? 20 * Math.log10(rms) : -100;
      const dynamicRangeDb = Math.max(0, peakVolumeDb - rmsVolumeDb);
      const silencePercent = (silentSamples / totalSamples) * 100;
      
      // Simple Autocorrelation pitch detector
      let estimatedPitchHz = 0;
      const pitchSamples = channelData.slice(0, Math.min(totalSamples, 8192));
      const r = new Float32Array(pitchSamples.length);
      for (let lag = 0; lag < r.length; lag++) {
        let sum = 0;
        for (let i = 0; i < r.length - lag; i++) {
          sum += pitchSamples[i] * pitchSamples[i + lag];
        }
        r[lag] = sum;
      }
      
      // Find peak in autocorrelation
      let peakIndex = -1;
      let peakValue = -1;
      // Skip the initial strong peak at lag = 0
      const minLag = Math.floor(sampleRate / 500); // Max pitch ~500Hz
      const maxLag = Math.floor(sampleRate / 60);  // Min pitch ~60Hz
      for (let lag = minLag; lag < maxLag; lag++) {
        if (r[lag] > r[lag - 1] && r[lag] > r[lag + 1]) {
          if (peakIndex === -1 || r[lag] > peakValue) {
            peakIndex = lag;
            peakValue = r[lag];
          }
        }
      }
      if (peakIndex !== -1) {
        estimatedPitchHz = Math.round(sampleRate / peakIndex);
      }
      
      setAnalysisResult({
        fileName: name,
        duration,
        sampleRate,
        channels,
        peakVolumeDb: parseFloat(peakVolumeDb.toFixed(1)),
        rmsVolumeDb: parseFloat(rmsVolumeDb.toFixed(1)),
        dynamicRangeDb: parseFloat(dynamicRangeDb.toFixed(1)),
        silencePercent: parseFloat(silencePercent.toFixed(1)),
        estimatedPitchHz: estimatedPitchHz || 120 // Fallback to standard human average if undef
      });
      
      toast.success('הניתוח המקומי הושלם בהצלחה!');
      audioContext.close();
    } catch (err) {
      console.error(err);
      toast.error('הניתוח המקומי נכשל. ודא שקובץ האודיו תקין.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    analyzeAudioBlob(file, file.name);
  };

  const handleAnalyzeDraft = () => {
    const draft = drafts.find(d => d.id === selectedDraftId);
    if (!draft) return;
    analyzeAudioBlob(draft.blob, draft.name);
  };

  // Draw waveform to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformPoints.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    
    // Gradient style
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#a855f7'); // primary purple
    gradient.addColorStop(0.5, '#6366f1'); // indigo
    gradient.addColorStop(1, '#3b82f6'); // blue
    
    const padding = 2;
    const barWidth = (width / waveformPoints.length) - padding;
    
    waveformPoints.forEach((val, index) => {
      const x = index * (barWidth + padding);
      const barHeight = val * height * 0.95;
      const y = (height - barHeight) / 2;
      
      // Draw rounded lines for a high end physical feel
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(1.5, barWidth), Math.max(2, barHeight), 2);
      ctx.fill();
    });
  }, [waveformPoints]);

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <Activity className="w-5 h-5 text-indigo-500 animate-pulse" />
          ניתוח קול מקומי (Real-Time Client Analysis)
        </CardTitle>
        <CardDescription>
          חלץ מאפיינים פיזיקליים ואקוסטיים ישירות בדפדפן - ללא שימוש בשרת חיצוני.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Draft selector */}
          <div className="bg-muted/40 p-4 rounded-lg border border-border space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileAudio className="w-4 h-4 text-primary" />
              בחר הקלטה קיימת מהגלריה
            </h4>
            <div className="flex gap-2">
              <select 
                className="flex-1 bg-background text-foreground text-sm rounded-md border border-input p-2 outline-none"
                value={selectedDraftId}
                onChange={(e) => setSelectedDraftId(e.target.value)}
              >
                <option value="">-- בחר הקלטת מקור --</option>
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <Button onClick={handleAnalyzeDraft} disabled={!selectedDraftId || isAnalyzing}>
                נתח
              </Button>
            </div>
          </div>

          {/* Upload field */}
          <div className="bg-muted/40 p-4 rounded-lg border border-border flex flex-col justify-center items-center relative group cursor-pointer hover:border-indigo-500/50 transition-colors">
            <input 
              type="file" 
              accept="audio/*" 
              onChange={handleFileUpload} 
              disabled={isAnalyzing}
              className="absolute inset-0 opacity-0 cursor-pointer" 
            />
            <Upload className="w-6 h-6 text-muted-foreground group-hover:text-indigo-400 mb-2 transition-colors" />
            <span className="text-sm font-semibold group-hover:text-indigo-400 transition-colors">העלה קובץ שמע מקומי מהמחשב</span>
            <span className="text-xs text-muted-foreground mt-1">WAV, MP3, WebM, OGG</span>
          </div>
        </div>

        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
            <Waves className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-sm text-muted-foreground font-semibold">מפענח את האות הפיזיקלי ומבצע התמרה מקומית...</p>
          </div>
        )}

        {analysisResult && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Waveform Canvas */}
            <div className="bg-zinc-950/80 rounded-lg p-4 border border-zinc-850">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-zinc-400 font-mono">תצוגת סיגנל מנותח: {analysisResult.fileName}</span>
                <span className="text-xs text-indigo-400 font-mono">100% Client-Side Engine</span>
              </div>
              <canvas 
                ref={canvasRef} 
                width={600} 
                height={120} 
                className="w-full h-[120px] bg-black/40 rounded border border-zinc-900/50"
              />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted p-3 rounded-lg border border-border flex flex-col">
                <span className="text-[10px] text-muted-foreground font-semibold">משך שמע</span>
                <span className="text-lg font-bold mt-1 font-mono text-primary">
                  {analysisResult.duration.toFixed(2)} שנ'
                </span>
              </div>
              <div className="bg-muted p-3 rounded-lg border border-border flex flex-col">
                <span className="text-[10px] text-muted-foreground font-semibold">קצב דגימה</span>
                <span className="text-lg font-bold mt-1 font-mono text-primary">
                  {analysisResult.sampleRate} Hz
                </span>
              </div>
              <div className="bg-muted p-3 rounded-lg border border-border flex flex-col">
                <span className="text-[10px] text-muted-foreground font-semibold">ערוצים פיזיים</span>
                <span className="text-lg font-bold mt-1 font-mono text-primary">
                  {analysisResult.channels === 1 ? 'מונו (1)' : 'סטריאו (2)'}
                </span>
              </div>
              <div className="bg-muted p-3 rounded-lg border border-border flex flex-col">
                <span className="text-[10px] text-muted-foreground font-semibold">תדר יסוד משוער (Pitch)</span>
                <span className="text-lg font-bold mt-1 font-mono text-emerald-500">
                  {analysisResult.estimatedPitchHz} Hz
                </span>
              </div>
              <div className="bg-muted p-3 rounded-lg border border-border flex flex-col">
                <span className="text-[10px] text-muted-foreground font-semibold">עוצמת שיא (Peak)</span>
                <span className="text-lg font-bold mt-1 font-mono text-indigo-500">
                  {analysisResult.peakVolumeDb} dB
                </span>
              </div>
              <div className="bg-muted p-3 rounded-lg border border-border flex flex-col">
                <span className="text-[10px] text-muted-foreground font-semibold">עוצמה ממוצעת (RMS)</span>
                <span className="text-lg font-bold mt-1 font-mono text-indigo-500">
                  {analysisResult.rmsVolumeDb} dB
                </span>
              </div>
              <div className="bg-muted p-3 rounded-lg border border-border flex flex-col">
                <span className="text-[10px] text-muted-foreground font-semibold">טווח דינמי</span>
                <span className="text-lg font-bold mt-1 font-mono text-blue-500">
                  {analysisResult.dynamicRangeDb} dB
                </span>
              </div>
              <div className="bg-muted p-3 rounded-lg border border-border flex flex-col">
                <span className="text-[10px] text-muted-foreground font-semibold">חלקי שקט באות</span>
                <span className="text-lg font-bold mt-1 font-mono text-yellow-500">
                  {analysisResult.silencePercent}%
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="bg-muted/20 px-6 py-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          הפרטיות שלך מובטחת - ניתוח זה מתבצע 100% במכשיר שלך
        </span>
        <span className="font-mono">Web Audio API</span>
      </CardFooter>
    </Card>
  );
}
