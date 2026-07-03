import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CollaborativeNotesProps {
  documentId: string;
  currentUser: { uid: string; fullName: string; username: string } | null;
}

export default function CollaborativeNotes({ documentId, currentUser }: CollaborativeNotesProps) {
  const [content, setContent] = useState('');
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const isLocalUpdateRef = useRef(false);

  useEffect(() => {
    if (!currentUser || !documentId) return;

    // Determine WS URL based on current host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3000`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'join',
        docId: documentId,
        userInfo: currentUser
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          if (data.state && data.state.content) {
            setContent(data.state.content);
          }
        } else if (data.type === 'update') {
          isLocalUpdateRef.current = false;
          if (data.state && data.state.content !== undefined) {
            setContent(data.state.content);
          }
        } else if (data.type === 'cursor') {
          setActiveUsers(prev => {
            if (!prev.includes(data.user.fullName)) {
              return [...prev, data.user.fullName];
            }
            return prev;
          });
          // Remove after 5 seconds of inactivity
          setTimeout(() => {
            setActiveUsers(prev => prev.filter(name => name !== data.user.fullName));
          }, 5000);
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    ws.onerror = () => {
      toast.error('שגיאה בחיבור בזמן אמת לשרת עריכה משותפת');
    };

    return () => {
      ws.close();
    };
  }, [documentId, currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    isLocalUpdateRef.current = true;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update',
        state: { content: newContent }
      }));
      wsRef.current.send(JSON.stringify({
        type: 'cursor'
      }));
    }
  };

  if (!currentUser) {
    return (
      <Card className="border-indigo-100 bg-white/50 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center text-indigo-950/60">
          <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
          <p>יש להתחבר לחשבון גוגל כדי לצפות ולערוך הערות משותפות.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-indigo-200 shadow-md">
      <CardHeader className="bg-indigo-50/50 pb-3 border-b border-indigo-100">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              הערות שיתופיות בזמן אמת
            </CardTitle>
            <CardDescription className="text-xs">
              כל שינוי נשמר ומסונכרן אוטומטית לכל שאר המשתמשים בחדר ({documentId})
            </CardDescription>
          </div>
          <div className="flex gap-1 items-center">
             <span className="relative flex h-2.5 w-2.5 mr-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
             </span>
             <span className="text-[10px] text-indigo-950/50 font-bold">מחובר</span>
          </div>
        </div>
        {activeUsers.length > 0 && (
          <div className="flex gap-2 items-center mt-2 text-[10px] text-indigo-600 font-bold bg-indigo-500/10 w-fit px-2 py-1 rounded-full">
            <Users className="w-3 h-3" />
            צופים כעת: {activeUsers.join(', ')}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <textarea 
          className="w-full min-h-[250px] p-4 text-sm bg-transparent resize-none focus:outline-none placeholder:text-indigo-950/30"
          placeholder="התחל להקליד כאן... (השינויים יופיעו אצל כל מי שפתוח אצלו המסך)"
          value={content}
          onChange={handleChange}
          dir="rtl"
        />
      </CardContent>
    </Card>
  );
}
