import { Platform } from "react-native";
import RNCallKeep from "react-native-callkeep";

const options = {
  ios: {
    appName: "Sangam Connect",
    supportsVideo: true,
    maximumCallGroups: 1,
    maximumCallsPerCallGroup: 1,
  },
  android: {
    alertTitle: "Permissions required",
    alertDescription: "Sangam Connect needs Phone Account permissions to handle incoming calls.",
    cancelButton: "Cancel",
    okButton: "ok",
    imageName: "phone_account_icon",
    additionalPermissions: [],
    selfManaged: true,
  },
};

let callKeepInitialized = false;

/**
 * Initializes CallKit / ConnectionService with error fallback for simulator/unsupported platforms.
 */
export async function setupCallKeep(onAnswerCall?: (uuid: string) => void, onEndCall?: (uuid: string) => void) {
  if (callKeepInitialized) return;

  try {
    await RNCallKeep.setup(options);
    RNCallKeep.setAvailable(true);

    if (onAnswerCall) {
      RNCallKeep.addEventListener("answerCall", ({ callUUID }) => {
        onAnswerCall(callUUID);
      });
    }

    if (onEndCall) {
      RNCallKeep.addEventListener("endCall", ({ callUUID }) => {
        onEndCall(callUUID);
      });
    }

    callKeepInitialized = true;
  } catch (err) {
    console.warn("CallKeep setup error (normal on unsupported simulators):", err);
  }
}

/**
 * Displays native incoming call ringing screen.
 */
export function displayIncomingCall(uuid: string, callerName: string) {
  try {
    RNCallKeep.displayIncomingCall(uuid, callerName, callerName, "number", true);
  } catch (err) {
    console.warn("displayIncomingCall error:", err);
  }
}

/**
 * Ends active native call UI.
 */
export function endCall(uuid: string) {
  try {
    RNCallKeep.endCall(uuid);
  } catch (err) {
    console.warn("endCall error:", err);
  }
}
