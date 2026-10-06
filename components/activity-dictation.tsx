"use client";

import { type Ref, useEffect, useId, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { createDictationSession, type DictationRecognitionConstructor, type DictationSnapshot } from "@/lib/activity-dictation";

export type ActivityDictationHandle = { stop: () => void; cancel: () => void; hasPending: () => boolean };
const emptySnapshot: DictationSnapshot = { status: "idle", finalText: "", interimText: "", error: "", truncated: false };
const subscribe = () => () => {};
function recognitionConstructor(): DictationRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const browser = window as unknown as { SpeechRecognition?: DictationRecognitionConstructor; webkitSpeechRecognition?: DictationRecognitionConstructor };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}

export function ActivityDictation({ ref, maxLength, onApply }: {
  ref?: Ref<ActivityDictationHandle>;
  maxLength: number;
  onApply: (transcript: string) => string | undefined;
}) {
  const supported = useSyncExternalStore(subscribe, () => Boolean(recognitionConstructor()), () => false);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [draft, setDraft] = useState("");
  const [applyError, setApplyError] = useState("");
  const session = useRef<ReturnType<typeof createDictationSession> | null>(null);
  const descriptionId = useId();
  const active = snapshot.status === "listening" || snapshot.status === "stopping";

  useEffect(() => () => session.current?.dispose(), []);
  useImperativeHandle(ref, () => ({
    stop: () => session.current?.stop(),
    cancel: () => session.current?.dispose(),
    hasPending: () => active || Boolean(draft.trim()),
  }), [active, draft]);

  const start = () => {
    const Recognition = recognitionConstructor();
    if (!Recognition || active || draft.trim()) return;
    session.current?.dispose();
    setApplyError("");
    session.current = createDictationSession({
      createRecognition: () => new Recognition(),
      maxLength,
      language: document.documentElement.lang || navigator.language || "en-US",
      onChange: (next) => { setSnapshot(next); setDraft(next.finalText); },
    });
    session.current.start();
  };
  const discard = () => {
    session.current?.dispose();
    session.current = null;
    setSnapshot(emptySnapshot);
    setDraft("");
    setApplyError("");
  };
  const apply = () => {
    if (active) return;
    const error = onApply(draft);
    if (error) { setApplyError(error); return; }
    discard();
  };

  return <details className="activity-dictation" onToggle={(event) => { if (!event.currentTarget.open) session.current?.stop(); }}>
    <summary>Dictate notes (optional)</summary>
    <div className="activity-dictation-body">
      <p id={descriptionId} className="page-description">Starting dictation turns on your microphone. Your browser or its speech provider may process audio online. Spej OS does not store recordings. Review the text, then apply it to your notes. Saving an activity only logs it; it never sends a message to a contact.</p>
      {!supported ? <p className="page-description">In-app dictation is unavailable in this browser. Type or paste in Outcome / context, or use your device’s keyboard dictation.</p> : <>
        <div className="activity-dictation-actions">
          <button type="button" className="button button-ghost" aria-describedby={descriptionId} disabled={active || Boolean(draft.trim())} onClick={start}>Start dictation</button>
          {active && <button type="button" className="button button-ghost" disabled={snapshot.status === "stopping"} onClick={() => session.current?.stop()}>{snapshot.status === "stopping" ? "Stopping…" : "Stop dictation"}</button>}
          {(active || draft || snapshot.error) && <button type="button" className="button button-ghost" onClick={discard}>Discard dictation</button>}
        </div>
        <p role="status" className="activity-dictation-status">{snapshot.status === "listening" ? "Listening — say your notes. Stop to review and apply them." : snapshot.status === "stopping" ? "Finishing transcription… You can discard to stop immediately." : snapshot.status === "ready" ? draft ? "Stopped. Review the transcript before applying it." : "Stopped. No confirmed speech was captured; type/paste notes or try again." : "Dictation starts only when you choose Start dictation."}</p>
        {(active || draft) && <label>Dictation preview<textarea value={draft} maxLength={maxLength} readOnly={active} rows={5} onChange={(event) => { setDraft(event.target.value); setApplyError(""); }}/></label>}
        {snapshot.interimText && <p className="activity-dictation-interim">Still being recognized: {snapshot.interimText}</p>}
        {snapshot.truncated && <p role="alert">The dictation limit was reached and recording stopped. Some words may not be included; check the transcript before applying.</p>}
        {snapshot.error && <p role="alert">{snapshot.error}</p>}
        {applyError && <p role="alert">{applyError}</p>}
        {draft && <button type="button" className="button button-ghost" disabled={active} onClick={apply}>Apply to notes</button>}
      </>}
    </div>
  </details>;
}
