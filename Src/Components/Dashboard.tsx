import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAppStore } from '../store/useAppStore';
import { Mic, Users, Play, Activity, ArrowLeft, Sparkles, Key, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';

export default function Dashboard() {
  const { setActiveTab } = useAppStore();

  const profileCount = useLiveQuery(() => db.voiceProfiles.count()) || 0;
  const draftCount = useLiveQuery(() => db.audioDrafts.count()) || 0;
  const queueCount = useLiveQuery(() => db.generationQueue.where('status').equals('pending').count()) || 0;
  const reportCount = useLiveQuery(() => db.diagnosisReports.count()) || 0;

  const steps = [
    {
      num: '1',
      title: 'הקלטת שמע מקור',
      description: 'עבור ללשונית "הקלטת שמע", הקלט דגימת קול ברורה של 20-30 שניות (באיכות גבוהה ללא רעשי רקע) ושמור אותה כטיוטה.',
      actionLabel: 'התחל להקליט כעת',
      icon: Mic,
      tab: 'record' as const,
      color: 'bg-blue-500/10 text-blue-600 border-blue-200/50',
      btnColor: 'bg-blue-600 hover:bg-blue-500'
    },
    {
      num: '2',
      title: 'יצירת פרופיל וסנכרון',
      description: 'עבור ללשונית "פרופילי קול", לחץ על "פרופיל קול חדש", תן לו שם ובחר את טיוטת ההקלטה שלך. המערכת תסנכרן ותשכפל את הקול ישירות ל-ElevenLabs!',
      actionLabel: 'צור פרופיל וסנכרן',
      icon: Users,
      tab: 'profiles' as const,
      color: 'bg-purple-500/10 text-purple-600 border-purple-200/50',
      btnColor: 'bg-purple-600 hover:bg-purple-500'
    },
    {
      num: '3',
      title: 'הזנת טקסט וסינתזה',
      description: 'עבור ללשונית "אולפן סינתזה", הזן כל טקסט שתרצה בעברית או בכל שפה אחרת, בחר את הקול המשוכפל שלך, ולחץ על "סנתז קול" לשמיעת התוצאה המושלמת!',
      actionLabel: 'כנס לאולפן הסינתזה',
      icon: Play,
      tab: 'synthesis' as const,
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50',
      btnColor: 'bg-emerald-600 hover:bg-emerald-500'
    }
  ];

  const tools = [
    {
      title: 'הקלטת שמע',
      description: 'לכוד אודיו באיכות גבוהה לשיבוט קולי',
      icon: Mic,
      tab: 'record' as const,
      stat: `${draftCount} טיוטות`,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'פרופילי קול',
      description: 'נהל והגדר את מודלי הקול שלך',
      icon: Users,
      tab: 'profiles' as const,
      stat: `${profileCount} פרופילים`,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      title: 'אולפן סינתזה',
      description: 'צור דיבור באמצעות פרופילי קול מותאמים אישית',
      icon: Play,
      tab: 'synthesis' as const,
      stat: `${queueCount} בתור`,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      title: 'לוח ניתוח',
      description: 'צלילה עמוקה למדדי דיבור ובהירות',
      icon: Activity,
      tab: 'analysis' as const,
      stat: `${reportCount} דוחות`,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
  ];

  const hasApiKey = !!localStorage.getItem('elevenlabs_api_key');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-indigo-900 via-indigo-950 to-purple-950 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="space-y-2 z-10 text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-indigo-200">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            סביבת שיבוט קול מתקדמת
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">ברוכים הבאים ל-VOCALIS Studio</h1>
          <p className="text-sm text-indigo-200/90 max-w-xl">
            המערכת המובילה ליצירת שיבוט קולי אמיתי וסינתזת דיבור אנושית ומדוייקת. עקוב אחר שלבי המדריך מטה כדי להתחיל לשבט קולות במהירות.
          </p>
        </div>
        
        {/* API Status Badge */}
        <div className="z-10 bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col items-center justify-center text-center shrink-0 w-full md:w-auto">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-indigo-300" />
            <span className="text-xs font-bold">סנכרון ElevenLabs:</span>
          </div>
          {hasApiKey ? (
            <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              מחובר ופעיל (אמיתי)
            </span>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-yellow-300 block">
                מצב סימולציה מקומית
              </span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setActiveTab('settings')}
                className="text-[10px] h-7 px-2.5 bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold rounded-lg"
              >
                הזן מפתח API לשיבוט אמיתי
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Step-by-Step Cloning Wizard */}
      <div className="space-y-4">
        <div className="text-right">
          <h2 className="text-xl font-bold tracking-tight text-indigo-950 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            שלושת השלבים לשיבוט קול אמיתי
          </h2>
          <p className="text-muted-foreground text-xs mt-1">
            הקלט, סנכרן וסנתז – השלם את השלבים הבאים לפי הסדר כדי להגיע לתוצאה המושלמת.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <Card key={step.num} className="relative flex flex-col justify-between overflow-hidden border-indigo-100/40 bg-white/70 backdrop-blur-md hover:border-indigo-500/30 hover:shadow-md transition-all duration-300">
                <div className="absolute top-4 left-4 text-5xl font-black text-indigo-500/5 select-none font-sans">
                  0{step.num}
                </div>
                <CardHeader className="pb-3 text-right">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 border ${step.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base font-bold text-indigo-950 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500 text-white text-[11px] font-bold font-mono">
                      {step.num}
                    </span>
                    {step.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-indigo-900/70 leading-relaxed font-sans pt-1">
                    {step.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 pb-5 px-6">
                  <Button 
                    onClick={() => setActiveTab(step.tab)}
                    className={`w-full text-xs font-bold text-white shadow-sm rounded-xl flex items-center justify-center gap-1.5 ${step.btnColor}`}
                  >
                    <span>{step.actionLabel}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Main Tools Quick Access Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-indigo-950 text-right">
          גישה מהירה לכלים
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card 
                key={tool.title} 
                className="cursor-pointer border-indigo-100/40 bg-white/70 backdrop-blur-md hover:border-indigo-500/30 hover:shadow-sm transition-all duration-300 text-right flex flex-col justify-between"
                onClick={() => setActiveTab(tool.tab)}
              >
                <CardHeader className="pb-2">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${tool.bg} ${tool.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base font-bold text-indigo-950">{tool.title}</CardTitle>
                  <CardDescription className="text-xs">{tool.description}</CardDescription>
                </CardHeader>
                <CardContent className="pb-4 pt-1">
                  <div className="text-xs font-bold text-indigo-600/70">
                    {tool.stat}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
