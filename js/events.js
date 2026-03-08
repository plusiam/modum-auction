import { app, state } from "./state.js";
import { syncDraftFromField } from "./drafts.js";
import {
  cleanup,
  handleCreateRoom,
  handleJoinRoom,
  handleRoomSettingsSave,
  handleParticipantSave,
  handleFinalSave,
  handlePhaseChange,
  useRoomCode,
  copyRoomCode,
  toggleRoomLock,
  toggleMemberLock,
  toggleMemberBlock,
  handleSelectWinner,
  handleExport,
} from "./handlers.js";
import { showNotice, render, renderConnectionStatusOnly } from "./renderers.js";
import { clearSession } from "./subscribers.js";

app.addEventListener("input", (event) => {
  const target = event.target;

  // 방 코드 입력 실시간 대문자 변환 및 포맷팅
  if (target instanceof HTMLInputElement && target.id === "roomCode") {
    const cursorPosition = target.selectionStart;
    const oldValue = target.value;
    const newValue = oldValue.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

    if (oldValue !== newValue) {
      target.value = newValue;
      // 커서 위치 복원
      const offset = newValue.length - oldValue.length;
      target.setSelectionRange(cursorPosition + offset, cursorPosition + offset);
    }
  }

  syncDraftFromField(target, true);
});

app.addEventListener("change", async (event) => {
  const target = event.target;
  if (
    !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    )
  ) {
    return;
  }
  // checkbox change: syncDraftFromField 전에 render 포함해서 처리
  const isReadyCheckbox =
    target instanceof HTMLInputElement &&
    target.type === "checkbox" &&
    target.name === "ready";
  syncDraftFromField(target, isReadyCheckbox);
  if (target.dataset.action === "change-phase" && target.value) {
    try {
      await handlePhaseChange(target.value);
    } catch (error) {
      showNotice("error", error.message || "단계 변경에 실패했습니다.");
    }
  }
});

app.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const actionTarget = target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }
  const { action, memberId, roomCode, phase } = actionTarget.dataset;
  try {
    if (action === "participant-tab" && actionTarget.dataset.tab) {
      state.participantTab = actionTarget.dataset.tab;
      render();
      return;
    }
    if (action === "use-room-code" && roomCode) {
      useRoomCode(roomCode);
      return;
    }
    if (action === "leave-room") {
      clearSession();
      return;
    }
    if (action === "copy-room-code") {
      await copyRoomCode();
      return;
    }
    if (action === "toggle-room-lock") {
      await toggleRoomLock();
      return;
    }
    if (action === "toggle-member-lock" && memberId) {
      await toggleMemberLock(memberId);
      return;
    }
    if (action === "toggle-member-block" && memberId) {
      await toggleMemberBlock(memberId);
      return;
    }
    if (action === "select-winner" && memberId) {
      await handleSelectWinner(memberId);
      return;
    }
    if (action === "export-image") {
      await handleExport("image");
      return;
    }
    if (action === "export-pdf") {
      await handleExport("pdf");
      return;
    }
    if (action === "change-phase" && phase) {
      await handlePhaseChange(phase);
    }
  } catch (error) {
    showNotice("error", error.message || "작업에 실패했습니다.");
  }
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  try {
    if (form.dataset.form === "create-room") {
      await handleCreateRoom(form);
      return;
    }
    if (form.dataset.form === "join-room") {
      await handleJoinRoom(form);
      return;
    }
    if (form.dataset.form === "room-settings") {
      await handleRoomSettingsSave();
      return;
    }
    if (form.dataset.form === "participant") {
      await handleParticipantSave();
      return;
    }
    if (form.dataset.form === "final") {
      await handleFinalSave();
    }
  } catch (error) {
    showNotice("error", error.message || "저장에 실패했습니다.");
  }
});

window.addEventListener("beforeunload", () => {
  cleanup();
});

window.addEventListener("online", () => {
  state.isOnline = true;
  state.connectionError = null;
  renderConnectionStatusOnly();
  showNotice("info", "네트워크에 다시 연결되었습니다.");
});

window.addEventListener("offline", () => {
  state.isOnline = false;
  state.connectionError = "네트워크 연결이 끊어졌습니다.";
  renderConnectionStatusOnly();
  showNotice("error", "네트워크 연결이 끊어졌습니다. 연결 상태를 확인해 주세요.");
});
