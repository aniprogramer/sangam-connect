import messaging, { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { displayIncomingCall } from "./callkeep";

/**
 * Handles background & terminated push notifications from FCM to wake app and trigger CallKit.
 */
export async function backgroundNotificationHandler(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
  if (remoteMessage.data?.type === "INCOMING_CALL") {
    const callerName = remoteMessage.data?.callerName || "Sangam Caller";
    const callUuid = remoteMessage.data?.callUuid || Date.now().toString();
    displayIncomingCall(callUuid, callerName);
  }
}

/**
 * Registers foreground and background handlers for Firebase Cloud Messaging.
 */
export async function setupNotifications(onIncomingCall?: (callData: any) => void) {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.warn("Push notification permission not granted");
      return;
    }

    // Set background message handler
    messaging().setBackgroundMessageHandler(backgroundNotificationHandler);

    // Foreground message handler
    messaging().onMessage(async (remoteMessage) => {
      if (remoteMessage.data?.type === "INCOMING_CALL") {
        const callerName = remoteMessage.data?.callerName || "Sangam Caller";
        const callUuid = remoteMessage.data?.callUuid || Date.now().toString();
        displayIncomingCall(callUuid, callerName);
        if (onIncomingCall) {
          onIncomingCall(remoteMessage.data);
        }
      }
    });
  } catch (err) {
    console.warn("FCM setup error (normal on simulators without Google Play Services):", err);
  }
}
