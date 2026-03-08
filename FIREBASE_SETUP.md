# Firebase 설정 가이드

modum-auction 프로젝트를 Firebase와 연결하는 단계별 가이드입니다.

## 📋 사전 준비

- [ ] Google 계정
- [ ] Firebase 콘솔 접근 권한
- [ ] 프로젝트 파일에 대한 쓰기 권한

## 🚀 1단계: Firebase 프로젝트 생성

### 1.1 Firebase Console 접속
1. https://console.firebase.google.com/ 접속
2. Google 계정으로 로그인

### 1.2 새 프로젝트 만들기
1. "프로젝트 추가" 클릭
2. 프로젝트 이름 입력 (예: `modum-auction`)
3. Google 애널리틱스 설정 (선택사항, 교육용이라면 비활성화 권장)
4. "프로젝트 만들기" 클릭
5. 프로젝트 생성 완료 대기 (약 30초)

## 🔐 2단계: Authentication 설정

### 2.1 익명 인증 활성화
1. 왼쪽 메뉴에서 "Authentication" 클릭
2. "시작하기" 클릭 (처음인 경우)
3. "Sign-in method" 탭 클릭
4. "익명" 제공업체 찾기
5. "사용 설정" 토글 ON
6. "저장" 클릭

✅ 익명 인증을 사용하면 학생들이 별도 로그인 없이 참여 가능합니다.

## 💾 3단계: Firestore Database 생성

### 3.1 Firestore 설정
1. 왼쪽 메뉴에서 "Firestore Database" 클릭
2. "데이터베이스 만들기" 클릭
3. 위치 선택:
   - 추천: `asia-northeast3 (서울)` - 한국에서 가장 빠름
   - 대안: `asia-northeast1 (도쿄)` - 서울 리전 없을 경우
4. "다음" 클릭

### 3.2 보안 규칙 모드 선택
1. **"프로덕션 모드"** 선택 (잠금 모드)
2. "만들기" 클릭
3. Firestore 생성 완료 대기 (약 1분)

⚠️ 프로덕션 모드를 선택하면 기본적으로 모든 접근이 차단됩니다.
   다음 단계에서 우리의 보안 규칙을 적용할 예정입니다.

## 📜 4단계: Firestore 보안 규칙 적용

### 4.1 보안 규칙 설정
1. Firestore Database 화면에서 "규칙" 탭 클릭
2. 기존 규칙을 모두 삭제
3. `/Users/yeohanki/Documents/Inbox/modum-auction/firestore.rules` 파일 내용을 복사
4. Firebase Console의 규칙 편집기에 붙여넣기
5. "게시" 클릭

### 4.2 규칙 검증
규칙이 올바르게 적용되었는지 확인:
- 규칙 편집기 상단에 "규칙이 유효합니다" 메시지 표시
- 오류가 있다면 빨간색으로 표시됨

✅ 우리의 보안 규칙은 다음을 보장합니다:
- XSS 공격 방지 (문자열 길이 제한)
- memberCount 조작 방지
- 역할 기반 권한 제어 (사회자/참여자)
- 필드별 수정 권한 분리

## 🔑 5단계: Firebase Config 가져오기

### 5.1 웹 앱 추가
1. Firebase 프로젝트 홈 화면으로 이동
2. "웹 앱에 Firebase 추가" (</> 아이콘) 클릭
3. 앱 닉네임 입력 (예: `modum-auction-web`)
4. "Firebase Hosting도 설정합니다" 체크 해제 (현재는 불필요)
5. "앱 등록" 클릭

### 5.2 Config 복사
다음과 같은 형식의 설정이 표시됩니다:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "modum-auction-xxxxx.firebaseapp.com",
  projectId: "modum-auction-xxxxx",
  storageBucket: "modum-auction-xxxxx.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

**중요**: 이 설정값을 어딘가에 임시 저장해 두세요!

## ⚙️ 6단계: 프로젝트 설정 파일 수정

### 6.1 firebase-config.js 수정

