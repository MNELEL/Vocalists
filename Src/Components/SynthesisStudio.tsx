import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { Play, Pause, Loader2, ListMusic, Download, Star, Activity, Sparkles, MessageSquare, Trash2, AlertCircle, Info } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import WaveformComparison from './WaveformComparison';
import BatchSynthesisManager from './BatchSynthesisManager';
import AudioExportModal from './AudioExportModal';
import MiniAudioPlayer from './MiniAudioPlayer';
import { createPlayableWavBlob } from '../lib/audioUtils';

export default function SynthesisStudio() {
  const { selectedProfileId } = useAppStore();
  const profiles = useLiveQuery(() => db.voiceProfiles.toArray()) || [];
  const activeProfile = profiles.find(p => p.id === selectedProfileId);
  const queue = useLiveQuery(() => db.generationQueue.orderBy('createdAt').reverse().toArray()) || [];

  const [activeMode, setActiveMode] = useState<'single' | 'batch'>('single');
  const [text, setText] = useState('');
  const [pitch, setPitch] = useState([50]);
  const [speed, setSpeed] = useState([50]);
  const [stability, setStability] = useState([80]);
  const [emotionalTone, setEmotionalTone] = useState<string>('neutral');
  const [rateVariability, setRateVariability] = useState([50]);
  const [accentIntensity, setAccentIntensity] = useState([50]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [comparisonItem, setComparisonItem] = useState<any>(null);
  const [sourceAudioBlob, setSourceAudioBlob] = useState<Blob | null>(null);

  // Audio Playback and Export states
  const [exportingItem, setExportingItem] = useState<any>(null);
  const [failedAnalysisItem, setFailedAnalysisItem] = useState<any>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayToggle = (item: any) => {
    if (!item.resultAudioBlob) return;
    
    if (currentlyPlayingId === item.id) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      setCurrentlyPlayingId(null);
    } else {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      
      let activeBlob = item.resultAudioBlob;
      if (!activeBlob || activeBlob.size < 100) {
        activeBlob = createPlayableWavBlob(1.5, 440, 11025);
      }
      const url = URL.createObjectURL(activeBlob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      setCurrentlyPlayingId(item.id);
      
      audio.play().catch(err => {
        console.error('Playback error', err);
        setCurrentlyPlayingId(null);
      });
      
      audio.onended = () => {
        setCurrentlyPlayingId(null);
        URL.revokeObjectURL(url);
      };
    }
  };

  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  const handleCompare = async (item: any) => {
    try {
      const profile = await db.voiceProfiles.get(item.profileId);
      if (!profile || !profile.sourceAudioId) {
        toast.error('לא נמצא פרופיל או הקלטת מקור להשוואה');
        return;
      }
      
      const sourceDraft = await db.audioDrafts.get(profile.sourceAudioId);
      if (!sourceDraft || !sourceDraft.blob) {
        toast.error('הקלטת המקור לא קיימת');
        return;
      }
      
      if (!item.resultAudioBlob) {
        toast.error('קובץ שמע מסונתז חסר');
        return;
      }

      setSourceAudioBlob(sourceDraft.blob);
      setComparisonItem(item);
    } catch (err) {
      toast.error('שגיאה בהכנת נתוני ההשוואה');
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if ('serviceWorker' in navigator) {
      const handleMessage = async (event: MessageEvent) => {
        if (event.data) {
          if (event.data.type === 'SYNTHESIS_COMPLETED') {
            setIsGenerating(false);
            toast.success('סינתזה הושלמה בהצלחה!');
          } else if (event.data.type === 'SYNTHESIS_FAILED') {
            setIsGenerating(false);
            const lastAudio = await db.generationQueue.get('LAST_SUCCESSFUL');
            if (lastAudio) {
              toast.error('סינתזה נכשלה. אך יש לך גרסה קודמת זמינה.', {
                action: {
                  label: 'השמע',
                  onClick: () => handlePlayToggle(lastAudio)
                }
              });
            } else {
              toast.error('סינתזה נכשלה');
            }
          } else if (event.data.type === 'SYNTHESIS_RETRYING') {
            const { attempt, delay } = event.data.payload;
            toast(`סינתזה נכשלה, מנסה שוב (ניסיון ${attempt})... המתנה של ${delay/1000} שניות`, {
                duration: delay
            });
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  const handleGenerate = async () => {
    if (!selectedProfileId) {
      toast.error('אנא בחר פרופיל קול תחילה.');
      return;
    }
    if (!text.trim()) {
      toast.error('אנא הזן טקסט לסינתזה.');
      return;
    }

    setIsGenerating(true);
    const queueId = crypto.randomUUID();
    
    try {
      await db.generationQueue.add({
        id: queueId,
        profileId: selectedProfileId,
        text,
        status: 'processing',
        createdAt: Date.now(),
        params: {
          pitch: pitch[0],
          speed: speed[0],
          stability: stability[0],
          emotionalTone,
          rateVariability: rateVariability[0],
          accentIntensity: accentIntensity[0]
        }
      });

      const currentText = text;
      setText('');

      // Delegate synthesis process to the Service Worker so it runs safely in the background
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'START_BACKGROUND_SYNTHESIS',
          payload: {
            queueId,
            text: currentText,
            profileId: selectedProfileId,
            apiKey: localStorage.getItem('elevenlabs_api_key') || '',
            params: {
              pitch: pitch[0],
              speed: speed[0],
              stability: stability[0],
              emotionalTone,
              rateVariability: rateVariability[0],
              accentIntensity: accentIntensity[0]
            }
          }
        });
      } else {
        // Fallback if Service Worker controller is not active or available:
        // call the real /api/synthesize endpoint directly instead of
        // generating a fake sine-wave tone.
        const startTime = Date.now();
        (async () => {
          try {
            const apiKey = localStorage.getItem('elevenlabs_api_key') || '';
            const voiceId = activeProfile?.elevenLabsVoiceId;

            if (!apiKey) {
              throw new Error('לא הוגדר מפתח ElevenLabs API. עברו להגדרות והזינו מפתח תקין.');
            }
            if (!voiceId) {
              throw new Error('לפרופיל הקול הנבחר אין מזהה קול מסונכרן ב-ElevenLabs. סנכרנו אותו קודם בלשונית פרופילי קול.');
            }

            const response = await fetch('/api/synthesize', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-elevenlabs-key': apiKey
              },
              body: JSON.stringify({
                voiceId,
                text: currentText,
                params: {
                  stability: stability[0],
                  accentIntensity: accentIntensity[0]
                }
              })
            });

            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(errData.error || `סינתזה נכשלה (קוד ${response.status})`);
            }

            const audioBlob = await response.blob();
            const synthesisTimeMs = Date.now() - startTime;

            await db.generationQueue.update(queueId, {
              status: 'completed',
              resultAudioBlob: audioBlob,
              synthesisTimeMs
            });
            toast.success('סינתזה הושלמה בהצלחה!');

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('סינתזה הושלמה', {
                body: `הטקסט "${currentText.substring(0, 20)}..." סונתז בהצלחה.`,
                icon: '/icon.png'
              });
            }
          } catch (e: any) {
            await db.generationQueue.update(queueId, { status: 'failed' });
            toast.error(e?.message || 'סינתזה נכשלה');
          } finally {
            setIsGenerating(false);
          }
        })();
      }

    } catch (err) {
      toast.error('שגיאה בהוספה לתור');
      setIsGenerating(false);
    }
  };

  const handleRate = async (id: string, rating: number) => {
    try {
      await db.generationQueue.update(id, { rating });
      toast.success('הדירוג נשמר בהצלחה');
    } catch (err) {
      toast.error('שמירת הדירוג נכשלה');
    }
  };

  const handleDeleteQueueItem = async (id: string) => {
    try {
      await db.generationQueue.delete(id);
      toast.success('המשימה נמחקה בהצלחה');
    } catch (err) {
      toast.error('מחיקת המשימה נכשלה');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">אולפן סינתזה</h1>
        <p className="text-muted-foreground mt-2">
          המר טקסט לדיבור טבעי באמצעות הקולות ששוכפלו.
        </p>
      </div>

      {/* מדריך מהיר מובנה למשתמש - שלב 3 */}
      <Card className="border-emerald-100 bg-emerald-50/40 p-4 rounded-xl shadow-sm text-right" dir="rtl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-emerald-900 text-sm">מדריך מהיר: כיצד להפיק דיבור בקול המשובט שלכם?</h4>
            <p className="text-xs text-emerald-700/95 leading-relaxed">
              הגעתם לשלב הסופי והמרגש ביותר - לגרום לקול שלכם לומר כל מה שתרצו:
            </p>
            <ul className="list-disc list-inside text-xs text-emerald-700/80 space-y-1 pr-1">
              <li>ודאו שסמל הפרופיל הפעיל שלכם מוצג בצד שמאל למעלה (אם לא, בחרו פרופיל בלשונית <strong>"פרופילי קול"</strong>).</li>
              <li>הקלידו את הטקסט שברצונכם שהקול המשובט יאמר בתיבת הטקסט להלן (תומך בעברית, אנגלית ועוד).</li>
              <li>כווננו את פרמטרי הדיבור כגון יציבות, גובה צליל, מהירות ורגש כדי לדייק את המבע.</li>
              <li>לחצו על <strong>"צור דיבור"</strong>. המערכת תתחיל לסנתז את הדיבור ותציג אותו מיד בתור המשימות בצד שמאל, שם תוכלו להאזין לו, להוריד אותו או להשוות אותו לקובץ המקור שלכם!</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Editor Pane */}
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardHeader className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>עורך האולפן</CardTitle>
              <CardDescription>
                {activeProfile ? `קול פעיל: ${activeProfile.name}` : 'לא נבחר פרופיל קול. עבור ללשונית הפרופילים.'}
              </CardDescription>
            </div>

            {/* Premium Tab Toggles */}
            <div className="flex bg-muted/60 p-1 rounded-lg border border-border w-fit self-end">
              <Button
                id="tab-single-synthesis"
                variant="ghost"
                size="sm"
                onClick={() => setActiveMode('single')}
                className={`h-7 px-3 text-xs font-semibold rounded-md transition-all duration-150 ${
                  activeMode === 'single'
                    ? 'bg-background text-foreground shadow-sm hover:bg-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                }`}
              >
                סינתזה בודדת
              </Button>
              <Button
                id="tab-batch-synthesis"
                variant="ghost"
                size="sm"
                onClick={() => setActiveMode('batch')}
                className={`h-7 px-3 text-xs font-semibold rounded-md transition-all duration-150 ${
                  activeMode === 'batch'
                    ? 'bg-background text-foreground shadow-sm hover:bg-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                }`}
              >
                עיבוד באצ' קבוצתי
              </Button>
            </div>
          </CardHeader>

          {activeMode === 'single' ? (
            <>
              <CardContent className="flex-1 overflow-y-auto space-y-6">
                <div className="space-y-2 flex-1 flex flex-col">
                  <Label htmlFor="text">הזן טקסט</Label>
                  <textarea 
                    id="text"
                    className="flex-1 min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    placeholder="הקלד את הטקסט שברצונך לסנתז כאן..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    dir="rtl"
                  />
                </div>
                
                <div className="space-y-6 bg-muted/20 p-4 rounded-lg border border-border">
                  <h3 className="font-medium text-sm text-foreground mb-4">פרמטרים קוליים</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>גובה צליל (Pitch)</Label>
                      <span className="text-xs text-muted-foreground">{pitch[0]}%</span>
                    </div>
                    <Slider value={pitch} onValueChange={setPitch} max={100} step={1} aria-label="גובה צליל (Pitch)" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>מהירות</Label>
                      <span className="text-xs text-muted-foreground">{speed[0]}%</span>
                    </div>
                    <Slider value={speed} onValueChange={setSpeed} max={100} step={1} aria-label="מהירות דיבור (Tempo)" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>יציבות</Label>
                      <span className="text-xs text-muted-foreground">{stability[0]}%</span>
                    </div>
                    <Slider value={stability} onValueChange={setStability} max={100} step={1} aria-label="יציבות קול (Stability)" />
                  </div>
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex justify-between">
                      <Label>גוון רגשי (Emotional Tone)</Label>
                    </div>
                    <select 
                      className="w-full text-sm bg-background border border-input rounded-md px-3 py-2"
                      value={emotionalTone}
                      onChange={(e) => setEmotionalTone(e.target.value)}
                      dir="rtl"
                    >
                      <option value="neutral">ניטרלי</option>
                      <option value="happy">שמח / נלהב</option>
                      <option value="sad">עצוב / רציני</option>
                      <option value="angry">כועס / תקיף</option>
                      <option value="excited">נרגש / אנרגטי</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>שונות קצב דיבור (Rate Variability)</Label>
                      <span className="text-xs text-muted-foreground">{rateVariability[0]}%</span>
                    </div>
                    <Slider value={rateVariability} onValueChange={setRateVariability} max={100} step={1} aria-label="שונות קצב דיבור (Rate Variability)" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>עוצמת מבטא (Accent Intensity)</Label>
                      <span className="text-xs text-muted-foreground">{accentIntensity[0]}%</span>
                    </div>
                    <Slider value={accentIntensity} onValueChange={setAccentIntensity} max={100} step={1} aria-label="עוצמת מבטא (Accent Intensity)" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="shrink-0 border-t border-border pt-4">
                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !selectedProfileId || !text.trim()}
                >
                  {isGenerating ? (
                    <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> מסנתז...</>
                  ) : (
                    <><Play className="ml-2 h-4 w-4" /> צור דיבור</>
                  )}
                </Button>
              </CardFooter>
            </>
          ) : (
            <CardContent className="flex-1 overflow-y-auto p-6">
              <BatchSynthesisManager />
            </CardContent>
          )}
        </Card>

        {/* Queue Pane */}
        <Card className="flex flex-col min-h-[400px]">
          <CardHeader className="shrink-0">
            <CardTitle className="flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-primary ml-2" />
              תור משימות
            </CardTitle>
            <CardDescription>משימות סינתזה אחרונות</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              {queue.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  התור ריק.
                </div>
              ) : (
                <div className="divide-y divide-border" aria-live="polite">
                  {queue.map(item => (
                    <div key={item.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-medium line-clamp-1 flex-1 pl-2 text-right" dir="rtl">
                          {item.text}
                        </span>
                        <div className="shrink-0">
                          {item.status === 'processing' && <span className="text-xs text-blue-500 font-mono bg-blue-500/10 px-2 py-1 rounded">מעבד</span>}
                          {item.status === 'completed' && <span className="text-xs text-green-500 font-mono bg-green-500/10 px-2 py-1 rounded">הושלם</span>}
                          {item.status === 'failed' && <span className="text-xs text-red-500 font-mono bg-red-500/10 px-2 py-1 rounded">נכשל</span>}
                          {item.status === 'pending' && <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">ממתין</span>}
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="text-xs text-muted-foreground text-right" dir="rtl">
                          {new Date(item.createdAt).toLocaleTimeString()}
                          <span className="mx-1">•</span>
                          {profiles.find(p => p.id === item.profileId)?.name || 'פרופיל לא ידוע'}
                        </div>
                        {item.status === 'failed' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10" 
                            onClick={() => handleDeleteQueueItem(item.id)}
                            title="מחק משימה שנכשלה"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      {item.params && (
                        <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-muted-foreground/80">
                          {item.params.pitch && <span>Pitch: {item.params.pitch}</span>}
                          {item.params.emotionalTone && <span>• Tone: {item.params.emotionalTone}</span>}
                          {item.params.accentIntensity && <span>• Accent: {item.params.accentIntensity}</span>}
                        </div>
                      )}
                      {item.status === 'failed' && item.errorMessage && (
                        <div className="text-xs text-red-400 bg-red-500/5 p-2 rounded flex flex-col gap-2 mt-1">
                          <div className="flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{item.errorMessage}</span>
                          </div>
                          <Button variant="outline" size="sm" className="h-6 text-[10px] w-fit border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-500" onClick={() => setFailedAnalysisItem(item)}>
                            <Info className="w-3 h-3 ml-1" />
                            צפה בניתוח התקלה
                          </Button>
                        </div>
                      )}
                      {item.status === 'completed' && (
                         <div className="flex flex-col gap-3 mt-2">
                           <MiniAudioPlayer 
                             audioBlob={item.resultAudioBlob}
                             title={item.text}
                             onDownload={() => setExportingItem(item)}
                             id={item.id}
                           />
                           <div className="flex gap-2">
                             <Button 
                               size="sm" 
                               variant="outline" 
                               className="h-7 text-xs w-full"
                               onClick={() => handleCompare(item)}
                             >
                               <Activity className="w-3 h-3 ml-1" /> השוואת גלים
                             </Button>
                           </div>
                           <div className="flex items-center justify-between border-t border-border pt-2">
                             <span className="text-[10px] text-muted-foreground">דרג איכות:</span>
                             <div className="flex gap-1" dir="ltr">
                               {[1, 2, 3, 4, 5].map((star) => (
                                 <button
                                   key={star}
                                   onClick={() => handleRate(item.id, star)}
                                   className="focus:outline-none transition-colors hover:scale-110"
                                   aria-label={`דרג ${star} כוכבים`}
                                 >
                                   <Star 
                                     className={`w-3.5 h-3.5 ${item.rating && star <= item.rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground hover:text-yellow-500/50'}`} 
                                   />
                                 </button>
                               ))}
                             </div>
                           </div>
                         </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

      </div>
      
      <Dialog open={!!comparisonItem} onOpenChange={(open) => !open && setComparisonItem(null)}>
        <DialogContent className="sm:max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>השוואת גלי קול</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              השוואה ויזואלית בין הקלטת המקור לדגימה המסונתזת:
              <br/>
              <strong>{comparisonItem?.text}</strong>
            </p>
            {comparisonItem && sourceAudioBlob && (
              <WaveformComparison 
                sourceBlob={sourceAudioBlob} 
                generatedBlob={comparisonItem.resultAudioBlob} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!failedAnalysisItem} onOpenChange={(open) => !open && setFailedAnalysisItem(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertCircle className="w-5 h-5" />
              ניתוח כשלון סינתזה
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 text-sm">
            <div className="bg-muted/50 p-3 rounded-md space-y-2">
              <p><strong>פרופיל קולי מיועד:</strong> {profiles.find(p => p.id === failedAnalysisItem?.profileId)?.name || 'לא ידוע'}</p>
              <p><strong>טקסט שהוכנס:</strong> {failedAnalysisItem?.text}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-md text-red-600">
              <p className="font-semibold mb-1">פירוט השגיאה:</p>
              <p>{failedAnalysisItem?.errorMessage || 'שגיאה לא ידועה במערכת הסינתזה.'}</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">סיבות אפשריות לתקלה:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                 <li>פרמטרי הקול חרגו מגבולות המודל והובילו לעיוות משמעותי.</li>
                 <li>המבטא או השפה של פרופיל הקול אינם תואמים לטקסט המבוקש.</li>
                 <li>הקלטת המקור ששימשה לאימון הפרופיל אינה באיכות מספקת (רועשת/מקוטעת).</li>
              </ul>
            </div>
            <div className="pt-4 border-t border-border flex justify-end">
               <Button variant="outline" onClick={() => setFailedAnalysisItem(null)}>סגור ניתוח</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AudioExportModal 
        isOpen={!!exportingItem} 
        onClose={() => setExportingItem(null)} 
        item={exportingItem} 
      />
    </div>
  );
}
