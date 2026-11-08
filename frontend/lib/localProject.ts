import { captureAudioFromVideo } from './audioCapture';
import { createAudioProject, uploadProject, type ProjectRecord } from './projects';
import type { TransferProgress } from './uploadRequest';

export type LocalProjectStage = 'extracting' | 'uploading-audio' | 'uploading-video';

/** Uploads compact audio on success; uploads the source video once only when extraction itself fails. */
export async function createProjectFromLocalFile(
  video: File,
  language: string,
  style: string,
  onStage: (stage: LocalProjectStage, progress: number, transfer?: TransferProgress) => void,
  onVideoFallback: () => void,
): Promise<ProjectRecord> {
  let audio: File;
  try {
    audio = (await captureAudioFromVideo(video, ({ progress }) => onStage('extracting', progress))).file;
  } catch {
    onVideoFallback();
    return uploadProject(video, language, style, (progress) => onStage('uploading-video', progress.percent, progress));
  }

  return createAudioProject(video, audio, language, style, (progress) => onStage('uploading-audio', progress.percent, progress));
}
