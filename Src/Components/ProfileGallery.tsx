import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type VoiceProfile } from '../lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  User, 
  Play, 
  Pause,
  Square,
  Info,
  Edit2, 
  Sliders, 
  Sparkles, 
  HelpCircle, 
  Check, 
  Activity,
  UserCheck,
  Languages,
  Wind,
  Calendar,
  FileText,
  Tag,
  Music,
  Download,
  X,
  FileAudio
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Badge } from './ui/badge';
import { createPlayableWavBlob, analyzeAudioAndSuggestTags } from '../lib/audioUtils';
import WaveformComparison from './WaveformComparison';

// Hebrew Localization Labels
const genderLabels = {
  male: 'גבר',
  female: 'אישה',
  neutral: 'ניטרלי'
};

const ageLabels = {
  young: 'צעיר/ה',
  mature: 'בוגר/ת',
  elder: 'מבוגר/ת'
};

const toneLabels = {
  warm: 'חם וידידותי',
  professional: 'מקצועי ורשמי',
  dramatic: 'דרמטי ותיאטרלי',
  energetic: 'אנרגטי וקצבי',
  soft: 'רך ורגוע'
};

const accentLabels = {
  standard: 'עברית סטנדרטית',
  oriental: 'מבטא מזרחי',
  european: 'מבטא אירופאי',
  american: 'מבטא אמריקאי'
};

const resonanceLabels = {
  chest: 'תהודת חזה (עמוק)',
  head: 'תהודת ראש (בהיר)',
  nasal: 'תהודה אפית'
};

const emotionLabels = {
  calm: 'רגוע ושלו',
  excited: 'נלהב ונמרץ',
  empathic: 'אמפתי ומזדהה',
  neutral: 'ניטרלי ושקול',
  assertive: 'אסרטיבי ובטוח'
};

// Natural voice profile descriptor in Hebrew
const generateAutoDescription = (
  name: string,
  gender: 'male' | 'female' | 'neutral',
  ageGroup: 'young' | 'mature' | 'elder',
  pitch: number,
  speed: number,
  toneVibe: string,
  accent: string,
  resonance: string,
  emotion: string
): string => {
  const genderWord = gender === 'male' ? 'קריין' : gender === 'female' ? 'קריינית' : 'קול';
  const ageWord = ageGroup === 'young' ? 'צעיר ורענן' : ageGroup === 'mature' ? 'בוגר וסמכותי' : 'מבוגר ומנוסה';
  
  const pitchWord = pitch < 35 ? 'נמוך ועמוק במיוחד' : pitch > 65 ? 'גבוה וצלול' : 'בגובה בינוני ומאוזן';
  const speedWord = speed < 35 ? 'מתון ואיטי' : speed > 65 ? 'קצבי ודינמי' : 'במהירות טבעית ומאוזנת';
  
  const toneMap: Record<string, string> = {
    warm: 'בעל גוון חם ומזמין המשרה ביטחון',
    professional: 'בסגנון מקצועי, רשמי ומדויק',
    dramatic: 'בטון דרמטי ותיאטרלי עם נוכחות רבה',
    energetic: 'אנרגטי, קצבי ומלא חיות',
    soft: 'רך, עדין ומלטף'
  };
  
  const accentMap: Record<string, string> = {
    standard: 'בעברית צברית נקייה',
    oriental: 'במבטא ים-תיכוני אותנטי',
    european: 'במבטא אירופאי מעודן',
    american: 'במבטא אמריקאי קל'
  };
  
  const resonanceMap: Record<string, string> = {
    chest: 'המופק בתהודת חזה עמוקה ומלאה',
    head: 'המופק בתהודת ראש בהירה ומתוחכמת',
    nasal: 'המופק בתהודה אפית ממוקדת'
  };
  
  const emotionMap: Record<string, string> = {
    calm: 'המשדר רוגע, שלווה ונינוחות מוחלטת',
    excited: 'המבטא התלהבות, אנרגיה שיא ושמחה',
    empathic: 'המשרה חמלה, הבנה וחיבור אנושי עמוק',
    neutral: 'הנשמר שקול, אובייקטיבי ומאוזן',
    assertive: 'המעביר נחישות, ביטחון עצמי ועוצמה'
  };

  const toneText = toneMap[toneVibe] || 'בסגנון מאוזן';
  const accentText = accentMap[accent] || 'בעברית תקנית';
  const resonanceText = resonanceMap[resonance] || '';
  const emotionText = emotionMap[emotion] || '';

  return `פרופיל ${genderWord} ${ageWord}, ${toneText}. הדיבור מופק ${resonanceText} ${accentText}, בגובה צליל ${pitchWord} ובקצב ${speedWord}. סגנון ההבעה הנוכחי הוא ${emotionText}.`;
};

const ComparisonContent = ({ profiles }: { profiles: VoiceProfile[] }) => {
  const [blobs, setBlobs] = useState<(Blob | null)[]>([]);

  useEffect(() => {
    const fetchBlobs = async () => {
      const fetchedBlobs = await Promise.all(
        profiles.map(async (p) => {
          if (!p.sourceAudioId) return null;
          const draft = await db.audioDrafts.get(p.sourceAudioId);
          return draft ? draft.blob : null;
        })
      );
      setBlobs(fetchedBlobs);
    };
    fetchBlobs();
  }, [profiles]);

  if (blobs.some(b => !b)) return <div>לא ניתן לטעון את קבצי השמע להשוואה.</div>;
  return <WaveformComparison sourceBlob={blobs[0]!} generatedBlob={blobs[1]!} sourceLabel={profiles[0].name} generatedLabel={profiles[1].name} />;
};

