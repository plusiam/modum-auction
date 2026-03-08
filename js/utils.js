import { PHASE_META } from "./constants.js";
import { state } from "./state.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nl2br(value) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function phaseLabel(phase) {
  return PHASE_META[phase]?.label || PHASE_META.brainstorm.label;
}

function phaseDescription(phase) {
  return PHASE_META[phase]?.description || PHASE_META.brainstorm.description;
}

function formatTime(timestamp) {
  if (!timestamp) {
    return "-";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getCurrentMember() {
  if (!state.session?.memberId) {
    return null;
  }
  return state.members.find((member) => member.id === state.session.memberId) || null;
}

function isModerator() {
  return state.session?.role === "moderator";
}

export { escapeHtml, nl2br, phaseLabel, phaseDescription, formatTime, getCurrentMember, isModerator };
