import Dexie, { type EntityTable } from 'dexie';

export interface AudioDraft {
  id: string;
  name: string;
  blob: Blob;
  durationMs: number;
  tags?: string[];
  createdAt: number;
  description?: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  sourceAudioId?: string;
  baseStyleId?: string;
  createdAt: number;
  tags?: string[];
  elevenLabsVoiceId?: string;
  // Multi-parameter voice characterization:
  gender?: 'male' | 'female' | 'neutral';
  ageGroup?: 'young' | 'mature' | 'elder';
  pitch?: number; // 0 to 100
  speed?: number; // 0 to 100
  toneVibe?: 'warm' | 'professional' | 'dramatic' | 'energetic' | 'soft';
  accent?: 'standard' | 'oriental' | 'european' | 'american';
  resonance?: 'chest' | 'head' | 'nasal';
  emotion?: 'calm' | 'excited' | 'empathic' | 'neutral' | 'assertive';
}

export interface VoiceStyleTemplate {
  id: string;
  name: string;
  pitch: number;
  speed: number;
  emotion: string;
}

export interface SpeechDiagnosisReport {
  id: string;
  profileId: string;
  clarityScore: number;
  pitchVariation: number[];
  speedVariation: number[];
  volumeVariation: number[];
  diarizationSegments: DiarizationSegment[];
  createdAt: number;
}

export interface DiarizationSegment {
  speakerId: string;
  startTime: number;
  endTime: number;
}

export interface GenerationQueueItem {
  id: string;
  profileId: string;
  text: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultAudioBlob?: Blob;
  rating?: number;
  synthesisTimeMs?: number;
  createdAt: number;
  name?: string;
  description?: string;
  tags?: string[];
  errorMessage?: string;
  params?: {
    pitch?: number;
    speed?: number;
    stability?: number;
    emotionalTone?: string;
    rateVariability?: number;
    accentIntensity?: number;
  };
}

export interface UserSubscription {
  uid: string;
  tier: 'free' | 'basic' | 'premium';
  stripeCustomerId?: string;
  status: 'active' | 'canceled' | 'past_due';
}

// ...

const db = new Dexie('VoiceAppDB') as Dexie & {
  audioDrafts: EntityTable<AudioDraft, 'id'>;
  voiceProfiles: EntityTable<VoiceProfile, 'id'>;
  styleTemplates: EntityTable<VoiceStyleTemplate, 'id'>;
  diagnosisReports: EntityTable<SpeechDiagnosisReport, 'id'>;
  generationQueue: EntityTable<GenerationQueueItem, 'id'>;
  subscriptions: EntityTable<UserSubscription, 'uid'>;
};

db.version(2).stores({
  audioDrafts: 'id, createdAt',
  voiceProfiles: 'id, name, createdAt',
  styleTemplates: 'id, name',
  diagnosisReports: 'id, profileId, createdAt',
  generationQueue: 'id, profileId, status, createdAt',
  subscriptions: 'uid, tier, status'
});

// Seed pre-defined/built-in voice profiles and style templates when DB is first created
db.on('populate', () => {
  db.voiceProfiles.bulkAdd([
    {
      id: 'prebuilt-avrohom',
      name: 'הרב אברהם (ראש ישיבה)',
      description: 'קול גברי מבוגר, סמכותי, עמוק ומלא הדרת פנים. מתאים להעברת שיעורים בעיון, פלפול, הרצאות עומק ושיחות מוסר בישיבה.',
      createdAt: Date.now() - 3600000 * 24,
      gender: 'male',
      ageGroup: 'mature',
      pitch: 32,
      speed: 42,
      toneVibe: 'professional',
      accent: 'standard',
      resonance: 'chest',
      emotion: 'calm',
      tags: ['ראש ישיבה', 'שיעור בעיון', 'סמכותי', 'רבנים']
    },
    {
      id: 'prebuilt-shalom',
      name: 'הרב שלום (מרצה חם ומסביר)',
      description: 'קול גברי חם, נעים ודינמי, בעל כושר הסבר יוצא מן הכלל. מעולה להרצאות אמונה, שיחות חיזוק, הידברות, פודקאסטים וקריינות מסבירה.',
      createdAt: Date.now() - 3600000 * 12,
      gender: 'male',
      ageGroup: 'mature',
      pitch: 40,
      speed: 50,
      toneVibe: 'warm',
      accent: 'standard',
      resonance: 'chest',
      emotion: 'empathic',
      tags: ['מרצים', 'חם וידידותי', 'הרצאה', 'רבנים']
    },
    {
      id: 'prebuilt-meir',
      name: 'המלמד ר\' מאיר (מלמד בחדר)',
      description: 'קול גברי נעים, רך, קצבי ומאיר פנים המתאים במיוחד להוראת תינוקות של בית רבן בחדר. הקראת חומש ורש"י, סיפורי צדיקים עם ניגון חסידי מתוק.',
      createdAt: Date.now() - 3600000 * 4,
      gender: 'male',
      ageGroup: 'young',
      pitch: 48,
      speed: 45,
      toneVibe: 'soft',
      accent: 'standard',
      resonance: 'head',
      emotion: 'empathic',
      tags: ['מלמדים בחדר', 'סבלני', 'ילדים', 'חסידי']
    },
    {
      id: 'prebuilt-pinchas',
      name: 'הרב פנחס (דרשן כריזמטי)',
      description: 'קול סוחף, דרמטי ועוצמתי המתאים לדרשות מעוררות, סיפורי שבת, דברי חיזוק והתעוררות בקהל רחב.',
      createdAt: Date.now() - 3600000 * 2,
      gender: 'male',
      ageGroup: 'mature',
      pitch: 38,
      speed: 55,
      toneVibe: 'dramatic',
      accent: 'standard',
      resonance: 'chest',
      emotion: 'excited',
      tags: ['דרשן', 'כריזמטי', 'דרשות', 'רבנים']
    }
  ]).catch(err => console.error('Error pre-populating database profiles:', err));

  db.styleTemplates.bulkAdd([
    {
      id: 'style-promo',
      name: 'פרומו דרמטי',
      pitch: 38,
      speed: 45,
      emotion: 'excited'
    },
    {
      id: 'style-assist',
      name: 'מענה קולי רגוע',
      pitch: 58,
      speed: 50,
      emotion: 'calm'
    },
    {
      id: 'style-news',
      name: 'קריינות סמכותית',
      pitch: 42,
      speed: 48,
      emotion: 'neutral'
    }
  ]).catch(err => console.error('Error pre-populating database styles:', err));
});

export { db };
