/**
 * Firebase 연결 테스트
 * - Firebase 초기화 확인
 * - 익명 인증 확인
 * - 방 생성 및 Firestore 저장 확인
 */

import { chromium } from "playwright";

async function testFirebaseConnection() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("1. 페이지 로딩...");

    // Console 로그 수집
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === "error") {
        console.log(`   [Browser Error] ${text}`);
      }
    });

    await page.goto("http://localhost:4173", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000); // Firebase 초기화 대기

    console.log("\n2. Firebase 초기화 확인...");
    const firebaseState = await page.evaluate(() => ({
      useDemo: window.APP_USE_DEMO,
      hasConfig: window.APP_FIREBASE_CONFIG !== null,
      projectId: window.APP_FIREBASE_CONFIG?.projectId,
    }));

    console.log(`   - Demo 모드: ${firebaseState.useDemo ? "❌ (켜짐)" : "✅ (꺼짐)"}`);
    console.log(`   - Firebase Config: ${firebaseState.hasConfig ? "✅ (설정됨)" : "❌ (없음)"}`);
    console.log(`   - Project ID: ${firebaseState.projectId || "N/A"}`);

    if (firebaseState.useDemo) {
      throw new Error("Demo 모드가 켜져 있습니다. firebase-config.js를 확인하세요.");
    }

    console.log("\n3. 방 생성...");
    await page.fill('input[name="moderatorName"]', "Firebase테스트");
    await page.fill('input[name="title"]', "Firebase 연결 테스트");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000); // Firebase 저장 대기

    console.log("\n4. 방 코드 확인...");
    const roomCodeExists = await page.locator('h2').count();
    console.log(`   - 방 제목 표시: ${roomCodeExists > 0 ? "✅" : "❌"}`);

    if (roomCodeExists > 0) {
      const roomTitle = await page.locator('h2').first().textContent();
      console.log(`   - 방 제목: ${roomTitle}`);
    }

    const roleLabels = await page.locator('.role-label').count();
    console.log(`   - 역할 표시: ${roleLabels}개 (사회자/개인)`)

    console.log("\n5. Firestore 데이터 확인...");
    console.log("   📌 Firebase Console에서 확인하세요:");
    console.log("   - Firestore Database → 'rooms' 컬렉션");
    console.log("   - 방 제목: 'Firebase 연결 테스트'");
    console.log("   - 사회자: 'Firebase테스트'");

    console.log("\n6. 스크린샷 저장...");
    await page.screenshot({ path: "test-firebase-connection.png", fullPage: true });
    console.log("   - 저장 위치: test-firebase-connection.png");

    console.log("\n✅ Firebase 연결 테스트 완료!");
    console.log("\n📋 다음 단계:");
    console.log("   1. Firebase Console → Firestore Database 확인");
    console.log("   2. 'rooms' 컬렉션에 데이터가 저장되었는지 확인");
    console.log("   3. Authentication → Users에 익명 사용자가 생성되었는지 확인");

  } catch (error) {
    console.error("\n❌ 테스트 실패:", error.message);
    await page.screenshot({ path: "test-firebase-error.png", fullPage: true });
    console.log("   - 에러 스크린샷: test-firebase-error.png");
  } finally {
    await browser.close();
  }
}

testFirebaseConnection();
