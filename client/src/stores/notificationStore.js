import { create } from 'zustand';

const notifSound = typeof Audio !== 'undefined' ? new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoeFaFNLW4mio5ZsTjJRdoGAgW1cT1yLn6CRaEw3Tn2BfX1sXFBai5yfkWVJN099gXx7bF5UXIudnI9iRTdPfYF7e21hWF2NnpuOYEQ3T32BfHtvZFxejZ+ajF5CN099gX18c2hfYJCgnIxdQDdPfYF9fXVrZGOUoZuKWz43T32CfX53b2tmmKObiVg8N099gn5+eXJwbZuknYhVOTdPf4N/f3t2dXKfpp2GUjg3T4CDgIB9enh2o6ieh1A2N0+ChIKBgH16e6aqn4hONTdPhYWDgoF+foCqraCITDM2T4eHhYSDgIGDs6+giUoyNk+JiIaFhIKChbizoomISDI3UIuKiIaFg4OGu7WiioZGMjdQjIuJiIaEhIm+t6OKhEQyN1COjIqJh4WFi8G5pIqCQjI3UJCOi4qIhoaMxLumioA/MjdQko+NjImHh47Gu6eJfj0yOFKUkY6MiomJkMm9qIl8OzI4UpaSj42LioqSzb+piXk5MTlTmJSRj42LjJXQwa2Jdjcx') : null;

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) => {
    const id = Date.now();
    set((state) => ({
      notifications: [{ ...notification, id, read: false, time: new Date() }, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));

    if (notifSound) {
      notifSound.play().catch(() => {});
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, { body: notification.message, icon: '/icon.png' });
    }

    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 10000);
  },

  markAllRead: () => set({ unreadCount: 0 }),

  requestPermission: () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  },
}));
