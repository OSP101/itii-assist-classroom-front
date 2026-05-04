import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getMessaging, Messaging, getToken, onMessage, MessagePayload } from "firebase/messaging";


const firebaseConfig = {
  apiKey: "AIzaSyAOgm56BteZP_ipSdv8il8r6knK3i4vTFc",
  authDomain: "itii-assist-classrooms.firebaseapp.com",
  projectId: "itii-assist-classrooms",
  storageBucket: "itii-assist-classrooms.firebasestorage.app",
  messagingSenderId: "217696858922",
  appId: "1:217696858922:web:27341ecb0e7b7ca971e453",
};

// VAPID Key สำหรับ web push
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

// Initialize Firebase app
export const initializeFirebase = (): FirebaseApp | null => {
  if (typeof window === "undefined") return null;
  
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn("Firebase config is missing. Push notifications will not work.");
    return null;
  }
  
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  
  return app;
};

// Get messaging instance
export const getMessagingInstance = (): Messaging | null => {
  if (typeof window === "undefined") return null;
  
  if (!app) {
    app = initializeFirebase();
  }
  
  if (!app) return null;
  
  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch (error) {
      console.error("Error initializing Firebase Messaging:", error);
      return null;
    }
  }
  
  return messaging;
};

// Request notification permission and get FCM token
export const requestNotificationPermission = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null;
  
  // Check if notifications are supported
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications");
    return null;
  }
  
  // Request permission
  const permission = await Notification.requestPermission();
  
  if (permission !== "granted") {
    console.log("Notification permission denied");
    return null;
  }
  
  // Get messaging instance
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) {
    console.error("Firebase Messaging is not available");
    return null;
  }
  
  if (!VAPID_KEY) {
    console.error("VAPID key is not configured");
    return null;
  }
  
  try {
    // Register service worker first
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("Service Worker registered:", registration);
    
    // Get FCM token
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    
    if (token) {
      console.log("FCM Token obtained:", token.substring(0, 20) + "...");
      return token;
    } else {
      console.log("No registration token available");
      return null;
    }
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
};

// Listen for foreground messages
export const onForegroundMessage = (callback: (payload: MessagePayload) => void): (() => void) | null => {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) return null;
  
  return onMessage(messagingInstance, (payload) => {
    console.log("Foreground message received:", payload);
    callback(payload);
  });
};

// Check if push notifications are supported
export const isPushNotificationSupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
};

// Get current notification permission status
export const getNotificationPermissionStatus = (): NotificationPermission | null => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }
  return Notification.permission;
};
