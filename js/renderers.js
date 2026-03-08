import {
  PHASE_META,
  MEMBER_COUNT_OPTIONS,
  DEFAULT_ROOM_MEMBERS,
  ONLINE_TIMEOUT_MS,
} from "./constants.js";
import { app, state } from "./state.js";
import {
  escapeHtml,
  nl2br,
  phaseLabel,
  phaseDescription,
  formatTime,
  getCurrentMember,
  isModerator,
} from "./utils.js";
import {
  isLockedForMember,
  getCandidateStats,
  getVoteableCandidates,
  hasValidVoteTarget,
  getParticipationSummary,
  getSeatSummary,
  getSeatState,
  getSeatName,
  getActiveMembers,
} from "./validators.js";

let noticeTimerId = null;

function showNotice(type, text) {
  state.notice = { type, text };
  renderNoticeOnly();
  window.clearTimeout(noticeTimerId);
  noticeTimerId = window.setTimeout(() => {
    state.notice = null;
    renderNoticeOnly();
  }, 3600);
}

function renderNoticeOnly() {
  const noticeContainer = document.querySelector("#notice-container");
  if (!noticeContainer) {
    return;
  }
  noticeContainer.innerHTML = renderNotice();
}

function renderConnectionStatusOnly() {
  const statusContainer = document.querySelector("#connection-status-container");
  if (!statusContainer) {
    return;
  }
  statusContainer.innerHTML = renderConnectionStatus();
}