`/Users/yeohanki/Documents/Inbox/modum-auction/firebase-config.js` 파일을 다음과 같이 수정:

```javascript
window.APP_USE_DEMO = false;  // true → false로 변경
window.APP_FIREBASE_CONFIG = {
  apiKey: "여기에_복사한_API_KEY",
  authDomain: "여기에_복사한_AUTH_DOMAIN",
  projectId: "여기에_복사한_PROJECT_ID",
  storageBucket: "여기에_복사한_STORAGE_BUCKET",
  messagingSenderId: "여기에_복사한_SENDER_ID",
  appId: "여기에_복사한_APP_ID",
};
```

### 6.2 보안 주의사항

⚠️ **주의**: `firebase-config.js`에는 실제 API 키가 포함됩니다.

- ✅ 이 파일을 Git에 커밋하지 마세요 (`.gitignore`에 추가 권장)
- ✅ 공개 저장소에 업로드하지 마세요
- ✅ Firebase Console의 보안 규칙이 데이터를 보호합니다
- ✅ API 키는 클라이언트 측 식별용이며, 보안 규칙이 실제 접근을 제어합니다

## 🧪 7단계: 연결 테스트

### 7.1 서버 재시작
```bash
# 기존 서버 종료 (Ctrl+C)
# 서버 재시작
npm start
```

### 7.2 브라우저 테스트
1. http://localhost:4173 접속
2. 개발자 도구 열기 (F12)
3. Console 탭에서 에러 확인
4. 상단 배너에 "Firebase 실시간 연결" 표시 확인

### 7.3 기능 테스트
1. "사회자 모드"에서 방 생성
2. 개발자 도구 > Console에서 Firebase 연결 로그 확인
3. Firebase Console > Firestore Database에서 데이터 생성 확인
4. 새 탭에서 "개인 모드"로 방 입장
5. 실시간 동기화 확인

## ✅ 완료 체크리스트

- [ ] Firebase 프로젝트 생성
- [ ] Authentication > 익명 인증 활성화
- [ ] Firestore Database 생성 (서울 리전 권장)
- [ ] Firestore 보안 규칙 적용 및 게시
- [ ] Firebase Config 복사
- [ ] firebase-config.js 수정
- [ ] 서버 재시작 및 테스트
- [ ] 실시간 동기화 확인

## 🔧 문제 해결

### "Firebase: Error (auth/configuration-not-found)"
→ `firebase-config.js`의 설정값이 올바른지 확인

### "Missing or insufficient permissions"
→ Firestore 보안 규칙이 올바르게 적용되었는지 확인

### "Firebase App named '[DEFAULT]' already exists"
→ 페이지 새로고침 (이미 초기화된 상태)

### 데이터가 실시간으로 동기화되지 않음
→ 브라우저 Console에서 WebSocket 연결 확인
→ Firebase Console > Firestore > 사용량 탭에서 읽기/쓰기 확인

## 📚 추가 설정 (선택사항)

### 허용 도메인 추가
배포 시 Firebase Console에서:
1. Authentication > Settings > Authorized domains
2. 배포 도메인 추가 (예: `modum-auction.web.app`)

### Firebase Hosting (선택)
무료 호스팅이 필요한 경우:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 🎓 교육용 권장사항

1. **학생 수에 따른 Firestore 무료 한도**:
   - 일일 읽기: 50,000건
   - 일일 쓰기: 20,000건
   - 일반적인 수업(30명 x 5시간)으로는 무료 한도 내에서 충분

2. **데이터 보존 기간**:
   - Firestore 데이터는 자동으로 삭제되지 않음
   - 수업 후 Firebase Console에서 수동 삭제 가능
   - Cloud Functions로 자동 삭제 설정 가능 (선택사항)

3. **비용 관리**:
   - Firebase Console > 사용량 및 결제 메뉴에서 실시간 모니터링
   - 예산 알림 설정 권장

---

**설정 완료!** 🎉

이제 Firebase와 연결된 실시간 협업 학습지를 사용할 수 있습니다.
