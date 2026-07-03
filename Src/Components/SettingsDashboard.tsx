import { useState, useEffect } from 'react';
import StorageManager from './StorageManager';
import CloudSyncManager from './CloudSyncManager';
import { Info, ShieldCheck, Cpu, HardDrive, Sparkles, Key, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';

export default function SettingsDashboard() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('elevenlabs_api_key') || '';
    setApiKey(savedKey);
  }, []);

  const handleSaveKey = () => {
    localStorage.setItem('elevenlabs_api_key', apiKey.trim());
    toast.success('מפתח ElevenLabs API נשמר בהצלחה במכשיר זה!');
  };

  const handleClearKey = () => {
    localStorage.removeItem('elevenlabs_api_key');
    setApiKey('');
    toast.info('מפתח ElevenLabs API הוסר בהצלחה.');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-right">הגדרות וניהול</h1>
        <p className="text-muted-foreground mt-2 text-right text-sm">
          נהל את האחסון, ההעדפות, שיבוט הקול והגדרות המערכת.
        </p>
      </div>

      {/* ElevenLabs API Key Section */}
      <Card className="border-indigo-100/40 bg-white/70 backdrop-blur-md shadow-sm">
        <CardHeader className="text-right">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-indigo-950">
            <Key className="w-5 h-5 text-indigo-500" />
            מפתח שיבוט קול (ElevenLabs API Key)
          </CardTitle>
          <CardDescription className="text-xs">
            כדי לבצע שיבוט קול אמיתי וסינתזה באיכות אנושית מושלמת, המערכת משתמשת בשירות ה-API של ElevenLabs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-right">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-indigo-900">מפתח ה-API האישי שלך</Label>
            <div className="relative flex items-center">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="הכנס את ה-API Key שלך מ-ElevenLabs..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pl-12 text-left font-mono text-xs h-10 tracking-widest bg-white border-indigo-100 focus:border-indigo-500 rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-3 text-indigo-900/40 hover:text-indigo-900 transition-colors p-1"
                title={showKey ? "הסתר מפתח" : "הצג מפתח"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              המפתח נשמר באופן מקומי ומאובטח בדפדפן שלך ומשמש רק לשליחת בקשות ישירות לשיבוט וסינתזה של הקול שלך.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            {localStorage.getItem('elevenlabs_api_key') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearKey} 
                className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
              >
                מחק מפתח
              </Button>
            )}
            <Button 
              size="sm" 
              onClick={handleSaveKey} 
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-sm"
            >
              שמור מפתח API
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* App Details and Visual Logo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-border bg-card flex flex-col justify-between overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              לוגו המערכת
            </CardTitle>
            <CardDescription>מזהה מותג ויזואלי</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center py-6">
            <div className="relative w-28 h-28 bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-indigo-500/10">
              <div className="flex items-center gap-1.5 justify-center">
                <span className="w-1.5 h-8 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                <span className="w-1.5 h-14 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1.5 h-10 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                <span className="w-1.5 h-16 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                <span className="w-1.5 h-6 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></span>
              </div>
              <span className="absolute bottom-2 text-[10px] font-bold tracking-widest text-white/80 font-mono">VOCALIS</span>
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center font-medium">
              Vocalis Studio — AI Sound Engine
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="w-5 h-5 text-primary" />
              פרטי האפליקציה (System Information)
            </CardTitle>
            <CardDescription>פרטים טכנולוגיים ומידע אודות Vocalis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-lg">
                <Cpu className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold">מנוע סינתזה ואנליזה</p>
                  <p className="font-medium text-foreground">Web Audio API & Client Synthesis</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-lg">
                <HardDrive className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold">בסיס נתונים מקומי</p>
                  <p className="font-medium text-foreground">IndexedDB (Dexie.js Engine)</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold">פרטיות ואבטחת מידע</p>
                  <p className="font-medium text-foreground">סביבת עבודה מאובטחת ומקומית</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-lg">
                <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold">גרסת מערכת</p>
                  <p className="font-medium text-foreground">v1.4.2 Premium Edition</p>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground leading-relaxed pt-2">
              <p>
                Vocalis היא סביבה מתקדמת המציעה כלי הקלטה מקצועיים, שיבוט קולי מבוסס פרופילים אקוסטיים, אולפן סינתזה מתקדם, לוח ניתוח ויזואלי המציע השוואות גלי קול בזמן אמת, וכלי ניהול אחסון חכמים ל-IndexedDB.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <CloudSyncManager />

      <StorageManager />
    </div>
  );
}
