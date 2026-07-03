/**
 * Generates a valid, playable, mathematically exact PCM WAV audio blob.
 * This ensures standard HTML5 audio players can play, pause, seek, and analyze
 * the generated file without throwing "no supported sources" or browser format errors.
 */
export function createPlayableWavBlob(
  durationSeconds: number = 1.5,
  frequency: number = 440,
  sampleRate: number = 11025
): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const subchunk2Size = numSamples * numChannels * (bitsPerSample / 8);
  const chunkSize = 36 + subchunk2Size;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const buffer = new ArrayBuffer(44 + subchunk2Size);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint8(0, 0x52); // R
  view.setUint8(1, 0x49); // I
  view.setUint8(2, 0x46); // F
  view.setUint8(3, 0x46); // F
  
  // file length
  view.setUint32(4, chunkSize, true);

  // WAVE identifier
  view.setUint8(8, 0x57);  // W
  view.setUint8(9, 0x41);  // A
  view.setUint8(10, 0x56); // V
  view.setUint8(11, 0x45); // E

  // subchunk 1 identifier ('fmt ')
  view.setUint8(12, 0x66); // f
  view.setUint8(13, 0x6d); // m
  view.setUint8(14, 0x74); // t
  view.setUint8(15, 0x20); // ' '

  // subchunk 1 size (16)
  view.setUint32(16, 16, true);

  // audio format (1 = PCM)
  view.setUint16(20, 1, true);

  // number of channels
  view.setUint16(22, numChannels, true);

  // sample rate
  view.setUint32(24, sampleRate, true);

  // byte rate
  view.setUint32(28, byteRate, true);

  // block align
  view.setUint16(32, blockAlign, true);

  // bits per sample
  view.setUint16(34, bitsPerSample, true);

  // subchunk 2 identifier ('data')
  view.setUint8(36, 0x64); // d
  view.setUint8(37, 0x61); // a
  view.setUint8(38, 0x74); // t
  view.setUint8(39, 0x61); // a

  // subchunk 2 size
  view.setUint32(40, subchunk2Size, true);

  // Write sine wave samples (with a sweet smooth fade-out to prevent clicks)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Base frequency
    let sample = Math.sin(2 * Math.PI * frequency * t);
    
    // Add harmonic elements to make it sound a bit richer/warmer, like actual synthesized speech
    sample += 0.3 * Math.sin(2 * Math.PI * (frequency * 2) * t);
    sample += 0.15 * Math.sin(2 * Math.PI * (frequency * 3) * t);
    
    // Normalize amplitude
    sample = sample / 1.45;

    // Apply soft attack and decay envelope to make it smooth
    let envelope = 1.0;
    const attackSamples = sampleRate * 0.15; // 150ms attack
    const decaySamples = sampleRate * 0.3; // 300ms decay
    
    if (i < attackSamples) {
      envelope = i / attackSamples;
    } else if (i > numSamples - decaySamples) {
      envelope = (numSamples - i) / decaySamples;
    }
    
    sample *= envelope;

    // Scale to 16-bit signed integer (-32768 to 32767)
    const val = Math.floor(sample * 30000);
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Decodes and analyzes an audio blob locally, returning a list of suggested metadata tags.
 */
export async function analyzeAudioAndSuggestTags(blob: Blob): Promise<string[]> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const duration = audioBuffer.duration;
    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;
    
    // Calculate RMS & Noise Floor
    let sumSquares = 0;
    let silentSumSquares = 0;
    let silentCount = 0;
    let peak = 0;
    
    // Stride to be extremely fast
    const stride = Math.max(1, Math.floor(totalSamples / 4000));
    const noiseThreshold = 0.015; // Silence threshold
    
    for (let i = 0; i < totalSamples; i += stride) {
      const val = channelData[i];
      const absVal = Math.abs(val);
      if (absVal > peak) peak = absVal;
      sumSquares += val * val;
      
      if (absVal < noiseThreshold) {
        silentSumSquares += val * val;
        silentCount++;
      }
    }
    
    const totalCalculated = totalSamples / stride;
    const rms = Math.sqrt(sumSquares / totalCalculated);
    const silentRms = silentCount > 0 ? Math.sqrt(silentSumSquares / silentCount) : 0;
    
    const tags: string[] = [];
    
    // 1. Suggest duration tag
    if (duration < 3) {
      tags.push("שמע קצר מאוד");
    } else if (duration < 10) {
      tags.push("שמע קצר");
    } else if (duration < 30) {
      tags.push("שמע בינוני");
    } else {
      tags.push("שמע ארוך");
    }
    tags.push(`${Math.round(duration)} שנ'`);
    
    // 2. Suggest ambient noise level tag
    // Convert silentRms to decibels to understand noise floor
    const noiseFloorDb = silentRms > 0 ? 20 * Math.log10(silentRms) : -100;
    if (noiseFloorDb < -50) {
      tags.push("סביבה שקטה");
    } else if (noiseFloorDb < -35) {
      tags.push("רעש רקע נמוך");
    } else {
      tags.push("רעש רקע בינוני");
    }
    
    // 3. Pitch detection for voice category suggestion
    let estimatedPitchHz = 0;
    const pitchSamples = channelData.slice(0, Math.min(totalSamples, 4096));
    const r = new Float32Array(pitchSamples.length);
    for (let lag = 0; lag < r.length; lag++) {
      let sum = 0;
      for (let i = 0; i < r.length - lag; i++) {
        sum += pitchSamples[i] * pitchSamples[i + lag];
      }
      r[lag] = sum;
    }
    
    let peakIndex = -1;
    let peakValue = -1;
    const sampleRate = audioBuffer.sampleRate;
    const minLag = Math.floor(sampleRate / 400); // ~400Hz max pitch
    const maxLag = Math.floor(sampleRate / 70);  // ~70Hz min pitch
    for (let lag = minLag; lag < maxLag; lag++) {
      if (r[lag] > r[lag - 1] && r[lag] > r[lag + 1]) {
        if (peakIndex === -1 || r[lag] > peakValue) {
          peakIndex = lag;
          peakValue = r[lag];
        }
      }
    }
    if (peakIndex !== -1) {
      estimatedPitchHz = Math.round(sampleRate / peakIndex);
    }
    
    if (estimatedPitchHz > 0) {
      if (estimatedPitchHz > 185) {
        tags.push("גבוה"); // 'high-pitched'
      } else if (estimatedPitchHz < 120) {
        tags.push("עמוק"); // 'deep'
      }
    }

    // 4. Basic breathful detection: estimate by checking peak/RMS ratio
    // Breathful voices often have a lower peak/RMS ratio (more constant energy)
    if (rms > 0) {
      const crestFactor = peak / rms;
      if (crestFactor < 3.5) {
        tags.push("אוורירי"); // 'breathful'
      }
    }
    
    audioContext.close();
    return tags;
  } catch (err) {
    console.error("Auto tagging analysis failed", err);
    // Return standard fallback tags based on size if decodeAudioData fails (e.g., file not decoded)
    const fallbackTags = ["קובץ שמע"];
    if (blob.size < 50000) {
      fallbackTags.push("שמע קצר");
    } else {
      fallbackTags.push("שמע ארוך");
    }
    return fallbackTags;
  }
}
