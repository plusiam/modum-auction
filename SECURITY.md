# 🔒 보안 가이드

## ⚠️ 중요: Firebase 설정 보안

### Firebase API 키 보호

**절대 하지 말아야 할 것:**
- ❌ `firebase-config.js` 파일을 Git에 커밋하지 마세요
- ❌ API 키를 공개 저장소에 업로드하지 마세요
- ❌ 스크린샷이나 로그에 API 키가 노출되지 않도록 주의하세요

**올바른 사용 방법:**
- ✅ `firebase-config.example.js`를 복사하여 `firebase-config.js` 생성
- ✅ Firebase Console에서 받은 실제 값으로 교체
- ✅ `.gitignore`에 `firebase-config.js`가 포함되어 있는지 확인

### 초기 설정 방법

```bash
# 1. example 파일 복사
cp firebase-config.example.js firebase-config.js

# 2. firebase-config.js 파일 열어서 실제 값 입력
# Firebase Console → Project Settings → General → Your apps → SDK setup and configuration

# 3. Git에 추가되지 않았는지 확인
git status  # firebase-config.js가 "Untracked files"에 없어야 함
```

## 🛡️ Firestore Security Rules

현재 적용된 보안 규칙:

### 1. 문자열 길이 제한
- `title`: 100자
- `prompt`: 500자
- `summary`: 1000자
- `scenario`: 2000자
- `participantName`, `moderatorName`: 50자

### 2. 데이터 무결성 보호
- `memberCount`: 블록/차단 해제 시 ±1만 허용
- `id`, `role`: 사용자가 수정 불가
- `blocked`: 사회자만 수정 가능

### 3. Enum 검증
- `phase`: setup, write, vote, final만 허용
- `role`: moderator, participant만 허용

### 4. 권한 분리
- **일반 사용자**: 자신의 member 문서만 수정 가능 (id/role/blocked 제외)
- **사회자**: room 문서 및 모든 member 문서 수정 가능 (id/role 제외)

## 🔐 XSS 방어

모든 사용자 입력은 HTML 엔티티 이스케이핑 처리:

```javascript
function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

## 🚨 보안 사고 발생 시

### API 키가 노출된 경우

1. **즉시 Firebase Console에서 키 재생성**
   - Firebase Console → Project Settings → General
   - Web App 삭제 후 재생성

2. **Git 히스토리에서 제거**
   ```bash
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch firebase-config.js' \
     --prune-empty --tag-name-filter cat -- --all

   git push origin main --force
   ```

3. **Firestore 보안 규칙 점검**
   - Firebase Console → Firestore Database → Rules
   - 모든 규칙이 정상 작동하는지 확인

4. **Authentication 활동 로그 확인**
   - Firebase Console → Authentication → Users
   - 의심스러운 익명 사용자가 있는지 확인

## 📋 보안 체크리스트

### 배포 전 확인사항

- [ ] `firebase-config.js`가 `.gitignore`에 포함되어 있음
- [ ] Git 히스토리에 민감 정보가 없음
- [ ] Firestore Security Rules가 적용되어 있음
- [ ] XSS 방어 코드가 모든 동적 값에 적용되어 있음
- [ ] 네트워크 오류 처리가 구현되어 있음

### 정기 점검사항

- [ ] Firebase 사용량 모니터링 (비정상 패턴 감지)
- [ ] Authentication 사용자 목록 확인
- [ ] Firestore 데이터 백업
- [ ] 보안 규칙 업데이트 필요 여부 확인

## 📚 추가 리소스

- [Firebase Security Best Practices](https://firebase.google.com/docs/rules/best-practices)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Web Security Fundamentals](https://developer.mozilla.org/en-US/docs/Web/Security)
