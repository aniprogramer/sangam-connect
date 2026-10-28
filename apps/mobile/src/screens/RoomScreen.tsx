import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useLocalParticipant,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import { colors } from "@sangam/tokens";
import { ROOM_OPTIONS } from "@sangam/shared";

const palette = colors.dark;

function MeetingView({ roomName, onLeave }: { roomName: string; onLeave: () => void }) {
  const { isCameraEnabled, isMicrophoneEnabled, setCameraEnabled, setMicrophoneEnabled } =
    useLocalParticipant();

  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  // Separate remote track from local track
  const remoteTrack = tracks.find((t) => !t.participant.isLocal);
  const localTrack = tracks.find((t) => t.participant.isLocal);

  return (
    <SafeAreaView style={styles.roomContainer}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.roomCodeTitle}>{roomName}</Text>
          <Text style={styles.participantCountSub}>
            {tracks.length} track{tracks.length === 1 ? "" : "s"} active
          </Text>
        </View>
        <TouchableOpacity style={styles.leaveBtn} onPress={onLeave}>
          <Text style={styles.leaveBtnText}>Leave</Text>
        </TouchableOpacity>
      </View>

      {/* Main Video Viewport */}
      <View style={styles.stage}>
        {remoteTrack && remoteTrack.publication?.track ? (
          <View style={styles.remoteTile}>
            <VideoTrack trackRef={remoteTrack} style={styles.fillVideo} />
            <Text style={styles.participantNameBadge}>
              {remoteTrack.participant.name || remoteTrack.participant.identity}
            </Text>
          </View>
        ) : (
          <View style={styles.waitingTile}>
            <Text style={styles.waitingText}>Waiting for other participants...</Text>
          </View>
        )}

        {/* Local Video PiP Tile */}
        {localTrack && localTrack.publication?.track && isCameraEnabled && (
          <View style={styles.localPipTile}>
            <VideoTrack trackRef={localTrack} style={styles.fillVideo} />
            <Text style={styles.pipBadge}>You</Text>
          </View>
        )}
      </View>

      {/* Control Bar */}
      <View style={styles.controlBar}>
        <TouchableOpacity
          style={[styles.controlBtn, !isMicrophoneEnabled && styles.btnMuted]}
          onPress={() => setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          <Text style={styles.controlBtnText}>
            {isMicrophoneEnabled ? "Mic On" : "Muted"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, !isCameraEnabled && styles.btnMuted]}
          onPress={() => setCameraEnabled(!isCameraEnabled)}
        >
          <Text style={styles.controlBtnText}>
            {isCameraEnabled ? "Cam On" : "Cam Off"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function RoomScreen({ route, navigation }: any) {
  const { roomName, token, serverUrl, role } = route.params || {};
  // Attendees are listen-only until a host promotes them.
  const canPublish = role !== "attendee";

  const handleDisconnected = () => {
    navigation.replace("Home");
  };

  if (!token || !serverUrl) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Missing meeting credentials.</Text>
        <TouchableOpacity style={styles.leaveBtn} onPress={handleDisconnected}>
          <Text style={styles.leaveBtnText}>Return Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      options={ROOM_OPTIONS}
      audio={canPublish}
      video={canPublish}
      onDisconnected={handleDisconnected}
      style={{ flex: 1, backgroundColor: palette.bgApp }}
    >
      <RoomAudioRenderer />
      <MeetingView roomName={roomName} onLeave={handleDisconnected} />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  roomContainer: {
    flex: 1,
    backgroundColor: palette.bgApp,
    justifyContent: "space-between",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: palette.bgApp,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    color: palette.danger,
    fontSize: 16,
    marginBottom: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  roomCodeTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  participantCountSub: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  leaveBtn: {
    backgroundColor: palette.danger,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  leaveBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  stage: {
    flex: 1,
    position: "relative",
    margin: 12,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: palette.bgSurface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  remoteTile: {
    flex: 1,
    position: "relative",
  },
  fillVideo: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  participantNameBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  waitingTile: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  waitingText: {
    color: palette.textMuted,
    fontSize: 14,
  },
  localPipTile: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: palette.accent,
    backgroundColor: "#000",
  },
  pipBadge: {
    position: "absolute",
    bottom: 4,
    left: 6,
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  controlBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  controlBtn: {
    backgroundColor: palette.bgElevated,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
  },
  btnMuted: {
    backgroundColor: palette.dangerSoft,
    borderColor: palette.danger,
  },
  controlBtnText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
});
