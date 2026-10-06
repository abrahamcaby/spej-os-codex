"use client";

import { ArrowUpRight, AtSign, Layers3, Mail, Radio } from "lucide-react";
import type { BriefCategory, DailyBriefSnapshotSection, DailyIntelligenceDigest } from "@/lib/types";
import styles from "./daily-snapshot.module.css";

const labels = { industry: "Industry", mentions: "Mentions", newsletters: "Newsletters" };
const icons = { industry: Radio, mentions: AtSign, newsletters: Mail };

export function DailySnapshot({ sections, intelligence, onOpen }: {
  sections: DailyBriefSnapshotSection[];
  intelligence?: DailyIntelligenceDigest;
  onOpen: (category: BriefCategory) => void;
}) {
  const mentionSections = sections.filter((section) => section.category === "mentions");
  const visibleSections = intelligence ? mentionSections : sections;
  return <div className={`${styles.grid} ${intelligence ? styles.hasDigest : ""}`}>
    {intelligence && <section className={`${styles.section} ${styles.intelligence}`}>
      <div className={styles.header}>
        <span className={styles.icon}><Layers3 size={16} /></span>
        <div>
          <h3>AI &amp; industry briefing</h3>
          <span>Top {intelligence.requestedCount} unique topics · {intelligence.duplicatesCollapsed} repeats merged</span>
        </div>
        <button type="button" onClick={() => onOpen("industry")} aria-label="Open industry intelligence"><ArrowUpRight size={18} /></button>
      </div>
      {intelligence.items.length ? <ol className={styles.list}>
        {intelligence.items.map((item, index) => <li key={item.id}>
          <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
            <p>{item.summary}</p>
            <div className={styles.topicMeta}>
              <span>{item.channels.length > 1 ? "Public + inbox" : item.channels[0] === "newsletters" ? "Inbox" : "Public web"}</span>
              <small>{item.sources.slice(0, 3).join(" · ")}{item.sources.length > 3 ? ` +${item.sources.length - 3}` : ""}</small>
              {item.coverageCount > 1 && <em>{item.coverageCount} sources</em>}
            </div>
          </div>
        </li>)}
      </ol> : <div className={styles.empty}>
        <b>{intelligence.configured ? "Nothing new in the intelligence queue" : "No saved intelligence yet"}</b>
        <p>{intelligence.configured ? "Repeated coverage and archived stories stay out of your brief." : "Run Industry or connect the newsletter inbox to build this briefing."}</p>
      </div>}
      <div className={styles.footer}>
        <span>{intelligence.checkedAt ? `${intelligence.stale ? "Last saved" : "Saved"} ${new Date(intelligence.checkedAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}` : "Waiting for first collection"}</span>
        <div className={styles.footerActions}>
          <button type="button" onClick={() => onOpen("industry")}>Industry <ArrowUpRight size={12} /></button>
          <button type="button" onClick={() => onOpen("newsletters")}>Newsletters <ArrowUpRight size={12} /></button>
        </div>
      </div>
    </section>}
    {visibleSections.map((section) => {
      const Icon = icons[section.category];
      return <section className={`${styles.section} ${styles[section.category]}`} key={section.category}>
        <div className={styles.header}>
          <span className={styles.icon}><Icon size={16} /></span>
          <div><h3>{labels[section.category]}</h3><span>Top {section.requestedCount} · {section.availableCount} available</span></div>
          <button type="button" onClick={() => onOpen(section.category)} aria-label={`Open ${labels[section.category]}`}><ArrowUpRight size={18} /></button>
        </div>
        {section.items.length ? <ol className={styles.list}>
          {section.items.map((item, index) => <li key={item.id}>
            <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
              <p>{item.summary}</p>
              <small>{item.source}</small>
            </div>
          </li>)}
        </ol> : <div className={styles.empty}>
          <b>{section.configured ? "Nothing new in this queue" : "No saved results yet"}</b>
          <p>{section.configured ? "Archived stories stay out of your brief." : "Add your sources or run the first refresh in this tab."}</p>
        </div>}
        <div className={styles.footer}>
          <span>{section.checkedAt ? `${section.stale ? "Last saved" : "Saved"} ${new Date(section.checkedAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}` : "Waiting for first collection"}</span>
          <button type="button" onClick={() => onOpen(section.category)}>See all <ArrowUpRight size={12} /></button>
        </div>
      </section>;
    })}
  </div>;
}
