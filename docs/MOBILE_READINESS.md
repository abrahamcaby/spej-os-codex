# Mobile readiness: reusable foundation, not a native app yet

The September 9 build remains a local web preview. Its React/TypeScript screens, shared components, business rules and data types provide a useful foundation for a phone experience. Existing responsive styles do not amount to verified mobile usability or an installable mobile app.

## What is not implemented

- No native iOS/Android project, app-store package, web manifest, service worker, push registration or offline change queue.
- The preview listens on the laptop's loopback interface. Opening `127.0.0.1` on a phone addresses the phone, not the laptop. Do not remove the loopback/production guard to make this preview publicly accessible.
- The backend uses Node and SQLite. That server stays on a properly hosted backend; it does not become part of a mobile web bundle.
- Company sign-in, server-enforced record permissions, verified audit identity and shared view settings still require integration. Demo profile switching is not authentication.
- Whole-workspace saves have no revision precondition. Concurrent phone/laptop edits could overwrite each other; production needs versioned record updates and explicit conflict handling.
- File links preserve the original system's access. Native uploads, camera access, download permissions and secure storage are separate work.

## Recommended sequence for Sean and IT

1. **Secure shared web app:** connect the existing Spej OS identity and permissions, authoritative records, versioned writes, audit trail and server-side SOSA gateway. Keep secrets out of the client. Preserve existing production Kanban, Grid, Gantt and project Documentation.
2. **Phone-first usability pass:** test navigation, forms, touch targets, keyboard behavior, dense boards/timelines and accessibility on actual iOS/Android devices. Choose compact mobile views of the same components, not a custom application per role.
3. **Installable web app if useful:** add a manifest and an explicit offline policy. Avoid caching private CRM records by default. Define logout/cache clearing, stale-data warnings, conflict handling, notification consent and device/session revocation before offline or push support.
4. **Optional native shell:** evaluate Capacitor if camera/file integrations, native notifications or app-store distribution justify it. Reuse the web UI where appropriate, with a hosted authenticated backend. A wrapper alone does not solve authentication, offline consistency or mobile usability.

This is an implementation roadmap, not a promise of one-click conversion. No phone-device or app-store testing was performed for this release.

Official references: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) and [Capacitor documentation](https://capacitorjs.com/docs).
