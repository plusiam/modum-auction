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
  renderSeatStrip,
} from "./validators.js";

function showNotice(type, text) {
  state.notice = { type, text };
  renderNoticeOnly();
  window.clearTimeout(showNotice.timerId);
  showNotice.timerId = window.setTimeout(() => {
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
      <article class="panel panel-body">
        <div class="panel-head">
          <div>
            <h2>사회자 모드</h2>
            <p>방을 열고 단계 전환, 참여자 제어, 최종 결과 정리를 담당합니다.</p>
          </div>
          <span class="role-label">사회자</span>
        </div>
        <form data-form="create-room" class="field-grid">
          <div class="field-grid two">
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

      <article class="panel panel-body">
        <div class="panel-head">
          <div>
            <h2>개인 모드</h2>
            <p>사회자가 공유한 코드를 입력해 자신의 해결책과 점수를 제출합니다.</p>
          </div>
          <span class="role-label">개인</span>
        </div>
        <form data-form="join-room" class="field-grid">
          <div class="field-grid two">
            <div class="field">
              <label for="participantName">참여자 이름</label>
              <input id="participantName" name="participantName" value="${escapeHtml(
                state.drafts.joinRoom.participantName,
              )}" placeholder="예: 박서준" />
            </div>
            <div class="field">
              <label for="roomCode">방 코드</label>
              <input id="roomCode" name="roomCode" maxlength="6" value="${escapeHtml(
                state.drafts.joinRoom.roomCode,
              )}" placeholder="예: AB12CD" />
            </div>
          </div>
          <div class="actions">
            <button class="button blue" type="submit">방 참여하기</button>
          </div>
        </form>

        <div class="room-search">
          <div class="panel-head">
            <div>
              <h3>최근 방 찾기</h3>
              <p>실시간으로 열린 방을 검색해서 코드를 바로 채울 수 있습니다.</p>
            </div>
          </div>
          <div class="field">
            <label for="roomSearch">검색</label>
            <input
              id="roomSearch"
              data-action="room-search"
              value="${escapeHtml(state.lobbySearch)}"
              placeholder="활동 제목 또는 코드"
            />
          </div>
          <div class="list">
            ${
              filteredRooms.length
                ? filteredRooms
                    .map(
                      (room) => `
                        <div class="room-item">
                          <div class="room-item-head">
                            <div>
                              <strong>${escapeHtml(room.title)}</strong>
                              <div class="small">질문: ${escapeHtml(room.prompt)}</div>
                            </div>
                            <span class="chip">${escapeHtml(room.code)}</span>
                          </div>
                          <div class="tag-row">
                            <span class="tag">자리 ${escapeHtml(String(room.participantCount || 0))}/${escapeHtml(String(room.maxMembers || DEFAULT_ROOM_MEMBERS))}</span>
                            <span class="tag">${room.isFull ? "정원 마감" : `남은 ${escapeHtml(String(room.availableSeats || 0))}자리`}</span>
                            <span class="tag">${escapeHtml(phaseLabel(room.phase))}</span>
                          </div>
                          <div class="actions">
                            <button
                              class="button ghost"
                              type="button"
                              data-action="use-room-code"
                              data-room-code="${escapeHtml(room.code)}"
                            >
                              코드 채우기
                            </button>
                          </div>
                        </div>
                      `,
                    )
                    .join("")
                : `<div class="empty">검색 결과가 없습니다. 사회자가 먼저 방을 열어 주세요.</div>`
            }
          </div>
          <p class="footer-note">
            현재 연결: <strong>${escapeHtml(state.backend?.mode || "demo")}</strong>
            ${state.backend?.mode === "demo" ? " | Firebase 설정 전에는 데모 저장소로 동작합니다." : ""}
          </p>
        </div>
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

  return `
    <aside class="sidebar">
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
              <span class="status-badge">${escapeHtml(
                isModerator() ? "사회자 화면" : "개인 화면",
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
                    const submitted =
                      member.candidateTitle || member.candidateSummary ? "해결책 작성" : "미작성";
                    const voted = hasValidVoteTarget(member.voteCandidateId, member)
                      ? `점수 ${escapeHtml(String(member.voteScore))}`
                      : "미투표";
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
                            ${
                              member.locked
                                ? `<span class="status-badge locked">잠금</span>`
                                : ""
                            }
                            ${
                              member.blocked
                                ? `<span class="status-badge blocked">제한</span>`
                                : ""
                            }
                          </div>
                        </div>
                        <div class="member-metrics">
                          <span class="metric">${escapeHtml(submitted)}</span>
                          <span class="metric">${escapeHtml(voted)}</span>
                          <span class="metric">${member.ready ? "검토 완료" : "작성 중"}</span>
                        </div>
                        ${
                          isModerator() && member.role !== "moderator"
                            ? `
                              <div class="actions">
                                <button
                                  class="button ghost"
                                  type="button"
                                  data-action="toggle-member-lock"
                                  data-member-id="${escapeHtml(member.id)}"
                                >
                                  ${member.locked ? "잠금 해제" : "입력 잠금"}
                                </button>
                                <button
                                  class="button ${member.blocked ? "secondary" : "warn"}"
                                  type="button"
                                  data-action="toggle-member-block"
                                  data-member-id="${escapeHtml(member.id)}"
                                >
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

