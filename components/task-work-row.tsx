"use client";

import { useId } from "react";
import { ArrowUpRight, Check, ChevronDown, Clock3, LockKeyhole, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { TASK_PRIORITIES, WORK_STATUSES, taskCategoryForDisplay, taskVisibility } from "@/lib/tasks";
import type { TaskItem } from "@/lib/types";

export type WorkTaskRowProps = {
  task: TaskItem;
  workspaceLabel: string;
  visibilityLabel: string;
  dueLabel: string;
  dueToday: boolean;
  focused?: boolean;
  isSubtask?: boolean;
  canEdit: boolean;
  canChangeOwner: boolean;
  owners: string[];
  remainingChildren: number;
  hasOpenChildren: boolean;
  totalChildren: number;
  expanded: boolean;
  relatedLabel?: string;
  onOpenRelated?: () => void;
  onComplete: () => void;
  onToggleChildren?: () => void;
  onEdit: () => void;
  onAddSubtask?: () => void;
  onDelete: () => void;
  onOwnerChange: (value: string) => void;
  onStatusChange: (value: NonNullable<TaskItem["status"]>) => void;
  onPriorityChange: (value: TaskItem["priority"]) => void;
};

/** Layout only: the parent owns record visibility, authorization, and writes. */
export function WorkTaskRow({
  task, workspaceLabel, visibilityLabel, dueLabel, dueToday, focused = false,
  isSubtask = false, canEdit, canChangeOwner, owners, remainingChildren,
  hasOpenChildren, totalChildren, expanded, relatedLabel, onOpenRelated,
  onComplete, onToggleChildren, onEdit, onAddSubtask, onDelete,
  onOwnerChange, onStatusChange, onPriorityChange,
}: WorkTaskRowProps) {
  const id = useId();
  const currentOwner = task.owner || "Unassigned";
  const ownerOptions = Array.from(new Set([currentOwner, ...owners]));
  const completionDisabled = !canEdit || hasOpenChildren || task.done;
  const completionLabel = task.done ? `${task.title} is complete`
    : !canEdit ? `${task.title} is read only`
      : hasOpenChildren ? `Complete open subtasks before completing ${task.title}`
        : task.recurrence === "One-time" ? `Complete ${task.title}` : `Complete and reschedule ${task.title}`;
  const ownerDisabled = !canEdit || !canChangeOwner;
  const rowClass = ["work-task-row", focused && "is-focused", isSubtask && "is-subtask", task.done && "is-complete"].filter(Boolean).join(" ");

  return <article className={rowClass} aria-labelledby={`${id}-title`}>
    <div className="work-task-leading">
      <button type="button" className="work-task-complete" disabled={completionDisabled} aria-label={completionLabel} title={completionLabel} onClick={onComplete}>
        <Check size={16} aria-hidden="true"/>
      </button>
      {!isSubtask && totalChildren > 0 && onToggleChildren ? <button type="button" className="work-task-expand" aria-label={`${expanded ? "Hide" : "Show"} subtasks for ${task.title}`} aria-expanded={expanded} onClick={onToggleChildren}>
        <ChevronDown size={16} aria-hidden="true"/>
      </button> : null}
    </div>

    <div className="work-task-content">
      <header className="work-task-heading">
        <h3 className="work-task-title" id={`${id}-title`}>{task.title}</h3>
        <div className="work-task-badges">
          <span className="work-task-badge work-task-badge-workspace">{workspaceLabel}</span>
          <span className="work-task-badge work-task-badge-category">{taskCategoryForDisplay(task)}</span>
          <span className="work-task-badge work-task-badge-visibility">{visibilityLabel}</span>
          {isSubtask ? <span className="work-task-badge">Subtask</span> : totalChildren > 0 ? <span className="work-task-badge">Task group</span> : null}
        </div>
      </header>
      {task.description ? <p className="work-task-description">{task.description}</p> : null}
      {!canEdit ? <p className="work-task-readonly"><LockKeyhole size={13} aria-hidden="true"/> Read only in this view. Task changes are unavailable.</p> : null}

      <fieldset className="work-task-fields">
        <legend className="work-task-sr-only">Task settings for {task.title}</legend>
        <label className="work-task-field">
          <span className="work-task-field-label">Owner</span>
          <select className="work-task-owner" aria-label={`Owner for ${task.title}`} value={currentOwner} disabled={ownerDisabled} title={ownerDisabled ? "Owner changes are unavailable in this view" : undefined} onChange={(event) => onOwnerChange(event.target.value)}>
            {ownerOptions.map((owner) => <option key={owner} value={owner} disabled={taskVisibility(task) === "Private" && owner === "Unassigned"}>{owner}</option>)}
          </select>
        </label>
        <label className="work-task-field">
          <span className="work-task-field-label">Status</span>
          <select className="work-task-status" aria-label={`Status for ${task.title}`} value={task.status || "Not Started"} disabled={!canEdit} onChange={(event) => onStatusChange(event.target.value as NonNullable<TaskItem["status"]>)}>
            {WORK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="work-task-field">
          <span className="work-task-field-label">Priority</span>
          <select className={`work-task-priority work-task-priority-${task.priority.toLowerCase()}`} aria-label={`Priority for ${task.title}`} value={task.priority} disabled={!canEdit} onChange={(event) => onPriorityChange(event.target.value as TaskItem["priority"])}>
            {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>
        <div className="work-task-field work-task-due-field">
          <span className="work-task-field-label" id={`${id}-due-label`}>Due</span>
          {canEdit ? <button type="button" className={`work-task-due-value${dueToday ? " is-due-today" : ""}`} aria-label={`Edit due date for ${task.title}: ${dueLabel}`} onClick={onEdit}>
            <Clock3 size={14} aria-hidden="true"/><span>{dueLabel}</span><Pencil size={12} aria-hidden="true"/>
          </button> : <p className={`work-task-due-value${dueToday ? " is-due-today" : ""}`} aria-labelledby={`${id}-due-label`}><Clock3 size={14} aria-hidden="true"/><span>{dueLabel}</span></p>}
        </div>
      </fieldset>

      <footer className="work-task-footer">
        <div className="work-task-context">
          <span>{task.effort ? `Effort: ${task.effort}` : "Effort not set"}</span>
          {task.recurrence && task.recurrence !== "One-time" ? <span>Repeats: {task.recurrence}</span> : null}
          {!isSubtask && totalChildren > 0 ? <span className="work-task-progress">{remainingChildren} open of {totalChildren} visible subtasks</span> : null}
          {relatedLabel ? onOpenRelated ? <button type="button" className="work-task-related" onClick={onOpenRelated}>Linked: {relatedLabel}<ArrowUpRight size={12} aria-hidden="true"/></button> : <span>Linked: {relatedLabel}</span> : null}
        </div>
        <div className="work-task-actions">
          <button type="button" className="work-task-edit" disabled={!canEdit} aria-label={`Edit details for ${task.title}`} onClick={onEdit}><Pencil size={13} aria-hidden="true"/> Edit details</button>
          {!isSubtask && onAddSubtask ? <button type="button" className="work-task-add" disabled={!canEdit} aria-label={`Add subtask to ${task.title}`} onClick={onAddSubtask}><Plus size={13} aria-hidden="true"/> Add subtask</button> : null}
          {canEdit ? <details className="work-task-more">
            <summary aria-label={`More actions for ${task.title}`}><MoreHorizontal size={16} aria-hidden="true"/><span>More actions</span></summary>
            <div className="work-task-menu"><button type="button" className="work-task-delete" aria-label={`Delete ${task.title}`} onClick={onDelete}><Trash2 size={13} aria-hidden="true"/> Delete {isSubtask ? "subtask" : "task"}</button></div>
          </details> : null}
        </div>
      </footer>
    </div>
  </article>;
}
