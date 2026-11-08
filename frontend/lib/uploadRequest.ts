export type TransferProgress = {
  loaded: number;
  total: number;
  percent: number;
  bytesPerSecond: number;
  secondsRemaining: number | null;
  waking: boolean;
};

export function postFormWithProgress<T>(url: string, body: FormData, onProgress: (progress: TransferProgress) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const startedAt = performance.now();
    let hasSentBytes = false;
    let finished = false;
    const wakeTimer = window.setTimeout(() => {
      if (!hasSentBytes && !finished) onProgress({ loaded: 0, total: 0, percent: 0, bytesPerSecond: 0, secondsRemaining: null, waking: true });
    }, 5000);

    request.open("POST", url);
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      hasSentBytes ||= event.loaded > 0;
      const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
      const bytesPerSecond = event.loaded / elapsedSeconds;
      onProgress({
        loaded: event.loaded,
        total: event.lengthComputable ? event.total : 0,
        percent: event.lengthComputable ? Math.round(event.loaded / event.total * 100) : 0,
        bytesPerSecond,
        secondsRemaining: event.lengthComputable && bytesPerSecond > 0 ? (event.total - event.loaded) / bytesPerSecond : null,
        waking: false,
      });
    };
    request.onload = () => {
      finished = true;
      window.clearTimeout(wakeTimer);
      if (request.status >= 200 && request.status < 300) {
        try { resolve(JSON.parse(request.responseText) as T); }
        catch { reject(new Error("The server returned an invalid response.")); }
        return;
      }
      let message = `${request.status} ${request.statusText}`;
      try { message = JSON.parse(request.responseText).detail || message; } catch { /* Keep the HTTP status. */ }
      reject(new Error(message));
    };
    request.onerror = () => { finished = true; window.clearTimeout(wakeTimer); reject(new Error("Upload failed. Check your connection and try again.")); };
    request.onabort = () => { finished = true; window.clearTimeout(wakeTimer); reject(new Error("Upload was cancelled.")); };
    request.send(body);
  });
}
