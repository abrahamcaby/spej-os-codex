"use client";

import { useEffect, useState } from "react";
import { metricDay } from "./gtm-metrics";

/** Refresh date-derived queues across midnight and when returning to the app. */
export function useLocalDay() {
  const [day, setDay] = useState(() => metricDay());
  useEffect(() => {
    const refresh = () => setDay(metricDay());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return day;
}
