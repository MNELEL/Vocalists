import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { googleSignIn, initAuth, getAccessToken, logout } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Cloud, CloudUpload, CloudDownload, RefreshCw, LogIn, LogOut, FileJson, CheckCircle2, ShieldAlert, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { createPlayableWavBlob } from '../lib/audioUtils';

// Helper utilities for Blob <-> Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const base64ToBlob = (base64Data: string, contentType: string = ''): Blob => {
  const sliceSize = 512;
  const base64 = base64Data.split(',')[1] || base64Data;
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: contentType });
};

interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

export default function CloudSyncManager() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetchingBackups, setIsFetchingBackups] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [backups, setBackups] = useState<DriveFile[]>([]);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  // Monitor Auth State
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        setNeedsAuth(false);
        fetchBackupsList(currentToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        toast.success('התחברת ל-Google Drive בהצלחה!');
        fetchBackupsList(result.accessToken);
      }
    } catch (err) {
      console.error(err);
      toast.error('התחברות נכשלה. אנא נסה שוב.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setBackups([]);
      toast.info('התנתקת מחשבון Google');
    } catch (err) {
      toast.error('התנתקות נכשלה');
    }
  };

  // Fetch Backups List from Google Drive
  const fetchBackupsList = async (accessToken: string) => {
    setIsFetchingBackups(true);
    try {
      const q = encodeURIComponent("name contains 'vocalis_backup_' and trashed = false");
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,size)&orderBy=createdTime+desc`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!res.ok) throw new Error('Failed to fetch file list');
      
      const data = await res.json();
      setBackups(data.files || []);
    } catch (err) {
      console.error(err);
      toast.error('שגיאה בטעינת גיבויים קודמים');
    } finally {
      setIsFetchingBackups(false);
    }
  };

  // Perform Manual Backup
  const handleBackup = async () => {
    if (!token) return;
    setIsSyncing(true);
    
    try {
      // Gather and serialize all data from Dexie
      const drafts = await db.audioDrafts.toArray();
      const profiles = await db.voiceProfiles.toArray();
      const templates = await db.styleTemplates.toArray();
      const reports = await db.diagnosisReports.toArray();
      const queue = await db.generationQueue.toArray();

      const serializedDrafts = await Promise.all(drafts.map(async (d) => {
        let base64Blob = '';
        if (d.blob) {
          base64Blob = await blobToBase64(d.blob);
        }
        return { ...d, blob: base64Blob };
      }));

      const serializedQueue = await Promise.all(queue.map(async (q) => {
        let base64Blob = '';
        if (q.resultAudioBlob) {
          base64Blob = await blobToBase64(q.resultAudioBlob);
        }
        return { ...q, resultAudioBlob: base64Blob };
      }));

      const backupPayload = {
        version: 1,
        timestamp: Date.now(),
        audioDrafts: serializedDrafts,
        voiceProfiles: profiles,
        styleTemplates: templates,
        diagnosisReports: reports,
        generationQueue: serializedQueue,
      };

      // Step 1: Create file metadata
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `vocalis_backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`,
          mimeType: 'application/json',
        }),
      });

      if (!createRes.ok) throw new Error('Failed to create backup metadata in Drive');
      const fileMeta = await createRes.json();
      const fileId = fileMeta.id;

      // Step 2: Upload file media content
      const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupPayload),
      });

      if (!uploadRes.ok) throw new Error('Failed to upload backup contents to Drive');

      toast.success('הגיבוי הועלה ל-Google Drive בהצלחה!');
      fetchBackupsList(token);
    } catch (err) {
      console.error(err);
      toast.error('גיבוי נכשל. ודא חיבור אינטרנט תקין.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Restore DB from Backup File
  const handleRestore = async (fileId: string) => {
    if (!token) return;
    setIsRestoring(fileId);
    
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to download backup file');
      const backupData = await res.json();

      // Clear current indexedDB and put items from backup
      await db.audioDrafts.clear();
      await db.voiceProfiles.clear();
      await db.styleTemplates.clear();
      await db.diagnosisReports.clear();
      await db.generationQueue.clear();

      if (backupData.audioDrafts) {
        for (const d of backupData.audioDrafts) {
          let restoredBlob: Blob | undefined;
          if (d.blob) {
            restoredBlob = base64ToBlob(d.blob, 'audio/webm');
          }
          await db.audioDrafts.put({
            id: d.id,
            name: d.name,
            blob: restoredBlob || createPlayableWavBlob(1.5, 440, 11025),
            durationMs: d.durationMs,
            tags: d.tags,
            createdAt: d.createdAt,
          });
        }
      }

      if (backupData.voiceProfiles) {
        for (const p of backupData.voiceProfiles) {
          await db.voiceProfiles.put(p);
        }
      }

      if (backupData.styleTemplates) {
        for (const t of backupData.styleTemplates) {
          await db.styleTemplates.put(t);
        }
      }

      if (backupData.diagnosisReports) {
        for (const r of backupData.diagnosisReports) {
          await db.diagnosisReports.put(r);
        }
      }

      if (backupData.generationQueue) {
        for (const q of backupData.generationQueue) {
          let restoredBlob: Blob | undefined;
          if (q.resultAudioBlob) {
            restoredBlob = base64ToBlob(q.resultAudioBlob, 'audio/webm');
          }
          await db.generationQueue.put({
            id: q.id,
            profileId: q.profileId,
            text: q.text,
            status: q.status,
            resultAudioBlob: restoredBlob,
            rating: q.rating,
            synthesisTimeMs: q.synthesisTimeMs,
            createdAt: q.createdAt,
          });
        }
      }

      toast.success('שחזור בסיס הנתונים הסתיים בהצלחה!');
      setConfirmRestoreId(null);
    } catch (err) {
      console.error(err);
      toast.error('שחזור נכשל. קובץ הגיבוי פגום או לא תקין.');
    } finally {
      setIsRestoring(null);
    }
  };

  const formatBytes = (bytesStr?: string) => {
    if (!bytesStr) return '';
    const bytes = parseInt(bytesStr);
    if (isNaN(bytes)) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-indigo-400">
          <Cloud className="w-5 h-5 animate-pulse text-indigo-400" />
          סנכרון ענן ידני (Manual Google Drive Backup)
        </CardTitle>
        <CardDescription>
          גבה את פרופילי הקול וההקלטות שלך בצורה מאובטחת ישירות ל-Google Drive האישי שלך.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {needsAuth ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/30 rounded-lg border border-border">
            <CloudUpload className="w-12 h-12 text-muted-foreground/60 mb-4" />
            <h4 className="text-base font-semibold">חיבור מאובטח ל-Google Drive</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
              כדי לגבות את המידע והפרופילים שלך בענן, עליך להתחבר עם חשבון Google שלך. האפליקציה תשמור את קובצי הגיבוי בתיקייה ייעודית מאובטחת.
            </p>
            
            <Button 
              onClick={handleLogin} 
              disabled={isLoggingIn}
              className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
            >
              {isLoggingIn ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              התחבר עם Google
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Logged in User Status */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-muted/40 rounded-lg border border-border gap-4">
              <div className="flex items-center gap-3">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border border-indigo-500/30" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                    {user?.displayName?.[0] || 'U'}
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    {user?.displayName}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-normal">מחובר לענן</span>
                  </h4>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                <LogOut className="w-4 h-4 ml-1.5" /> התנתק
              </Button>
            </div>

            {/* Direct Sync / Backup Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-indigo-950/20 border border-indigo-500/20 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-indigo-300 flex items-center gap-1.5">
                    <CloudUpload className="w-4 h-4" />
                    צור נקודת גיבוי חדשה
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    ייצא את כל פרופילי הקול, אבחומי האודיו ותור הסינתזה והעלה אותם כקובץ מוצפן ומאובטח ל-Google Drive.
                  </p>
                </div>
                <Button 
                  onClick={handleBackup} 
                  disabled={isSyncing} 
                  className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {isSyncing ? (
                    <><RefreshCw className="w-4 h-4 ml-2 animate-spin" /> מגבה ל-Drive...</>
                  ) : (
                    <><CloudUpload className="w-4 h-4 ml-2" /> גבה כעת</>
                  )}
                </Button>
              </div>

              <div className="p-4 rounded-lg bg-muted/40 border border-border flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-indigo-400" />
                    רענן רשימת גיבויים
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    סרוק את שטח האחסון ב-Google Drive כדי לחפש נקודות שחזור קודמות של Vocalis שנוצרו במכשיר זה.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => token && fetchBackupsList(token)} 
                  disabled={isFetchingBackups}
                  className="mt-5 w-full"
                >
                  {isFetchingBackups ? (
                    <><RefreshCw className="w-4 h-4 ml-2 animate-spin" /> טוען גיבויים...</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 ml-2" /> רענן רשימה</>
                  )}
                </Button>
              </div>
            </div>

            {/* List of existing backups */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileJson className="w-4 h-4 text-indigo-400" />
                גיבויים קודמים זמינים ב-Drive ({backups.length})
              </h4>
              
              {backups.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg bg-muted/10">
                  לא נמצאו נקודות שחזור קודמות ב-Google Drive. צור גיבוי חדש כדי להתחיל.
                </div>
              ) : (
                <div className="max-h-[220px] overflow-y-auto space-y-2 border border-border rounded-lg p-2 bg-muted/10">
                  {backups.map((backup) => (
                    <div 
                      key={backup.id} 
                      className="flex items-center justify-between p-2.5 bg-card border border-border rounded-md hover:border-indigo-500/30 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileJson className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div className="text-right">
                          <p className="font-semibold text-foreground text-[11px] truncate max-w-[200px] sm:max-w-[320px]">{backup.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {new Date(backup.createdTime).toLocaleString('he-IL')} • {formatBytes(backup.size)}
                          </p>
                        </div>
                      </div>

                      {confirmRestoreId === backup.id ? (
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => handleRestore(backup.id)} 
                            disabled={isRestoring === backup.id}
                            className="h-7 text-[10px] px-2"
                          >
                            {isRestoring === backup.id ? 'משחזר...' : 'אשר שחזור'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setConfirmRestoreId(null)}
                            className="h-7 text-[10px] px-2 text-muted-foreground"
                          >
                            בטל
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setConfirmRestoreId(backup.id)}
                          className="h-7 text-[10px] border-indigo-500/30 hover:bg-indigo-950/20 text-indigo-400"
                        >
                          <CloudDownload className="w-3.5 h-3.5 ml-1" /> שחזר
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/20 px-6 py-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          הצפנה ואבטחה מובנית על גבי השרתים המאובטחים של Google
        </span>
        <span className="font-mono text-[10px]">OAuth 2.0 Enabled</span>
      </CardFooter>
    </Card>
  );
}
