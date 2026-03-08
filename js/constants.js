import {
  DEFAULT_ROOM_MEMBERS,
  MAX_ROOM_MEMBERS,
  MIN_ROOM_MEMBERS,
  ONLINE_TIMEOUT_MS,
} from "./backend.js";

const PHASE_META = {
  brainstorm: {
    label: "1단계 해결책 제안",
    description: "각 참여자가 자기 해결책과 핵심 장점을 적습니다.",
  },
  auction: {
    label: "2단계 경매 점수",
    description: "다른 해결책을 보고 가장 설득력 있는 안에 점수를 줍니다.",
  },
  refine: {
    label: "3단계 보완 토의",
    description: "1등 해결책을 함께 고치고 보완 의견을 모읍니다.",
  },
  final: {
    label: "4단계 결과 확정",
    description: "사회자가 최종 모둠 해결책을 정리하고 파일로 저장합니다.",
  },
};

const SESSION_KEY = "auction-worksheet-session-v1";
const PRESENCE_INTERVAL_MS = 20000;

const FORM_KEY_MAP = {
  "create-room": "createRoom",
  "join-room": "joinRoom",
  "room-settings": "roomSettings",
  participant: "participant",
  final: "final",
};

const MEMBER_COUNT_OPTIONS = Array.from(
  { length: MAX_ROOM_MEMBERS - MIN_ROOM_MEMBERS + 1 },
  (_, index) => MIN_ROOM_MEMBERS + index,
);

export {
  PHASE_META,
  SESSION_KEY,
  PRESENCE_INTERVAL_MS,
  FORM_KEY_MAP,
  MEMBER_COUNT_OPTIONS,
  DEFAULT_ROOM_MEMBERS,
  MAX_ROOM_MEMBERS,
  MIN_ROOM_MEMBERS,
  ONLINE_TIMEOUT_MS,
};
