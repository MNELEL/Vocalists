import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import WaveformComparison from './WaveformComparison';
import { Search, Tag, Trash2, Play, Pause, Plus, X, Activity, CheckSquare, Square, Download } from 'lucide-react';
import { createPlayableWavBlob } from '../lib/audioUtils';

export default function DraftGallery() {
  const allDrafts = useLiveQuery(() => db.audioDrafts.toArray()) || [];
  const [searchQuery, setSearchQuery] = useState('');
  
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const [playingDraftId, setPlayingDraftId] = useState<string | null>(null);
  const [isDraftPaused, setIsDraftPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);
  
  const handleAddTag = async (draftId: string) => {
    const newTag = tagInput[draftId]?.trim();
    if (!newTag) return;
    
    try {
      const draft = await db.audioDrafts.get(draftId);
      if (draft) {
        const currentTags = draft.tags || [];
        if (!currentTags.includes(newTag)) {
          await db.audioDrafts.update(draftId, { tags: [...currentTags, newTag] });
          toast.success('תגית נוספה בהצלחה');
        }
      }
      setTagInput(prev => ({ ...prev, [draftId]: '' }));
    } catch (err) {
      toast.error('הוספת התגית נכשלה');
    }
  };

  const handleRemoveTag = async (draftId: string, tagToRemove: string) => {
    try {
      const draft = await db.audioDrafts.get(draftId);
      if (draft && draft.tags) {
        await db.audioDrafts.update(draftId, { 
          tags: draft.tags.filter(t => t !== tagToRemove) 
        });
      }
    } catch (err) {
      toast.error('הסרת התגית נכשלה');
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      await db.audioDrafts.delete(draftId);
      toast.success('הקלטה נמחקה');
    } catch (err) {
      toast.error('מחיקת ההקלטה נכשלה');
    }
  };

  const playDraft = (draftId: string, blob: Blob) => {
    if (playingDraftId === draftId) {
      if (audioRef.current) {
        if (isDraftPaused) {
          audioRef.current.play().then(() => {
            setIsDraftPaused(false);
          });
        } else {
          audioRef.current.pause();
          setIsDraftPaused(true);
        }
      }
    } else {
      stopDraft();
      
      let activeBlob = blob;
      if (!activeBlob || activeBlob.size < 100) {
        activeBlob = createPlayableWavBlob(1.5, 440, 11025);
      }
      const audioUrl = URL.createObjectURL(activeBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setPlayingDraftId(draftId);
      setIsDraftPaused(false);
      
      audio.play().catch(err => {
        console.error('Playback failed', err);
        toast.error('שגיאה בניגון השמע');
        setPlayingDraftId(null);
      });
      
      audio.onended = () => {
        setPlayingDraftId(null);
        setIsDraftPaused(false);
        URL.revokeObjectURL(audioUrl);
      };
    }
  };

  const stopDraft = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingDraftId(null);
    setIsDraftPaused(false);
  };

  const handleDownloadDraft = (draft: any) => {
    const url = URL.createObjectURL(draft.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.name}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleToggleCompare = (draftId: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(draftId)) {
        return prev.filter(id => id !== draftId);
      }
      if (prev.length >= 2) {
        toast.error('ניתן לבחור עד 2 הקלטות להשוואה');
        return prev;
      }
      return [...prev, draftId];
    });
  };

  const draft1 = allDrafts.find(d => d.id === selectedForCompare[0]);
  const draft2 = allDrafts.find(d => d.id === selectedForCompare[1]);

  const filteredDrafts = allDrafts.filter(draft => {
    const query = searchQuery.toLowerCase();
    const matchName = draft.name.toLowerCase().includes(query);
    const matchTags = draft.tags?.some(tag => tag.toLowerCase().includes(query));
    return matchName || matchTags;
  });

  if (allDrafts.length === 0) return null;

  return (
    <div className="mt-12 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight">גלריית הקלטות</h3>
          <p className="text-sm text-muted-foreground">נהל ותייג את הקלטות המקור שלך</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          {selectedForCompare.length > 0 && (
            <Button 
              variant="default" 
              onClick={() => setIsCompareOpen(true)}
              disabled={selectedForCompare.length !== 2}
              className="w-full sm:w-auto"
            >
              <Activity className="w-4 h-4 ml-2" /> השווה ({selectedForCompare.length}/2)
            </Button>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="חיפוש לפי שם או תגית..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrafts.map(draft => (
          <Card key={draft.id} className="overflow-hidden">
            <CardHeader className="pb-2 bg-muted/30">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg truncate">{draft.name}</CardTitle>
                <div className="flex gap-1">
                  <Button 
                    variant={selectedForCompare.includes(draft.id) ? "default" : "ghost"} 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => handleToggleCompare(draft.id)}
                    title="בחר להשוואה"
                  >
                    {selectedForCompare.includes(draft.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </Button>
                  {playingDraftId === draft.id ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 bg-rose-50/50" onClick={stopDraft} title="עצור">
                        <Square className="h-4 w-4 fill-rose-500 text-rose-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-600 bg-indigo-50/50" onClick={() => playDraft(draft.id, draft.blob)} title={isDraftPaused ? "נגן" : "השהה"}>
                        {isDraftPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" onClick={() => playDraft(draft.id, draft.blob)} title="נגן">
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadDraft(draft)} title="הורד wav">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDraft(draft.id)} title="מחק">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription className="text-xs">
                {new Date(draft.createdAt).toLocaleString()} • {Math.round(draft.durationMs / 1000)} שניות
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 pb-2">
              <div className="flex flex-wrap gap-2 mb-4">
                {draft.tags?.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {tag}
                    <button 
                      onClick={() => handleRemoveTag(draft.id, tag)}
                      className="ml-1 hover:text-destructive focus:outline-none"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              
            </CardContent>
            <CardFooter className="pt-0">
               <div className="flex w-full items-center gap-2">
                 <Input 
                   size={1}
                   placeholder="הוסף תגית..." 
                   className="h-8 text-xs"
                   value={tagInput[draft.id] || ''}
                   onChange={(e) => setTagInput(prev => ({ ...prev, [draft.id]: e.target.value }))}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') handleAddTag(draft.id);
                   }}
                 />
                 <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => handleAddTag(draft.id)}>
                   <Plus className="w-4 h-4" />
                 </Button>
               </div>
            </CardFooter>
          </Card>
        ))}
        
        {filteredDrafts.length === 0 && searchQuery && (
           <div className="col-span-full py-8 text-center text-muted-foreground">
             לא נמצאו הקלטות התואמות לחיפוש.
           </div>
        )}
      </div>

      <Dialog open={isCompareOpen} onOpenChange={setIsCompareOpen}>
        <DialogContent className="sm:max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>השוואת הקלטות</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              השוואה ויזואלית בין הקלטות נבחרות מהגלריה.
            </p>
            {draft1 && draft2 && (
              <WaveformComparison 
                sourceBlob={draft1.blob} 
                generatedBlob={draft2.blob} 
                sourceLabel={draft1.name}
                generatedLabel={draft2.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
