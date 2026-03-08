const STORAGE_KEY = "auction-worksheet-store-v1";
const CHANNEL_KEY = "auction-worksheet-sync-v1";
const FIREBASE_VERSION = "10.12.5";
export const ONLINE_TIMEOUT_MS = 45000;
export const MIN_ROOM_MEMBERS = 2;
export const MAX_ROOM_MEMBERS = 10;
export const DEFAULT_ROOM_MEMBERS = 6;

const ROOM_PHASES = ["brainstorm", "auction", "refine", "final"];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function now() {
  return Date.now();
}

function clampRoomMembers(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_ROOM_MEMBERS;
  }

  return Math.min(MAX_ROOM_MEMBERS, Math.max(MIN_ROOM_MEMBERS, Math.round(parsed)));
}

function randomId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 10)}`;
}

function randomCode(length = 6) {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return result;
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nested]) => nested !== undefined)
        .map(([key, nested]) => [key, stripUndefined(nested)]),
    );
  }

  return value;
}

function normalizeFinal(final = {}) {
  return {
    selectedCandidateId: "",
    finalTitle: "",
    finalSummary: "",
    actionSteps: "",
    participationSummary: "",
    ...final,
  };
}

function normalizeRoom(room = {}) {
  return {
    id: room.id || "",
    code: (room.code || "").toUpperCase(),
    title: room.title || "해결책 경매 토의",
    prompt: room.prompt || "여러 해결책 중 무엇이 가장 바람직할까?",
    scenario: room.scenario || "",
    maxMembers: clampRoomMembers(room.maxMembers),
    memberCount: Number(room.memberCount || 0),
    activeCount: Number(room.activeCount || 0),
    phase: ROOM_PHASES.includes(room.phase) ? room.phase : "brainstorm",
    editingLocked: Boolean(room.editingLocked),
    moderatorUid: room.moderatorUid || "",
    createdAt: Number(room.createdAt || now()),
    updatedAt: Number(room.updatedAt || now()),
    final: normalizeFinal(room.final),
  };
}

function normalizeMember(member = {}) {
  return {
    id: member.id || member.uid || "",
    name: member.name || "이름 없음",
    role: member.role === "moderator" ? "moderator" : "participant",
    joinedAt: Number(member.joinedAt || now()),
    lastSeenAt: Number(member.lastSeenAt || now()),
    locked: Boolean(member.locked),
    blocked: Boolean(member.blocked),
    ready: Boolean(member.ready),
    candidateTitle: member.candidateTitle || "",
    candidateSummary: member.candidateSummary || "",
    candidateStrength: member.candidateStrength || "",
    voteCandidateId: member.voteCandidateId || "",
    voteScore: Number(member.voteScore || 0),
    voteReason: member.voteReason || "",
    supplementNote: member.supplementNote || "",
    updatedAt: Number(member.updatedAt || member.lastSeenAt || now()),
  };
}

function sortRooms(rooms) {
  return [...rooms].sort((left, right) => right.updatedAt - left.updatedAt);
}

function sortMembers(members) {
  return [...members].sort((left, right) => left.joinedAt - right.joinedAt);
}

function summarizeRoom(room, members) {
  const normalizedRoom = normalizeRoom(room);
  const participantCount = members.length
    ? members.filter((member) => !member.blocked).length
    : normalizedRoom.memberCount;
  const availableSeats = Math.max(0, normalizedRoom.maxMembers - participantCount);

  // members 배열이 있으면 실시간 계산, 없으면 Room 문서의 activeCount 사용
  const activeCount = members.length
    ? members.filter(
        (member) => now() - member.lastSeenAt < ONLINE_TIMEOUT_MS && !member.blocked,
      ).length
    : normalizedRoom.activeCount;

  return {
    ...normalizedRoom,
    participantCount,
    availableSeats,
    isFull: availableSeats === 0,
    activeCount,
  };
}

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"rooms":{}}');
  } catch (error) {
    console.warn("Local store could not be parsed. Resetting.", error);
    return { rooms: {} };
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function getSessionUid() {
  const existing = sessionStorage.getItem("auction-worksheet-tab-uid");
  if (existing) {
    return existing;
  }

  const uid = randomId();
  sessionStorage.setItem("auction-worksheet-tab-uid", uid);
  return uid;
}

export async function createBackend() {
  const config = window.APP_FIREBASE_CONFIG;
  const forceDemo = window.APP_USE_DEMO === true;

  if (!forceDemo && config && config.apiKey) {
    try {
      return await createFirebaseBackend(config);
    } catch (error) {
      console.warn("Firebase backend init failed, falling back to demo mode.", error);
    }
  }

  return createDemoBackend();
}

function createDemoBackend() {
  const uid = getSessionUid();
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(CHANNEL_KEY)
      : null;

  let store = readStore();
  const roomSubscribers = new Set();
  const roomDetailSubscribers = new Map();

  function snapshotRooms() {
    return sortRooms(
      Object.values(store.rooms).map((room) =>
        summarizeRoom(room, Object.values(room.members || {}).map(normalizeMember)),
      ),
    );
  }

  function snapshotRoom(roomId) {
    const room = store.rooms[roomId];
    if (!room) {
      return null;
    }

    const normalizedRoom = normalizeRoom(room);
    const members = sortMembers(Object.values(room.members || {}).map(normalizeMember));
    return { room: normalizedRoom, members };
  }

  function emitRooms() {
    const rooms = snapshotRooms();
    roomSubscribers.forEach((subscriber) => subscriber(rooms));
  }

  function emitRoom(roomId) {
    const subscribers = roomDetailSubscribers.get(roomId);
    if (!subscribers) {
      return;
    }

    const nextSnapshot = snapshotRoom(roomId);
    subscribers.forEach((subscriber) => subscriber(nextSnapshot));
  }

  function emitAll() {
    emitRooms();
    roomDetailSubscribers.forEach((_, roomId) => emitRoom(roomId));
  }

  function persist() {
    writeStore(store);
    emitAll();
    channel?.postMessage({ type: "sync" });
  }

  function ensureUniqueCode() {
    let code = randomCode();

    while (Object.values(store.rooms).some((room) => room.code === code)) {
      code = randomCode();
    }

    return code;
  }

  function assertRoom(roomId) {
    const room = store.rooms[roomId];
    if (!room) {
      throw new Error("방을 찾지 못했습니다.");
    }
    return room;
  }

  function touchRoom(room) {
    room.updatedAt = now();
  }

  function countJoinableMembers(room) {
    return Object.values(room.members || {})
      .map(normalizeMember)
      .filter((member) => !member.blocked).length;
  }

  async function updateMember(roomId, memberId, patch) {
    const room = assertRoom(roomId);
    const existing = room.members[memberId];

    if (!existing) {
      throw new Error("참여자 정보를 찾지 못했습니다.");
    }

    room.members[memberId] = normalizeMember({
      ...existing,
      ...stripUndefined(patch),
      id: memberId,
      updatedAt: now(),
    });
    room.memberCount = countJoinableMembers(room);

    // activeCount 계산 (Demo 모드)
    const allMembers = Object.values(room.members).map(normalizeMember);
    room.activeCount = allMembers.filter(
      (member) => now() - member.lastSeenAt < ONLINE_TIMEOUT_MS && !member.blocked,
    ).length;

    touchRoom(room);
    persist();
  }

  const handleStorageChange = (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }
    store = readStore();
    emitAll();
  };

  const handleChannelMessage = () => {
    store = readStore();
    emitAll();
  };

  window.addEventListener("storage", handleStorageChange);
  channel?.addEventListener("message", handleChannelMessage);

  return {
    mode: "demo",
    async init() {
      return { uid, provider: "demo" };
    },
    subscribeRooms(callback) {
      roomSubscribers.add(callback);
      callback(snapshotRooms());
      return () => roomSubscribers.delete(callback);
    },
    subscribeRoom(roomId, callback) {
      if (!roomDetailSubscribers.has(roomId)) {
        roomDetailSubscribers.set(roomId, new Set());
      }

      const subscribers = roomDetailSubscribers.get(roomId);
      subscribers.add(callback);
      callback(snapshotRoom(roomId));

      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          roomDetailSubscribers.delete(roomId);
        }
      };
    },
    async createRoom({ moderatorName, title, prompt, scenario, maxMembers }) {
      const roomId = randomId();
      const createdAt = now();
      const room = normalizeRoom({
        id: roomId,
        code: ensureUniqueCode(),
        moderatorUid: uid,
        title,
        prompt,
        scenario,
        maxMembers,
        memberCount: 1,
        activeCount: 1,
        phase: "brainstorm",
        editingLocked: false,
        createdAt,
        updatedAt: createdAt,
      });
      const member = normalizeMember({
        id: uid,
        name: moderatorName,
        role: "moderator",
        ready: true,
        joinedAt: createdAt,
        lastSeenAt: createdAt,
      });

      store.rooms[roomId] = { ...room, members: { [uid]: member } };
      persist();

      return {
        roomId,
        roomCode: room.code,
        memberId: uid,
        role: "moderator",
      };
    },
    async joinRoom({ participantName, roomCode }) {
      const normalizedCode = roomCode.trim().toUpperCase();
      const room = Object.values(store.rooms).find(
        (candidate) => candidate.code === normalizedCode,
      );

      if (!room) {
        throw new Error("입력한 방 코드를 찾을 수 없습니다.");
      }

      const existing = room.members[uid];
      if (existing?.blocked) {
        throw new Error("사회자가 현재 참여를 제한했습니다.");
      }

      if (!existing && countJoinableMembers(room) >= normalizeRoom(room).maxMembers) {
        throw new Error("이 모둠은 이미 정원이 가득 찼습니다.");
      }

      room.members[uid] = normalizeMember({
        ...existing,
        id: uid,
        name: participantName,
        role: existing?.role === "moderator" ? "moderator" : "participant",
        joinedAt: existing?.joinedAt || now(),
        lastSeenAt: now(),
        blocked: false,
      });
      room.memberCount = countJoinableMembers(room);
      touchRoom(room);
      persist();

      return {
        roomId: room.id,
        roomCode: room.code,
        memberId: uid,
        role: room.members[uid].role,
      };
    },
    async updateRoom(roomId, patch) {
      const room = assertRoom(roomId);
      const roomPatch = stripUndefined(patch);
      store.rooms[roomId] = {
        ...room,
        ...roomPatch,
        maxMembers: clampRoomMembers(roomPatch.maxMembers ?? room.maxMembers),
        memberCount: Number(roomPatch.memberCount ?? room.memberCount ?? 0),
        final: normalizeFinal({
          ...room.final,
          ...stripUndefined(roomPatch.final || {}),
        }),
        updatedAt: now(),
      };
      persist();
    },
    updateMember,
    async touch(roomId, memberId) {
      try {
        await updateMember(roomId, memberId, { lastSeenAt: now() });
      } catch (error) {
        console.warn("Presence touch failed.", error);
      }
    },
    cleanup() {
      // 이벤트 리스너 제거
      window.removeEventListener("storage", handleStorageChange);
      channel?.removeEventListener("message", handleChannelMessage);
      channel?.close();

      // 구독자 정리
      roomSubscribers.clear();
      roomDetailSubscribers.clear();
    },
  };
}

async function createFirebaseBackend(config) {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
    import(
      `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`
    ),
  ]);

  const {
    initializeApp,
    getApps,
  } = appModule;
  const {
    getAuth,
    signInAnonymously,
  } = authModule;
  const {
    getFirestore,
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    setDoc,
    where,
  } = firestoreModule;

  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  async function ensureAuth() {
    if (auth.currentUser) {
      return auth.currentUser;
    }

    const credential = await signInAnonymously(auth);
    return credential.user;
  }

  async function ensureUniqueCode() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = randomCode();
      const existing = await getDocs(
        query(collection(db, "rooms"), where("code", "==", code), limit(1)),
      );
      if (existing.empty) {
        return code;
      }
    }

    throw new Error("방 코드 생성에 실패했습니다. 다시 시도해 주세요.");
  }

  function roomRef(roomId) {
    return doc(db, "rooms", roomId);
  }

  function memberRef(roomId, memberId) {
    return doc(db, "rooms", roomId, "members", memberId);
  }

  async function updateRoom(roomId, patch) {
    const cleanPatch = stripUndefined(patch);
    const payload = {
      ...cleanPatch,
      updatedAt: now(),
    };

    if (cleanPatch.final) {
      payload.final = normalizeFinal(cleanPatch.final);
    }

    if (cleanPatch.maxMembers !== undefined) {
      payload.maxMembers = clampRoomMembers(cleanPatch.maxMembers);
    }

    if (cleanPatch.memberCount !== undefined) {
      payload.memberCount = Number(cleanPatch.memberCount);
    }

    await setDoc(
      roomRef(roomId),
      payload,
      { merge: true },
    );
  }

  async function updateMember(roomId, memberId, patch) {
    const cleanPatch = stripUndefined(patch);
    const patchKeys = Object.keys(cleanPatch);
    const shouldTouchRoom = patchKeys.some((key) => key !== "lastSeenAt");

    await runTransaction(db, async (transaction) => {
      const memberSnapshot = await transaction.get(memberRef(roomId, memberId));
      if (!memberSnapshot.exists()) {
        throw new Error("참여자 정보를 찾지 못했습니다.");
      }

      const existing = normalizeMember({ id: memberSnapshot.id, ...memberSnapshot.data() });
      const nextBlocked =
        cleanPatch.blocked !== undefined ? Boolean(cleanPatch.blocked) : existing.blocked;
      const blockedChanged = existing.blocked !== nextBlocked;

      transaction.set(
        memberRef(roomId, memberId),
        {
          ...cleanPatch,
          id: memberId,
          updatedAt: now(),
        },
        { merge: true },
      );

      if (!shouldTouchRoom && !blockedChanged) {
        return;
      }

      const roomSnapshot = await transaction.get(roomRef(roomId));
      if (!roomSnapshot.exists()) {
        throw new Error("방을 찾지 못했습니다.");
      }

      const room = normalizeRoom({ id: roomSnapshot.id, ...roomSnapshot.data() });
      const roomPatch = { updatedAt: now() };

      if (blockedChanged) {
        const delta = nextBlocked ? -1 : 1;
        roomPatch.memberCount = Math.max(
          0,
          Math.min(room.maxMembers, room.memberCount + delta),
        );
      }

      // activeCount 재계산 (모든 멤버 조회 필요)
      const membersSnapshot = await transaction.get(
        query(collection(db, "rooms", roomId, "members")),
      );
      const allMembers = membersSnapshot.docs.map((doc) =>
        normalizeMember({ id: doc.id, ...doc.data() }),
      );
      roomPatch.activeCount = allMembers.filter(
        (member) => now() - member.lastSeenAt < ONLINE_TIMEOUT_MS && !member.blocked,
      ).length;

      transaction.set(roomRef(roomId), roomPatch, { merge: true });
    });
  }

  return {
    mode: "firebase",
    async init() {
      const user = await ensureAuth();
      return { uid: user.uid, provider: "firebase" };
    },
    subscribeRooms(callback) {
      const unsubscribe = onSnapshot(
        query(collection(db, "rooms"), orderBy("updatedAt", "desc"), limit(24)),
        (snapshot) => {
          const rooms = snapshot.docs.map((roomDoc) =>
            summarizeRoom(normalizeRoom({ id: roomDoc.id, ...roomDoc.data() }), []),
          );
          callback(rooms);
        },
      );
      return unsubscribe;
    },
    subscribeRoom(roomId, callback) {
      let currentRoom = null;
      let currentMembers = [];
      let roomLoaded = false;
      let membersLoaded = false;

      const emit = () => {
        if (!roomLoaded || !membersLoaded) {
          return;
        }

        if (!currentRoom) {
          callback(null);
          return;
        }

        callback({
          room: currentRoom,
          members: currentMembers,
        });
      };

      const unsubscribeRoom = onSnapshot(roomRef(roomId), (snapshot) => {
        currentRoom = snapshot.exists()
          ? normalizeRoom({ id: snapshot.id, ...snapshot.data() })
          : null;
        roomLoaded = true;
        emit();
      });

      const unsubscribeMembers = onSnapshot(
        query(collection(db, "rooms", roomId, "members"), orderBy("joinedAt", "asc")),
        (snapshot) => {
          currentMembers = snapshot.docs.map((memberDoc) =>
            normalizeMember({ id: memberDoc.id, ...memberDoc.data() }),
          );
          membersLoaded = true;
          emit();
        },
      );

      return () => {
        unsubscribeRoom();
        unsubscribeMembers();
      };
    },
    async createRoom({ moderatorName, title, prompt, scenario, maxMembers }) {
      const user = await ensureAuth();
      const roomId = randomId();
      const createdAt = now();
      const code = await ensureUniqueCode();
      const room = normalizeRoom({
        id: roomId,
        code,
        moderatorUid: user.uid,
        title,
        prompt,
        scenario,
        maxMembers,
        memberCount: 1,
        activeCount: 1,
        phase: "brainstorm",
        editingLocked: false,
        createdAt,
        updatedAt: createdAt,
      });
      const member = normalizeMember({
        id: user.uid,
        name: moderatorName,
        role: "moderator",
        ready: true,
        joinedAt: createdAt,
        lastSeenAt: createdAt,
      });

      await setDoc(roomRef(roomId), room);
      await setDoc(memberRef(roomId, user.uid), member);

      return {
        roomId,
        roomCode: code,
        memberId: user.uid,
        role: "moderator",
      };
    },
    async joinRoom({ participantName, roomCode }) {
      const user = await ensureAuth();
      const normalizedCode = roomCode.trim().toUpperCase();
      const roomSnapshot = await getDocs(
        query(collection(db, "rooms"), where("code", "==", normalizedCode), limit(1)),
      );

      if (roomSnapshot.empty) {
        throw new Error("입력한 방 코드를 찾을 수 없습니다.");
      }

      const roomDoc = roomSnapshot.docs[0];
      let nextRole = "participant";

      await runTransaction(db, async (transaction) => {
        const latestRoomSnapshot = await transaction.get(roomRef(roomDoc.id));
        if (!latestRoomSnapshot.exists()) {
          throw new Error("방을 찾지 못했습니다.");
        }

        const room = normalizeRoom({ id: latestRoomSnapshot.id, ...latestRoomSnapshot.data() });
        const membershipReference = memberRef(roomDoc.id, user.uid);
        const membershipSnapshot = await transaction.get(membershipReference);
        const membership = membershipSnapshot.exists()
          ? normalizeMember({ id: membershipSnapshot.id, ...membershipSnapshot.data() })
          : null;

        if (membership?.blocked) {
          throw new Error("사회자가 현재 참여를 제한했습니다.");
        }

        if (!membership && room.memberCount >= room.maxMembers) {
          throw new Error("이 모둠은 이미 정원이 가득 찼습니다.");
        }

        nextRole = membership?.role === "moderator" ? "moderator" : "participant";

        transaction.set(
          membershipReference,
          {
            ...membership,
            id: user.uid,
            name: participantName,
            role: nextRole,
            joinedAt: membership?.joinedAt || now(),
            lastSeenAt: now(),
            blocked: false,
            updatedAt: now(),
          },
          { merge: true },
        );

        transaction.set(
          roomRef(roomDoc.id),
          {
            updatedAt: now(),
            memberCount: membership ? room.memberCount : room.memberCount + 1,
          },
          { merge: true },
        );
      });

      return {
        roomId: roomDoc.id,
        roomCode: normalizedCode,
        memberId: user.uid,
        role: nextRole,
      };
    },
    updateRoom,
    updateMember,
    async touch(roomId, memberId) {
      try {
        await updateMember(roomId, memberId, { lastSeenAt: now() });
      } catch (error) {
        console.warn("Presence touch failed.", error);
      }
    },
    cleanup() {
      // Firebase는 구독 해제가 이미 각 unsubscribe 함수를 통해 이루어지므로
      // 추가적인 cleanup이 필요하지 않음
      // 만약 필요하다면 state에서 관리되는 unsubRooms와 unsubRoom을 호출
    },
  };
}
