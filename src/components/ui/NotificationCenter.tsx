"use client";

import { useState, useEffect } from "react";

export interface Notification {
  id: string;
  type: "success" | "info" | "warning" | "error";
  title: string;
  message: string;
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoDismiss?: boolean;
  duration?: number; // in milliseconds
}

interface NotificationCenterProps {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  playSound?: boolean;
}

// Global notification store (simple implementation)
let notificationListeners: Array<(notification: Notification) => void> = [];

export function showNotification(notification: Omit<Notification, "id" | "timestamp">) {
  const fullNotification: Notification = {
    ...notification,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    autoDismiss: notification.autoDismiss !== false,
    duration: notification.duration || 5000
  };

  notificationListeners.forEach(listener => listener(fullNotification));

  return fullNotification.id;
}

export function NotificationCenter({
  position = "bottom-right",
  playSound = true
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const listener = (notification: Notification) => {
      setNotifications(prev => [...prev, notification]);

      // Play notification sound
      if (playSound && notification.type === "success") {
        playNotificationSound();
      }

      // Auto-dismiss
      if (notification.autoDismiss) {
        setTimeout(() => {
          dismissNotification(notification.id);
        }, notification.duration);
      }
    };

    notificationListeners.push(listener);

    return () => {
      notificationListeners = notificationListeners.filter(l => l !== listener);
    };
  }, [playSound]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4"
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-50 flex flex-col gap-3 max-w-md`}>
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={() => dismissNotification(notification.id)}
        />
      ))}
    </div>
  );
}

interface NotificationCardProps {
  notification: Notification;
  onDismiss: () => void;
}

function NotificationCard({ notification, onDismiss }: NotificationCardProps) {
  const typeConfig = {
    success: {
      bg: "bg-[var(--status-success-bg)]",
      border: "border-[var(--status-success)]",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      iconColor: "text-[var(--status-success)]"
    },
    info: {
      bg: "bg-[var(--status-info-bg)]",
      border: "border-[var(--status-info)]",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
      iconColor: "text-[var(--status-info)]"
    },
    warning: {
      bg: "bg-[var(--status-warning-bg)]",
      border: "border-[var(--status-warning)]",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      iconColor: "text-[var(--status-warning)]"
    },
    error: {
      bg: "bg-[var(--status-error-bg)]",
      border: "border-[var(--status-error)]",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
      iconColor: "text-[var(--status-error)]"
    }
  };

  const config = typeConfig[notification.type];

  return (
    <div className={`
      ${config.bg} border-l-4 ${config.border}
      rounded-lg shadow-lg p-4 animate-slide-in-right
      min-w-[320px] max-w-md
    `}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          {config.icon}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[var(--text-primary)] text-sm mb-1">
            {notification.title}
          </h4>
          <p className="text-sm text-[var(--text-secondary)]">
            {notification.message}
          </p>

          {notification.action && (
            <button
              onClick={() => {
                notification.action?.onClick();
                onDismiss();
              }}
              className="mt-2 text-sm font-medium text-[var(--brand-primary)] hover:underline"
            >
              {notification.action.label}
            </button>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Notification sound (subtle chime)
function playNotificationSound() {
  if (typeof window === 'undefined') return;

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Gentle chime: C5 -> E5 -> G5
    const notes = [523.25, 659.25, 783.99];
    let time = audioContext.currentTime;

    notes.forEach((freq, i) => {
      oscillator.frequency.setValueAtTime(freq, time);
      gainNode.gain.setValueAtTime(0.1, time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
      time += 0.15;
    });

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    // Silently fail if audio context not supported
    console.warn('Audio notification not supported');
  }
}

// Convenience functions
export const notify = {
  success: (title: string, message: string, options?: Partial<Notification>) =>
    showNotification({ type: "success", title, message, ...options }),

  info: (title: string, message: string, options?: Partial<Notification>) =>
    showNotification({ type: "info", title, message, ...options }),

  warning: (title: string, message: string, options?: Partial<Notification>) =>
    showNotification({ type: "warning", title, message, ...options }),

  error: (title: string, message: string, options?: Partial<Notification>) =>
    showNotification({ type: "error", title, message, ...options }),
};
