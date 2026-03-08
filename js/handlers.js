import { createBackend } from "./backend.js";
import { exportElementAsImage, exportElementAsPdf } from "./export.js";
import { DEFAULT_ROOM_MEMBERS, MIN_ROOM_MEMBERS, MAX_ROOM_MEMBERS } from "./constants.js";
import { state, saveSession } from "./state.js";
import { getCurrentMember, phaseLabel } from "./utils.js";
import { hasValidVoteTarget, getCandidateStats } from "./validators.js";
import { ensureDrafts } from "./drafts.js";
import { subscribeToRoom } from "./subscribers.js";
import { showNotice, render } from "./renderers.js";

async function init() {
  try {
    state.backend = await createBackend();
    state.backendMeta = await state.backend.init();
    state.unsubRooms = state.backend.subscribeRooms((rooms) => {
      state.rooms = rooms;
      render();
    });
    if (state.session?.roomId) {
      subscribeToRoom(state.session.roomId);
    }
  } catch (error) {
    console.error(error);
    showNotice("error", error.message || "앱을 초기화하지 못했습니다.");
  } finally {
    state.loading = false;
    render();
    // 로비 화면일 때 방 코드 입력에 자동 포커스
    if (!state.session?.roomId) {
      setTimeout(() => {
        const roomCodeInput = document.getElementById("roomCode");
        if (roomCodeInput) {
          roomCodeInput.focus();
          roomCodeInput.select();
        }
      }, 100);
    }
  }
}

function cleanup() {
  // 전역 구독 정리
  state.unsubRooms?.();
  state.unsubRooms = null;

  // 방 구독 정리 (이미 clearRoomSubscription에서 처리되지만 명시적으로 추가)
  state.unsubRoom?.();
  state.unsubRoom = null;

  // 타이머 정리
  window.clearInterval(state.presenceTimer);
  state.presenceTimer = null;

  // Backend cleanup (이벤트 리스너 제거 등)
  state.backend?.cleanup?.();
}

async function handleCreateRoom(form) {
  const formData = new FormData(form);
  const moderatorName = (formData.get("moderatorName") || "").toString().trim();
  const title = (formData.get("title") || "").toString().trim();
  const prompt = (formData.get("prompt") || "").toString().trim();
  const scenario = (formData.get("scenario") || "").toString().trim();
  const maxMembers = Number(formData.get("maxMembers") || DEFAULT_ROOM_MEMBERS);
  if (!moderatorName || !title || !prompt) {
    showNotice("error", "사회자 이름, 활동 제목, 질문은 꼭 입력해 주세요.");
    return;
  }
  if (!Number.isInteger(maxMembers) || maxMembers < MIN_ROOM_MEMBERS || maxMembers > MAX_ROOM_MEMBERS) {
    showNotice("error", `모둠 정원은 ${MIN_ROOM_MEMBERS}명부터 ${MAX_ROOM_MEMBERS}명까지 가능합니다.`);
    return;
  }
  const result = await state.backend.createRoom({ moderatorName, title, prompt, scenario, maxMembers });
  state.session = { roomId: result.roomId, memberId: result.memberId, role: result.role };
  saveSession();
  ensureDrafts(true);
  subscribeToRoom(result.roomId);
  showNotice("info", `새 방이 열렸습니다. 방 코드 ${result.roomCode}`);
}

async function handleJoinRoom(form) {
  const formData = new FormData(form);
  const participantName = (formData.get("participantName") || "").toString().trim();
  const roomCode = (formData.get("roomCode") || "").toString().trim().toUpperCase();
  if (!participantName || !roomCode) {
    showNotice("error", "이름과 방 코드를 입력해 주세요.");
    return;
  }
  if (roomCode.length !== 6) {
    showNotice("error", "방 코드는 6자리로 입력해 주세요.");
    return;
  }
  const result = await state.backend.joinRoom({ participantName, roomCode });
  const isRejoining = state.session?.roomId === result.roomId && state.session?.memberId === result.memberId;
  state.session = { roomId: result.roomId, memberId: result.memberId, role: result.role };
  saveSession();
  ensureDrafts(true);
  subscribeToRoom(result.roomId);
  showNotice("info", isRejoining ? `방 ${result.roomCode}에 재입장했습니다.` : `방 ${result.roomCode}에 참여했습니다.`);
}

async function handleRoomSettingsSave() {
  await state.backend.updateRoom(state.room.id, {
    title: state.drafts.roomSettings.title.trim(),
    prompt: state.drafts.roomSettings.prompt.trim(),
    scenario: state.drafts.roomSettings.scenario.trim(),
  });
  state.dirty.roomSettings = false;
  showNotice("info", "토의 주제와 상황을 저장했습니다.");
}

