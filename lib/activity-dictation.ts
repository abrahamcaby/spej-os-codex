/** The small browser surface we use, also injectable for microphone-free tests. */
export type DictationResultEvent = {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

export type DictationRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: DictationResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type DictationRecognitionConstructor = new () => DictationRecognition;
export type DictationSnapshot = {
  status: "idle" | "listening" | "stopping" | "ready" | "error";
  finalText: string;
  interimText: string;
  error: string;
  truncated: boolean;
};

export function dictationErrorMessage(code: string): string {
  if (code === "not-allowed" || code === "service-not-allowed" || code === "NotAllowedError") return "Microphone or speech recognition access was denied. You can type, paste, or use your device’s keyboard dictation instead.";
  if (code === "audio-capture") return "No microphone is available. You can still type or paste your notes.";
  if (code === "network") return "The browser’s speech service could not connect. Review any captured text, or type/paste your notes.";
  if (code === "no-speech") return "No speech was detected. You can try again or type/paste your notes.";
  if (code === "language-not-supported") return "The browser’s speech service does not support this language. Use keyboard dictation or type/paste your notes.";
  return "Dictation stopped. Review any captured text, or type/paste your notes.";
}

/** Never starts a microphone until the caller explicitly invokes start(). */
export function createDictationSession({ createRecognition, onChange, maxLength, language = "en-US" }: {
  createRecognition: () => DictationRecognition;
  onChange: (snapshot: DictationSnapshot) => void;
  maxLength: number;
  language?: string;
}) {
  let recognition: DictationRecognition | undefined;
  let disposed = false;
  let snapshot: DictationSnapshot = { status: "idle", finalText: "", interimText: "", error: "", truncated: false };
  const limit = Math.max(0, Math.floor(maxLength));
  const update = (patch: Partial<DictationSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    if (!disposed) onChange(snapshot);
  };
  const detach = () => {
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
  };
  const fail = (code: string) => {
    if (disposed) return;
    detach();
    try { recognition?.abort(); } catch { /* Already stopped by the browser. */ }
    update({ status: "error", interimText: "", error: dictationErrorMessage(code) });
  };
  const stop = () => {
    if (disposed || snapshot.status !== "listening") return;
    update({ status: "stopping" });
    try { recognition?.stop(); } catch { fail("stopped"); }
  };
  return {
    start() {
      if (disposed || recognition) return;
      try {
        recognition = createRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;
        recognition.onresult = (event) => {
          if (disposed || (snapshot.status !== "listening" && snapshot.status !== "stopping")) return;
          // results is the complete session snapshot, not a stream of new text.
          // Rebuilding it avoids duplicated final phrases on repeated events.
          const final: string[] = [];
          const interim: string[] = [];
          for (let index = 0; index < event.results.length; index += 1) {
            const result = event.results[index];
            const text = result[0]?.transcript.trim();
            if (text) (result.isFinal ? final : interim).push(text);
          }
          const finalText = final.join(" ");
          const interimText = interim.join(" ");
          const exceeded = finalText.length + interimText.length > limit;
          update({ finalText: finalText.slice(0, limit), interimText: interimText.slice(0, Math.max(0, limit - finalText.length)), truncated: snapshot.truncated || exceeded });
          if (exceeded) stop();
        };
        recognition.onerror = ({ error }) => fail(error);
        recognition.onend = () => {
          if (!disposed && (snapshot.status === "listening" || snapshot.status === "stopping")) {
            detach();
            update({ status: "ready", interimText: "" });
          }
        };
        update({ status: "listening" });
        recognition.start();
      } catch (error) {
        fail(error instanceof Error ? error.name : "start-failed");
      }
    },
    stop,
    getSnapshot: () => snapshot,
    dispose() {
      if (disposed) return;
      disposed = true;
      detach();
      // abort avoids a late result saving text after cancel, save, or unmount.
      try { recognition?.abort(); } catch { /* Already stopped by the browser. */ }
    },
  };
}

/** Reject overflow rather than silently replacing or truncating existing notes. */
export function appendDictationNotes(current: string, transcript: string, maxLength: number): { value: string; applied: boolean; error: string } {
  const text = transcript.trim();
  if (!text) return { value: current, applied: false, error: "There is no transcript to apply yet." };
  const combined = `${current}${current && !current.endsWith("\n") ? "\n\n" : ""}${text}`;
  if (combined.length > maxLength) return { value: current, applied: false, error: `These notes would exceed ${maxLength.toLocaleString("en-US")} characters. Shorten the transcript or notes before applying; your existing notes have not changed.` };
  return { value: combined, applied: true, error: "" };
}
