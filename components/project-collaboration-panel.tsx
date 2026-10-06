"use client";
import { useState, type FormEvent } from "react";
import type { ProjectItem } from "@/lib/types";
import { projectResourceUrl } from "@/lib/project-collaboration";
import { useLocalDay } from "@/lib/use-local-day";
import { developmentStyles as styles } from "./customer-development-styles";

export function ProjectCollaborationPanel({ project, onSave, defaultAuthor }: { project: ProjectItem; onSave: (changes: Partial<ProjectItem>) => void; defaultAuthor: string }) {
  const today = useLocalDay();
  const [note, setNote] = useState({ author: defaultAuthor, occurredOn: today, summary: "", nextStep: "" });
  const [resource, setResource] = useState({ title: "", url: "" });
  const [notice, setNotice] = useState("");
  function addNote(event: FormEvent) {
    event.preventDefault();
    if (!note.author.trim() || !note.summary.trim() || !note.occurredOn || note.occurredOn > today) { setNotice("Add an author, a past or present date, and an update."); return; }
    onSave({ progressUpdates: [...(project.progressUpdates || []), { ...note, id: crypto.randomUUID(), recordedAt: new Date().toISOString() }] });
    setNote({ ...note, summary: "", nextStep: "" }); setNotice("Update queued for saving. Check the workspace save status.");
  }
  function addResource(event: FormEvent) {
    event.preventDefault(); const url = projectResourceUrl(resource.url);
    if (!resource.title.trim() || !url) { setNotice("Use a title and an HTTPS sharing-page link without credentials or download tokens."); return; }
    onSave({ resources: [...(project.resources || []), { id: crypto.randomUUID(), title: resource.title, url, addedAt: new Date().toISOString(), addedBy: defaultAuthor }] });
    setResource({ title: "", url: "" }); setNotice("Resource link queued for saving. The source file has not been copied.");
  }
  return <section className={styles.panel} aria-label={`Progress and resources for ${project.name}`}><details><summary>Progress updates ({project.progressUpdates?.length || 0})</summary><p>Keep dated updates without replacing earlier notes. Names are demo labels, not verified audit identities.</p>{[...(project.progressUpdates || [])].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.recordedAt.localeCompare(a.recordedAt)).map((update) => <article key={update.id} className={styles.panel}><b>{update.occurredOn} · {update.author}</b><p style={{ whiteSpace: "pre-wrap" }}>{update.summary}</p>{update.nextStep && <p><b>Next:</b> {update.nextStep}</p>}</article>)}<form className={styles.editor} onSubmit={addNote}><div className={styles.fields}><label>Update by<input required maxLength={120} value={note.author} onChange={(e) => setNote({ ...note, author: e.target.value })}/></label><label>Progress date<input required type="date" max={today} value={note.occurredOn} onChange={(e) => setNote({ ...note, occurredOn: e.target.value })}/></label><label>Progress / decision / blocker<textarea required maxLength={2000} value={note.summary} onChange={(e) => setNote({ ...note, summary: e.target.value })}/></label><label>Next step<textarea maxLength={2000} value={note.nextStep} onChange={(e) => setNote({ ...note, nextStep: e.target.value })}/></label></div><button className="button button-secondary" disabled={(project.progressUpdates?.length || 0) >= 200}>Add progress update</button></form></details><details><summary>Project files and links ({project.resources?.length || 0})</summary><p>Link to a SharePoint, OneDrive, GitHub or other HTTPS resource. Access stays with the source; this does not upload, copy or grant file access.</p>{project.resources?.map((item) => <p key={item.id}><a href={projectResourceUrl(item.url) || undefined} target="_blank" rel="noopener noreferrer">{item.title} ↗</a></p>)}<form className={styles.editor} onSubmit={addResource}><div className={styles.fields}><label>File / resource title<input required maxLength={200} value={resource.title} onChange={(e) => setResource({ ...resource, title: e.target.value })}/></label><label>HTTPS sharing-page link<input required type="url" maxLength={2000} placeholder="https://…" value={resource.url} onChange={(e) => setResource({ ...resource, url: e.target.value })}/></label></div><button className="button button-secondary" disabled={(project.resources?.length || 0) >= 200}>Attach link</button></form></details>{notice && <p role="status">{notice}</p>}</section>;
}
