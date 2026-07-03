import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';

interface WaveformComparisonProps {
  sourceBlob: Blob;
  generatedBlob: Blob;
  sourceLabel?: string;
  generatedLabel?: string;
}

export default function WaveformComparison({ sourceBlob, generatedBlob, sourceLabel = 'הקלטת מקור', generatedLabel = 'דגימה מסונתזת' }: WaveformComparisonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processAudio = async () => {
      setIsProcessing(true);
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Process source
        const sourceBuffer = await sourceBlob.arrayBuffer();
        const sourceData = await audioCtx.decodeAudioData(sourceBuffer);
        const sourceChannelData = sourceData.getChannelData(0);

        // Process generated
        const generatedBuffer = await generatedBlob.arrayBuffer();
        const generatedData = await audioCtx.decodeAudioData(generatedBuffer);
        const generatedChannelData = generatedData.getChannelData(0);

        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw
        const drawWaveform = (data: Float32Array, color: string, offsetY: number, heightScale: number) => {
          const step = Math.ceil(data.length / canvas.width);
          const amp = canvas.height * heightScale;
          
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          
          for (let i = 0; i < canvas.width; i++) {
            let min = 1.0;
            let max = -1.0;
            
            for (let j = 0; j < step; j++) {
              const datum = data[(i * step) + j];
              if (datum < min) min = datum;
              if (datum > max) max = datum;
            }
            
            const y1 = offsetY + (min * amp);
            const y2 = offsetY + (max * amp);
            
            ctx.moveTo(i, y1);
            ctx.lineTo(i, y2);
          }
          ctx.stroke();
        };

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        // Draw waveforms superimposed
        // Source in blue, generated in green
        drawWaveform(sourceChannelData, 'rgba(59, 130, 246, 0.7)', canvas.height / 2, 0.4); // Blue-500
        drawWaveform(generatedChannelData, 'rgba(34, 197, 94, 0.7)', canvas.height / 2, 0.4); // Green-500

      } catch (err) {
        console.error('Error drawing waveforms:', err);
      } finally {
        setIsProcessing(false);
      }
    };

    processAudio();
  }, [sourceBlob, generatedBlob]);

  return (
    <Card className="p-4 bg-slate-900 border-slate-800">
      <div className="flex justify-between items-center mb-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-blue-400">{sourceLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-400">{generatedLabel}</span>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
      </div>
      <div className="relative rounded-lg overflow-hidden border border-slate-800">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={200} 
          className="w-full h-[200px]"
        />
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <span className="text-sm text-slate-300 animate-pulse font-mono">מעבד גלי קול...</span>
          </div>
        )}
      </div>
    </Card>
  );
}