function highlightMatch(text, search) {
  if (!search) return escapeHtml(text);
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return escapeHtml(text).replace(regex, '<mark class="search-highlight">$1</mark>');
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

function renderLobby() {
  const search = state.lobbySearch.trim().toLowerCase();
  const filteredRooms = state.rooms.filter((room) => {
    if (!search) {
      return true;
    }
    return (
      room.title.toLowerCase().includes(search) ||
      room.code.toLowerCase().includes(search)
    );
  });

  return `
    <section class="lobby">
      <article class="panel panel-body join-panel">
        <div class="panel-head">
          <div>
            <h2>개인 모드</h2>
            <p>방 코드를 빠르게 입력하고 바로 입장할 수 있게 정리했습니다.</p>
          </div>
          <span class="role-label role-label--participant">학생 · 참여자</span>
        </div>
        <form data-form="join-room" class="field-grid">
          <div class="join-hero">
            <div class="field">
              <label for="roomCode">방 코드</label>
              <input
                id="roomCode"
                class="room-code-input"
                name="roomCode"
                maxlength="6"
                value="${escapeHtml(state.drafts.joinRoom.roomCode)}"
                placeholder="예: AB12CD"
              />
            </div>
            <button class="button blue join-cta" type="submit">방 참여하기</button>
          </div>
          <div class="field">
            <label for="participantName">참여자 이름</label>
            <input id="participantName" name="participantName" value="${escapeHtml(
              state.drafts.joinRoom.participantName,
            )}" placeholder="예: 박서준" />
          </div>
          <p class="helper">방 코드를 알고 있으면 검색 없이 바로 입장하면 됩니다.</p>
        </form>

        <div class="room-search quick-room-search">
          <div class="panel-head">
            <div>
              <h3>최근 열린 방</h3>
              <p>코드를 모를 때만 최근 방에서 골라 채우면 됩니다.</p>
            </div>
          </div>
          <div class="field">
            <label for="roomSearch">방 찾기</label>
            <input
              id="roomSearch"
              data-action="room-search"
              value="${escapeHtml(state.lobbySearch)}"
              placeholder="활동 제목 또는 코드"
            />
          </div>
          <div class="room-pick-grid">
            ${
              filteredRooms.length
                ? filteredRooms
                    .slice(0, 8)
                    .map(
                      (room) => `
                        <button
                          class="room-pick-card"
                          type="button"
                          data-action="use-room-code"
                          data-room-code="${escapeHtml(room.code)}"
                        >
                          <div class="room-pick-header">
                            <span class="room-pick-code">${highlightMatch(room.code, search)}</span>
                            <span class="phase-badge phase-${escapeHtml(room.phase || "setup")}">${escapeHtml(phaseLabel(room.phase))}</span>
                          </div>
                          <strong>${highlightMatch(room.title, search)}</strong>
                          <span class="small">${escapeHtml(room.prompt)}</span>
                          <span class="tag-row">
                            <span class="tag">자리 ${escapeHtml(String(room.participantCount || 0))}/${escapeHtml(String(room.maxMembers || DEFAULT_ROOM_MEMBERS))}</span>
                            <span class="tag ${room.isFull ? "tag-warning" : "tag-info"}">${room.isFull ? "정원 마감" : `남은 ${escapeHtml(String(room.availableSeats || 0))}자리`}</span>
                          </span>
                        </button>
                      `,
                    )
                    .join("")
                : `<div class="empty">보이는 방이 없으면 사회자에게 6자리 코드를 직접 받아 입력하세요.</div>`
            }
          </div>
          <p class="footer-note">
            현재 연결: <strong>${escapeHtml(state.backend?.mode || "demo")}</strong>
            ${state.backend?.mode === "demo" ? " | Firebase 설정 전에는 데모 저장소로 동작합니다." : ""}
          </p>
        </div>
      </article>

      <article class="panel panel-body">
        <div class="panel-head">
          <div>
            <h2>사회자 모드</h2>
            <p>방 개설과 토의 진행만 빠르게 할 수 있게 필요한 항목만 남겼습니다.</p>
          </div>
          <span class="role-label role-label--moderator">사회자 · 진행자</span>
        </div>
        <form data-form="create-room" class="field-grid">
          <div class="field-grid two field-grid--safe">
            <div class="field">
              <label for="moderatorName">사회자 이름</label>
              <input id="moderatorName" name="moderatorName" value="${escapeHtml(
                state.drafts.createRoom.moderatorName,
              )}" placeholder="예: 4모둠 사회자 김민지" />
            </div>
            <div class="field">
              <label for="title">활동 제목</label>
              <input id="title" name="title" value="${escapeHtml(
                state.drafts.createRoom.title,
              )}" />
            </div>
          </div>
          <div class="field">
            <label for="prompt">토의 질문</label>
            <input id="prompt" name="prompt" value="${escapeHtml(
              state.drafts.createRoom.prompt,
            )}" />
          </div>
          <div class="field">
            <label for="maxMembers">모둠 정원</label>
            <select id="maxMembers" name="maxMembers">
              ${MEMBER_COUNT_OPTIONS.map(
                (count) => `
                  <option
                    value="${escapeHtml(String(count))}"
                    ${Number(state.drafts.createRoom.maxMembers) === count ? "selected" : ""}
                  >
                    사회자 포함 ${escapeHtml(String(count))}명
                  </option>
                `,
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label for="scenario">문제 상황 / 자료 안내</label>
            <textarea id="scenario" name="scenario" placeholder="토의할 상황 설명, 참고 자료, 모둠 규칙을 적으세요.">${escapeHtml(
              state.drafts.createRoom.scenario,
            )}</textarea>
          </div>
          <div class="actions">
            <button class="button primary" type="submit">방 만들기</button>
          </div>
          <p class="helper">학생 사회자 1인과 참여 학생이 함께 쓰는 방입니다. 방이 열리면 6자리 코드가 생성되며, 사회자를 포함해 최대 10명까지 입장할 수 있습니다.</p>
        </form>
      </article>
    </section>
  `;
}

function renderSummaryCards() {
  const summary = getParticipationSummary();
  return `
    <section class="summary-grid">
      <article class="summary-card"><span>모둠 정원</span><strong>${escapeHtml(String(summary.capacity))}</strong><div class="small">사회자 포함 최대 인원</div></article>
      <article class="summary-card"><span>사용 중 좌석</span><strong>${escapeHtml(String(summary.total))}</strong><div class="small">남은 ${escapeHtml(String(summary.available))}석 · 현재 접속 ${escapeHtml(String(summary.online))}명</div></article>
      <article class="summary-card"><span>해결책 제출</span><strong>${escapeHtml(String(summary.submittedIdeas))}</strong><div class="small">개인 해결책 입력 완료</div></article>
      <article class="summary-card"><span>점수 제출</span><strong>${escapeHtml(String(summary.voted))}</strong><div class="small">경매 점수 반영 완료</div></article>
    </section>
  `;
}

function renderPhaseBar() {
  return `
    <section class="panel card-pad">
      <div class="panel-head">
        <div>
          <h3>토의 흐름</h3>
          <p>사회자가 현재 단계를 바꾸면 개인 모드 화면도 즉시 바뀝니다.</p>
        </div>
      </div>
      <div class="phase-bar">
        ${Object.entries(PHASE_META)
          .map(
            ([key, meta]) => `
              <div class="phase-step ${state.room.phase === key ? "active" : ""}">
                <strong>${escapeHtml(meta.label)}</strong>
                <p>${escapeHtml(meta.description)}</p>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRoomSidebar() {
  const summary = getParticipationSummary();
  const seatSummary = getSeatSummary();
  const currentMember = getCurrentMember();
  const memberNote = currentMember?.blocked
    ? "사회자가 현재 이 기기의 참여를 제한했습니다."
    : isLockedForMember(currentMember)
      ? "지금은 입력이 잠겨 있어 읽기 전용입니다."
      : isModerator()
        ? `학생 사회자를 포함해 최대 ${escapeHtml(String(seatSummary.capacity))}명이 참여합니다. 남은 자리는 ${escapeHtml(String(seatSummary.available))}석입니다.`
        : "입력 내용은 저장 버튼을 누르면 실시간으로 공유됩니다.";

  const roleMod = isModerator();

  return `
    <aside class="sidebar">
      <!-- 역할 구분 배너 -->
      <div class="role-banner ${roleMod ? 'role-banner--moderator' : 'role-banner--participant'}">
        <span class="role-banner-icon" aria-hidden="true">${roleMod ? '🎤' : '✏️'}</span>
        <div class="role-banner-text">
          <strong class="role-banner-label">${roleMod ? '사회자 · 진행자 모드' : '학생 · 참여자 모드'}</strong>
          <span class="role-banner-sub">${roleMod ? '단계 전환 · 집계 · 잠금 제어' : '해결책 작성 · 투표 · 보완 의견'}</span>
        </div>
        <span class="role-banner-phase">${escapeHtml(phaseLabel(state.room.phase))}</span>
      </div>
      <section class="panel">
        <div class="workspace-top">
          <div class="workspace-title">
            <div class="eyebrow">활동 9 해결책 경매 토의</div>
            <h2>${escapeHtml(state.room.title)}</h2>
            <p>${escapeHtml(state.room.prompt)}</p>
            ${
              state.room.scenario
                ? `<div class="note">${nl2br(state.room.scenario)}</div>`
                : ""
            }
          </div>
          <div class="workspace-code">
            <div class="room-code">
              방 코드 <strong>${escapeHtml(state.room.code)}</strong>
            </div>
            <div class="chip-row">
              <span class="status-badge phase">${escapeHtml(
                phaseLabel(state.room.phase),
              )}</span>
              <span class="status-badge ${roleMod ? 'role-mod' : 'role-participant'}">${escapeHtml(
                roleMod ? "사회자 화면" : "개인 화면",
              )}</span>
              <span class="status-badge">${escapeHtml(String(seatSummary.occupied))}/${escapeHtml(String(seatSummary.capacity))}석</span>
            </div>
            <div class="actions">
              <button class="button ghost" type="button" data-action="copy-room-code">코드 복사</button>
              <button class="button ghost" type="button" data-action="leave-room">방 나가기</button>
            </div>
          </div>
        </div>
      </section>

      <section class="panel card-pad">
        <div class="panel-head">
          <div>
            <h3>접속 현황</h3>
            <p>${escapeHtml(String(summary.total))}/${escapeHtml(String(summary.capacity))}석 사용 중 · ${escapeHtml(String(summary.available))}석 남음 · ${escapeHtml(String(summary.online))}명 현재 연결</p>
          </div>
        </div>
        ${renderSeatStrip()}
        <div class="participants">
          ${
            state.members.length
              ? state.members
                  .map((member) => {
                    const online = Date.now() - member.lastSeenAt < ONLINE_TIMEOUT_MS;
                    const phase = state.room?.phase || "brainstorm";
                    // 단계별 강조 지표
                    let primaryMetric, primaryDone;
                    if (phase === "brainstorm") {
                      primaryDone = Boolean(member.candidateTitle || member.candidateSummary);
                      primaryMetric = primaryDone
                        ? `<span class="metric metric--done">✅ 해결책 작성</span>`
                        : `<span class="metric metric--pending">⏳ 미작성</span>`;
                    } else if (phase === "auction") {
                      primaryDone = hasValidVoteTarget(member.voteCandidateId, member);
                      primaryMetric = primaryDone
                        ? `<span class="metric metric--done">✅ 투표 완료 (${escapeHtml(String(member.voteScore))}점)</span>`
                        : `<span class="metric metric--pending">⏳ 미투표</span>`;
                    } else {
                      primaryDone = Boolean(member.ready);
                      primaryMetric = primaryDone
                        ? `<span class="metric metric--done">✅ 검토 완료</span>`
                        : `<span class="metric metric--pending">🔧 작성 중</span>`;
                    }
                    return `
                      <article class="member-item">
                        <div class="member-item-head">
                          <div>
                            <strong>${escapeHtml(member.name)}</strong>
                            <div class="small">${escapeHtml(
                              member.role === "moderator" ? "사회자" : "참여자",
                            )} · 마지막 입력 ${escapeHtml(formatTime(member.updatedAt))}</div>
                          </div>
                          <div class="status-row">
                            <span class="status-badge ${online ? "online" : ""}">${online ? "온라인" : "오프라인"}</span>
                            ${member.locked ? `<span class="status-badge locked">잠금</span>` : ""}
                            ${member.blocked ? `<span class="status-badge blocked">제한</span>` : ""}
                          </div>
                        </div>
                        <div class="member-metrics">
                          ${primaryMetric}
                        </div>
                        ${
                          isModerator() && member.role !== "moderator"
                            ? `
                              <div class="actions">
                                <button class="button ghost" type="button" data-action="toggle-member-lock" data-member-id="${escapeHtml(member.id)}">
                                  ${member.locked ? "잠금 해제" : "입력 잠금"}
                                </button>
                                <button class="button ${member.blocked ? "secondary" : "warn"}" type="button" data-action="toggle-member-block" data-member-id="${escapeHtml(member.id)}">
                                  ${member.blocked ? "참여 허용" : "참여 제한"}
                                </button>
                              </div>
                            `
                            : ""
                        }
                      </article>
                    `;
                  })
                  .join("")
              : `<div class="empty">아직 참여자가 없습니다.</div>`
          }
        </div>
        <p class="footer-note">${escapeHtml(memberNote)}</p>
      </section>
    </aside>
  `;
}

// ─── 사회자: 단계별 액션 배너 ────────────────────────────────────────────────
function renderPhaseActionBanner() {
  const phase = state.room.phase;
  const summary = getParticipationSummary();
  const leaderboard = getCandidateStats();

  const configs = {
    brainstorm: {
      color: "banner--brainstorm",
      icon: "📝",
      title: "1단계 · 해결책 제안 중",
      desc: `현재 ${summary.submittedIdeas}명이 해결책을 작성했습니다. 모든 학생이 제출을 마치면 2단계로 넘어가세요.`,
      progress: `${summary.submittedIdeas} / ${summary.total - 1}명 제출`,
      progressRatio: summary.total > 1 ? summary.submittedIdeas / (summary.total - 1) : 0,
      btn: { label: "2단계 경매 점수로 전환 →", phase: "auction", style: "button" },
    },
    auction: {
      color: "banner--auction",
      icon: "⚡",
      title: "2단계 · 경매 점수 집계 중",
      desc: `현재 ${summary.voted}명이 투표를 완료했습니다. 투표가 충분히 모이면 1등 해결책을 선택하고 3단계로 이동하세요.`,
      progress: `${summary.voted} / ${summary.total - 1}명 투표`,
      progressRatio: summary.total > 1 ? summary.voted / (summary.total - 1) : 0,
      btn: leaderboard[0]
        ? { label: `"${(leaderboard[0].candidateTitle || leaderboard[0].name + "의 해결책").slice(0,20)}" 1등 선택 →`, phase: null, action: "select-winner", memberId: leaderboard[0].id, style: "button blue" }
        : { label: "집계 대기 중…", phase: null, style: "button", disabled: true },
    },
    refine: {
      color: "banner--refine",
      icon: "🔧",
      title: "3단계 · 보완 토의 중",
      desc: "학생들이 1등 해결책에 보완 의견을 작성 중입니다. 의견이 모이면 아래 최종 해결책 폼을 정리하고 4단계로 이동하세요.",
      progress: `${summary.ready}명 검토 완료`,
      progressRatio: summary.total > 1 ? summary.ready / (summary.total - 1) : 0,
      btn: { label: "4단계 결과 확정으로 →", phase: "final", style: "button" },
    },
    final: {
      color: "banner--final",
      icon: "🏆",
      title: "4단계 · 결과 확정",
      desc: "토의가 마무리되었습니다. 결과 카드를 이미지나 PDF로 저장할 수 있습니다.",
      progress: `참여 ${summary.total}명 완료`,
      progressRatio: 1,
      btn: { label: "이미지로 저장", phase: null, action: "export-image", style: "button ghost" },
      btn2: { label: "PDF 저장", phase: null, action: "export-pdf", style: "button blue" },
    },
  };

  const cfg = configs[phase] || configs.brainstorm;
  const pct = Math.round(Math.min(cfg.progressRatio, 1) * 100);

  const btnHtml = cfg.btn.disabled
    ? `<button class="${cfg.btn.style}" type="button" disabled>${escapeHtml(cfg.btn.label)}</button>`
    : cfg.btn.phase
      ? `<button class="${cfg.btn.style}" type="button" data-action="change-phase" data-phase="${escapeHtml(cfg.btn.phase)}">${escapeHtml(cfg.btn.label)}</button>`
      : `<button class="${cfg.btn.style}" type="button" data-action="${escapeHtml(cfg.btn.action || '')}" ${cfg.btn.memberId ? `data-member-id="${escapeHtml(cfg.btn.memberId)}"` : ''}>${escapeHtml(cfg.btn.label)}</button>`;

  const btn2Html = cfg.btn2
    ? `<button class="${cfg.btn2.style}" type="button" data-action="${escapeHtml(cfg.btn2.action || '')}">${escapeHtml(cfg.btn2.label)}</button>`
    : '';

  return `
    <div class="phase-action-banner ${escapeHtml(cfg.color)}">
      <div class="pab-left">
        <span class="pab-icon" aria-hidden="true">${cfg.icon}</span>
        <div class="pab-text">
          <strong class="pab-title">${escapeHtml(cfg.title)}</strong>
          <p class="pab-desc">${escapeHtml(cfg.desc)}</p>
          <div class="pab-progress-wrap">
            <div class="pab-progress-bar">
              <div class="pab-progress-fill" style="width:${pct}%"></div>
            </div>
            <span class="pab-progress-label">${escapeHtml(cfg.progress)}</span>
          </div>
        </div>
      </div>
      <div class="pab-actions">
        ${btnHtml}
        ${btn2Html}
      </div>
    </div>
  `;
}

// ─── 사회자: 단계별 핵심 패널 ──────────────────────────────────────────────
function renderPhaseFocusPanel(leaderboard) {
  const phase = state.room.phase;
  const summary = getParticipationSummary();
  const selectedWinner = leaderboard.find(
    (c) => c.id === state.room.final.selectedCandidateId,
  );
  const leadCandidate = leaderboard[0] || null;
  const otherCandidates = leaderboard.slice(1, 4);

  // ── 1단계: 참여자 제출 현황 ──
  if (phase === "brainstorm") {
    const members = state.members.filter((m) => !m.blocked && m.role !== "moderator");
    return `
      <section class="panel card-pad phase-focus-panel">
        <div class="panel-head">
          <div>
            <h3>해결책 제출 현황</h3>
            <p>학생들이 해결책을 작성하고 있습니다. 제출 완료된 학생을 확인하세요.</p>
          </div>
          <span class="status-badge phase">${summary.submittedIdeas} / ${summary.total - 1}명 제출</span>
        </div>
        <div class="submission-grid">
          ${members.length ? members.map((m) => {
            const submitted = Boolean(m.candidateTitle || m.candidateSummary);
            const online = Date.now() - m.lastSeenAt < ONLINE_TIMEOUT_MS;
            return `
              <div class="submission-item ${submitted ? 'submitted' : 'pending'}">
                <span class="submission-status-icon">${submitted ? '✅' : '⏳'}</span>
                <div class="submission-info">
                  <strong>${escapeHtml(m.name)}</strong>
                  ${submitted ? `<span class="small">${escapeHtml((m.candidateTitle || '제목 없음').slice(0, 18))}</span>` : `<span class="small muted">${online ? '작성 중…' : '오프라인'}</span>`}
                </div>
              </div>
            `;
          }).join('') : `<div class="empty">아직 참여자가 없습니다.</div>`}
        </div>
        ${summary.submittedIdeas > 0 ? `<p class="helper">✅ 제출된 해결책이 있습니다. 모두 완료되면 2단계로 전환하세요.</p>` : `<p class="helper">학생들이 해결책을 저장하면 여기에 나타납니다.</p>`}
      </section>
    `;
  }

  // ── 2단계: 실시간 경매 순위 (기존 핵심집계 전면 표시) ──
  if (phase === "auction") {
    return `
      <section class="panel card-pad phase-focus-panel">
        <div class="panel-head">
          <div>
            <h3>실시간 경매 순위</h3>
            <p>투표가 들어올 때마다 순위가 바뀝니다. 투표가 충분히 모이면 1등을 선택하세요.</p>
          </div>
          <span class="status-badge phase">${summary.voted} / ${summary.total - 1}명 투표</span>
        </div>
        ${leadCandidate ? `
          <article class="candidate-card lead-card">
            <div class="candidate-head">
              <div>
                <div class="chip-row">
                  <span class="candidate-rank">1</span>
                  <span class="status-badge online">현재 최상위</span>
                </div>
                <h3>${escapeHtml(leadCandidate.candidateTitle || `${leadCandidate.name}의 해결책`)}</h3>
                <p class="small">제안자 ${escapeHtml(leadCandidate.name)}</p>
              </div>
              <div class="score-strip">
                <span class="score-pill">총점 ${escapeHtml(String(leadCandidate.totalScore))}</span>
                <span class="score-pill">투표 ${escapeHtml(String(leadCandidate.voteCount))}</span>
                <span class="score-pill">평균 ${escapeHtml(leadCandidate.averageScore.toFixed(1))}</span>
              </div>
            </div>
            <div class="candidate-copy">${nl2br(leadCandidate.candidateSummary || "아직 요약이 없습니다.")}</div>
            <div class="grid-two compact-grid">
              <div class="insight-card">
                <strong>강점</strong>
                <p>${nl2br(leadCandidate.candidateStrength || "아직 강점 설명이 없습니다.")}</p>
              </div>
              <div class="insight-card">
                <strong>핵심 지지 이유</strong>
                ${leadCandidate.topReasons.length
                  ? `<ul>${leadCandidate.topReasons.map((r) => `<li><strong>${escapeHtml(r.name)}</strong> (${escapeHtml(String(r.score))}점) — ${escapeHtml(r.reason)}</li>`).join("")}</ul>`
                  : `<p class="muted">아직 지지 이유가 없습니다.</p>`}
              </div>
            </div>
            <div class="actions">
              <button class="button blue" type="button" data-action="select-winner" data-member-id="${escapeHtml(leadCandidate.id)}">이 해결책 1등으로 선택</button>
            </div>
          </article>
          ${otherCandidates.length ? `
            <div class="compact-candidate-list">
              ${otherCandidates.map((c, i) => `
                <article class="compact-candidate">
                  <div>
                    <div class="small">후보 ${escapeHtml(String(i + 2))}</div>
                    <strong>${escapeHtml(c.candidateTitle || `${c.name}의 해결책`)}</strong>
                    <div class="small">${escapeHtml(c.name)} · 총점 ${escapeHtml(String(c.totalScore))} · 투표 ${escapeHtml(String(c.voteCount))}</div>
                  </div>
                  <button class="button ghost" type="button" data-action="select-winner" data-member-id="${escapeHtml(c.id)}">선택</button>
                </article>
              `).join("")}
            </div>
          ` : ""}
        ` : `
          <div class="empty-state-cta">
            <div class="empty-state-icon" aria-hidden="true">⚡</div>
            <p class="empty-state-title">아직 투표 결과가 없습니다</p>
            <p class="empty-state-desc">학생들이 경매 투표를 완료하면 실시간으로 순위가 나타납니다.</p>
            <div class="empty-state-action">
              <button class="button ghost" type="button" data-action="copy-room-code">방 코드 복사해서 학생에게 공유하기</button>
            </div>
          </div>
        `}
      </section>
    `;
  }

  // ── 3단계: 우승자 카드 + 최종안 편집 ──
  if (phase === "refine") {
    const winner = selectedWinner || leadCandidate;
    return `
      <section class="panel card-pad phase-focus-panel">
        <div class="panel-head">
          <div>
            <h3>1등 해결책 확정 및 보완</h3>
            <p>선정된 해결책을 확인하고 학생들의 보완 의견을 반영해 최종안을 정리하세요.</p>
          </div>
        </div>
        ${winner ? `
          <div class="winner-summary-card">
            <div class="chip-row">
              <span class="chip">🏆 선정된 1등 해결책</span>
              <span class="chip">제안자 ${escapeHtml(winner.name)}</span>
            </div>
            <h3>${escapeHtml(winner.candidateTitle || `${winner.name}의 해결책`)}</h3>
            <p>${nl2br(winner.candidateSummary || "")}</p>
            ${winner.supplements.length ? `
              <div class="insight-card">
                <strong>학생들의 보완 의견</strong>
                <ul>${winner.supplements.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
              </div>
            ` : `<p class="helper muted">학생들의 보완 의견을 기다리는 중입니다.</p>`}
          </div>
        ` : `<div class="empty">2단계에서 먼저 1등 해결책을 선택해 주세요.</div>`}
        <form data-form="final" class="field-grid" style="margin-top:20px">
          <div class="field">
            <label for="finalTitle">최종 해결책 제목</label>
            <input id="finalTitle" name="finalTitle" value="${escapeHtml(state.drafts.final.finalTitle)}" placeholder="예: 모두가 안전하게 지키는 횡단보도 도우미 운영" />
          </div>
          <div class="field">
            <label for="finalSummary">최종 해결책 설명</label>
            <textarea id="finalSummary" name="finalSummary">${escapeHtml(state.drafts.final.finalSummary)}</textarea>
          </div>
          <div class="field-grid two field-grid--safe">
            <div class="field">
              <label for="actionSteps">실행 단계 / 보완 포인트</label>
              <textarea id="actionSteps" name="actionSteps">${escapeHtml(state.drafts.final.actionSteps)}</textarea>
            </div>
            <div class="field">
              <label for="participationSummary">참여 점검 메모</label>
              <textarea id="participationSummary" name="participationSummary">${escapeHtml(state.drafts.final.participationSummary)}</textarea>
            </div>
          </div>
          <div class="actions">
            <button class="button primary" type="submit">최종안 저장</button>
            <button class="button ghost" type="button" data-action="change-phase" data-phase="final">결과 확정 단계로 →</button>
          </div>
        </form>
      </section>
    `;
  }

  // ── 4단계: 결과 내보내기 전면 ──
  return `
    <section class="panel card-pad phase-focus-panel">
      <div class="panel-head">
        <div>
          <h3>결과 내보내기</h3>
          <p>토의 결과를 이미지나 PDF로 저장하세요.</p>
        </div>
        <div class="actions">
          <button class="button ghost" type="button" data-action="export-image">이미지 저장</button>
          <button class="button blue" type="button" data-action="export-pdf">PDF 저장</button>
        </div>
      </div>
      ${selectedWinner || leadCandidate ? `
        <div class="winner-summary-card">
          <div class="chip-row"><span class="chip">🏆 최종 선정 해결책</span></div>
          <h3>${escapeHtml(state.room.final.finalTitle || (selectedWinner || leadCandidate)?.candidateTitle || "")}</h3>
          <p>${nl2br(state.room.final.finalSummary || (selectedWinner || leadCandidate)?.candidateSummary || "")}</p>
        </div>
      ` : ""}
    </section>
  `;
}

function renderModeratorPanels() {
  const leaderboard = getCandidateStats();
  const selectedWinner = leaderboard.find(
    (candidate) => candidate.id === state.room.final.selectedCandidateId,
  );

  return `
    <section class="main">
      ${renderSummaryCards()}

      <!-- 단계 인식 액션 배너 -->
      ${renderPhaseActionBanner()}

      <!-- 빠른 진행 (단계 전환 + 잠금) — 항상 표시 -->
      <section class="panel card-pad">
        <div class="panel-head">
          <div>
            <h3>빠른 진행</h3>
            <p>단계를 전환하거나 전체 입력을 잠글 수 있습니다.</p>
          </div>
          <div class="status-row">
            <button class="room-code-badge" type="button" data-action="copy-room-code" title="방 코드 복사">
              ${escapeHtml(state.room.code)}
              <svg class="icon icon-sm" aria-hidden="true"><use href="./icons.svg#icon-copy"></use></svg>
            </button>
            <span class="status-badge">${escapeHtml(
              state.room.editingLocked ? "전체 입력 잠김" : "전체 입력 열림",
            )}</span>
          </div>
        </div>
        <div class="field-grid two field-grid--safe">
          <div class="field">
            <label for="phase">현재 단계</label>
            <select id="phase" class="phase-select" data-action="change-phase" name="phase">
              ${Object.entries(PHASE_META)
                .map(
                  ([key, meta]) => `
                    <option value="${escapeHtml(key)}" ${state.room.phase === key ? "selected" : ""}>
                      ${escapeHtml(meta.label)}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </div>
          <div class="field">
            <label>현재 1등 해결책</label>
            <div class="quick-highlight">
              ${
                selectedWinner
                  ? `<strong>${escapeHtml(selectedWinner.candidateTitle || `${selectedWinner.name}의 해결책`)}</strong>`
                  : `<strong>아직 선택 전</strong>`
              }
              <span class="small">${
                selectedWinner
                  ? `${escapeHtml(selectedWinner.name)} · 총점 ${escapeHtml(String(selectedWinner.totalScore))}`
                  : "집계가 모이면 여기서 바로 확인됩니다."
              }</span>
            </div>
          </div>
        </div>
        <div class="actions">
          <button class="button ghost" type="button" data-action="toggle-room-lock">
            ${state.room.editingLocked ? "전체 잠금 해제" : "전체 입력 잠금"}
          </button>
        </div>
        <p class="helper">단계를 바꾸면 참여자 화면이 즉시 변경됩니다.</p>
      </section>

      ${renderPhaseBar()}

      <!-- 단계별 핵심 패널 -->
      ${renderPhaseFocusPanel(leaderboard)}

      <!-- 활동 설정 (항상 접어두기) -->
      <details class="panel card-pad disclosure">
        <summary>활동 설정 자세히 보기</summary>
        <form data-form="room-settings" class="field-grid disclosure-body">
          <div class="field-grid two field-grid--safe">
            <div class="field">
              <label for="roomTitle">활동 제목</label>
              <input id="roomTitle" name="title" value="${escapeHtml(state.drafts.roomSettings.title)}" />
            </div>
            <div class="field"></div>
          </div>
          <div class="field">
            <label for="roomPrompt">토의 질문</label>
            <input id="roomPrompt" name="prompt" value="${escapeHtml(state.drafts.roomSettings.prompt)}" />
          </div>
          <div class="field">
            <label for="roomScenario">문제 상황 / 자료 안내</label>
            <textarea id="roomScenario" name="scenario">${escapeHtml(state.drafts.roomSettings.scenario)}</textarea>
          </div>
          <div class="actions">
            <button class="button primary" type="submit">질문 저장</button>
          </div>
        </form>
      </details>

      ${renderExportBoard()}
    </section>
  `;
}

function renderParticipantPanels() {
  const currentMember = getCurrentMember();
  const leaderboard = getCandidateStats();
  const voteableCandidates = getVoteableCandidates(currentMember);
  const editable = !isLockedForMember(currentMember);
  const canVote = state.room.phase !== "brainstorm";
  const canSupplement = state.room.phase === "refine" || state.room.phase === "final";
  const winnerId = state.room.final.selectedCandidateId;
  const hasVoteTarget = hasValidVoteTarget(state.drafts.participant.voteCandidateId, currentMember);
  const voteSelectEnabled = editable && canVote && voteableCandidates.length > 0;
  const voteFieldsEnabled = voteSelectEnabled && hasVoteTarget;
  const voteHelper = !canVote
    ? "1단계에서는 자신의 해결책을 먼저 정리합니다."
    : voteableCandidates.length
      ? "자기 해결책을 제외한 다른 해결책 중 하나를 골라 점수를 주세요."
      : "아직 점수를 줄 다른 해결책이 없어 경매 점수를 잠시 기다려야 합니다.";

  // 탭 상태: "my" | "vote"
  const activeTab = state.participantTab || "my";

  // 탭2 — 선택된 후보 미리보기 카드
  const selectedPreview = voteableCandidates.find(
    (c) => c.id === state.drafts.participant.voteCandidateId,
  );

  // 참여자 진행 체크리스트
  const myDone = Boolean(
    state.drafts.participant.candidateTitle || state.drafts.participant.candidateSummary,
  );
  const voteDone = hasVoteTarget;

  return `
    <section class="main">
      ${renderSummaryCards()}
      ${renderPhaseBar()}

      <section class="panel card-pad">
        <div class="panel-head">
          <div>
            <h3>개인 의사결정 작성</h3>
            <p>${escapeHtml(phaseDescription(state.room.phase))}</p>
          </div>
          <div class="status-row">
            ${
              currentMember?.ready
                ? `<span class="status-badge online">검토 완료</span>`
                : `<span class="status-badge">작성 중</span>`
            }
            ${
              editable
                ? `<span class="status-badge">입력 가능</span>`
                : `<span class="status-badge locked">읽기 전용</span>`
            }
          </div>
        </div>

        <!-- 진행 체크리스트 -->
        <div class="participant-checklist">
          <div class="checklist-step ${myDone ? 'done' : ''}">
            <span class="checklist-icon">${myDone ? '✅' : '📝'}</span>
            <span>내 해결책 작성</span>
          </div>
          <span class="checklist-arrow">→</span>
          <div class="checklist-step ${voteDone ? 'done' : (!canVote ? 'locked' : '')}">
            <span class="checklist-icon">${voteDone ? '✅' : (canVote ? '⚡' : '🔒')}</span>
            <span>경매 투표 ${!canVote ? '(2단계에 열림)' : ''}</span>
          </div>
          <span class="checklist-arrow">→</span>
          <div class="checklist-step ${currentMember?.ready ? 'done' : ''}">
            <span class="checklist-icon">${currentMember?.ready ? '✅' : '🏁'}</span>
            <span>검토 완료</span>
          </div>
        </div>

        <!-- 탭 네비게이션 -->
        <div class="participant-tabs" role="tablist">
          <button
            class="ptab ${activeTab === 'my' ? 'ptab--active' : ''}"
            type="button"
            role="tab"
            aria-selected="${activeTab === 'my'}"
            data-action="participant-tab"
            data-tab="my"
          >
            <span class="ptab-icon">📝</span>
            <span>내 해결책 작성</span>
            ${myDone ? '<span class="ptab-badge ptab-badge--done">완료</span>' : ''}
          </button>
          <button
            class="ptab ${activeTab === 'vote' ? 'ptab--active' : ''} ${!canVote ? 'ptab--locked' : ''}"
            type="button"
            role="tab"
            aria-selected="${activeTab === 'vote'}"
            data-action="participant-tab"
            data-tab="vote"
            ${!canVote ? 'title="2단계(경매 점수)부터 활성화됩니다"' : ''}
          >
            <span class="ptab-icon">${canVote ? '⚡' : '🔒'}</span>
            <span>경매 투표</span>
            ${!canVote ? '<span class="ptab-badge ptab-badge--locked">2단계~</span>' : (voteDone ? '<span class="ptab-badge ptab-badge--done">완료</span>' : '')}
          </button>
        </div>

        <form data-form="participant" class="field-grid">

          <!-- ═══ 탭 1: 내 해결책 작성 ═══ -->
          <div class="ptab-panel ${activeTab === 'my' ? '' : 'ptab-panel--hidden'}" role="tabpanel">
            <div class="field-grid two field-grid--safe">
              <div class="field">
                <label for="candidateTitle">나의 해결책 제목</label>
                <input
                  id="candidateTitle"
                  name="candidateTitle"
                  value="${escapeHtml(state.drafts.participant.candidateTitle)}"
                  placeholder="예: 대중교통 확대로 탄소 줄이기"
                  ${editable ? "" : "disabled"}
                />
              </div>
              <div class="field ready-toggle-field">
                <label class="ready-toggle-label">
                  <span>검토 완료</span>
                  <span class="ready-toggle-wrap">
                    <input
                      id="ready"
                      type="checkbox"
                      name="ready"
                      class="ready-checkbox sr-only"
                      value="true"
                      ${state.drafts.participant.ready ? "checked" : ""}
                      ${editable ? "" : "disabled"}
                    />
                    <span class="ready-toggle-track" aria-hidden="true">
                      <span class="ready-toggle-thumb"></span>
                    </span>
                    <span class="ready-toggle-text">${state.drafts.participant.ready ? '완료 ✓' : '작성 중'}</span>
                  </span>
                </label>
                <p class="helper">완료로 표시하면 사회자 화면에 즉시 반영됩니다.</p>
              </div>
            </div>
            <div class="field">
              <label for="candidateSummary">나의 해결책 설명</label>
              <textarea
                id="candidateSummary"
                name="candidateSummary"
                placeholder="내 해결책이 왜 좋은지 2~3문장으로 설명해 보세요."
                ${editable ? "" : "disabled"}
              >${escapeHtml(state.drafts.participant.candidateSummary)}</textarea>
            </div>
            <div class="field">
              <label for="candidateStrength">내 해결책의 좋은 점</label>
              <textarea
                id="candidateStrength"
                name="candidateStrength"
                placeholder="다른 해결책보다 이 안이 더 나은 이유를 적어보세요."
                ${editable ? "" : "disabled"}
              >${escapeHtml(state.drafts.participant.candidateStrength)}</textarea>
            </div>
            <div class="actions">
              <button class="button primary" type="submit" ${editable ? "" : "disabled"}>내 해결책 저장</button>
              ${canVote ? `
                <button
                  class="button ghost"
                  type="button"
                  data-action="participant-tab"
                  data-tab="vote"
                >경매 투표하러 가기 →</button>
              ` : `
                <p class="helper phase-next-hint">💡 저장 후 사회자가 2단계로 넘기면 다른 해결책에 점수를 줄 수 있습니다.</p>
              `}
            </div>
            <p class="helper">
              ${editable ? "저장하면 사회자 화면에서 즉시 집계됩니다." : "사회자가 입력을 잠갔거나 참여를 제한했습니다."}
            </p>
          </div>

          <!-- ═══ 탭 2: 경매 투표 ═══ -->
          <div class="ptab-panel ${activeTab === 'vote' ? '' : 'ptab-panel--hidden'}" role="tabpanel">
            ${!canVote ? `
              <div class="vote-phase-lock">
                <div class="vote-phase-lock-icon">🔒</div>
                <p class="vote-phase-lock-title">아직 투표 단계가 아닙니다</p>
                <p class="helper">사회자가 <strong>2단계(경매 점수)</strong>로 전환하면 여기서 다른 해결책에 점수를 줄 수 있습니다.</p>
                <button class="button ghost" type="button" data-action="participant-tab" data-tab="my">← 내 해결책 작성으로 돌아가기</button>
              </div>
            ` : `
              <!-- 투표 대상 선택 -->
              <div class="vote-target-section">
                <div class="vote-step-label">
                  <span class="vote-step-num">1</span>
                  <strong>가장 설득력 있는 해결책을 선택하세요</strong>
                </div>
                <div class="field field-grid--safe">
                  <select
                    id="voteCandidateId"
                    name="voteCandidateId"
                    class="vote-candidate-select"
                    ${voteSelectEnabled ? "" : "disabled"}
                  >
                    <option value="">— 해결책을 선택하세요 —</option>
                    ${voteableCandidates
                      .map(
                        (candidate) => `
                          <option
                            value="${escapeHtml(candidate.id)}"
                            ${state.drafts.participant.voteCandidateId === candidate.id ? "selected" : ""}
                          >
                            ${escapeHtml(candidate.candidateTitle || `${candidate.name}의 해결책`)}
                          </option>
                        `,
                      )
                      .join("")}
                  </select>
                </div>

                <!-- 선택된 후보 미리보기 카드 -->
                ${selectedPreview ? `
                  <div class="vote-preview-card">
                    <div class="vote-preview-head">
                      <strong>${escapeHtml(selectedPreview.candidateTitle || `${selectedPreview.name}의 해결책`)}</strong>
                      <span class="small">제안자 · ${escapeHtml(selectedPreview.name)}</span>
                    </div>
                    ${selectedPreview.candidateSummary ? `<p class="vote-preview-body">${nl2br(selectedPreview.candidateSummary)}</p>` : ''}
                    ${selectedPreview.candidateStrength ? `
                      <div class="vote-preview-strength">
                        <span class="vote-preview-strength-label">제안자가 밝힌 좋은 점</span>
                        <p>${nl2br(selectedPreview.candidateStrength)}</p>
                      </div>
                    ` : ''}
                  </div>
                ` : (voteableCandidates.length === 0 ? `
                  <div class="vote-waiting">
                    <p>⏳ 아직 다른 참여자의 해결책이 없습니다. 잠시 기다려 주세요.</p>
                  </div>
                ` : `
                  <div class="vote-waiting">
                    <p>👆 위에서 해결책을 선택하면 내용이 여기에 표시됩니다.</p>
                  </div>
                `)}
              </div>

              <!-- 점수 입력 -->
              <div class="vote-score-section ${!voteFieldsEnabled ? 'vote-section--locked' : ''}">
                <div class="vote-step-label">
                  <span class="vote-step-num">2</span>
                  <strong>경매 점수를 정하세요 (0~10점)</strong>
                  ${!voteFieldsEnabled ? '<span class="field-phase-hint">위에서 해결책을 먼저 선택하세요</span>' : ''}
                </div>
                <div class="vote-score-display">
                  <span class="vote-score-big">${escapeHtml(String(state.drafts.participant.voteScore || 0))}</span>
                  <span class="vote-score-unit">점</span>
                </div>
                <div class="vote-score-wrap">
                  <input
                    id="voteScore"
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    name="voteScore"
                    value="${escapeHtml(String(state.drafts.participant.voteScore || 0))}"
                    ${voteFieldsEnabled ? "" : "disabled"}
                  />
                </div>
                <div class="vote-score-ticks" aria-hidden="true">
                  ${Array.from({length: 11}, (_, i) => `<span>${i}</span>`).join('')}
                </div>
              </div>

              <!-- 이유 작성 -->
              <div class="vote-reason-section ${!voteFieldsEnabled ? 'vote-section--locked' : ''}">
                <div class="vote-step-label">
                  <span class="vote-step-num">3</span>
                  <strong>그 해결책을 높게 평가한 이유를 쓰세요</strong>
                  ${!voteFieldsEnabled ? '<span class="field-phase-hint">위에서 해결책을 먼저 선택하세요</span>' : ''}
                </div>
                <div class="field">
                  <textarea
                    id="voteReason"
                    name="voteReason"
                    placeholder="왜 이 해결책이 가장 좋다고 생각하는지 이유를 적어보세요."
                    ${voteFieldsEnabled ? "" : "disabled"}
                  >${escapeHtml(state.drafts.participant.voteReason)}</textarea>
                </div>
              </div>

              <!-- 보완 의견 (3단계~) -->
              ${canSupplement ? `
                <div class="vote-supplement-section">
                  <div class="vote-step-label">
                    <span class="vote-step-num">4</span>
                    <strong>1등 해결책 보완 의견</strong>
                    <span class="field-phase-hint">(3단계 보완 토의)</span>
                  </div>
                  <div class="field">
                    <textarea
                      id="supplementNote"
                      name="supplementNote"
                      ${editable && canSupplement ? "" : "disabled"}
                      placeholder="${
                        winnerId
                          ? "선정된 해결책을 더 좋게 만드는 아이디어를 적으세요."
                          : "사회자가 1등 해결책을 선택하면 보완 의견을 적을 수 있습니다."
                      }"
                    >${escapeHtml(state.drafts.participant.supplementNote)}</textarea>
                  </div>
                </div>
              ` : `<textarea name="supplementNote" class="sr-only" aria-hidden="true" tabindex="-1">${escapeHtml(state.drafts.participant.supplementNote)}</textarea>`}

              <div class="actions">
                <button class="button primary" type="submit" ${editable ? "" : "disabled"}>투표 저장</button>
                <button class="button ghost" type="button" data-action="participant-tab" data-tab="my">← 내 해결책으로</button>
              </div>
              <p class="helper">${editable ? "저장하면 사회자 화면 집계에 즉시 반영됩니다." : "사회자가 입력을 잠갔거나 참여를 제한했습니다."}</p>
            `}
          </div>

        </form>
      </section>

      <section class="panel card-pad">
        <div class="panel-head">
          <div>
            <h3>현재 경매 순위</h3>
            <p>모둠 안에서 어떤 해결책이 높은 점수를 받고 있는지 확인합니다.</p>
          </div>
        </div>
        <div class="candidate-grid">
          ${
            leaderboard.length
              ? leaderboard
                  .map(
                    (candidate, index) => `
                      <article class="candidate-card">
                        <div class="candidate-head">
                          <div>
                            <div class="chip-row">
                              <span class="candidate-rank">${escapeHtml(String(index + 1))}</span>
                              ${
                                state.room.final.selectedCandidateId === candidate.id
                                  ? `<span class="status-badge online">사회자 선택</span>`
                                  : ""
                              }
                            </div>
                            <h3>${escapeHtml(candidate.candidateTitle || `${candidate.name}의 해결책`)}</h3>
                            <p class="small">제안자 ${escapeHtml(candidate.name)}</p>
                          </div>
                          <div class="score-strip">
                            <span class="score-pill">총점 ${escapeHtml(String(candidate.totalScore))}</span>
                            <span class="score-pill">투표 ${escapeHtml(String(candidate.voteCount))}</span>
                          </div>
                        </div>
                        <div class="candidate-copy">${nl2br(candidate.candidateSummary || "아직 설명이 없습니다.")}</div>
                        <div class="candidate-meta">
                          <div class="insight-card">
                            <strong>좋은 점</strong>
                            <p>${nl2br(candidate.candidateStrength || "아직 좋은 점 설명이 없습니다.")}</p>
                          </div>
                        </div>
                      </article>
                    `,
                  )
                  .join("")
              : `<div class="empty">아직 제출된 해결책이 없습니다.</div>`
          }
        </div>
      </section>

      ${renderExportBoard()}
    </section>
  `;
}

function renderExportBoard() {
  const leaderboard = getCandidateStats();
  const selectedWinner =
    leaderboard.find((candidate) => candidate.id === state.room.final.selectedCandidateId) ||
    leaderboard[0] ||
    null;
  const summary = getParticipationSummary();
  const finalTitle =
    state.room.final.finalTitle ||
    selectedWinner?.candidateTitle ||
    "아직 최종 제목이 정해지지 않았습니다.";
  const finalSummary =
    state.room.final.finalSummary ||
    selectedWinner?.candidateSummary ||
    "사회자가 최종 해결책을 아직 정리하지 않았습니다.";
  const actionSteps =
    state.room.final.actionSteps ||
    (selectedWinner?.supplements.length
      ? selectedWinner.supplements.join("\n")
      : "실행 단계와 보완 포인트를 사회자가 정리할 수 있습니다.");
  const participationSummary =
    state.room.final.participationSummary ||
    `정원 ${summary.capacity}석 중 ${summary.total}석이 사용 중이며, ${summary.ready}명이 작성 완료, ${summary.voted}명이 점수 제출을 마쳤습니다.`;

  return `
    <section class="panel card-pad">
      <div class="panel-head">
        <div>
          <h3>결과 카드 / 내보내기</h3>
          <p>최종 모둠 결과를 이미지와 PDF로 저장할 수 있습니다.</p>
        </div>
        ${
          isModerator()
            ? `
              <div class="actions">
                <button class="button ghost" type="button" data-action="export-image">이미지 저장</button>
                <button class="button blue" type="button" data-action="export-pdf">PDF 저장</button>
              </div>
            `
            : ""
        }
      </div>
      <div id="export-board" class="export-board">
        <div class="export-head">
          <div>
            <div class="eyebrow">아홉 번째 놀이</div>
            <h3>${escapeHtml(state.room.title)}</h3>
            <p>${escapeHtml(state.room.prompt)}</p>
          </div>
          <div class="status-row">
            <span class="status-badge phase">${escapeHtml(phaseLabel(state.room.phase))}</span>
            <span class="status-badge">방 코드 ${escapeHtml(state.room.code)}</span>
          </div>
        </div>

        <div class="winner-box">
          <div class="winner-card">
            <div class="chip-row">
              <span class="chip">최종 모둠 해결책</span>
              ${
                selectedWinner
                  ? `<span class="chip">기반 아이디어 ${escapeHtml(selectedWinner.name)}</span>`
                  : ""
              }
            </div>
            <h4>${escapeHtml(finalTitle)}</h4>
            <p>${nl2br(finalSummary)}</p>
            ${
              selectedWinner
                ? `
                  <div class="tag-row">
                    <span class="tag">경매 총점 ${escapeHtml(String(selectedWinner.totalScore))}</span>
                    <span class="tag">지지 ${escapeHtml(String(selectedWinner.voteCount))}명</span>
                    <span class="tag">평균 ${escapeHtml(selectedWinner.averageScore.toFixed(1))}점</span>
                  </div>
                `
                : ""
            }
          </div>
        </div>

        <div class="final-grid">
          <section class="final-notes">
            <h4>실행 단계 / 보완 포인트</h4>
            <p>${nl2br(actionSteps)}</p>
          </section>
          <section class="final-notes">
            <h4>참여 점검</h4>
            <p>${nl2br(participationSummary)}</p>
            <ul>
              <li>모둠 정원 ${escapeHtml(String(summary.capacity))}석</li>
              <li>사용 중 좌석 ${escapeHtml(String(summary.total))}석</li>
              <li>남은 자리 ${escapeHtml(String(summary.available))}석</li>
              <li>현재 접속 ${escapeHtml(String(summary.online))}명</li>
              <li>해결책 제출 ${escapeHtml(String(summary.submittedIdeas))}명</li>
              <li>점수 제출 ${escapeHtml(String(summary.voted))}명</li>
            </ul>
          </section>
        </div>
      </div>
    </section>
  `;
}

function renderWorkspace() {
  const mod = isModerator();
  return `
    <section class="workspace ${mod ? 'workspace--moderator' : 'workspace--participant'}">
      ${renderRoomSidebar()}
      ${mod ? renderModeratorPanels() : renderParticipantPanels()}
    </section>
  `;
}

function renderNotice() {
  if (!state.notice) {
    return "";
  }

  return `<div class="notice ${escapeHtml(state.notice.type)}">${escapeHtml(
    state.notice.text,
  )}</div>`;
}

function renderConnectionStatus() {
  if (state.isOnline) {
    return "";
  }
  return `
    <div class="connection-status offline">
      <span>⚠️ 오프라인</span>
      <span class="small">네트워크 연결을 확인해 주세요</span>
    </div>
  `;
}

function render() {
  const backendMode = state.backend?.mode || "demo";
  app.innerHTML = `
    <div class="stack">
      <section class="hero">
        <article class="panel hero-copy">
          <div class="eyebrow">${backendMode === "firebase" ? "Firebase 실시간 연결" : "데모 모드 준비 완료"}</div>
          <h1>해결책 경매 토의 웹학습지</h1>
          <div class="question-pill">Q. 여러 해결책 중 무엇이 가장 바람직할까?</div>
          <p>
            사회자 모드에서는 방을 만들고 토의 단계를 전환하며, 참여자의 작성 상태를 보고 잠금이나 참여 제한을 제어할 수 있습니다.
            개인 모드에서는 자신의 해결책을 적고, 다른 해결책에 점수를 주고, 1등 해결책을 보완하는 의견을 실시간으로 보낼 수 있습니다.
            최종 결과는 결과 카드 형태로 이미지와 PDF로 내려받을 수 있습니다.
          </p>
        </article>
        <article class="panel hero-art">
          <div class="art-stage">
            <div class="art-banner">즐거운 경매 축제</div>
            <div class="art-balloons"><span></span><span></span><span></span></div>
            <div class="art-trophy"></div>
            <div class="art-trophy-label">최고 경매왕</div>
            <div class="score-bubble score-a">10점</div>
            <div class="score-bubble score-b">9점</div>
            <div class="score-bubble score-c">8점</div>
            <div class="hero-caption">"가장 좋은 해결책을 찾아라"</div>
          </div>
        </article>
      </section>

      ${state.loading ? `<div class="empty">앱을 준비하는 중입니다.</div>` : ""}
      ${!state.loading && !state.session ? renderLobby() : ""}
      ${
        !state.loading && state.session && !state.room
          ? `<div class="empty">방 정보를 불러오는 중입니다.</div>`
          : ""
      }
      ${!state.loading && state.session && state.room ? renderWorkspace() : ""}
    </div>
    <div id="connection-status-container">${renderConnectionStatus()}</div>
    <div id="notice-container">${renderNotice()}</div>
  `;
}

export { showNotice, render, renderNoticeOnly, renderConnectionStatusOnly };
