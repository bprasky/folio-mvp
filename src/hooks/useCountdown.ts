import { useEffect, useState } from "react";

export default function useCountdown(targetIso: string) {
  const target = new Date(targetIso).getTime();
  const [ms, setMs] = useState(target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setMs(target - Date.now());
    }, 15000);
    return () => clearInterval(interval);
  }, [targetIso]);

  const days = Math.max(0, Math.floor(ms / 86400000));
  const hours = Math.max(0, Math.floor((ms / 3600000) % 24));
  const minutes = Math.max(0, Math.floor((ms / 60000) % 60));

  return { days, hours, minutes };
}


