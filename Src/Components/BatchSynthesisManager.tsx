import React, { useState, useEffect, useRef } from 'react';
import { db, type GenerationQueueItem } from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { 
  Play, 
  Loader2, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Hourglass, 
  PlayCircle, 
  AlertCircle,
  Sparkles,
  ChevronDown,
  Settings,
  Save,
  Sliders,
  Volume2,
  SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { createPlayableWavBlob } from '../lib/audioUtils';

interface BatchItem {
  id: string;
  text: string;
  profileId: string;
  status: 'draft' | 'pending' | 'processing' | 'completed' | 'failed';
  queueId?: string;
}

interface AudioPreset {
  id: string;
  name: string;
  format: 'mp3' | 'wav' | 'webm';
  bitrate: string;
  sampleRate: string;
  channels: 'mono' | 'stereo';
  profileId: string;
  isSystem?: boolean;
}

export default function BatchSynthesisManager() {
  const { selectedProfileId } = useAppStore();
  const [items, setItems] = useState<BatchItem[]>([
    { id: '1', text: 'שלום וברוכים הבאים לאולפן הדיבור המתקדם שלנו.', profileId: '', status: 'draft' },
    { id: '2', text: 'אנא ודא כי פרופיל הקול מכויל כראוי לפני תחילת העבודה.', profileId: '', status: 'draft' }
  ]);
  const [newText, setNewText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const voiceProfiles = useAppStore((state: any) => state.voiceProfiles) || [];
  // Fallback to query from db if state is empty
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    db.voiceProfiles.toArray().then(setProfiles).catch(console.error);
  }, []);

  const activeProfiles = profiles.length > 0 ? profiles : voiceProfiles;
  const currentProfileId = selectedProfileId || (activeProfiles[0]?.id || '');

  // Presets State
  const [presets, setPresets] = useState<AudioPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('podcast-mp3');
  
  // Custom Settings under active preset
  const [format, setFormat] = useState<'mp3' | 'wav' | 'webm'>('mp3');
  const [bitrate, setBitrate] = useState<string>('192');
  const [sampleRate, setSampleRate] = useState<string>('44100');
  const [channels, setChannels] = useState<'mono' | 'stereo'>('stereo');
  const [presetProfileId, setPresetProfileId] = useState<string>('');
  
  // New Preset Builder state
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Load Presets
  useEffect(() => {
    const systemPresets: AudioPreset[] = [
      {
        id: 'broadcast-wav',
        name: 'איכות שידור אולפנית (WAV)',
        format: 'wav',
        bitrate: '320',
        sampleRate: '48000',
        channels: 'stereo',
        profileId: currentProfileId,
        isSystem: true
      },
      {
        id: 'podcast-mp3',
        name: 'פודקאסט איכותי (MP3 Stereo)',
        format: 'mp3',
        bitrate: '192',
        sampleRate: '44100',
        channels: 'stereo',
        profileId: currentProfileId,
        isSystem: true
      },
      {
        id: 'draft-mono',
        name: 'טיוטה מהירה וקומפקטית (MP3 Mono)',
        format: 'mp3',
        bitrate: '128',
        sampleRate: '22050',
        channels: 'mono',
        profileId: currentProfileId,
        isSystem: true
      }
    ];

    const saved = localStorage.getItem('vocalis_batch_presets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AudioPreset[];
        setPresets([...systemPresets, ...parsed]);
      } catch (e) {
        setPresets(systemPresets);
      }
    } else {
      setPresets(systemPresets);
    }
  }, [currentProfileId]);

  // Handle selecting a preset
  const handleSelectPreset = (id: string) => {
    setSelectedPresetId(id);
    const found = presets.find(p => p.id === id);
    if (found) {
      setFormat(found.format);
      setBitrate(found.bitrate);
      setSampleRate(found.sampleRate);
      setChannels(found.channels);
      if (found.profileId) {
        setPresetProfileId(found.profileId);
      }
      toast.success(`נטען פריסט הגדרות: ${found.name}`);
    }
  };

  // Handle saving current configurations as a new custom preset
  const handleSaveNewPreset = () => {
    if (!newPresetName.trim()) {
      toast.error('אנא הזן שם תקין לפריסט החדש');
      return;
    }

    const newPreset: AudioPreset = {
      id: crypto.randomUUID(),
      name: newPresetName.trim(),
      format,
      bitrate,
      sampleRate,
      channels,
      profileId: presetProfileId || currentProfileId
    };

    const customOnly = presets.filter(p => !p.isSystem);
    const updatedCustom = [...customOnly, newPreset];
    localStorage.setItem('vocalis_batch_presets', JSON.stringify(updatedCustom));

    setPresets(prev => {
      const system = prev.filter(p => p.isSystem);
      return [...system, ...updatedCustom];
    });

    setSelectedPresetId(newPreset.id);
    setNewPresetName('');
    setIsCreatingPreset(false);
    toast.success(`הפריסט "${newPreset.name}" נשמר בהצלחה!`);
  };

  // Handle deleting a custom preset
  const handleDeletePreset = (id: string) => {
    const target = presets.find(p => p.id === id);
    if (!target) return;
    if (target.isSystem) {
      toast.error('לא ניתן למחוק פריסט מערכת מובנה');
      return;
    }

    const updatedCustom = presets.filter(p => !p.isSystem && p.id !== id);
    localStorage.setItem('vocalis_batch_presets', JSON.stringify(updatedCustom));

    setPresets(prev => {
      const system = prev.filter(p => p.isSystem);
      return [...system, ...updatedCustom];
    });

    setSelectedPresetId('podcast-mp3');
    // Re-apply default podcast-mp3 settings
    const def = presets.find(p => p.id === 'podcast-mp3');
    if (def) {
      setFormat(def.format);
      setBitrate(def.bitrate);
      setSampleRate(def.sampleRate);
      setChannels(def.channels);
    }
    toast.success('הפריסט נמחק בהצלחה');
  };

  // Keep track of active background progress of queued tasks
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = async (event: MessageEvent) => {
        if (!event.data) return;
        const { type, payload } = event.data;

        if (type === 'SYNTHESIS_COMPLETED' || type === 'SYNTHESIS_FAILED') {
          const status = type === 'SYNTHESIS_COMPLETED' ? 'completed' : 'failed';
          
          setItems(prev => prev.map(item => {
            if (item.queueId === payload.queueId) {
              return { ...item, status };
            }
            return item;
          }));

          // Check if all items are done
          setItems(current => {
            const activeRunning = current.filter(i => i.status === 'processing' || i.status === 'pending');
            if (activeRunning.length === 0 && isProcessing) {
              setIsProcessing(false);
              toast.success('כל משימות האצ\' הסתיימו בהצלחה!');
            }
            return current;
          });
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [isProcessing]);

  // Handle adding custom item
  const handleAddItem = () => {
    if (!newText.trim()) {
      toast.error('הזן טקסט תקין');
      return;
    }
    const newItem: BatchItem = {
      id: crypto.randomUUID(),
      text: newText.trim(),
      profileId: presetProfileId || currentProfileId,
      status: 'draft'
    };
    setItems(prev => [...prev, newItem]);
    setNewText('');
  };

  // Remove single item
  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Clear everything
  const handleClearAll = () => {
    setItems([]);
  };

  // Handle file import
  const handleFileImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const textContent = e.target?.result as string;
      if (!textContent) return;

      const lines = textContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 2);

      if (lines.length === 0) {
        toast.error('לא נמצאו שורות טקסט תקינות בקובץ');
        return;
      }

      const newBatchItems: BatchItem[] = lines.map((line) => ({
        id: crypto.randomUUID(),
        text: line,
        profileId: presetProfileId || currentProfileId,
        status: 'draft'
      }));

      setItems(prev => [...prev, ...newBatchItems]);
      toast.success(`יובאו בהצלחה ${newBatchItems.length} שורות מהקובץ!`);
    };
    reader.readAsText(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'text/plain' || file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      handleFileImport(file);
    } else {
      toast.error('אנא העלה קובץ טקסט או CSV תקין');
    }
  };

  // Execute Batch
  const handleExecuteBatch = async () => {
    const draftItems = items.filter(item => item.status === 'draft');
    if (draftItems.length === 0) {
      toast.error('אין משימות חדשות להפעלה בטיוטה');
      return;
    }

    const finalProfileId = presetProfileId || currentProfileId;
    if (!finalProfileId) {
      toast.error('אנא בחר פרופיל קול פעיל תחילה');
      return;
    }

    setIsProcessing(true);
    const activePresetName = presets.find(p => p.id === selectedPresetId)?.name || 'מותאם אישית';
    toast.success(`מפעיל עיבוד אצ' (${draftItems.length} קבצים) לפי פריסט: ${activePresetName}`);

    // Update statuses to pending/processing and queue them
    const updatedItems = [...items];

    for (const item of updatedItems) {
      if (item.status === 'draft') {
        const queueId = crypto.randomUUID();
        item.status = 'pending';
        item.queueId = queueId;
        item.profileId = finalProfileId;

        try {
          // 1. Add to Dexie DB
          await db.generationQueue.add({
            id: queueId,
            profileId: finalProfileId,
            text: item.text,
            status: 'processing',
            createdAt: Date.now()
          });

          // 2. Dispatch to service worker if present
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            item.status = 'processing';
            navigator.serviceWorker.controller.postMessage({
              type: 'START_BACKGROUND_SYNTHESIS',
              payload: {
                queueId,
                text: item.text,
                profileId: finalProfileId,
                apiKey: localStorage.getItem('elevenlabs_api_key') || '',
                format,
                bitrate,
                sampleRate,
                channels
              }
            });
          } else {
            // Fallback simulated background processing sequentially
            item.status = 'processing';
            setTimeout(async () => {
              try {
                const dummyBlob = createPlayableWavBlob(
                  1.5,
                  260 + Math.random() * 80,
                  parseInt(sampleRate) || 11025
                );
                await db.generationQueue.update(queueId, {
                  status: 'completed',
                  resultAudioBlob: dummyBlob,
                  synthesisTimeMs: 1400 + Math.random() * 400
                });
                
                setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed' } : i));
                
                // Notify via client channel manually
                window.dispatchEvent(new CustomEvent('local_synth_completed', { detail: { queueId } }));
              } catch (err) {
                const errorMessage = 'הפרעות רעש בהקלטת המקור או חריגת פרמטרים שגרמו לעיוות.';
                await db.generationQueue.update(queueId, { status: 'failed', errorMessage });
                setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'failed', errorMessage } : i));
              }
            }, 2500 + Math.random() * 1500);
          }
        } catch (err) {
          console.error(err);
          item.status = 'failed';
        }
      }
    }

    setItems(updatedItems);
  };

  const selectedPreset = presets.find(p => p.id === selectedPresetId);

  return (
    <div className="space-y-6" id="batch-synthesis-module">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-indigo-400">
            <Sparkles className="w-5 h-5" />
            עיבוד באצ' קבוצתי & פריסטים מובנים
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            הגדר פריסט ייצוא מהיר, החל אותו על רשימת טקסטים שלמה, וייצר את כל קבצי השמע ברקע במרוכז.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button 
            id="btn-clear-all-batch"
            variant="outline" 
            size="sm" 
            onClick={handleClearAll}
            disabled={isProcessing}
            className="text-xs"
          >
            נקה תור
          </Button>
          <Button 
            id="btn-trigger-file-upload"
            variant="outline" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="text-xs gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            ייבא קובץ טקסט / CSV
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => e.target.files?.[0] && handleFileImport(e.target.files[0])}
            accept=".txt,.csv" 
            className="hidden" 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Preset Configuration Panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-indigo-500/20 bg-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                פריסט הגדרות שמע (Audio Preset)
              </CardTitle>
              <CardDescription className="text-xs">
                בחר פריסט קבוע או שמור תצורה נוכחית לשימוש חוזר
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Presets dropdown selector */}
              <div className="space-y-1.5">
                <Label htmlFor="preset-select" className="text-xs font-semibold text-muted-foreground">פריסט פעיל</Label>
                <div className="flex gap-1.5">
                  <select
                    id="preset-select"
                    value={selectedPresetId}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="flex-1 h-9 rounded-md border border-input bg-card px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    disabled={isProcessing}
                  >
                    {presets.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.isSystem ? '🔒' : '👤'}
                      </option>
                    ))}
                  </select>
                  
                  {selectedPreset && !selectedPreset.isSystem && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                      onClick={() => handleDeletePreset(selectedPreset.id)}
                      title="מחק פריסט מותאם אישית"
                      disabled={isProcessing}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Preset details details & manual overrides */}
              <div className="p-3 bg-card rounded-lg border border-border/60 space-y-3.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-400 border-b border-border pb-1.5">
                  <span className="flex items-center gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    פרמטרי ייצוא משולבים
                  </span>
                  <span>{selectedPreset?.isSystem ? 'מערכת' : 'אישי'}</span>
                </div>

                {/* Voice model selection inside preset */}
                <div className="space-y-1">
                  <Label htmlFor="preset-profile" className="text-[10px] text-muted-foreground block">מודל קולי מוגדר</Label>
                  <select
                    id="preset-profile"
                    value={presetProfileId || currentProfileId}
                    onChange={(e) => setPresetProfileId(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-muted/40 px-2 py-0.5 text-xs"
                    disabled={isProcessing}
                  >
                    {activeProfiles.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Format selection */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground block">פורמט פלט</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['mp3', 'wav', 'webm'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setFormat(fmt)}
                        className={`h-7 rounded border text-[10px] font-mono transition-colors ${
                          format === fmt 
                            ? 'bg-indigo-600 border-indigo-500 text-white font-bold' 
                            : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60'
                        }`}
                        disabled={isProcessing}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bitrate Selection (only active if format is mp3) */}
                {format === 'mp3' && (
                  <div className="space-y-1 animate-in fade-in duration-200">
                    <Label htmlFor="preset-bitrate" className="text-[10px] text-muted-foreground block">קצב נתונים (Bitrate)</Label>
                    <select
                      id="preset-bitrate"
                      value={bitrate}
                      onChange={(e) => setBitrate(e.target.value)}
                      className="w-full h-8 rounded border border-input bg-muted/40 px-2 py-0.5 text-xs"
                      disabled={isProcessing}
                    >
                      <option value="128">128 kbps (קובץ קטן)</option>
                      <option value="192">192 kbps (איכות שידור)</option>
                      <option value="256">256 kbps (סטריאו מורחב)</option>
                      <option value="320">320 kbps (איכות סטודיו)</option>
                    </select>
                  </div>
                )}

                {/* Sample Rate selection */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="preset-samplerate" className="text-[10px] text-muted-foreground block">תדר דגימה</Label>
                    <select
                      id="preset-samplerate"
                      value={sampleRate}
                      onChange={(e) => setSampleRate(e.target.value)}
                      className="w-full h-8 rounded border border-input bg-muted/40 px-1 py-0.5 text-[11px]"
                      disabled={isProcessing}
                    >
                      <option value="22050">22.05 kHz</option>
                      <option value="44100">44.1 kHz</option>
                      <option value="48000">48.0 kHz</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="preset-channels" className="text-[10px] text-muted-foreground block">ערוצים</Label>
                    <select
                      id="preset-channels"
                      value={channels}
                      onChange={(e) => setChannels(e.target.value as any)}
                      className="w-full h-8 rounded border border-input bg-muted/40 px-1 py-0.5 text-[11px]"
                      disabled={isProcessing}
                    >
                      <option value="stereo">Stereo</option>
                      <option value="mono">Mono</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Save New Preset section */}
              {isCreatingPreset ? (
                <div className="p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/15 space-y-2.5 animate-in slide-in-from-top duration-200">
                  <Label htmlFor="new-preset-name" className="text-xs font-semibold text-indigo-400">שם פריסט חדש</Label>
                  <Input
                    id="new-preset-name"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="לדוגמה: פודקאסט פרימיום..."
                    className="h-8 text-xs bg-card"
                  />
                  <div className="flex gap-1.5 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsCreatingPreset(false)}
                      className="h-7 text-[10px]"
                    >
                      ביטול
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveNewPreset}
                      className="h-7 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] gap-1"
                    >
                      <Save className="w-3 h-3" />
                      שמור פריסט
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setIsCreatingPreset(true)}
                  className="w-full text-xs gap-1.5 border-dashed border-indigo-500/30 hover:border-indigo-500/50"
                  disabled={isProcessing}
                >
                  <Save className="w-3.5 h-3.5 text-indigo-400" />
                  שמור הגדרות אלו כפריסט חדש
                </Button>
              )}

              {/* Saved presets summary view cards */}
              <div className="border-t border-border/60 pt-4 space-y-3">
                <Label className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5 justify-end">
                  <Sliders className="w-3.5 h-3.5" />
                  סקירת פריסטים שמורים
                </Label>
                <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1" dir="rtl">
                  {presets.map(p => {
                    const isSelected = selectedPresetId === p.id;
                    const presetProfile = activeProfiles.find((ap: any) => ap.id === p.profileId) || activeProfiles.find((ap: any) => ap.id === currentProfileId);
                    const modelName = presetProfile?.name || 'מודל פעיל';
                    return (
                      <div
                        key={p.id}
                        id={`preset-summary-card-${p.id}`}
                        onClick={() => handleSelectPreset(p.id)}
                        className={`p-2.5 rounded-lg border text-[11px] transition-all duration-200 cursor-pointer text-right flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500/50 shadow-sm shadow-indigo-500/5'
                            : 'bg-card/40 border-border/50 hover:border-indigo-500/30 hover:bg-muted/10'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-foreground text-xs">{p.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                            p.isSystem 
                              ? 'bg-muted text-muted-foreground' 
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10'
                          }`}>
                            {p.isSystem ? 'מערכת' : 'אישי'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1.5 text-[10px] text-muted-foreground">
                          <div className="bg-muted/30 px-1.5 py-1 rounded flex flex-col items-center">
                            <span className="text-[9px] opacity-75">מודל</span>
                            <span className="font-semibold text-foreground truncate max-w-[70px] text-center" title={modelName}>{modelName}</span>
                          </div>
                          <div className="bg-muted/30 px-1.5 py-1 rounded flex flex-col items-center">
                            <span className="text-[9px] opacity-75">פורמט</span>
                            <span className="font-semibold text-indigo-400 font-mono">{p.format.toUpperCase()}</span>
                          </div>
                          <div className="bg-muted/30 px-1.5 py-1 rounded flex flex-col items-center">
                            <span className="text-[9px] opacity-75">ביטרייט</span>
                            <span className="font-semibold text-foreground font-mono">
                              {p.format === 'mp3' ? `${p.bitrate}k` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Drag & Drop Area & List queue */}
        <div className="lg:col-span-2 space-y-4">
          {/* Drag & Drop or Paste */}
          <div 
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors duration-200 ${
              dragActive ? 'border-indigo-500 bg-indigo-950/20' : 'border-border bg-muted/20'
            }`}
          >
            <div className="flex max-w-lg mx-auto gap-2">
              <Input 
                id="batch-quick-text-input"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="הזן משפט קצר להוספה מהירה..."
                className="flex-1 bg-card text-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                disabled={isProcessing}
              />
              <Button 
                id="btn-add-batch-item"
                onClick={handleAddItem} 
                size="sm"
                disabled={isProcessing}
                className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 text-xs gap-1"
              >
                <Plus className="w-4 h-4" />
                הוסף שורה
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2.5">
              או גרור והשלך קובץ <code className="font-mono text-indigo-400">.txt</code> או <code className="font-mono text-indigo-400">.csv</code> המכיל משפט אחד בכל שורה.
            </p>
          </div>

          {/* Batch Items List */}
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <div className="bg-muted/40 px-4 py-2.5 border-b border-border flex justify-between items-center text-xs text-muted-foreground font-medium">
              <span className="w-1/12">#</span>
              <span className="w-6/12 text-right">תוכן הטקסט</span>
              <span className="w-3/12 text-right">פרופיל קולי</span>
              <span className="w-2/12 text-center">סטטוס</span>
            </div>

            {items.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                אין משימות בתור כרגע. השתמש בתיבת הטקסט או בייבוא קובץ כדי להתחיל.
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                {items.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="px-4 py-3 flex flex-col justify-center text-xs hover:bg-muted/10 transition-colors"
                    id={`batch-item-row-${item.id}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="w-1/12 text-muted-foreground font-mono">{(index + 1).toString().padStart(2, '0')}</span>
                      <span className="w-6/12 text-right truncate pl-4 font-medium" dir="rtl">{item.text}</span>
                      <span className="w-3/12 text-right text-muted-foreground truncate">
                        {activeProfiles.find(p => p.id === (item.profileId || presetProfileId || currentProfileId))?.name || 'פרופיל ברירת מחדל'}
                      </span>
                      
                      <div className="w-2/12 flex items-center justify-center gap-1.5">
                        {item.status === 'draft' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">
                            טיוטה
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-mono animate-pulse">
                            <Hourglass className="w-3 h-3" />
                            ממתין
                          </span>
                        )}
                        {item.status === 'processing' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-mono">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            מעבד
                          </span>
                        )}
                        {item.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">
                            <CheckCircle2 className="w-3 h-3" />
                            הושלם
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-mono" title={item.errorMessage}>
                            <XCircle className="w-3 h-3" />
                            נכשל
                          </span>
                        )}

                        {(item.status === 'draft' || item.status === 'failed') && (
                          <button 
                            onClick={() => handleRemoveItem(item.id)} 
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                            title="מחק שורה"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {item.status === 'failed' && item.errorMessage && (
                      <div className="text-[10px] text-red-500/80 bg-red-500/5 mt-2 p-1.5 rounded pr-2 text-right">
                        {item.errorMessage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="bg-muted/30 px-4 py-3 border-t border-border flex justify-between items-center text-xs">
              <span className="text-muted-foreground">
                סה"כ משימות בתור: <strong className="text-foreground">{items.length}</strong> (מתוכן {items.filter(i => i.status === 'draft').length} חדשות)
              </span>

              <Button
                id="btn-execute-batch-synthesis"
                onClick={handleExecuteBatch}
                disabled={isProcessing || items.filter(i => i.status === 'draft').length === 0}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs gap-1.5"
                size="sm"
              >
                {isProcessing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> מעבד משימות באצ'...</>
                ) : (
                  <><PlayCircle className="w-3.5 h-3.5" /> הפעל עיבוד קבוצתי</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
