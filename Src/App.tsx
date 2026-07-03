import { useState, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { LayoutDashboard, Mic, Users, Settings2, Activity, Play, Wifi, WifiOff, Battery, BatteryCharging, Waves, Database, Download, LogOut } from 'lucide-react';
import { cn } from './lib/utils';
import Dashboard from './components/Dashboard';
import AudioRecording from './components/AudioRecording';
import ProfileGallery from './components/ProfileGallery';
import SynthesisStudio from './components/SynthesisStudio';
import AnalysisDashboard from './components/AnalysisDashboard';
import SettingsDashboard from './components/SettingsDashboard';
import OnboardingGuide from './components/OnboardingGuide';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { db } from './lib/db';
import { initAuth } from './lib/firebase';
import { Button } from './components/ui/button';
import AuthScreen from './components/AuthScreen';

export default function App() {
  const { activeTab, setActiveTab, batterySaver, setBatterySaver } = useAppStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        // Handle auth success
        console.log('Auth success:', user);
      },
      () => {
        // Handle auth failure
        setCurrentUser(null);
        localStorage.removeItem('vocalis_session');
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  useEffect(() => {
    // Robust seeding of prebuilt voice profiles if the DB is empty
    const seedDatabase = async () => {
      try {
        const count = await db.voiceProfiles.count();
        if (count === 0) {
          await db.voiceProfiles.bulkAdd([
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
          ]);
          
          const styleCount = await db.styleTemplates.count();
          if (styleCount === 0) {
            await db.styleTemplates.bulkAdd([
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
            ]);
          }
          console.log('Voice database seeded with premium preloaded profiles successfully.');
        }
      } catch (err) {
        console.error('Error seeding voice profiles on app mount:', err);
      }
    };
    seedDatabase();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
    { id: 'record', label: 'הקלטת שמע', icon: Mic },
    { id: 'profiles', label: 'פרופילי קול', icon: Users },
    { id: 'synthesis', label: 'אולפן סינתזה', icon: Play },
    { id: 'analysis', label: 'ניתוח קולי', icon: Activity },
    { id: 'settings', label: 'הגדרות', icon: Settings2 },
  ] as const;

  const tabNames: Record<string, string> = {
    dashboard: 'לוח בקרה',
    record: 'הקלטת שמע',
    profiles: 'פרופילי קול',
    synthesis: 'אולפן סינתזה',
    analysis: 'ניתוח קולי',
    settings: 'הגדרות'
  };

  if (!currentUser) {
    return (
      <>
        <AuthScreen onLoginSuccess={(u) => {
          localStorage.setItem('vocalis_session', JSON.stringify(u));
          setCurrentUser(u);
        }} />
        <Toaster theme="light" dir="rtl" />
      </>
    );
  }

  return (
    <div className="flex h-screen w-full bg-gradient-to-tr from-[#FFF5F5] via-[#F4F5FC] to-[#EDF9FF] font-sans text-foreground overflow-hidden" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-l border-indigo-100/40 bg-white/75 backdrop-blur-md flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFD1D1] via-[#DCE1FC] to-[#C9EFFF] flex items-center justify-center shadow-sm border border-white/40">
             <Waves className="w-5 h-5 text-indigo-500/80" />
          </div>
          <span className="font-black text-lg bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 bg-clip-text text-transparent tracking-tight">VOCALIS</span>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer",
                  isActive
                    ? "bg-indigo-500/10 text-indigo-600 shadow-sm border border-indigo-100/30"
                    : "text-indigo-950/60 hover:bg-indigo-50/50 hover:text-indigo-950"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-indigo-100/30">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3 border border-indigo-100/40 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FFD1D1] to-[#C9EFFF] flex items-center justify-center font-bold text-xs text-indigo-600 border border-white">
              {currentUser?.fullName ? currentUser.fullName[0] : 'U'}
            </div>
            <div className="flex-1 min-w-0 text-right font-sans">
              <p className="text-xs font-bold text-indigo-950 truncate">{currentUser?.fullName || 'משתמש מערכת'}</p>
              <p className="text-[10px] text-indigo-950/60 font-semibold truncate">{currentUser?.role || 'הרשאות מלאות'}</p>
            </div>
            <button 
              onClick={async () => {
                const { logout } = await import('./lib/firebase');
                await logout();
                localStorage.removeItem('vocalis_session');
                setCurrentUser(null);
                toast.success('התנתקת מהמערכת בהצלחה');
              }}
              className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 transition-colors"
              title="התנתק מהמערכת"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-transparent relative overflow-hidden">
        {/* Desktop Header */}
        <header className="h-16 hidden md:flex items-center justify-between px-8 border-b border-indigo-100/30 bg-white/40 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-indigo-950/60 font-semibold">בית / <span className="text-indigo-600 font-bold">{tabNames[activeTab]}</span></span>
          </div>
          <div className="flex items-center gap-6">
            {showInstallBtn && (
              <Button 
                onClick={handleInstallClick}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-3 flex items-center gap-1.5 animate-pulse shadow-md rounded-lg"
                size="sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>התקן אפליקציה</span>
              </Button>
            )}
            <button 
              onClick={() => setBatterySaver(!batterySaver)}
              className={cn("flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-colors", batterySaver ? "text-yellow-600" : "text-indigo-950/50 hover:text-indigo-950")}
              title="חיסכון בסוללה (מפחית קצב רענון)"
            >
              {batterySaver ? <BatteryCharging className="w-4 h-4" /> : <Battery className="w-4 h-4" />}
              <span>חיסכון סוללה {batterySaver ? "פועל" : "כבוי"}</span>
            </button>
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500" : "bg-red-500")}></span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-950/50">
                מערכת {isOnline ? "מקוונת" : "לא מקוונת"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-indigo-950/50">
              סנכרון ענן: <span className={cn(isOnline ? "text-indigo-600" : "text-indigo-950/30")}>{isOnline ? "פעיל" : "מושהה"}</span>
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-indigo-100/30 bg-white/75 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FFD1D1] to-[#C9EFFF] flex items-center justify-center border border-white">
              <Waves className="w-4 h-4 text-indigo-500/80" />
            </div>
            <span className="font-black bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 bg-clip-text text-transparent">VOCALIS</span>
          </div>
          <div className="flex items-center gap-4">
             {showInstallBtn && (
               <Button 
                 onClick={handleInstallClick}
                 className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] h-7 px-2 flex items-center gap-1 shadow-md rounded-lg"
                 size="sm"
               >
                 <Download className="w-3 h-3" />
                 <span>התקן</span>
               </Button>
             )}
             <button 
               onClick={() => setBatterySaver(!batterySaver)}
               className={cn("flex items-center justify-center transition-colors", batterySaver ? "text-yellow-600" : "text-indigo-950/50")}
               title="חיסכון בסוללה"
             >
               {batterySaver ? <BatteryCharging className="w-5 h-5" /> : <Battery className="w-5 h-5" />}
             </button>
             {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6 md:p-8 h-full max-w-7xl">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'record' && <AudioRecording />}
            {activeTab === 'profiles' && <ProfileGallery />}
            {activeTab === 'synthesis' && <SynthesisStudio />}
            {activeTab === 'analysis' && <AnalysisDashboard />}
            {activeTab === 'settings' && <SettingsDashboard />}
          </div>
        </div>

        {/* Mobile Nav */}
        <nav className="md:hidden flex items-center justify-around p-3 border-t border-indigo-100/30 bg-white/75 backdrop-blur-md safe-area-pb shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-medium transition-all",
                  activeTab === item.id
                    ? "text-indigo-600 bg-indigo-500/10"
                    : "text-indigo-950/60 hover:text-indigo-950"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="hidden xs:block font-bold">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </main>
      <Toaster theme="light" dir="rtl" />
      <OnboardingGuide />
    </div>
  );
}
