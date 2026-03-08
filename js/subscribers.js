import { PRESENCE_INTERVAL_MS } from "./constants.js";
import { state, saveSession } from "./state.js";
import { getCurrentMember } from "./utils.js";
import { ensureDrafts } from "./drafts.js";
import { showNotice, render } from "./renderers.js";

function clearRoomSubscription() {
  state.unsubRoom?.();
  state.unsubRoom = null;
  window.clearInterval(state.presenceTimer);
  state.presenceTimer = null;
  state.room = null;
  state.members = [];
}

async function clearSession() {
  // 사회자가 방을 나갈 때 moderatorLastSeenAt을 0으로 설정하여 로비에서 즉시 숨김
  const currentMember = getCurrentMember();
  if (currentMember?.role === "moderator" && state.session?.roomId && state.backend) {
    try {
      await state.backend.updateRoom(state.session.roomId, { moderatorLastSeenAt: 0 });
    } catch (error) {
      console.warn("사회자 오프라인 표시 실패:", error);
    }
  }
  clearRoomSubscription();
  state.session = null;
  saveSession();
  ensureDrafts(true);
  render();
}

function startPresenceLoop() {
  if (!state.session?.roomId || !state.session?.memberId) {
    return;
  }
  window.clearInterval(state.presenceTimer);
  state.presenceTimer = window.setInterval(() => {
    state.backend
      ?.touch(state.session.roomId, state.session.memberId)
      .catch((error) => console.warn("Presence loop error", error));
  }, PRESENCE_INTERVAL_MS);
}

function subscribeToRoom(roomId) {
  clearRoomSubscription();
  state.unsubRoom = state.backend.subscribeRoom(roomId, (snapshot) => {
    if (!snapshot) {
      showNotice("error", "방 정보를 불러오지 못했습니다.");
      clearSession();
      return;
    }
    state.room = snapshot.room;
    state.members = snapshot.members;
    ensureDrafts();
    const currentMember = getCurrentMember();
    if (!currentMember && state.session) {
      showNotice("error", "현재 탭의 참여자 정보가 없어 방에서 나갑니다.");
      clearSession();
      return;
    }
    render();
  });
  state.backend.touch(roomId, state.session.memberId).catch(() => {});
  startPresenceLoop();
}

export { clearRoomSubscription, clearSession, startPresenceLoop, subscribeToRoom };