async function handleParticipantSave() {
  const currentMember = getCurrentMember();
  if (!currentMember) {
    throw new Error("참여자 정보를 다시 불러와 주세요.");
  }
  const canVote = state.room.phase !== "brainstorm";
  const canSupplement = state.room.phase === "refine" || state.room.phase === "final";
  const nextVoteCandidateId = canVote ? state.drafts.participant.voteCandidateId : "";
  if (nextVoteCandidateId && !hasValidVoteTarget(nextVoteCandidateId, currentMember)) {
    throw new Error("자기 해결책에는 점수를 줄 수 없습니다. 다른 해결책을 선택해 주세요.");
  }
  const patch = {
    candidateTitle: state.drafts.participant.candidateTitle.trim(),
    candidateSummary: state.drafts.participant.candidateSummary.trim(),
    candidateStrength: state.drafts.participant.candidateStrength.trim(),
    voteCandidateId: nextVoteCandidateId,
    voteScore: nextVoteCandidateId ? Number(state.drafts.participant.voteScore || 0) : 0,
    voteReason: nextVoteCandidateId ? state.drafts.participant.voteReason.trim() : "",
    supplementNote: canSupplement ? state.drafts.participant.supplementNote.trim() : "",
    ready: Boolean(state.drafts.participant.ready),
    lastSeenAt: Date.now(),
  };
  await state.backend.updateMember(state.room.id, state.session.memberId, patch);
  state.dirty.participant = false;
  showNotice("info", "개인 의견이 실시간으로 반영되었습니다.");
}

async function handleFinalSave() {
  const nextFinal = {
    ...state.room.final,
    finalTitle: state.drafts.final.finalTitle.trim(),
    finalSummary: state.drafts.final.finalSummary.trim(),
    actionSteps: state.drafts.final.actionSteps.trim(),
    participationSummary: state.drafts.final.participationSummary.trim(),
  };
  await state.backend.updateRoom(state.room.id, {
    final: nextFinal,
  });
  state.dirty.final = false;
  showNotice("info", "최종 모둠 해결책을 저장했습니다.");
}

async function handleSelectWinner(memberId) {
  const leaderboard = getCandidateStats();
  const candidate = leaderboard.find((item) => item.id === memberId);
  if (!candidate) {
    showNotice("error", "선택할 해결책 후보가 없습니다.");
    return;
  }
  const nextFinal = {
    ...state.room.final,
    selectedCandidateId: memberId,
    finalTitle: state.room.final.finalTitle || candidate.candidateTitle,
    finalSummary: state.room.final.finalSummary || candidate.candidateSummary,
  };
  await state.backend.updateRoom(state.room.id, { phase: "refine", final: nextFinal });
  state.dirty.final = false;
  showNotice("info", `${candidate.name}의 해결책을 1등 해결책으로 선택했습니다.`);
}

async function handlePhaseChange(phase) {
  await state.backend.updateRoom(state.room.id, { phase });
  showNotice("info", `현재 단계를 ${phaseLabel(phase)}로 변경했습니다.`);
}

async function toggleRoomLock() {
  const wasLocked = state.room.editingLocked;
  await state.backend.updateRoom(state.room.id, { editingLocked: !wasLocked });
  showNotice(
    "info",
    wasLocked ? "전체 편집 잠금을 해제했습니다." : "전체 편집을 잠갔습니다.",
  );
}

async function toggleMemberLock(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) {
    return;
  }
  await state.backend.updateMember(state.room.id, memberId, { locked: !member.locked });
  showNotice(
    "info",
    member.locked
      ? `${member.name}의 편집 잠금을 해제했습니다.`
      : `${member.name}의 편집을 잠갔습니다.`,
  );
}

async function toggleMemberBlock(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) {
    return;
  }

  // 참여 제한 해제 시 정원 체크
  if (member.blocked) {
    const activeMembers = state.members.filter((m) => !m.blocked).length;
    if (activeMembers >= state.room.maxMembers) {
      showNotice("error", `정원이 가득 찼습니다. 현재 ${activeMembers}/${state.room.maxMembers}석 사용 중입니다.`);
      return;
    }
  }

  await state.backend.updateMember(state.room.id, memberId, {
    blocked: !member.blocked,
    ready: member.blocked ? member.ready : false,
  });
  showNotice(
    "info",
    member.blocked
      ? `${member.name}의 참여 제한을 해제했습니다.`
      : `${member.name}의 참여를 제한했습니다.`,
  );
}

function useRoomCode(roomCode) {
  state.drafts.joinRoom.roomCode = roomCode;
  render();
}

async function copyRoomCode() {
  try {
    await navigator.clipboard.writeText(state.room.code);
    showNotice("info", `방 코드 ${state.room.code}를 복사했습니다.`);
  } catch (error) {
    showNotice("error", "클립보드 복사에 실패했습니다.");
  }
}

async function handleExport(kind) {
  const board = document.querySelector("#export-board");
  if (!board) {
    showNotice("error", "내보낼 결과 카드가 없습니다.");
    return;
  }
  const filename = `${state.room.title}-${state.room.code}-결과`;
  try {
    if (kind === "image") {
      await exportElementAsImage(board, filename);
    } else {
      await exportElementAsPdf(board, filename);
    }
    showNotice("info", kind === "image" ? "PNG를 저장했습니다." : "PDF를 저장했습니다.");
  } catch (error) {
    showNotice("error", error.message || "내보내기에 실패했습니다.");
  }
}

export {
  init,
  cleanup,
  handleCreateRoom,
  handleJoinRoom,
  handleRoomSettingsSave,
  handleParticipantSave,
  handleFinalSave,
  handleSelectWinner,
  handlePhaseChange,
  toggleRoomLock,
  toggleMemberLock,
  toggleMemberBlock,
  useRoomCode,
  copyRoomCode,
  handleExport,
};
