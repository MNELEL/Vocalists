import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Database, Trash2, HardDrive } from 'lucide-react';
import { toast } from 'sonner';

export default function StorageManager() {
  const [totalUsage, setTotalUsage] = useState(0);
  const [quota, setQuota] = useState(0);
  
  const audioDrafts = useLiveQuery(() => db.audioDrafts.toArray()) || [];
  const voiceProfiles = useLiveQuery(() => db.voiceProfiles.toArray()) || [];
  const generatedQueue = useLiveQuery(() => db.generationQueue.toArray()) || [];

  useEffect(() => {
    const calculateStorage = async () => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          setTotalUsage(estimate.usage || 0);
          setQuota(estimate.quota || 0);
        } catch (err) {
          console.error("Storage estimation failed", err);
        }
      }
    };
    calculateStorage();
    const interval = setInterval(calculateStorage, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [audioDrafts, voiceProfiles, generatedQueue]);

  const handleDeleteOldAudio = async () => {
    try {
      if (audioDrafts.length > 0) {
         const sorted = [...audioDrafts].sort((a, b) => a.createdAt - b.createdAt);
         const toDelete = sorted.slice(0, Math.min(5, sorted.length));
         for (const draft of toDelete) {
           await db.audioDrafts.delete(draft.id);
         }
         toast.success(`נמחקו ${toDelete.length} הקלטות ישנות בהצלחה`);
      } else {
         toast.info("אין הקלטות מקור למחיקה");
      }
    } catch (err) {
      toast.error('מחיקת הקלטות נכשלה');
    }
  };

  const handleDeleteOldSamples = async () => {
    try {
      if (generatedQueue.length > 0) {
         const sorted = [...generatedQueue].sort((a, b) => a.createdAt - b.createdAt);
         const toDelete = sorted.slice(0, Math.min(5, sorted.length));
         for (const sample of toDelete) {
           await db.generationQueue.delete(sample.id);
         }
         toast.success(`נמחקו ${toDelete.length} דגימות קול ישנות בהצלחה`);
      } else {
         toast.info("אין דגימות קול למחיקה");
      }
    } catch (err) {
      toast.error('מחיקת דגימות נכשלה');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const usagePercent = quota > 0 ? (totalUsage / quota) * 100 : 0;

  return (
    <Card className="mt-8 border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          ניהול אחסון מקומי
        </CardTitle>
        <CardDescription>
          צפה בנפח האחסון בשימוש ומחק קבצי אודיו ישנים
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="font-medium text-muted-foreground">ניצול דיסק</span>
          <span>{formatBytes(totalUsage)} מתוך {formatBytes(quota)}</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2.5 mb-6">
          <div 
            className="bg-primary h-2.5 rounded-full transition-all" 
            style={{ width: `${Math.min(100, Math.max(1, usagePercent))}%` }}
          ></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-muted p-3 rounded-md flex items-center justify-between">
            <span className="text-xs text-muted-foreground">הקלטות מקור</span>
            <span className="font-semibold">{audioDrafts.length}</span>
          </div>
          <div className="bg-muted p-3 rounded-md flex items-center justify-between">
            <span className="text-xs text-muted-foreground">פרופילים</span>
            <span className="font-semibold">{voiceProfiles.length}</span>
          </div>
          <div className="bg-muted p-3 rounded-md flex items-center justify-between">
            <span className="text-xs text-muted-foreground">דגימות סונתזו</span>
            <span className="font-semibold">{generatedQueue.length}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 p-4 border-t border-border flex flex-col sm:flex-row gap-4">
        <Button variant="outline" className="w-full sm:w-auto" onClick={handleDeleteOldAudio}>
          <Trash2 className="w-4 h-4 ml-2" />
          מחק הקלטות מקור ישנות (5 הכי ישנות)
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" onClick={handleDeleteOldSamples}>
          <Trash2 className="w-4 h-4 ml-2" />
          מחק דגימות סונתזו ישנות (5 הכי ישנות)
        </Button>
      </CardFooter>
    </Card>
  );
}