function renderModeratorPanels() {
  const leaderboard = getCandidateStats();
  const selectedWinner = leaderboard.find(
    (candidate) => candidate.id === state.room.final.selectedCandidateId,
  );

  return `
    <section class="main">
      ${renderSummaryCards()}
      ${renderPhaseBar()}

      <section class="panel card-pad">
        <div class="panel-head">
          <div>
            <h3>사회자 제어</h3>
            <p>방 단계, 질문, 문제 상황, 전체 입력 잠금을 바로 조정합니다.</p>
          </div>
          <div class="status-row">
            <span class="status-badge">${escapeHtml(
              state.room.editingLocked ? "전체 입력 잠김" : "전체 입력 열림",
            )}</span>
          </div>
        </div>
        <form data-form="room-settings" class="field-grid">
          <div class="field-grid two">
            <div class="field">
              <label for="roomTitle">활동 제목</label>
              <input id="roomTitle" name="title" value="${escapeHtml(
                state.drafts.roomSettings.title,
              )}" />
            </div>
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
          </div>
          <div class="field">
            <label for="roomPrompt">토의 질문</label>
            <input id="roomPrompt" name="prompt" value="${escapeHtml(
              state.drafts.roomSettings.prompt,
            )}" />
          </div>
          <div class="field">
            <label for="roomScenario">문제 상황 / 자료 안내</label>
            <textarea id="roomScenario" name="scenario">${escapeHtml(
              state.drafts.roomSettings.scenario,
            )}</textarea>
          </div>
          <div class="actions">
            <button class="button primary" type="submit">질문 저장</button>
            <button class="button ghost" type="button" data-action="toggle-room-lock">
              ${state.room.editingLocked ? "전체 잠금 해제" : "전체 입력 잠금"}
            </button>
          </div>
        </form>
      </section>

      <section class="panel card-pad">
        <div class="panel-head">
          <div>
            <h3>실시간 경매 집계</h3>
            <p>점수 합계와 지지 이유를 보고 1등 해결책을 선택할 수 있습니다.</p>
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
                                  ? `<span class="status-badge online">현재 선택된 1등안</span>`
                                  : ""
                              }
                            </div>
                            <h3>${escapeHtml(candidate.candidateTitle || `${candidate.name}의 해결책`)}</h3>
                            <p class="small">제안자 ${escapeHtml(candidate.name)}</p>
                          </div>
                          <div class="score-strip">
                            <span class="score-pill">총점 ${escapeHtml(String(candidate.totalScore))}</span>
                            <span class="score-pill">투표 ${escapeHtml(String(candidate.voteCount))}</span>
                            <span class="score-pill">평균 ${escapeHtml(candidate.averageScore.toFixed(1))}</span>
                          </div>
                        </div>
                        <div class="candidate-copy">${nl2br(candidate.candidateSummary || "아직 요약이 없습니다.")}</div>
                        <div class="candidate-meta">
                          <div class="insight-card">
                            <strong>강점</strong>
                            <p>${nl2br(candidate.candidateStrength || "아직 강점 설명이 없습니다.")}</p>
                          </div>
                          <div class="grid-two">
                            <div class="insight-card">
                              <strong>지지 이유</strong>
                              ${
                                candidate.topReasons.length
                                  ? `
                                    <ul>
                                      ${candidate.topReasons
                                        .map(
                                          (reason) => `
                                            <li><strong>${escapeHtml(reason.name)}</strong> (${escapeHtml(String(reason.score))}점) - ${escapeHtml(reason.reason)}</li>
                                          `,
                                        )
                                        .join("")}
                                    </ul>
                                  `
                                  : `<p class="muted">아직 지지 이유가 없습니다.</p>`
                              }
                            </div>
                            <div class="insight-card">
                              <strong>보완 메모</strong>
                              ${
                                candidate.supplements.length
                                  ? `
                                    <ul>
                                      ${candidate.supplements
                                        .map((item) => `<li>${escapeHtml(item)}</li>`)
                                        .join("")}
                                    </ul>
                                  `
                                  : `<p class="muted">보완 의견이 아직 없습니다.</p>`
                              }
                            </div>
                          </div>
                        </div>
                        <div class="actions">
                          <button
                            class="button blue"
                            type="button"
                            data-action="select-winner"
                            data-member-id="${escapeHtml(candidate.id)}"
                          >
                            1등 해결책으로 선택
                          </button>
                        </div>
                      </article>
                    `,
                  )
                  .join("")
              : `<div class="empty">참여자들이 해결책을 제출하면 여기에서 순위가 정리됩니다.</div>`
          }
        </div>
        ${
          selectedWinner
            ? `<p class="helper">현재 선택된 해결책은 <strong>${escapeHtml(
                selectedWinner.name,
              )}</strong>의 제안입니다.</p>`
            : ""
        }
      </section>

      <section class="panel card-pad">
        <div class="panel-head">
          <div>
            <h3>최종 모둠 해결책</h3>
            <p>사회자가 실시간 집계를 바탕으로 최종 해결책을 정리합니다.</p>
          </div>
        </div>
        <form data-form="final" class="field-grid">
          <div class="field">
            <label for="finalTitle">최종 해결책 제목</label>
            <input id="finalTitle" name="finalTitle" value="${escapeHtml(
              state.drafts.final.finalTitle,
            )}" placeholder="예: 모두가 안전하게 지키는 횡단보도 도우미 운영" />
          </div>
          <div class="field">
            <label for="finalSummary">최종 해결책 설명</label>
            <textarea id="finalSummary" name="finalSummary">${escapeHtml(
              state.drafts.final.finalSummary,
            )}</textarea>
          </div>
          <div class="field-grid two">
            <div class="field">
              <label for="actionSteps">실행 단계 / 보완 포인트</label>
              <textarea id="actionSteps" name="actionSteps">${escapeHtml(
                state.drafts.final.actionSteps,
              )}</textarea>
            </div>
            <div class="field">
              <label for="participationSummary">참여 점검 메모</label>
              <textarea id="participationSummary" name="participationSummary">${escapeHtml(
                state.drafts.final.participationSummary,
              )}</textarea>
            </div>
          </div>
          <div class="actions">
            <button class="button primary" type="submit">최종안 저장</button>
            <button class="button ghost" type="button" data-action="change-phase" data-phase="final">
              결과 확정 단계로 전환
            </button>
          </div>
        </form>
      </section>

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
        <form data-form="participant" class="field-grid">
          <div class="field-grid two">
            <div class="field">
              <label for="candidateTitle">나의 해결책 제목</label>
              <input
                id="candidateTitle"
                name="candidateTitle"
                value="${escapeHtml(state.drafts.participant.candidateTitle)}"
                ${editable ? "" : "disabled"}
              />
            </div>
            <div class="field">
              <label for="voteCandidateId">가장 설득력 있는 해결책</label>
              <select
                id="voteCandidateId"
                name="voteCandidateId"
                ${voteSelectEnabled ? "" : "disabled"}
              >
                <option value="">선택하세요</option>
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
          </div>
          <div class="field">
            <label for="candidateSummary">나의 해결책 설명</label>
            <textarea
              id="candidateSummary"
              name="candidateSummary"
              ${editable ? "" : "disabled"}
            >${escapeHtml(state.drafts.participant.candidateSummary)}</textarea>
          </div>
          <div class="field">
            <label for="candidateStrength">내 해결책의 좋은 점</label>
            <textarea
              id="candidateStrength"
              name="candidateStrength"
              ${editable ? "" : "disabled"}
            >${escapeHtml(state.drafts.participant.candidateStrength)}</textarea>
          </div>
          <div class="field-grid two">
            <div class="field">
              <label for="voteScore">경매 점수 (${escapeHtml(
                String(state.drafts.participant.voteScore || 0),
              )}점)</label>
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
              <p class="helper">${escapeHtml(voteHelper)}</p>
            </div>
            <div class="field">
              <label for="ready">현재 입력을 검토 완료로 표시</label>
              <select id="ready" name="ready" ${editable ? "" : "disabled"}>
                <option value="false" ${state.drafts.participant.ready ? "" : "selected"}>아직 작성 중</option>
                <option value="true" ${state.drafts.participant.ready ? "selected" : ""}>검토 완료</option>
              </select>
            </div>
          </div>
          <div class="field-grid two">
            <div class="field">
              <label for="voteReason">그 해결책을 높게 평가한 이유</label>
              <textarea
                id="voteReason"
                name="voteReason"
                ${voteFieldsEnabled ? "" : "disabled"}
              >${escapeHtml(state.drafts.participant.voteReason)}</textarea>
            </div>
            <div class="field">
              <label for="supplementNote">1등 해결책 보완 의견</label>
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
          <div class="actions">
            <button class="button primary" type="submit" ${editable ? "" : "disabled"}>의견 저장</button>
          </div>
          <p class="helper">
            ${
              editable
                ? "저장하면 사회자 화면에서 즉시 집계됩니다."
                : "사회자가 입력을 잠갔거나 참여를 제한했습니다."
            }
          </p>
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
  return `
    <section class="workspace">
      ${renderRoomSidebar()}
      ${isModerator() ? renderModeratorPanels() : renderParticipantPanels()}
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
