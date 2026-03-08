/**
 * 렌더링 최적화 테스트
 * - Notice 표시 시 전체 DOM이 아닌 부분만 업데이트되는지 확인
 * - Connection status 변경 시 부분만 업데이트되는지 확인
 */

import { chromium } from "playwright";

async function testRenderOptimization() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("1. 페이지 로딩...");
    await page.goto("http://localhost:4173");
    await page.waitForLoadState("networkidle");

    console.log("2. 초기 DOM 구조 확인...");
    const hasNoticeContainer = await page.locator("#notice-container").count();
    const hasConnectionContainer = await page.locator("#connection-status-container").count();

    console.log(`   - Notice 컨테이너: ${hasNoticeContainer > 0 ? "✅" : "❌"}`);
    console.log(`   - Connection 컨테이너: ${hasConnectionContainer > 0 ? "✅" : "❌"}`);

    console.log("\n3. 방 생성 폼 작성...");
    await page.fill('input[name="moderatorName"]', "테스트사회자");
    await page.fill('input[name="title"]', "렌더링 테스트");

    // DOM 변경 관찰을 위한 스크립트 주입
    await page.evaluate(() => {
      window.domChangeCount = 0;
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.target.id === 'app') {
            window.domChangeCount++;
            console.log('🔄 전체 DOM 재생성 감지:', window.domChangeCount);
          }
        });
      });
      observer.observe(document.querySelector('#app'), {
        childList: true,
        subtree: false
      });
    });

    console.log("\n4. 방 생성 제출...");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const domChanges = await page.evaluate(() => window.domChangeCount);
    console.log(`   - 전체 DOM 재생성 횟수: ${domChanges}회 (예상: 1회)`);

    console.log("\n5. Notice 자동 사라짐 확인...");
    await page.waitForTimeout(4000);
    const finalDomChanges = await page.evaluate(() => window.domChangeCount);
    console.log(`   - 최종 DOM 재생성 횟수: ${finalDomChanges}회`);
    console.log(`   - Notice 사라질 때 전체 렌더링 발생: ${finalDomChanges > domChanges ? "❌" : "✅"}`);

    console.log("\n6. 오프라인 모드 시뮬레이션...");
    await context.setOffline(true);
    await page.waitForTimeout(500);

    const offlineStatus = await page.locator(".connection-status.offline").count();
    console.log(`   - 오프라인 표시: ${offlineStatus > 0 ? "✅" : "❌"}`);

    const offlineDomChanges = await page.evaluate(() => window.domChangeCount);
    console.log(`   - 오프라인 전환 시 DOM 재생성: ${offlineDomChanges > finalDomChanges ? "❌" : "✅"}`);

    console.log("\n7. 온라인 복구...");
    await context.setOffline(false);
    await page.waitForTimeout(500);

    const onlineStatus = await page.locator(".connection-status.offline").count();
    console.log(`   - 오프라인 표시 사라짐: ${onlineStatus === 0 ? "✅" : "❌"}`);

    console.log("\n✅ 렌더링 최적화 테스트 완료");
    await page.screenshot({ path: "test-render-optimization.png", fullPage: true });
    console.log("   - 스크린샷 저장: test-render-optimization.png");

  } catch (error) {
    console.error("❌ 테스트 실패:", error.message);
    await page.screenshot({ path: "test-render-error.png", fullPage: true });
  } finally {
    await browser.close();
  }
}

testRenderOptimization();
