export const ACQUISITION_MOTIONS = ["Unclassified", "Inbound", "Outbound", "Network", "Referral", "Event", "Partner"] as const;
export type AcquisitionMotion = typeof ACQUISITION_MOTIONS[number];
export const GTM_SOURCE_OPTIONS = ["Website / inbound", "Organic search", "Email inbound", "Email outbound", "Phone outbound", "LinkedIn 5-3-1", "Other LinkedIn", "Other social media", "Personal network", "Professional network", "Prior professional network", "Referral / introduction", "In-person event", "Webinar / online event", "Content / podcast", "Partner", "Paid media", "Team sourced", "Unknown / Needs Review"];
export function cleanAcquisitionMotion(value: unknown): AcquisitionMotion {
  return ACQUISITION_MOTIONS.includes(value as AcquisitionMotion) ? value as AcquisitionMotion : "Unclassified";
}
