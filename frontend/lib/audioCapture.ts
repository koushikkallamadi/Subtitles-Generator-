export type AudioCaptureProgress = { progress: number; duration: number };

const MAX_DECODE_BYTES = 300 * 1024 * 1024;
const TARGET_SAMPLE_RATE = 16_000;

function toPcmWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);
  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
    const sample = samples[sampleIndex];
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
    offset += bytesPerSample;
  }
  return buffer;
}

/** Decodes locally at native speed, downmixes and resamples to compact mono PCM for transcription. */
export async function captureAudioFromVideo(
  file: File,
  onProgress: (value: AudioCaptureProgress) => void,
): Promise<{ file: File; duration: number }> {
  if (file.size > MAX_DECODE_BYTES) {
    throw new Error("This file is too large for local audio extraction. Use the full-upload fallback.");
  }
  const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const OfflineAudioContextConstructor = window.OfflineAudioContext || (window as typeof window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!AudioContextConstructor || !OfflineAudioContextConstructor) {
    throw new Error("This browser does not support local audio extraction.");
  }

  const startedAt = performance.now();
  let context: AudioContext | null = null;
  try {
    onProgress({ progress: 2, duration: 0 });
    const encodedMedia = await file.arrayBuffer();
    onProgress({ progress: 12, duration: 0 });
    context = new AudioContextConstructor();
    const decoded = await context.decodeAudioData(encodedMedia);
    const duration = decoded.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Could not read the audio duration.");
    onProgress({ progress: 48, duration });

    const mono = new Float32Array(decoded.length);
    const channelScale = 1 / decoded.numberOfChannels;
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const channelData = decoded.getChannelData(channel);
      for (let sample = 0; sample < channelData.length; sample++) mono[sample] += channelData[sample] * channelScale;
    }

    const input = context.createBuffer(1, decoded.length, decoded.sampleRate);
    input.copyToChannel(mono, 0);
    const outputLength = Math.ceil(duration * TARGET_SAMPLE_RATE);
    const offline = new OfflineAudioContextConstructor(1, outputLength, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = input;
    source.connect(offline.destination);
    source.start(0);
    const resampled = await offline.startRendering();
    onProgress({ progress: 88, duration });

    const wav = toPcmWav(resampled.getChannelData(0), TARGET_SAMPLE_RATE);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "audio";
    const audioFile = new File([wav], baseName + ".wav", { type: "audio/wav" });
    onProgress({ progress: 100, duration });
    console.info("Local audio extraction completed", {
      seconds: Number(((performance.now() - startedAt) / 1000).toFixed(3)),
      inputBytes: file.size,
      wavBytes: audioFile.size,
      durationSeconds: Number(duration.toFixed(3)),
    });
    return { file: audioFile, duration };
  } catch (error) {
    throw new Error(error instanceof Error ? "Local audio extraction failed: " + error.message : "Local audio extraction failed.");
  } finally {
    await context?.close().catch(() => undefined);
  }
}
