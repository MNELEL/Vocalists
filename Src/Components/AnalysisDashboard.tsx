import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend } from 'recharts';
import { Activity, Zap, BarChart2, ShieldAlert, Download, Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import LocalAudioAnalyzer from './LocalAudioAnalyzer';
import CollaborativeNotes from './CollaborativeNotes';

export default function AnalysisDashboard() {
  const { selectedProfileId } = useAppStore();
  
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const session = localStorage.getItem('vocalis_session');
    if (session) {
      try {
        setCurrentUser(JSON.parse(session));
      } catch (e) {}
    }
  }, []);
  
  const reports = useLiveQuery(
    () => db.diagnosisReports.where('profileId').equals(selectedProfileId || '').toArray(),
    [selectedProfileId]
  ) || [];

  const generationQueue = useLiveQuery(() => db.generationQueue.where('status').equals('completed').toArray()) || [];
  const voiceProfiles = useLiveQuery(() => db.voiceProfiles.toArray()) || [];

  const performanceData = useMemo(() => {
    if (!generationQueue.length || !voiceProfiles.length) return [];
    
    // Group by profileId
    const stats: Record<string, { totalMs: number, count: number, name: string }> = {};
    
    voiceProfiles.forEach(p => {
      stats[p.id] = { totalMs: 0, count: 0, name: p.name };
    });

    generationQueue.forEach(item => {
      if (item.synthesisTimeMs && stats[item.profileId]) {
        stats[item.profileId].totalMs += item.synthesisTimeMs;
        stats[item.profileId].count += 1;
      }
    });

    return Object.values(stats)
      .filter(s => s.count > 0)
      .map(s => ({
        name: s.name,
        'זמן ממוצע (ms)': Math.round(s.totalMs / s.count)
      }));
  }, [generationQueue, voiceProfiles]);

  const trendData = useMemo(() => {
    if (!generationQueue.length || !voiceProfiles.length) return [];

    const sortedQueue = [...generationQueue]
      .filter(item => item.status === 'completed' && item.synthesisTimeMs)
      .sort((a, b) => a.createdAt - b.createdAt);

    if (sortedQueue.length === 0) return [];

    // Group runs by date (DD/MM)
    const dateGroups: Record<string, Record<string, { total: number, count: number }>> = {};
    
    sortedQueue.forEach(item => {
      const dateStr = new Date(item.createdAt).toLocaleDateString('he-IL', {
        month: '2-digit',
        day: '2-digit'
      });
      
      if (!dateGroups[dateStr]) {
        dateGroups[dateStr] = {};
      }
      
      if (!dateGroups[dateStr][item.profileId]) {
        dateGroups[dateStr][item.profileId] = { total: 0, count: 0 };
      }
      
      dateGroups[dateStr][item.profileId].total += item.synthesisTimeMs!;
      dateGroups[dateStr][item.profileId].count += 1;
    });

    return Object.entries(dateGroups).map(([date, profileStats]) => {
      const row: any = { date };
      voiceProfiles.forEach(p => {
        if (profileStats[p.id]) {
          row[p.name] = Math.round(profileStats[p.id].total / profileStats[p.id].count);
        }
      });
      return row;
    });
  }, [generationQueue, voiceProfiles]);

  const latestReport = reports.length > 0 ? reports[reports.length - 1] : null;
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const runAnalysis = async () => {
    if (!selectedProfileId) {
      toast.error('בחר תחילה פרופיל קול בלשונית הפרופילים.');
      return;
    }

    setIsAnalyzing(true);
    
    // Simulate AI analysis delay
    setTimeout(async () => {
      const mockPitch = Array.from({ length: 20 }, () => Math.floor(Math.random() * 40) + 180);
      const mockSpeed = Array.from({ length: 20 }, () => Math.floor(Math.random() * 20) + 140);
      const mockVolume = Array.from({ length: 20 }, () => Math.floor(Math.random() * 30) + 60);
      
      const diarization = [
        { speakerId: 'דובר א', startTime: 0, endTime: 4.5 },
        { speakerId: 'דובר ב', startTime: 4.5, endTime: 8.2 },
        { speakerId: 'דובר א', startTime: 8.2, endTime: 12.0 },
      ];

      try {
        await db.diagnosisReports.add({
          id: crypto.randomUUID(),
          profileId: selectedProfileId,
          clarityScore: Math.floor(Math.random() * 15) + 85, // 85-100
          pitchVariation: mockPitch,
          speedVariation: mockSpeed,
          volumeVariation: mockVolume,
          diarizationSegments: diarization,
          createdAt: Date.now()
        });
        toast.success('ניתוח דיבור הושלם!');
      } catch (err) {
        toast.error('שמירת דוח הניתוח נכשלה');
      } finally {
        setIsAnalyzing(false);
      }
    }, 2500);
  };

  const exportDataToJSON = () => {
    if (!latestReport) return;
    try {
      const dataStr = JSON.stringify(latestReport, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `analysis_report_${latestReport.id}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      toast.success('הנתונים יוצאו בהצלחה');
    } catch (err) {
      toast.error('שגיאה בייצוא הנתונים');
    }
  };

  const formatChartData = (dataArray: number[]) => {
    return dataArray.map((val, idx) => ({
      time: `${idx * 0.5}שנ'`,
      value: val
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">לוח ניתוח קולי ואקוסטי</h1>
        <p className="text-muted-foreground mt-2">
          מנוע ניתוח קבצי שמע מקומיים, מדדי אבחון מתקדמים וסטטיסטיקות ביצועי מודל.
        </p>
      </div>

      {/* Always accessible Local Audio Analyzer */}
      <LocalAudioAnalyzer />

      {/* Voice Profile Diagnosis Section */}
      <div className="border-t border-border pt-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">אבחון פרופיל קול אקוסטי</h2>
            <p className="text-sm text-muted-foreground mt-1">
              מדדי אבחון עמוקים ושינויי גובה צליל, קצב ועוצמה עבור הפרופיל הפעיל.
            </p>
          </div>
          {selectedProfileId && (
            <div className="flex gap-2">
              {latestReport && (
                <Button variant="outline" onClick={exportDataToJSON}>
                  <Download className="w-4 h-4 ml-2" /> ייצוא ל-JSON
                </Button>
              )}
              <Button onClick={runAnalysis} disabled={isAnalyzing}>
                {isAnalyzing ? (
                   <><Activity className="w-4 h-4 ml-2 animate-spin" /> מנתח...</>
                ) : (
                   <><Zap className="w-4 h-4 ml-2" /> הרץ אבחון חדש</>
                )}
              </Button>
            </div>
          )}
        </div>

        {!selectedProfileId ? (
          <Card className="border-dashed bg-muted/10">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-bold">לא נבחר פרופיל קול</h3>
              <p className="text-muted-foreground mt-2 max-w-md text-sm">
                אנא בחר פרופיל קול מגלריית הפרופילים כדי שתוכל להפיק ולצפות בדוחות וניתוחי דיבור אקוסטיים מתקדמים.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {!latestReport && !isAnalyzing && (
              <Card className="border-dashed bg-muted/10">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                  <BarChart2 className="w-12 h-12 text-muted-foreground mb-4 opacity-30" />
                  <h3 className="text-lg font-medium">אין נתוני אבחון זמינים</h3>
                  <p className="text-muted-foreground mt-1 max-w-sm">
                    הרץ סריקת אבחון חדשה עבור הפרופיל הנוכחי כדי להפיק מדדי דיבור, ציוני בהירות ותרשימי ציר זמן.
                  </p>
                </CardContent>
              </Card>
            )}

            {latestReport && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Clarity Score Card */}
                <Card className="md:col-span-1 border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle>ציון בהירות</CardTitle>
                    <CardDescription>דיוק אקוסטי כללי</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-6">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                        <circle 
                          cx="50" cy="50" r="45" 
                          fill="transparent" 
                          stroke="currentColor" 
                          strokeWidth="8" 
                          strokeDasharray={`${(latestReport.clarityScore / 100) * 283} 283`}
                          className="text-primary transition-all duration-1000 ease-out" 
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold tracking-tighter">{latestReport.clarityScore}</span>
                        <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">/100</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Diarization Timeline */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>חלוקת דוברים בציר הזמן (Diarization)</CardTitle>
                    <CardDescription>מקטעי דוברים שזוהו לאורך זמן</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-32 relative w-full bg-zinc-950/50 rounded-lg border border-border p-4 flex flex-col justify-center" dir="ltr">
                      <div className="relative h-12 w-full bg-muted/30 rounded overflow-hidden">
                        {latestReport.diarizationSegments.map((seg, i) => {
                          const totalDuration = 12.0; // Mocked total duration
                          const left = (seg.startTime / totalDuration) * 100;
                          const width = ((seg.endTime - seg.startTime) / totalDuration) * 100;
                          const isA = seg.speakerId === 'דובר א';
                          return (
                            <div 
                              key={i}
                              className={`absolute h-full flex items-center justify-center text-[10px] font-mono text-white/90 border-r border-background/20 transition-all ${isA ? 'bg-purple-600' : 'bg-blue-600'}`}
                              style={{ left: `${left}%`, width: `${width}%` }}
                              title={`${seg.speakerId} (${seg.startTime}s - ${seg.endTime}s)`}
                              dir="rtl"
                            >
                              {width > 10 ? seg.speakerId : ''}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-2 font-mono" dir="ltr">
                        <span>0.0s</span>
                        <span>12.0s</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pitch Chart */}
                <Card className="md:col-span-3 lg:col-span-1">
                  <CardHeader>
                    <CardTitle>השתנות גובה צליל (Hz)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formatChartData(latestReport.pitchVariation)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="time" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={['dataMin - 20', 'dataMax + 20']} stroke="#666" fontSize={12} tickLine={false} axisLine={false} orientation="right" />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                          itemStyle={{ color: '#a855f7' }}
                        />
                        <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Speed Chart */}
                <Card className="md:col-span-3 lg:col-span-1">
                  <CardHeader>
                    <CardTitle>קצב דיבור (WPM)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={formatChartData(latestReport.speedVariation)}>
                        <defs>
                          <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="time" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={['dataMin - 10', 'dataMax + 10']} stroke="#666" fontSize={12} tickLine={false} axisLine={false} orientation="right" />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                          itemStyle={{ color: '#3b82f6' }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSpeed)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Volume Chart */}
                <Card className="md:col-span-3 lg:col-span-1">
                  <CardHeader>
                    <CardTitle>מעטפת עוצמת קול (dB)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={formatChartData(latestReport.volumeVariation)}>
                        <defs>
                          <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="time" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={['dataMin - 10', 'dataMax + 10']} stroke="#666" fontSize={12} tickLine={false} axisLine={false} orientation="right" />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                          itemStyle={{ color: '#10b981' }}
                        />
                        <Area type="step" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorVol)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>

      {performanceData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                זמני סינתזה ממוצעים לפי מודל (IndexedDB)
              </CardTitle>
              <CardDescription>
                השוואת ביצועים לזמן יצירת אודיו פר מודל קולי
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} orientation="right" />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  />
                  <Legend />
                  <Bar dataKey="זמן ממוצע (ms)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {trendData.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  מגמת זמני סינתזה לאורך זמן
                </CardTitle>
                <CardDescription>
                  שינוי במהירות יצירת השמע (במילישניות) לפי תאריך
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="date" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} orientation="right" />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                    />
                    <Legend />
                    {voiceProfiles.map((p, idx) => {
                      const colors = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6'];
                      const strokeColor = colors[idx % colors.length];
                      return (
                        <Line 
                          key={p.id}
                          type="monotone" 
                          dataKey={p.name} 
                          stroke={strokeColor} 
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedProfileId && (
        <div className="mt-8">
          <CollaborativeNotes 
            documentId={`profile-notes-${selectedProfileId}`} 
            currentUser={currentUser} 
          />
        </div>
      )}
    </div>
  );
}
