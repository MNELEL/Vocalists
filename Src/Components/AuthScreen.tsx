import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Waves, Sparkles, LogIn, ShieldAlert, Mail, Lock } from 'lucide-react';
import { googleSignIn, emailSignIn, emailSignUp } from '../lib/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface AuthScreenProps {
  onLoginSuccess: (user: { username: string; fullName: string; role: string; email: string; uid: string }) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      let result;
      if (mode === 'signup') {
        result = await emailSignUp(email, password);
      } else {
        result = await emailSignIn(email, password);
      }
      
      if (result && result.user) {
        toast.success(mode === 'signup' ? 'חשבון נוצר בהצלחה!' : 'התחברת בהצלחה!');
        onLoginSuccess({
          username: result.user.email?.split('@')[0] || 'user',
          fullName: result.user.displayName || 'משתמש',
          role: 'משתמש כללי',
          email: result.user.email || '',
          uid: result.user.uid
        });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'הפעולה נכשלה. אנא נסה שוב.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsProcessing(true);
    try {
      const result = await googleSignIn();
      if (result && result.user) {
        toast.success(`ברוך הבא, ${result.user.displayName}!`);
        onLoginSuccess({
          username: result.user.email?.split('@')[0] || 'user',
          fullName: result.user.displayName || 'משתמש',
          role: 'משתמש כללי',
          email: result.user.email || '',
          uid: result.user.uid
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('התחברות נכשלה. אנא נסה שוב.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-[#FFECEC] via-[#F2F4FF] to-[#E3F6FF] p-4 text-right overflow-y-auto" dir="rtl">
      {/* Background Decorative Blobs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob [animation-delay:2s]"></div>
      <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-amber-100 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob [animation-delay:4s]"></div>

      <Card className="w-full max-w-md border border-white/50 bg-white/75 backdrop-blur-xl shadow-xl rounded-3xl overflow-hidden relative z-10 transition-all duration-300">
        <CardHeader className="text-center pt-8 pb-4">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FFD1D1] via-[#DCE1FC] to-[#C9EFFF] flex items-center justify-center shadow-md border border-white/60">
              <Waves className="w-8 h-8 text-indigo-500/80" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            מערכת קולית VOCALIS
          </CardTitle>
          <CardDescription className="text-xs text-indigo-950/60 font-medium mt-1">
            התחברות מאובטחת ומסונכרנת לענן
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 py-6 text-center">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'signup')} className="w-full mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">התחברות</TabsTrigger>
              <TabsTrigger value="signup">הרשמה</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="space-y-4 pt-4">
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2 text-right">
                  <Label htmlFor="email">אימייל</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2 text-right">
                  <Label htmlFor="password">סיסמה</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={isProcessing}>
                  {isProcessing ? 'מעבד...' : 'התחבר'}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="space-y-4 pt-4">
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2 text-right">
                  <Label htmlFor="email">אימייל</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2 text-right">
                  <Label htmlFor="password">סיסמה</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={isProcessing}>
                  {isProcessing ? 'מעבד...' : 'צור חשבון'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white/75 px-2 text-muted-foreground">או</span>
            </div>
          </div>
          
          <Button 
            onClick={handleGoogleLogin} 
            disabled={isProcessing}
            className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 shadow-sm font-bold text-sm h-12 flex items-center justify-center gap-3"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">מתחבר... <Sparkles className="w-4 h-4 animate-spin" /></span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  <path d="M1 1h22v22H1z" fill="none"/>
                </svg>
                המשך עם גוגל
              </>
            )}
          </Button>
        </CardContent>

        <CardFooter className="flex justify-center border-t border-indigo-50/50 bg-indigo-50/20 py-4 mt-2">
          <p className="text-xs text-indigo-950/50 flex items-center gap-1 text-center max-w-[250px]">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            הנתונים והפרופילים נשמרים בענן בצורה מאובטחת, פרטית, ומגובה אוטומטית.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
