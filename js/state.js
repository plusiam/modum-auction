import { SESSION_KEY, DEFAULT_ROOM_MEMBERS } from "./constants.js";

const app = document.querySelector("#app");

function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch (error) {
    return null;
  }
}

const state = {
  backend: null,
  backendMeta: null,
  rooms: [],
  room: null,
  members: [],
  session: loadSession(),
  notice: null,
  loading: true,
  lobbySearch: "",
  unsubRooms: null,
  unsubRoom: null,
  presenceTimer: null,
  isOnline: navigator.onLine,
  connectionError: null,
  drafts: {
    createRoom: {
      moderatorName: "",
      title: "해결책 경매 토의",
      prompt: "여러 해결책 중 무엇이 가장 바람직할까?",
      scenario: "",
      maxMembers: DEFAULT_ROOM_MEMBERS,
    },
    joinRoom: {
      participantName: "",
      roomCode: "",
    },
    roomSettings: {
      title: "",
      prompt: "",
      scenario: "",
    },
    participant: {
      candidateTitle: "",
      candidateSummary: "",
      candidateStrength: "",
      voteCandidateId: "",
      voteScore: 5,
      voteReason: "",
      supplementNote: "",
      ready: false,
    },
    final: {
      finalTitle: "",
      finalSummary: "",
      actionSteps: "",
      participationSummary: "",
    },
  },
  dirty: {
    roomSettings: false,
    participant: false,
    final: false,
  },
  draftRoomId: "",
};

function saveSession() {
  if (state.session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
    return;
  }
  sessionStorage.removeItem(SESSION_KEY);
}

export { app, state, loadSession, saveSession };
