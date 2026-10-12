import { useEffect, useRef, useState } from "react";

export const useAiTask = () => {
  const active = useRef<AbortController | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
  }, []);
  return {
    isRunning,
    start() {
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      setIsRunning(true);
      return controller;
    },
    stop() {
      active.current?.abort();
      active.current = null;
      setIsRunning(false);
    },
    finish(controller: AbortController) {
      // An old cancelled request must not clear a newly started task.
      if (active.current !== controller) return;
      active.current = null;
      setIsRunning(false);
    },
  };
};