export default function ProfileGallery() {
  const profiles = useLiveQuery(() => db.voiceProfiles.toArray()) || [];
  const drafts = useLiveQuery(() => db.audioDrafts.toArray()) || [];
  const generationQueue = useLiveQuery(() => db.generationQueue.toArray()) || [];
  const styleTemplates = useLiveQuery(() => db.styleTemplates.toArray()) || [];
  const { setSelectedProfileId, selectedProfileId } = useAppStore();

  const [playingFileId, setPlayingFileId] = useState<string | null>(null);
  const [isFilePaused, setIsFilePaused] = useState(false);
  const fileAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (fileAudioRef.current) {
        fileAudioRef.current.pause();
      }
    };
  }, []);

  const [activeGalleryTab, setActiveGalleryTab] = useState<'profiles' | 'styles'>('profiles');

  // Style Template state
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [newStylePitch, setNewStylePitch] = useState<number[]>([50]);
  const [newStyleSpeed, setNewStyleSpeed] = useState<number[]>([50]);
  const [newStyleEmotion, setNewStyleEmotion] = useState('neutral');

  const [isStyleEditDialogOpen, setIsStyleEditDialogOpen] = useState(false);
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [editStyleName, setEditStyleName] = useState('');
  const [editStylePitch, setEditStylePitch] = useState<number[]>([50]);
  const [editStyleSpeed, setEditStyleSpeed] = useState<number[]>([50]);
  const [editStyleEmotion, setEditStyleEmotion] = useState('neutral');

  const handleCreateStyle = async () => {
    if (!newStyleName.trim()) {
      toast.error('אנא הזן שם לתבנית');
      return;
    }
    try {
      const id = crypto.randomUUID();
      await db.styleTemplates.add({
        id,
        name: newStyleName.trim(),
        pitch: newStylePitch[0],
        speed: newStyleSpeed[0],
        emotion: newStyleEmotion
      });
      toast.success(`תבנית הסגנון "${newStyleName}" נוצרה בהצלחה!`);
      setNewStyleName('');
      setNewStylePitch([50]);
      setNewStyleSpeed([50]);
      setNewStyleEmotion('neutral');
      setIsStyleDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('שגיאה ביצירת תבנית הסגנון');
    }
  };

  const handleEditStyleOpen = (style: any) => {
    setEditingStyleId(style.id);
    setEditStyleName(style.name);
    setEditStylePitch([style.pitch]);
    setEditStyleSpeed([style.speed]);
    setEditStyleEmotion(style.emotion);
    setIsStyleEditDialogOpen(true);
  };

  const handleUpdateStyle = async () => {
    if (!editingStyleId) return;
    if (!editStyleName.trim()) {
      toast.error('אנא הזן שם לתבנית');
      return;
    }
    try {
      await db.styleTemplates.update(editingStyleId, {
        name: editStyleName.trim(),
        pitch: editStylePitch[0],
        speed: editStyleSpeed[0],
        emotion: editStyleEmotion
      });
      toast.success('תבנית הסגנון עודכנה בהצלחה');
      setIsStyleEditDialogOpen(false);
      setEditingStyleId(null);
    } catch (err) {
      console.error(err);
      toast.error('עדכון תבנית הסגנון נכשל');
    }
  };

  const handleDeleteStyle = async (id: string, name: string) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את תבנית הסגנון "${name}"?`)) return;
    try {
      await db.styleTemplates.delete(id);
      toast.success(`תבנית הסגנון "${name}" נמחקה בהצלחה`);
    } catch (err) {
      console.error(err);
      toast.error('מחיקת תבנית הסגנון נכשלה');
    }
  };

  // Multi-select and bulk tagging states
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [comparingProfiles, setComparingProfiles] = useState<VoiceProfile[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [isBulkTagDialogOpen, setIsBulkTagDialogOpen] = useState(false);
  const [newProfileTags, setNewProfileTags] = useState<string[]>([]);
  const [editProfileTags, setEditProfileTags] = useState<string[]>([]);
  const [newProfileTagInput, setNewProfileTagInput] = useState('');
  const [editProfileTagInput, setEditProfileTagInput] = useState('');

  const handleStartComparison = async () => {
    if (selectedProfileIds.length !== 2) return;
    const profilesToCompare = profiles.filter(p => selectedProfileIds.includes(p.id));
    setComparingProfiles(profilesToCompare);
    setIsComparing(true);
  };

  const handleBulkDelete = async () => {
    if (selectedProfileIds.length === 0) return;
    if (!confirm(`האם אתה בטוח שברצונך למחוק ${selectedProfileIds.length} פרופילי קול שנבחרו?`)) return;
    try {
      await Promise.all(selectedProfileIds.map(id => db.voiceProfiles.delete(id)));
      toast.success('פרופילי הקול שנבחרו נמחקו בהצלחה');
      setSelectedProfileIds([]);
    } catch (err) {
      console.error(err);
      toast.error('שגיאה במחיקת הפרופילים');
    }
  };

  const handleBulkAutoTag = async () => {
    if (selectedProfileIds.length === 0) return;
    try {
      await Promise.all(selectedProfileIds.map(async (id) => {
        const profile = profiles.find(p => p.id === id);
        if (profile && profile.sourceAudioId) {
          const draft = await db.audioDrafts.get(profile.sourceAudioId);
          if (draft) {
            const newTags = await analyzeAudioAndSuggestTags(draft.blob);
            const currentTags = profile.tags || [];
            const combinedTags = Array.from(new Set([...currentTags, ...newTags]));
            await db.voiceProfiles.update(id, { tags: combinedTags });
          }
        }
      }));
      toast.success(`תהליך תיוג אוטומטי הושלם ל-${selectedProfileIds.length} פרופילים.`);
    } catch (err) {
      console.error(err);
      toast.error('שגיאה במהלך התיוג האוטומטי');
    }
  };

  const handleBulkExport = () => {
    if (selectedProfileIds.length === 0) return;
    const selectedProfiles = profiles.filter(p => selectedProfileIds.includes(p.id));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedProfiles, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `voice_profiles_export_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('הפרופילים שנבחרו יוצאו בהצלחה כקובץ JSON!');
  };

  const handleExportSingleProfile = (profile: VoiceProfile) => {
    const exportData = {
      name: profile.name,
      description: profile.description,
      gender: profile.gender || 'neutral',
      ageGroup: profile.ageGroup || 'mature',
      pitch: profile.pitch !== undefined ? profile.pitch : 50,
      speed: profile.speed !== undefined ? profile.speed : 50,
      toneVibe: profile.toneVibe || 'professional',
      accent: profile.accent || 'standard',
      resonance: profile.resonance || 'chest',
      emotion: profile.emotion || 'neutral',
      tags: profile.tags || []
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `voice_profile_${profile.name.replace(/\s+/g, '_')}_settings.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success(`פרמטרי הסינתזה של "${profile.name}" יוצאו בהצלחה!`);
  };

  const handleBulkAddTag = async () => {
    if (!bulkTagInput.trim()) {
      toast.error('אנא הזן תגית תקינה');
      return;
    }
    try {
      await Promise.all(selectedProfileIds.map(async (id) => {
        const profile = profiles.find(p => p.id === id);
        if (profile) {
          const currentTags = profile.tags || [];
          if (!currentTags.includes(bulkTagInput.trim())) {
            await db.voiceProfiles.update(id, {
              tags: [...currentTags, bulkTagInput.trim()]
            });
          }
        }
      }));
      toast.success('התגית נוספה בהצלחה לכל הפרופילים שנבחרו');
      setBulkTagInput('');
      setIsBulkTagDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('שגיאה בהוספת תגית קבוצתית');
    }
  };
  
  // Related Audio Files & Metadata Dialog State
  const [isAudioFilesDialogOpen, setIsAudioFilesDialogOpen] = useState(false);
  const [selectedProfileForFiles, setSelectedProfileForFiles] = useState<VoiceProfile | null>(null);

  // Edit file metadata state
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileType, setEditingFileType] = useState<'draft' | 'generated' | null>(null);
  const [fileEditName, setFileEditName] = useState('');
  const [fileEditDescription, setFileEditDescription] = useState('');
  const [fileEditDate, setFileEditDate] = useState('');
  const [fileEditTags, setFileEditTags] = useState<string[]>([]);
  const [newFileTagInput, setNewFileTagInput] = useState('');
  
  // Create Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');
  const [selectedDraftId, setSelectedDraftId] = useState('');
  
  // Voice Characterization Parameters for Creation
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>('neutral');
  const [ageGroup, setAgeGroup] = useState<'young' | 'mature' | 'elder'>('mature');
  const [pitch, setPitch] = useState<number[]>([50]);
  const [speed, setSpeed] = useState<number[]>([50]);
  const [toneVibe, setToneVibe] = useState<'warm' | 'professional' | 'dramatic' | 'energetic' | 'soft'>('professional');
  const [accent, setAccent] = useState<'standard' | 'oriental' | 'european' | 'american'>('standard');
  const [resonance, setResonance] = useState<'chest' | 'head' | 'nasal'>('chest');
  const [emotion, setEmotion] = useState<'calm' | 'excited' | 'empathic' | 'neutral' | 'assertive'>('neutral');

  // Edit Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female' | 'neutral'>('neutral');
  const [editAgeGroup, setEditAgeGroup] = useState<'young' | 'mature' | 'elder'>('mature');
  const [editPitch, setEditPitch] = useState<number[]>([50]);
  const [editSpeed, setEditSpeed] = useState<number[]>([50]);
  const [editToneVibe, setEditToneVibe] = useState<'warm' | 'professional' | 'dramatic' | 'energetic' | 'soft'>('professional');
  const [editAccent, setEditAccent] = useState<'standard' | 'oriental' | 'european' | 'american'>('standard');
  const [editResonance, setEditResonance] = useState<'chest' | 'head' | 'nasal'>('chest');
  const [editEmotion, setEditEmotion] = useState<'calm' | 'excited' | 'empathic' | 'neutral' | 'assertive'>('neutral');

  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [syncingProfileId, setSyncingProfileId] = useState<string | null>(null);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const syncProfileToElevenLabs = async (profile: VoiceProfile) => {
    if (!profile.sourceAudioId) {
      toast.error('לא נמצאה הקלטת מקור לפרופיל זה. לא ניתן לסנכרן ל-ElevenLabs.');
      return;
    }
    setSyncingProfileId(profile.id);
    try {
      const draft = await db.audioDrafts.get(profile.sourceAudioId);
      if (!draft || !draft.blob) {
        toast.error('הקלטת המקור לא נמצאה בבסיס הנתונים המקומי.');
        return;
      }
      
      const base64Audio = await blobToBase64(draft.blob);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      const savedKey = localStorage.getItem('elevenlabs_api_key');
      if (savedKey) {
        headers['x-elevenlabs-key'] = savedKey;
      }

      const response = await fetch('/api/voices/add', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: profile.name,
          description: profile.description,
          base64Audio,
          mimeType: draft.blob.type
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.voice_id) {
          await db.voiceProfiles.update(profile.id, {
            elevenLabsVoiceId: data.voice_id
          });
          toast.success('פרופיל הקול סונכרן ונוצר בהצלחה ב-ElevenLabs!');
        } else {
          toast.error('השירות החזיר תגובה לא תקינה');
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(`סנכרון ל-ElevenLabs נכשל: ${errData.error || 'שגיאה כללית'}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`שגיאה בחיבור לשרת: ${err.message || 'שגיאת רשת'}`);
    } finally {
      setSyncingProfileId(null);
    }
  };

  const createProfile = async () => {
    if (!newProfileName.trim() || !selectedDraftId) {
      toast.error('אנא ספק שם ובחר טיוטת שמע כרפרנס.');
      return;
    }
    
    setIsCreatingProfile(true);
    let elevenLabsVoiceId = undefined;
    
    try {
      const draft = await db.audioDrafts.get(selectedDraftId);
      if (draft && draft.blob) {
        try {
          const base64Audio = await blobToBase64(draft.blob);
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          const savedKey = localStorage.getItem('elevenlabs_api_key');
          if (savedKey) {
            headers['x-elevenlabs-key'] = savedKey;
          }

          const response = await fetch('/api/voices/add', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name: newProfileName,
              description: newProfileDesc,
              base64Audio,
              mimeType: draft.blob.type
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.voice_id) {
              elevenLabsVoiceId = data.voice_id;
              toast.success('הקול סונכרן ונוצר בהצלחה ב-ElevenLabs!');
            }
          } else {
            const errData = await response.json().catch(() => ({}));
            toast.warning(`לא ניתן היה לרשום את הקול ב-ElevenLabs: ${errData.error || 'שגיאה כללית'}. הפרופיל ייווצר באופן מקומי בלבד.`);
          }
        } catch (err) {
          console.warn('ElevenLabs API registration failed, falling back to local-only:', err);
          toast.warning('לא מוגדר מפתח ElevenLabs או שישנה בעיית רשת. הפרופיל נשמר באופן מקומי בלבד.');
        }
      }

      const id = crypto.randomUUID();
      await db.voiceProfiles.add({
        id,
        name: newProfileName,
        description: newProfileDesc,
        sourceAudioId: selectedDraftId,
        createdAt: Date.now(),
        gender,
        ageGroup,
        pitch: pitch[0],
        speed: speed[0],
        toneVibe,
        accent,
        resonance,
        emotion,
        tags: newProfileTags,
        elevenLabsVoiceId
      });
      toast.success('פרופיל הקול נוצר בהצלחה');
      setIsDialogOpen(false);
      
      // Reset form fields
      setNewProfileName('');
      setNewProfileDesc('');
      setSelectedDraftId('');
      setGender('neutral');
      setAgeGroup('mature');
      setPitch([50]);
      setSpeed([50]);
      setToneVibe('professional');
      setAccent('standard');
      setResonance('chest');
      setEmotion('neutral');
      setNewProfileTags([]);
      setNewProfileTagInput('');
    } catch (error) {
      toast.error('יצירת הפרופיל נכשלה');
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const openEditDialog = (profile: VoiceProfile) => {
    setEditingProfileId(profile.id);
    setEditName(profile.name || '');
    setEditDesc(profile.description || '');
    setEditGender(profile.gender || 'neutral');
    setEditAgeGroup(profile.ageGroup || 'mature');
    setEditPitch([profile.pitch !== undefined ? profile.pitch : 50]);
    setEditSpeed([profile.speed !== undefined ? profile.speed : 50]);
    setEditToneVibe(profile.toneVibe || 'professional');
    setEditAccent(profile.accent || 'standard');
    setEditResonance(profile.resonance || 'chest');
    setEditEmotion(profile.emotion || 'neutral');
    setEditProfileTags(profile.tags || []);
    setEditProfileTagInput('');
    setIsEditDialogOpen(true);
  };

  const saveEditedProfile = async () => {
    if (!editingProfileId) return;
    if (!editName.trim()) {
      toast.error('שם הפרופיל אינו יכול להיות ריק');
      return;
    }

    try {
      await db.voiceProfiles.update(editingProfileId, {
        name: editName,
        description: editDesc,
        gender: editGender,
        ageGroup: editAgeGroup,
        pitch: editPitch[0],
        speed: editSpeed[0],
        toneVibe: editToneVibe,
        accent: editAccent,
        resonance: editResonance,
        emotion: editEmotion,
        tags: editProfileTags
      });
      toast.success('פרופיל הקול עודכן בהצלחה');
      setIsEditDialogOpen(false);
      setEditingProfileId(null);
    } catch (err) {
      toast.error('עדכון הפרופיל נכשל');
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      await db.voiceProfiles.delete(id);
      toast.success('פרופיל נמחק');
      if (selectedProfileId === id) {
        setSelectedProfileId(null);
      }
      setSelectedProfileIds(prev => prev.filter(pId => pId !== id));
    } catch (error) {
      toast.error('מחיקת הפרופיל נכשלה');
    }
  };

  const formatDateForInput = (timestamp: number) => {
    const date = new Date(timestamp);
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleStartEditFile = (file: any, type: 'draft' | 'generated') => {
    setEditingFileId(file.id);
    setEditingFileType(type);
    setFileEditName(file.name || (type === 'draft' ? 'הקלטת מקור' : 'שמע מסונתז'));
    setFileEditDescription(file.description || (type === 'generated' ? file.text : ''));
    setFileEditDate(formatDateForInput(file.createdAt));
    setFileEditTags(file.tags || []);
    setNewFileTagInput('');
  };

  const handleAddFileTag = () => {
    const cleanTag = newFileTagInput.trim();
    if (cleanTag && !fileEditTags.includes(cleanTag)) {
      setFileEditTags([...fileEditTags, cleanTag]);
      setNewFileTagInput('');
    }
  };

  const handleRemoveFileTag = (tagToRemove: string) => {
    setFileEditTags(fileEditTags.filter(t => t !== tagToRemove));
  };

  const handleSaveFileMetadata = async () => {
    if (!editingFileId || !editingFileType) return;

    try {
      const timestamp = fileEditDate ? new Date(fileEditDate).getTime() : Date.now();
      
      if (editingFileType === 'draft') {
        await db.audioDrafts.update(editingFileId, {
          name: fileEditName,
          description: fileEditDescription,
          createdAt: timestamp,
          tags: fileEditTags
        });
      } else {
        await db.generationQueue.update(editingFileId, {
          name: fileEditName,
          description: fileEditDescription,
          createdAt: timestamp,
          tags: fileEditTags
        });
      }
      
      toast.success('מטא-דאטה עודכן בהצלחה');
      setEditingFileId(null);
      setEditingFileType(null);
    } catch (err) {
      console.error(err);
      toast.error('עדכון מטא-דאטה נכשל');
    }
  };

  const handleDeleteFile = async (fileId: string, type: 'draft' | 'generated') => {
    if (!confirm('האם אתה בטוח שברצונך למחוק קובץ שמע זה? פעולה זו אינה הפיכה.')) return;
    try {
      if (type === 'draft') {
        await db.audioDrafts.delete(fileId);
        if (selectedProfileForFiles && selectedProfileForFiles.sourceAudioId === fileId) {
          await db.voiceProfiles.update(selectedProfileForFiles.id, {
            sourceAudioId: undefined
          });
          setSelectedProfileForFiles({
            ...selectedProfileForFiles,
            sourceAudioId: undefined
          });
        }
        toast.success('הקלטת המקור נמחקה בהצלחה');
      } else {
        await db.generationQueue.delete(fileId);
        toast.success('קובץ השמע המסונתז נמחק בהצלחה');
      }
    } catch (err) {
      console.error(err);
      toast.error('מחיקת קובץ השמע נכשלה');
    }
  };

  const playAudioFile = (fileId: string, blob: Blob | undefined) => {
    if (!blob) {
      toast.error('שגיאה: קובץ השמע אינו זמין');
      return;
    }
    if (playingFileId === fileId) {
      if (fileAudioRef.current) {
        if (isFilePaused) {
          fileAudioRef.current.play().then(() => {
            setIsFilePaused(false);
          });
        } else {
          fileAudioRef.current.pause();
          setIsFilePaused(true);
        }
      }
    } else {
      stopAudioFile();
      
      let activeBlob = blob;
      if (activeBlob.size < 100) {
        activeBlob = createPlayableWavBlob(1.5, 440, 11025);
      }
      const audioUrl = URL.createObjectURL(activeBlob);
      const audio = new Audio(audioUrl);
      fileAudioRef.current = audio;
      setPlayingFileId(fileId);
      setIsFilePaused(false);

      audio.play().catch(err => {
        console.error('Playback failed', err);
        toast.error('שגיאה בניגון השמע');
        setPlayingFileId(null);
      });

      audio.onended = () => {
        setPlayingFileId(null);
        setIsFilePaused(false);
        URL.revokeObjectURL(audioUrl);
      };
    }
  };

  const stopAudioFile = () => {
    if (fileAudioRef.current) {
      fileAudioRef.current.pause();
      fileAudioRef.current = null;
    }
    setPlayingFileId(null);
    setIsFilePaused(false);
  };

  const handleDownloadFile = (blob: Blob | undefined, name: string) => {
    if (!blob) {
      toast.error('שגיאה: קובץ השמע אינו זמין');
      return;
    }
    let activeBlob = blob;
    if (activeBlob.size < 100) {
      activeBlob = createPlayableWavBlob(1.5, 440, 11025);
    }
    const url = URL.createObjectURL(activeBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      {/* מדריך מהיר מובנה למשתמש - שלב 2 */}
      <Card className="border-purple-100 bg-purple-50/40 p-4 rounded-xl shadow-sm text-right" dir="rtl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-purple-900 text-sm">מדריך מהיר: כיצד לבנות פרופיל קול ולבצע שיבוט אמיתי?</h4>
            <p className="text-xs text-purple-700/95 leading-relaxed">
              מזל טוב! יש לכם הקלטות טיוטה. כעת בואו ניצור את "הזהות הקולית" שלכם לשיבוט:
            </p>
            <ul className="list-disc list-inside text-xs text-purple-700/80 space-y-1 pr-1">
              <li>לחצו על <strong>"צור פרופיל חדש"</strong>, תנו לו שם ובחרו את אחת מטיוטות השמע שהקלטתם כקובץ מקור.</li>
              <li>אם הגדרתם מפתח ElevenLabs API בלשונית ההגדרות, בחרו באפשרות <strong>"סנכרן לשרת ElevenLabs"</strong> - זה יבצע שיבוט קול אמיתי ומדויק לחלוטין!</li>
              <li>אחרת, המערכת תבצע ניתוח מאפיינים מקומי (גיל, מגדר, גובה צליל, מהירות) כדי להציג את הקול.</li>
              <li>לאחר יצירת הפרופיל, לחצו על כפתור <strong>"בחר פרופיל" (הפיכת פרופיל לפעיל)</strong>. זהו הפרופיל שישמש אתכם באולפן הסינתזה כדי לדבר בקולכם!</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Category Tabs */}
      <div className="flex border-b border-indigo-100/40 pb-px gap-6 mb-2">
        <button
          onClick={() => setActiveGalleryTab('profiles')}
          className={`pb-3 text-sm font-bold transition-all relative cursor-pointer ${
            activeGalleryTab === 'profiles'
              ? 'text-indigo-600'
              : 'text-indigo-950/40 hover:text-indigo-950/60'
          }`}
        >
          פרופילי קול (Voice Profiles)
          {activeGalleryTab === 'profiles' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveGalleryTab('styles')}
          className={`pb-3 text-sm font-bold transition-all relative cursor-pointer ${
            activeGalleryTab === 'styles'
              ? 'text-indigo-600'
              : 'text-indigo-950/40 hover:text-indigo-950/60'
          }`}
        >
          תבניות סגנון קולי (Voice Style Templates)
          {activeGalleryTab === 'styles' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>

      {activeGalleryTab === 'profiles' ? (
        <>
          {/* Upper bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sliders className="w-7 h-7 text-indigo-500" />
            פרופילי קול & אפיון פרמטרים
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            נהל את מודלי הקול שלך, אפין אותם לפי פרמטרים מדויקים (מגדר, גיל, גובה צליל, מבטא, תהודה) וכייל את העדפות המערכת.
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="w-4 h-4 ml-2" /> פרופיל חדש
          </DialogTrigger>
          <DialogContent className="max-w-[550px]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                יצירת פרופיל קול מאופיין
              </DialogTitle>
              <DialogDescription className="text-xs">
                בנה פרופיל קול חדש מתוך טיוטת שמע קיימת והגדר אפיון שמע מדויק.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm max-h-[420px] overflow-y-auto px-1">
              
              {/* Basic Meta fields */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">שם הפרופיל</Label>
                  <Input 
                    placeholder="למשל, קריין רדיו סמכותי" 
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    dir="rtl"
                    className="h-9 text-xs"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold text-foreground">תיאור ואפיון קולי</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2 gap-1"
                      onClick={() => {
                        const autoDesc = generateAutoDescription(
                          newProfileName || 'קול מותאם',
                          gender,
                          ageGroup,
                          pitch[0],
                          speed[0],
                          toneVibe,
                          accent,
                          resonance,
                          emotion
                        );
                        setNewProfileDesc(autoDesc);
                        toast.success('התיאור האוטומטי נוצר בהצלחה!');
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
                      ייצר תיאור אוטומטי
                    </Button>
                  </div>
                  <textarea 
                    placeholder="תיאור סגנון, גוון, מבטא ורגש (ניתן לכתוב ידנית או לייצר אוטומטית מתחת)" 
                    value={newProfileDesc}
                    onChange={(e) => setNewProfileDesc(e.target.value)}
                    dir="rtl"
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-card px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                {/* Tags management */}
                <div className="space-y-1.5 pt-1.5">
                  <Label className="text-xs font-semibold text-foreground">תגיות זיהוי וקטגוריה</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="הוסף תגית (למשל: רב, מלמד, ירושלמי)" 
                      value={newProfileTagInput}
                      onChange={(e) => setNewProfileTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newProfileTagInput.trim() && !newProfileTags.includes(newProfileTagInput.trim())) {
                            setNewProfileTags(prev => [...prev, newProfileTagInput.trim()]);
                            setNewProfileTagInput('');
                          }
                        }
                      }}
                      className="text-xs h-8 border-indigo-100/50"
                    />
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        if (newProfileTagInput.trim() && !newProfileTags.includes(newProfileTagInput.trim())) {
                          setNewProfileTags(prev => [...prev, newProfileTagInput.trim()]);
                          setNewProfileTagInput('');
                        }
                      }}
                      className="h-8 text-xs px-3 border-indigo-100/30 hover:bg-indigo-50/50"
                    >
                      הוסף
                    </Button>
                  </div>
                  {newProfileTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {newProfileTags.map((tag, idx) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="text-[10px] px-2 py-0.5 font-bold rounded-lg bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF] flex items-center gap-1"
                        >
                          {tag}
                          <button 
                            type="button" 
                            onClick={() => setNewProfileTags(prev => prev.filter((_, tIdx) => tIdx !== idx))}
                            className="text-red-500 hover:text-red-700 font-extrabold text-xs ml-0.5"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Source Draft */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">טיוטת שמע למקור (Reference)</Label>
                <select 
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={selectedDraftId}
                  onChange={(e) => setSelectedDraftId(e.target.value)}
                  dir="rtl"
                >
                  <option value="" className="bg-background text-foreground">בחר טיוטה מקורית להשוואה...</option>
                  {drafts.map(draft => (
                    <option key={draft.id} value={draft.id} className="bg-background text-foreground">
                      {draft.name} ({new Date(draft.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-border pt-3 space-y-3.5">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  פרמטרי אפיון פיזיולוגיים וסגנוניים
                </span>

                {/* Gender, Age, Tone Row */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">מגדר קולי</Label>
                    <select
                      value={gender}
                      onChange={(e: any) => setGender(e.target.value)}
                      className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                    >
                      <option value="male">גברי</option>
                      <option value="female">נשי</option>
                      <option value="neutral">ניטרלי / מעורב</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">קבוצת גיל</Label>
                    <select
                      value={ageGroup}
                      onChange={(e: any) => setAgeGroup(e.target.value)}
                      className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                    >
                      <option value="young">צעיר (אנרגטי)</option>
                      <option value="mature">בוגר (סמכותי)</option>
                      <option value="elder">מבוגר (מיושב)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">טון ואווירה</Label>
                    <select
                      value={toneVibe}
                      onChange={(e: any) => setToneVibe(e.target.value)}
                      className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                    >
                      <option value="professional">מקצועי ורשמי</option>
                      <option value="warm">חם וידידותי</option>
                      <option value="soft">רך ורגוע</option>
                      <option value="energetic">אנרגטי וקצבי</option>
                      <option value="dramatic">דרמטי ותיאטרלי</option>
                    </select>
                  </div>
                </div>

                {/* Accent, Resonance & Emotion Row */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">מבטא והגייה</Label>
                    <select
                      value={accent}
                      onChange={(e: any) => setAccent(e.target.value)}
                      className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                    >
                      <option value="standard">עברית סטנדרטית</option>
                      <option value="oriental">מבטא מזרחי</option>
                      <option value="european">מבטא אירופאי</option>
                      <option value="american">מבטא אמריקאי</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">תהודת קול</Label>
                    <select
                      value={resonance}
                      onChange={(e: any) => setResonance(e.target.value)}
                      className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                    >
                      <option value="chest">תהודת חזה</option>
                      <option value="head">תהודת ראש</option>
                      <option value="nasal">תהודה אפית</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">הבעת רגש</Label>
                    <select
                      value={emotion}
                      onChange={(e: any) => setEmotion(e.target.value)}
                      className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                    >
                      <option value="neutral">ניטרלי ושקול</option>
                      <option value="calm">רגוע ושלו</option>
                      <option value="excited">נלהב ונמרץ</option>
                      <option value="empathic">אמפתי ומזדהה</option>
                      <option value="assertive">אסרטיבי ובטוח</option>
                    </select>
                  </div>
                </div>

                {/* Pitch slider */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <Label className="font-semibold text-muted-foreground">גובה צליל (Pitch)</Label>
                    <span className="font-mono text-indigo-400 font-bold">{pitch[0]}%</span>
                  </div>
                  <Slider 
                    value={pitch}
                    max={100}
                    step={1}
                    onValueChange={setPitch}
                    className="py-1"
                    aria-label="גובה צליל (Pitch)"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground px-1">
                    <span>עמוק (בס)</span>
                    <span>ממוצע</span>
                    <span>גבוה (סופרן)</span>
                  </div>
                </div>

                {/* Speed slider */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <Label className="font-semibold text-muted-foreground">מהירות דיבור (Tempo)</Label>
                    <span className="font-mono text-indigo-400 font-bold">{speed[0]}%</span>
                  </div>
                  <Slider 
                    value={speed}
                    max={100}
                    step={1}
                    onValueChange={setSpeed}
                    className="py-1"
                    aria-label="מהירות דיבור (Tempo)"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground px-1">
                    <span>מתון / איטי</span>
                    <span>רגיל</span>
                    <span>מהיר / דינמי</span>
                  </div>
                </div>

              </div>

            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)} disabled={isCreatingProfile}>ביטול</Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={createProfile} disabled={isCreatingProfile}>
                {isCreatingProfile ? 'מבצע שיבוט ויוצר...' : 'צור פרופיל'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bulk actions bar */}
      {selectedProfileIds.length > 0 && (
        <div className="bg-indigo-50/80 border border-indigo-100/50 backdrop-blur-md rounded-2xl p-4 mb-6 flex flex-wrap justify-between items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300" dir="rtl">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 text-white rounded-lg px-2.5 py-1 text-xs font-black">
              {selectedProfileIds.length}
            </div>
            <span className="text-xs font-bold text-indigo-950">פרופילים נבחרו לפעולה קבוצתית</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Bulk Tag Dialog */}
            <Dialog open={isBulkTagDialogOpen} onOpenChange={setIsBulkTagDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold text-xs h-9">
                  <Tag className="w-4 h-4 ml-1.5" />
                  הוסף תגית קבוצתית
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[400px]" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="font-bold text-base flex items-center gap-1.5">
                    <Tag className="w-5 h-5 text-indigo-600" />
                    שיוך תגית קבוצתית
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    הזן תגית כדי להוסיף אותה בו זמנית לכל {selectedProfileIds.length} הפרופילים שנבחרו.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-3 text-right">
                  <Label className="text-xs font-bold">שם התגית</Label>
                  <Input 
                    value={bulkTagInput}
                    onChange={(e) => setBulkTagInput(e.target.value)}
                    placeholder="למשל: שיעור בעיון, רבנים, חדר"
                    className="text-xs h-10 border-indigo-100 text-right"
                  />
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsBulkTagDialogOpen(false)}>ביטול</Button>
                  <Button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold" onClick={handleBulkAddTag}>שייך תגית</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button size="sm" variant="outline" onClick={handleBulkAutoTag} className="border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold text-xs h-9">
              <Sparkles className="w-4 h-4 ml-1.5" />
              תיוג אוטומטי ({selectedProfileIds.length})
            </Button>

            {selectedProfileIds.length === 2 && (
              <Button size="sm" variant="outline" onClick={handleStartComparison} className="border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold text-xs h-9">
                <Activity className="w-4 h-4 ml-1.5" />
                השווה פרופילים
              </Button>
            )}

            <Button size="sm" variant="outline" onClick={handleBulkExport} className="border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold text-xs h-9">
              <Download className="w-4 h-4 ml-1.5" />
              ייצא פרופילים ({selectedProfileIds.length})
            </Button>

            <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs h-9 shadow-sm">
              <Trash2 className="w-4 h-4 ml-1.5" />
              מחק קבוצתית ({selectedProfileIds.length})
            </Button>

            <Button size="sm" variant="ghost" onClick={() => setSelectedProfileIds([])} className="text-muted-foreground hover:text-foreground text-xs h-9">
              בטל בחירה
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isComparing} onOpenChange={setIsComparing}>
        <DialogContent className="max-w-[900px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>השוואת פרופילי קול</DialogTitle>
          </DialogHeader>
          {comparingProfiles.length === 2 && <ComparisonContent profiles={comparingProfiles} />}
        </DialogContent>
      </Dialog>

      {/* Main Grid display list */}
      {profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-card text-center">
          <User className="w-12 h-12 text-muted-foreground mb-4 opacity-50 animate-pulse" />
          <h3 className="text-lg font-medium text-foreground">לא נמצאו פרופילי קול</h3>
          <p className="text-muted-foreground mt-2 max-w-sm mb-4 text-xs">
            טרם יצרת פרופילי קול מאופיינים. הגדר את הפרופיל הראשון שלך כדי להתחיל ליצור ולסנתז שמע.
          </p>
          <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="text-xs">
            צור פרופיל ראשון
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map(profile => {
            const isSelected = selectedProfileId === profile.id;
            const isChecked = selectedProfileIds.includes(profile.id);
            
            // Associated files count
            const associatedDraft = drafts.find(d => d.id === profile.sourceAudioId);
            const associatedQueueItems = generationQueue.filter(q => q.profileId === profile.id && q.status === 'completed');
            const relatedFilesCount = (associatedDraft ? 1 : 0) + associatedQueueItems.length;
            
            // Build defaults if missing in older profiles to prevent render crashes
            const pGender = profile.gender || 'neutral';
            const pAge = profile.ageGroup || 'mature';
            const pTone = profile.toneVibe || 'professional';
            const pAccent = profile.accent || 'standard';
            const pResonance = profile.resonance || 'chest';
            const pEmotion = profile.emotion || 'neutral';
            const pPitch = profile.pitch !== undefined ? profile.pitch : 50;
            const pSpeed = profile.speed !== undefined ? profile.speed : 50;

            return (
              <Card 
                key={profile.id} 
                id={`voice-profile-card-${profile.id}`}
                className={`overflow-hidden transition-all duration-300 relative group flex flex-col justify-between ${
                  isSelected 
                    ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md shadow-indigo-500/5 bg-gradient-to-br from-indigo-950/10 to-card' 
                    : 'hover:border-indigo-500/30'
                }`}
              >
                <CardHeader className="bg-muted/20 pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base flex items-center gap-2 font-bold">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProfileIds(prev => [...prev, profile.id]);
                            } else {
                              setSelectedProfileIds(prev => prev.filter(id => id !== profile.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-indigo-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                          title="בחר לפעולה קבוצתית"
                        />
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-muted-foreground/10 text-muted-foreground'
                        }`}>
                          {isSelected ? <UserCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                      </div>
                      <span className="truncate max-w-[150px]">{profile.name}</span>
                    </CardTitle>
                    
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground hover:text-indigo-400" 
                        onClick={() => handleExportSingleProfile(profile)}
                        title="ייצא פרמטרי סינתזה (הגדרות)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground hover:text-indigo-400" 
                        onClick={() => openEditDialog(profile)}
                        title="ערוך אפיון קול"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-rose-500 opacity-50 hover:opacity-100" 
                        onClick={() => deleteProfile(profile.id)}
                        title="מחק פרופיל"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  <CardDescription className="line-clamp-2 pt-1 text-xs">
                    {profile.description || 'לא סופק תיאור עבור מודל זה.'}
                  </CardDescription>

                  {/* Render Tags */}
                  {profile.tags && profile.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {profile.tags.map((tag: string, idx: number) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="text-[9px] px-1.5 py-0.5 font-bold rounded-md bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="py-3 space-y-4 flex-1">
                  
                  {/* Visual Parameters Grid / Tags */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded p-1.5 flex flex-col gap-0.5 text-right">
                      <span className="text-muted-foreground font-semibold">מין וגיל</span>
                      <span className="font-bold text-indigo-300">
                        {genderLabels[pGender]} • {ageLabels[pAge]}
                      </span>
                    </div>

                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded p-1.5 flex flex-col gap-0.5 text-right">
                      <span className="text-muted-foreground font-semibold">אווירה וסגנון</span>
                      <span className="font-bold text-indigo-300">
                        {toneLabels[pTone]}
                      </span>
                    </div>

                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded p-1.5 flex flex-col gap-0.5 text-right">
                      <span className="text-muted-foreground font-semibold">מבטא & תהודה</span>
                      <span className="font-bold text-indigo-300">
                        {accentLabels[pAccent]} • {resonanceLabels[pResonance]}
                      </span>
                    </div>

                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded p-1.5 flex flex-col gap-0.5 text-right">
                      <span className="text-muted-foreground font-semibold">הבעת רגש</span>
                      <span className="font-bold text-indigo-300">
                        {emotionLabels[pEmotion] || 'ניטרלי ושקול'}
                      </span>
                    </div>
                  </div>

                  {/* Pitch and Speed Mini-Indicators */}
                  <div className="space-y-2.5 pt-1">
                    {/* Pitch */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground">גובה צליל (Pitch)</span>
                        <span className="font-mono text-indigo-400 font-bold">{pPitch}%</span>
                      </div>
                      <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${pPitch}%` }}
                        />
                      </div>
                    </div>

                    {/* Speed */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground">מהירות (Tempo)</span>
                        <span className="font-mono text-indigo-400 font-bold">{pSpeed}%</span>
                      </div>
                      <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${pSpeed}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ElevenLabs Voice Sync Status */}
                  <div className="pt-2 border-t border-indigo-500/10 flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground font-semibold">סנכרון ElevenLabs:</span>
                    {profile.elevenLabsVoiceId ? (
                      <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 font-mono text-[9px] border border-emerald-500/20 gap-1 py-0.5">
                        <Check className="w-3 h-3 text-emerald-400" />
                        סונכרן ({profile.elevenLabsVoiceId.substring(0, 8)}...)
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 gap-1 border border-indigo-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          syncProfileToElevenLabs(profile);
                        }}
                        disabled={syncingProfileId === profile.id}
                      >
                        {syncingProfileId === profile.id ? (
                          'מסנכרן...'
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            סנכרן כעת
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                </CardContent>

                <CardFooter className="pt-2 pb-4 px-4 flex gap-2">
                  <Button 
                    variant={isSelected ? "secondary" : "default"} 
                    className={`flex-1 text-xs h-9 font-semibold ${
                      isSelected 
                        ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                    }`}
                    onClick={() => {
                      setSelectedProfileId(profile.id);
                      toast.info(`פרופיל פעיל: ${profile.name}`);
                    }}
                  >
                    {isSelected ? 'פעיל' : 'בחר כפעיל'}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 px-3 hover:bg-indigo-500/10 text-xs border-indigo-500/20 text-indigo-400 flex items-center gap-1.5"
                    onClick={() => {
                      setSelectedProfileForFiles(profile);
                      setIsAudioFilesDialogOpen(true);
                    }}
                    title="ניהול קובצי שמע ומטא-דאטה"
                  >
                    <FileAudio className="w-4 h-4" />
                    קובצי שמע ({relatedFilesCount})
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && setIsEditDialogOpen(false)}>
        <DialogContent className="max-w-[550px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Edit2 className="w-5 h-5 text-indigo-500" />
              עריכת אפיון פרופיל קול
            </DialogTitle>
            <DialogDescription className="text-xs">
              כייל מחדש את המאפיינים והפרמטרים הפיזיולוגיים של מודל קול זה.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm max-h-[420px] overflow-y-auto px-1">
            {/* Basic Meta fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">שם הפרופיל</Label>
                <Input 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  dir="rtl"
                  className="h-9 text-xs"
                />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-foreground">תיאור ואפיון קולי</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2 gap-1"
                    onClick={() => {
                      const autoDesc = generateAutoDescription(
                        editName || 'קול מותאם',
                        editGender,
                        editAgeGroup,
                        editPitch[0],
                        editSpeed[0],
                        editToneVibe,
                        editAccent,
                        editResonance,
                        editEmotion
                      );
                      setEditDesc(autoDesc);
                      toast.success('התיאור האוטומטי נוצר בהצלחה!');
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
                    ייצר תיאור אוטומטי
                  </Button>
                </div>
                <textarea 
                  placeholder="תיאור סגנון, גוון, מבטא ורגש (ניתן לכתוב ידנית או לייצר אוטומטית מתחת)" 
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  dir="rtl"
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-card px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Edit Tags management */}
              <div className="space-y-1.5 pt-1.5">
                <Label className="text-xs font-semibold text-foreground">תגיות זיהוי וקטגוריה</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="הוסף תגית (למשל: רב, מלמד, ירושלמי)" 
                    value={editProfileTagInput}
                    onChange={(e) => setEditProfileTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (editProfileTagInput.trim() && !editProfileTags.includes(editProfileTagInput.trim())) {
                          setEditProfileTags(prev => [...prev, editProfileTagInput.trim()]);
                          setEditProfileTagInput('');
                        }
                      }
                    }}
                    className="text-xs h-8 border-indigo-100/50"
                  />
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      if (editProfileTagInput.trim() && !editProfileTags.includes(editProfileTagInput.trim())) {
                        setEditProfileTags(prev => [...prev, editProfileTagInput.trim()]);
                        setEditProfileTagInput('');
                      }
                    }}
                    className="h-8 text-xs px-3 border-indigo-100/30 hover:bg-indigo-50/50"
                  >
                    הוסף
                  </Button>
                </div>
                {editProfileTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {editProfileTags.map((tag, idx) => (
                      <Badge 
                        key={idx} 
                        variant="secondary" 
                        className="text-[10px] px-2 py-0.5 font-bold rounded-lg bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF] flex items-center gap-1"
                      >
                        {tag}
                        <button 
                          type="button" 
                          onClick={() => setEditProfileTags(prev => prev.filter((_, tIdx) => tIdx !== idx))}
                          className="text-red-500 hover:text-red-700 font-extrabold text-xs ml-0.5"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-3.5">
              <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                <Sliders className="w-4 h-4" />
                כיול פרמטרים וסגנון
              </span>

              {/* Gender, Age, Tone Row */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">מגדר קולי</Label>
                  <select
                    value={editGender}
                    onChange={(e: any) => setEditGender(e.target.value)}
                    className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                  >
                    <option value="male">גברי</option>
                    <option value="female">נשי</option>
                    <option value="neutral">ניטרלי / מעורב</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">קבוצת גיל</Label>
                  <select
                    value={editAgeGroup}
                    onChange={(e: any) => setEditAgeGroup(e.target.value)}
                    className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                  >
                    <option value="young">צעיר (אנרגטי)</option>
                    <option value="mature">בוגר (סמכותי)</option>
                    <option value="elder">מבוגר (מיושב)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">טון ואווירה</Label>
                  <select
                    value={editToneVibe}
                    onChange={(e: any) => setEditToneVibe(e.target.value)}
                    className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                  >
                    <option value="professional">מקצועי ורשמי</option>
                    <option value="warm">חם וידידותי</option>
                    <option value="soft">רך ורגוע</option>
                    <option value="energetic">אנרגטי וקצבי</option>
                    <option value="dramatic">דרמטי ותיאטרלי</option>
                  </select>
                </div>
              </div>

              {/* Accent, Resonance & Emotion Row */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">מבטא והגייה</Label>
                  <select
                    value={editAccent}
                    onChange={(e: any) => setEditAccent(e.target.value)}
                    className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                  >
                    <option value="standard">עברית סטנדרטית</option>
                    <option value="oriental">מבטא מזרחי</option>
                    <option value="european">מבטא אירופאי</option>
                    <option value="american">מבטא אמריקאי</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">תהודת קול</Label>
                  <select
                    value={editResonance}
                    onChange={(e: any) => setEditResonance(e.target.value)}
                    className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                  >
                    <option value="chest">תהודת חזה</option>
                    <option value="head">תהודת ראש</option>
                    <option value="nasal">תהודה אפית</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">הבעת רגש</Label>
                  <select
                    value={editEmotion}
                    onChange={(e: any) => setEditEmotion(e.target.value)}
                    className="w-full h-8 rounded border border-input bg-card px-2 py-0.5 text-xs"
                  >
                    <option value="neutral">ניטרלי ושקול</option>
                    <option value="calm">רגוע ושלו</option>
                    <option value="excited">נלהב ונמרץ</option>
                    <option value="empathic">אמפתי ומזדהה</option>
                    <option value="assertive">אסרטיבי ובטוח</option>
                  </select>
                </div>
              </div>

              {/* Pitch slider */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center text-[11px]">
                  <Label className="font-semibold text-muted-foreground">גובה צליל (Pitch)</Label>
                  <span className="font-mono text-indigo-400 font-bold">{editPitch[0]}%</span>
                </div>
                <Slider 
                  value={editPitch}
                  max={100}
                  step={1}
                  onValueChange={setEditPitch}
                  className="py-1"
                  aria-label="גובה צליל (Pitch)"
                />
              </div>

              {/* Speed slider */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center text-[11px]">
                  <Label className="font-semibold text-muted-foreground">מהירות דיבור (Tempo)</Label>
                  <span className="font-mono text-indigo-400 font-bold">{editSpeed[0]}%</span>
                </div>
                <Slider 
                  value={editSpeed}
                  max={100}
                  step={1}
                  onValueChange={setEditSpeed}
                  className="py-1"
                  aria-label="מהירות דיבור (Tempo)"
                />
              </div>

            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(false)}>ביטול</Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={saveEditedProfile}>שמור שינויים</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Related Audio Files & Metadata Manager Dialog */}
      <Dialog open={isAudioFilesDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAudioFilesDialogOpen(false);
          setSelectedProfileForFiles(null);
          setEditingFileId(null);
          setEditingFileType(null);
        }
      }}>
        <DialogContent className="max-w-[650px] w-full" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <FileAudio className="w-5 h-5 text-indigo-500" />
              ניהול קובצי שמע ומטא-דאטה: {selectedProfileForFiles?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              ערוך ותייג את קובץ המקור (הקלטת בסיס) או את קובצי השמע המסונתזים המשויכים לפרופיל זה.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm max-h-[450px] overflow-y-auto px-1">
            {selectedProfileForFiles && (
              <>
                {/* 1. Base Reference Audio */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 border-b border-border pb-1">
                    <Music className="w-4 h-4" />
                    קובץ מקור (הקלטת בסיס לרפרנס)
                  </h4>
                  
                  {(() => {
                    const draft = drafts.find(d => d.id === selectedProfileForFiles.sourceAudioId);
                    if (!draft) {
                      return <p className="text-xs text-muted-foreground italic">לא נמצא קובץ מקור משויך לפרופיל זה.</p>;
                    }

                    const isEditing = editingFileId === draft.id && editingFileType === 'draft';

                    return (
                      <Card className="p-3 border-indigo-500/10 bg-indigo-500/5">
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">שם הקובץ (קול)</Label>
                              <Input 
                                value={fileEditName} 
                                onChange={(e) => setFileEditName(e.target.value)} 
                                className="h-8 text-xs" 
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">תיאור הקובץ</Label>
                              <textarea 
                                value={fileEditDescription} 
                                onChange={(e) => setFileEditDescription(e.target.value)} 
                                className="flex min-h-[50px] w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold">תאריך יצירה</Label>
                              <Input 
                                type="datetime-local" 
                                value={fileEditDate} 
                                onChange={(e) => setFileEditDate(e.target.value)} 
                                className="h-8 text-xs" 
                              />
                            </div>
                            
                            {/* Tags list & add tag inside editor */}
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-semibold">תגיות מטא-דאטה</Label>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {fileEditTags.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-[10px] py-0.5 px-1.5 flex items-center gap-1">
                                    <Tag className="w-2.5 h-2.5" />
                                    {tag}
                                    <button onClick={() => handleRemoveFileTag(tag)} className="hover:text-rose-500 focus:outline-none">
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex gap-1">
                                <Input 
                                  placeholder="הוסף תגית..." 
                                  value={newFileTagInput} 
                                  onChange={(e) => setNewFileTagInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddFileTag();
                                    }
                                  }}
                                  className="h-7 text-xs flex-1" 
                                />
                                <Button size="sm" type="button" onClick={handleAddFileTag} className="h-7 px-2 bg-indigo-600 text-white">
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-1 justify-end">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingFileId(null); setEditingFileType(null); }}>ביטול</Button>
                              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-500 text-white" onClick={handleSaveFileMetadata}>שמור</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs truncate text-foreground">{draft.name}</span>
                                <Badge variant="outline" className="text-[9px] py-0 border-indigo-500/30 text-indigo-400 bg-indigo-500/5">רפרנס מקורי</Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2">
                                {draft.description || 'לא סופק תיאור עבור קובץ שמע זה.'}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-2">
                                  <Calendar className="w-3 h-3 text-muted-foreground" />
                                  {new Date(draft.createdAt).toLocaleString()}
                                </span>
                                {draft.tags?.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-[9px] py-0 px-1 flex items-center gap-0.5">
                                    <Tag className="w-2.5 h-2.5" />
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="flex gap-1 self-center shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500" onClick={() => handleDeleteFile(draft.id, 'draft')} title="מחק">
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              </Button>
                              {playingFileId === draft.id ? (
                                <>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500 bg-rose-50/50" onClick={stopAudioFile} title="עצור">
                                    <Square className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 bg-indigo-50/50" onClick={() => playAudioFile(draft.id, draft.blob)} title={isFilePaused ? "נגן" : "השהה"}>
                                    {isFilePaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                                  </Button>
                                </>
                              ) : (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" onClick={() => playAudioFile(draft.id, draft.blob)} title="נגן">
                                  <Play className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownloadFile(draft.blob, draft.name)} title="הורד">
                                <Download className="w-3.5 h-3.5 text-foreground" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-400" onClick={() => handleStartEditFile(draft, 'draft')} title="ערוך מטא-דאטה">
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })()}
                </div>

                {/* 2. Generated Audio Files */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 border-b border-border pb-1">
                    <Sparkles className="w-4 h-4" />
                    קובצי שמע מסונתזים (תוצרי מודל הקול)
                  </h4>

                  {(() => {
                    const generatedItems = generationQueue.filter(q => q.profileId === selectedProfileForFiles.id && q.status === 'completed');
                    if (generatedItems.length === 0) {
                      return <p className="text-xs text-muted-foreground italic py-2">לא נמצאו קובצי שמע מסונתזים עבור מודל זה.</p>;
                    }

                    return (
                      <div className="space-y-2.5">
                        {generatedItems.map((item, index) => {
                          const isEditing = editingFileId === item.id && editingFileType === 'generated';
                          const displayName = item.name || `תוצר סינתזה ${generatedItems.length - index}`;

                          return (
                            <Card key={item.id} className="p-3 border-border">
                              {isEditing ? (
                                <div className="space-y-3">
                                  <div className="space-y-1">
                                    <Label className="text-[11px] font-semibold">שם הקובץ (קול מסונתז)</Label>
                                    <Input 
                                      value={fileEditName} 
                                      onChange={(e) => setFileEditName(e.target.value)} 
                                      className="h-8 text-xs" 
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[11px] font-semibold">תיאור הקובץ (או טקסט מקור)</Label>
                                    <textarea 
                                      value={fileEditDescription} 
                                      onChange={(e) => setFileEditDescription(e.target.value)} 
                                      className="flex min-h-[50px] w-full rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[11px] font-semibold">תאריך יצירה</Label>
                                    <Input 
                                      type="datetime-local" 
                                      value={fileEditDate} 
                                      onChange={(e) => setFileEditDate(e.target.value)} 
                                      className="h-8 text-xs" 
                                    />
                                  </div>
                                  
                                  {/* Tags list & add tag inside editor */}
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold">תגיות מטא-דאטה</Label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {fileEditTags.map(tag => (
                                        <Badge key={tag} variant="secondary" className="text-[10px] py-0.5 px-1.5 flex items-center gap-1">
                                          <Tag className="w-2.5 h-2.5" />
                                          {tag}
                                          <button onClick={() => handleRemoveFileTag(tag)} className="hover:text-rose-500 focus:outline-none">
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        </Badge>
                                      ))}
                                    </div>
                                    <div className="flex gap-1">
                                      <Input 
                                        placeholder="הוסף תגית..." 
                                        value={newFileTagInput} 
                                        onChange={(e) => setNewFileTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddFileTag();
                                          }
                                        }}
                                        className="h-7 text-xs flex-1" 
                                      />
                                      <Button size="sm" type="button" onClick={handleAddFileTag} className="h-7 px-2 bg-indigo-600 text-white">
                                        <Plus className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="flex gap-2 pt-1 justify-end">
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingFileId(null); setEditingFileType(null); }}>ביטול</Button>
                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-500 text-white" onClick={handleSaveFileMetadata}>שמור</Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-start gap-4">
                                  <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-xs truncate text-foreground">{displayName}</span>
                                      {item.rating && (
                                        <Badge variant="outline" className="text-[9px] py-0 border-amber-500/30 text-amber-400 bg-amber-500/5">
                                          דירוג: {item.rating}★
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                                      {item.description || item.text}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-2">
                                        <Calendar className="w-3 h-3 text-muted-foreground" />
                                        {new Date(item.createdAt).toLocaleString()}
                                      </span>
                                      {item.tags?.map(tag => (
                                        <Badge key={tag} variant="secondary" className="text-[9px] py-0 px-1 flex items-center gap-0.5">
                                          <Tag className="w-2.5 h-2.5" />
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex gap-1 self-center shrink-0">
                                    <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500" onClick={() => handleDeleteFile(item.id, 'generated')} title="מחק">
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    </Button>
                                    {playingFileId === item.id ? (
                                      <>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500 bg-rose-50/50" onClick={stopAudioFile} title="עצור">
                                          <Square className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 bg-indigo-50/50" onClick={() => playAudioFile(item.id, item.resultAudioBlob)} title={isFilePaused ? "נגן" : "השהה"}>
                                          {isFilePaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                                        </Button>
                                      </>
                                    ) : (
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" onClick={() => playAudioFile(item.id, item.resultAudioBlob)} title="נגן">
                                        <Play className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownloadFile(item.resultAudioBlob, displayName)} title="הורד">
                                      <Download className="w-3.5 h-3.5 text-foreground" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-400" onClick={() => handleStartEditFile(item, 'generated')} title="ערוך מטא-דאטה">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => {
              setIsAudioFilesDialogOpen(false);
              setSelectedProfileForFiles(null);
              setEditingFileId(null);
              setEditingFileType(null);
            }}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      ) : (
        /* Voice Style Template Manager Section */
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Music className="w-6 h-6 text-indigo-500" />
                תבניות סגנון קולי
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                צור ונהל תבניות סגנון קולי קבועות מראש (גובה צליל, קצב ורגש) כדי להחיל אותן במהירות באולפן הסינתזה.
              </p>
            </div>

            <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
              <DialogTrigger render={<Button />}>
                <Plus className="w-4 h-4 ml-2" /> תבנית סגנון חדשה
              </DialogTrigger>
              <DialogContent className="max-w-[450px]" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    יצירת תבנית סגנון קולי
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    קבע ערכים מוגדרים מראש עבור גובה צליל, קצב דיבור ורגש.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 text-sm">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">שם התבנית</Label>
                    <Input 
                      placeholder="למשל, קריינות חדשות רשמית" 
                      value={newStyleName}
                      onChange={(e) => setNewStyleName(e.target.value)}
                      className="text-right text-xs"
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-semibold">גובה צליל (Pitch)</Label>
                      <span className="text-xs text-muted-foreground">{newStylePitch[0]}%</span>
                    </div>
                    <Slider 
                      value={newStylePitch} 
                      onValueChange={setNewStylePitch} 
                      max={100} 
                      step={1} 
                      aria-label="גובה צליל"
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-semibold">קצב דיבור (Tempo)</Label>
                      <span className="text-xs text-muted-foreground">{newStyleSpeed[0]}%</span>
                    </div>
                    <Slider 
                      value={newStyleSpeed} 
                      onValueChange={setNewStyleSpeed} 
                      max={100} 
                      step={1} 
                      aria-label="מהירות דיבור"
                    />
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs font-semibold text-foreground">רגש מוביל (Emotion)</Label>
                    <select
                      value={newStyleEmotion}
                      onChange={(e) => setNewStyleEmotion(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-xs"
                    >
                      {Object.entries(emotionLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <DialogFooter className="pt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsStyleDialogOpen(false)} className="text-xs">
                    ביטול
                  </Button>
                  <Button size="sm" onClick={handleCreateStyle} className="text-xs bg-indigo-600 hover:bg-indigo-500">
                    צור תבנית
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit Style Template Dialog */}
          <Dialog open={isStyleEditDialogOpen} onOpenChange={setIsStyleEditDialogOpen}>
            <DialogContent className="max-w-[450px]" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                  <Edit2 className="w-5 h-5 text-indigo-500" />
                  עריכת תבנית סגנון קולי
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2 text-sm">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">שם התבנית</Label>
                  <Input 
                    value={editStyleName}
                    onChange={(e) => setEditStyleName(e.target.value)}
                    className="text-right text-xs"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold">גובה צליל (Pitch)</Label>
                    <span className="text-xs text-muted-foreground">{editStylePitch[0]}%</span>
                  </div>
                  <Slider 
                    value={editStylePitch} 
                    onValueChange={setEditStylePitch} 
                    max={100} 
                    step={1} 
                    aria-label="גובה צליל"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold">קצב דיבור (Tempo)</Label>
                    <span className="text-xs text-muted-foreground">{editStyleSpeed[0]}%</span>
                  </div>
                  <Slider 
                    value={editStyleSpeed} 
                    onValueChange={setEditStyleSpeed} 
                    max={100} 
                    step={1} 
                    aria-label="מהירות דיבור"
                  />
                </div>

                <div className="space-y-1.5 pt-2">
                  <Label className="text-xs font-semibold text-foreground">רגש מוביל (Emotion)</Label>
                  <select
                    value={editStyleEmotion}
                    onChange={(e) => setEditStyleEmotion(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-xs"
                  >
                    {Object.entries(emotionLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter className="pt-4 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsStyleEditDialogOpen(false)} className="text-xs">
                  ביטול
                </Button>
                <Button size="sm" onClick={handleUpdateStyle} className="text-xs bg-indigo-600 hover:bg-indigo-500">
                  שמור שינויים
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Style Templates Grid */}
          {styleTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-card text-center">
              <Music className="w-12 h-12 text-muted-foreground mb-4 opacity-50 animate-pulse" />
              <h3 className="text-lg font-medium text-foreground">לא נמצאו תבניות סגנון</h3>
              <p className="text-muted-foreground mt-2 max-w-sm mb-4 text-xs">
                טרם הגדרת תבניות סגנון אישיות. צור תבנית ראשונה כדי להתחיל!
              </p>
              <Button onClick={() => setIsStyleDialogOpen(true)} variant="outline" className="text-xs">
                צור תבנית ראשונה
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {styleTemplates.map(style => (
                <Card key={style.id} className="overflow-hidden hover:border-indigo-500/30 transition-all duration-300 relative flex flex-col justify-between">
                  <CardHeader className="bg-muted/10 pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base flex items-center gap-2 font-bold text-foreground">
                        <Music className="w-4 h-4 text-indigo-500" />
                        {style.name}
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="w-7 h-7 hover:text-indigo-600" 
                          onClick={() => handleEditStyleOpen(style)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="w-7 h-7 hover:text-red-500 text-muted-foreground" 
                          onClick={() => handleDeleteStyle(style.id, style.name)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2 pb-4 space-y-3.5">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-semibold">גובה צליל (Pitch):</span>
                        <span className="font-bold text-indigo-600">{style.pitch}%</span>
                      </div>
                      <div className="w-full bg-indigo-100/40 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${style.pitch}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-semibold">מהירות דיבור (Tempo):</span>
                        <span className="font-bold text-indigo-600">{style.speed}%</span>
                      </div>
                      <div className="w-full bg-indigo-100/40 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${style.speed}%` }}></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-indigo-500/5">
                      <span className="text-muted-foreground font-semibold">רגש מוביל:</span>
                      <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/15 font-semibold text-[11px] rounded-md px-2 py-0.5">
                        {emotionLabels[style.emotion as keyof typeof emotionLabels] || style.emotion || 'ניטרלי ושקול'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
