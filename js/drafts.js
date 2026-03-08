import { FORM_KEY_MAP } from "./constants.js";
import { state } from "./state.js";
import { getCurrentMember } from "./utils.js";
import { hasValidVoteTarget } from "./validators.js";
import { render } from "./renderers.js";

function ensureDrafts(force = false) {
  const roomId = state.room?.id || "";
  const currentMember = getCurrentMember();
  if (force || state.draftRoomId !== roomId) {
    state.draftRoomId = roomId;
    state.dirty.roomSettings = false;
    state.dirty.participant = false;
    state.dirty.final = false;
  }
  if (state.room && (!state.dirty.roomSettings || force)) {
    state.drafts.roomSettings = {
      title: state.room.title || "",
      prompt: state.room.prompt || "",
      scenario: state.room.scenario || "",
    };
  }
  if (currentMember && (!state.dirty.participant || force)) {
    const hasVoteTarget = hasValidVoteTarget(currentMember.voteCandidateId, currentMember);
    state.drafts.participant = {
      candidateTitle: currentMember.candidateTitle || "",
      candidateSummary: currentMember.candidateSummary || "",
      candidateStrength: currentMember.candidateStrength || "",
      voteCandidateId: hasVoteTarget ? currentMember.voteCandidateId : "",
      voteScore: hasVoteTarget ? currentMember.voteScore || 5 : 5,
      voteReason: hasVoteTarget ? currentMember.voteReason || "" : "",
      supplementNote: currentMember.supplementNote || "",
      ready: Boolean(currentMember.ready),
    };
  }
  if (state.room && (!state.dirty.final || force)) {
    state.drafts.final = {
      finalTitle: state.room.final?.finalTitle || "",
      finalSummary: state.room.final?.finalSummary || "",
      actionSteps: state.room.final?.actionSteps || "",
      participationSummary: state.room.final?.participationSummary || "",
    };
  }
}

function setDraftValue(section, key, value) {
  state.drafts[section] = {
    ...state.drafts[section],
    [key]: value,
  };
}

function getDraftKey(formName) {
  return FORM_KEY_MAP[formName] || formName;
}

function syncDraftFromField(target, shouldRender = false) {
  if (
    !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    )
  ) {
    return;
  }
  if (target.dataset.action === "room-search") {
    state.lobbySearch = target.value;
    if (shouldRender) {
      render();
    }
    return;
  }
  if (target.dataset.action === "change-phase") {
    return;
  }
  const form = target.closest("form");
  if (!form?.dataset.form) {
    return;
  }
  const section = getDraftKey(form.dataset.form);
  const key = target.name;
  let value = target.value;
  if (section === "joinRoom" && key === "roomCode") {
    value = value.replaceAll(/\s+/g, "").toUpperCase();
    target.value = value;
  }
  if (section === "participant" && key === "voteScore") {
    value = Number(value);
  }
  if (section === "participant" && key === "ready") {
    // checkbox: target.checked로 boolean을 읽고, value는 "true" 고정
    value = target instanceof HTMLInputElement && target.type === "checkbox"
      ? target.checked
      : value === "true";
  }
  if (section in state.drafts && key) {
    setDraftValue(section, key, value);
  }
  if (section === "roomSettings" || section === "participant" || section === "final") {
    state.dirty[section] = true;
  }
  if (shouldRender && section === "participant" && key === "voteScore") {
    render();
  }
}

export { ensureDrafts, setDraftValue, getDraftKey, syncDraftFromField };
