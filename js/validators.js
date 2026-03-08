import { DEFAULT_ROOM_MEMBERS, ONLINE_TIMEOUT_MS } from "./constants.js";
import { state } from "./state.js";
import { escapeHtml, getCurrentMember } from "./utils.js";

function isLockedForMember(member = getCurrentMember()) {
  if (!member) {
    return true;
  }
  return Boolean(state.room?.editingLocked || member.locked || member.blocked);
}

function isVoteTargetValid(member, candidateId) {
  if (!member || !candidateId || candidateId === member.id) {
    return false;
  }
  return state.members.some(
    (candidate) =>
      candidate.id === candidateId &&
      !candidate.blocked &&
      (candidate.candidateTitle || candidate.candidateSummary),
  );
}

function getCandidateStats() {
  const candidates = state.members.filter(
    (member) => !member.blocked && (member.candidateTitle || member.candidateSummary),
  );
  const result = candidates.map((candidate) => {
    const supporters = state.members.filter(
      (member) =>
        !member.blocked &&
        member.voteCandidateId === candidate.id &&
        isVoteTargetValid(member, candidate.id),
    );
    const totalScore = supporters.reduce(
      (sum, member) => sum + Number(member.voteScore || 0),
      0,
    );
    const averageScore = supporters.length ? totalScore / supporters.length : 0;
    const topReasons = supporters
      .filter((member) => member.voteReason)
      .sort((left, right) => Number(right.voteScore || 0) - Number(left.voteScore || 0))
      .slice(0, 3)
      .map((member) => ({
        name: member.name,
        score: member.voteScore,
        reason: member.voteReason,
      }));
    const supplements = supporters
      .filter((member) => member.supplementNote)
      .slice(0, 3)
      .map((member) => `${member.name}: ${member.supplementNote}`);
    return {
      ...candidate,
      supporters,
      totalScore,
      averageScore,
      voteCount: supporters.length,
      topReasons,
      supplements,
    };
  });
  return result.sort((left, right) => {
    if (right.totalScore !== left.totalScore) {
      return right.totalScore - left.totalScore;
    }
    if (right.voteCount !== left.voteCount) {
      return right.voteCount - left.voteCount;
    }
    return left.joinedAt - right.joinedAt;
  });
}

function getVoteableCandidates(currentMember = getCurrentMember()) {
  return getCandidateStats().filter((candidate) => candidate.id !== currentMember?.id);
}

function hasValidVoteTarget(candidateId, currentMember = getCurrentMember()) {
  return isVoteTargetValid(currentMember, candidateId);
}

function getActiveMembers() {
  return state.members.filter((member) => !member.blocked);
}

function getSeatSummary() {
  const occupied = getActiveMembers().length;
  const capacity = state.room?.maxMembers || DEFAULT_ROOM_MEMBERS;
  const available = Math.max(0, capacity - occupied);
  return {
    occupied,
    capacity,
    available,
    isFull: available === 0,
  };
}

function getSeatState(member) {
  if (member.role === "moderator") {
    return { tone: "moderator", label: "사회자" };
  }
  if (member.locked || state.room?.editingLocked) {
    return { tone: "locked", label: "잠금" };
  }
  if (member.voteCandidateId || member.ready) {
    return { tone: "ready", label: "완료" };
  }
  if (member.candidateTitle || member.candidateSummary || member.candidateStrength) {
    return { tone: "draft", label: "작성중" };
  }
  return { tone: "joined", label: "입장" };
}

function getSeatName(name) {
  return (name || "빈 자리").slice(0, 4);
}

function renderSeatStrip() {
  if (!state.room) {
    return "";
  }
  const summary = getSeatSummary();
  const members = getActiveMembers();
  const seatCount = Math.max(summary.capacity, members.length);
  const seats = Array.from({ length: seatCount }, (_, index) => {
    const member = members[index];
    if (!member) {
      return `
        <div class="seat-slot empty">
          <span class="seat-slot-name">빈 자리</span>
          <span class="seat-slot-state">입장 가능</span>
        </div>
      `;
    }
    const seatState = getSeatState(member);
    return `
      <div class="seat-slot ${escapeHtml(seatState.tone)}">
        <span class="seat-slot-name">${escapeHtml(getSeatName(member.name))}</span>
        <span class="seat-slot-state">${escapeHtml(seatState.label)}</span>
      </div>
    `;
  }).join("");
  return `
    <div class="seat-summary">
      <div class="seat-summary-head">
        <strong>모둠 좌석</strong>
        <span>${escapeHtml(String(summary.occupied))}/${escapeHtml(String(summary.capacity))}석 사용 중 · ${escapeHtml(String(summary.available))}석 남음</span>
      </div>
      <div class="seat-strip">${seats}</div>
    </div>
  `;
}

function getParticipationSummary() {
  const activeMembers = getActiveMembers();
  const seatSummary = getSeatSummary();
  const online = activeMembers.filter(
    (member) => Date.now() - member.lastSeenAt < ONLINE_TIMEOUT_MS,
  ).length;
  const ready = activeMembers.filter((member) => member.ready).length;
  const submittedIdeas = activeMembers.filter(
    (member) => member.candidateTitle || member.candidateSummary,
  ).length;
  const voted = activeMembers.filter((member) =>
    isVoteTargetValid(member, member.voteCandidateId),
  ).length;
  return {
    total: activeMembers.length,
    online,
    ready,
    submittedIdeas,
    voted,
    capacity: seatSummary.capacity,
    available: seatSummary.available,
  };
}

export {
  isLockedForMember,
  isVoteTargetValid,
  getCandidateStats,
  getVoteableCandidates,
  hasValidVoteTarget,
  getActiveMembers,
  getSeatSummary,
  getSeatState,
  getSeatName,
  renderSeatStrip,
  getParticipationSummary,
};
