import { useEffect, useCallback } from 'react';

interface IntegrityEvent {
  type: 'visibilitychange' | 'blur' | 'focus' | 'fullscreenchange' | 'tab_switch' | 'window_resize';
  visible: boolean;
  timestamp: number;
  details?: any;
}

interface UseIntegrityTrackingOptions {
  assessmentId: string;
  itemId: string;
  onIntegrityEvent?: (event: IntegrityEvent) => void;
  enabled?: boolean;
}

export function useIntegrityTracking({
  assessmentId,
  itemId,
  onIntegrityEvent,
  enabled = true
}: UseIntegrityTrackingOptions) {

  const reportIntegrityEvent = useCallback(async (event: IntegrityEvent) => {
    if (!enabled) return;

    try {
      const response = await fetch(`/api/assessments/${assessmentId}/items/${itemId}/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        console.warn('Failed to report integrity event:', response.statusText);
      }

      if (onIntegrityEvent) {
        onIntegrityEvent(event);
      }
    } catch (error) {
      console.warn('Error reporting integrity event:', error);
    }
  }, [assessmentId, itemId, enabled, onIntegrityEvent]);

  useEffect(() => {
    if (!enabled) return;

    let lastVisibilityState = document.visibilityState;
    let fullscreenElement = document.fullscreenElement;
    let windowSize = { width: window.innerWidth, height: window.innerHeight };

    // Track visibility changes (tab switches)
    const handleVisibilityChange = () => {
      const currentVisibility = document.visibilityState;
      const event: IntegrityEvent = {
        type: 'visibilitychange',
        visible: currentVisibility === 'visible',
        timestamp: Date.now(),
        details: {
          fromState: lastVisibilityState,
          toState: currentVisibility
        }
      };

      // Only report if visibility actually changed
      if (lastVisibilityState !== currentVisibility) {
        reportIntegrityEvent(event);
        lastVisibilityState = currentVisibility;
      }
    };

    // Track window focus/blur
    const handleFocus = () => {
      reportIntegrityEvent({
        type: 'focus',
        visible: true,
        timestamp: Date.now()
      });
    };

    const handleBlur = () => {
      reportIntegrityEvent({
        type: 'blur',
        visible: false,
        timestamp: Date.now()
      });
    };

    // Track fullscreen changes
    const handleFullscreenChange = () => {
      const currentFullscreen = document.fullscreenElement;
      const isFullscreen = !!currentFullscreen;

      reportIntegrityEvent({
        type: 'fullscreenchange',
        visible: isFullscreen,
        timestamp: Date.now(),
        details: {
          fullscreen: isFullscreen,
          element: currentFullscreen?.tagName
        }
      });

      fullscreenElement = currentFullscreen;
    };

    // Track window resize (potential window switching)
    const handleResize = () => {
      const newSize = { width: window.innerWidth, height: window.innerHeight };
      const sizeChanged = newSize.width !== windowSize.width || newSize.height !== windowSize.height;

      if (sizeChanged) {
        reportIntegrityEvent({
          type: 'window_resize',
          visible: document.visibilityState === 'visible',
          timestamp: Date.now(),
          details: {
            fromSize: windowSize,
            toSize: newSize
          }
        });

        windowSize = newSize;
      }
    };

    // Track page unload (attempting to leave page)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      reportIntegrityEvent({
        type: 'tab_switch',
        visible: false,
        timestamp: Date.now(),
        details: { action: 'page_unload' }
      });
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, reportIntegrityEvent]);

  return {
    reportIntegrityEvent
  };
}

