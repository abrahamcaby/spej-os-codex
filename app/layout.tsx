import type { Metadata } from "next";
import "./globals.css";
import "../components/task-work.css";
import "../components/relationship-context-panel.css";
import "../components/customer-development-panels.css";
import "../components/communication-history.css";
import "../components/activity-dictation.css";
import "../components/connections-settings.css";

export const metadata: Metadata = {
  title: "Spej OS Preview",
  description: "A connected Spej OS preview with focused CRM, GTM, and Projects workspaces, shared records, and reviewed SOSA-assisted updates.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("control-center-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
