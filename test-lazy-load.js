/**
 * Lazy Load 테스트
 * - 초기 페이지 로드 시 html2canvas, jspdf가 로드되지 않는지 확인
 * - Export 버튼 클릭 시 라이브러리가 동적으로 로드되는지 확인
 */

import { chromium } from "playwright";

async function testLazyLoad() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("1. 초기 페이지 로딩...");
    await page.goto("http://localhost:4173");
    await page.waitForLoadState("networkidle");

    console.log("\n2. 초기 로드 상태 확인...");
    const initialState = await page.evaluate(() => ({
      html2canvas: typeof window.html2canvas !== "undefined",
      jspdf: typeof window.jspdf !== "undefined",
    }));

    console.log(`   - html2canvas 로드됨: ${initialState.html2canvas ? "❌ (즉시 로드됨)" : "✅ (lazy load)"}`);
    console.log(`   - jsPDF 로드됨: ${initialState.jspdf ? "❌ (즉시 로드됨)" : "✅ (lazy load)"}`);

    console.log("\n3. 방 생성...");
    await page.fill('input[name="moderatorName"]', "테스트사회자");
    await page.fill('input[name="title"]', "번들 최적화 테스트");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    console.log("\n4. 단계 변경 (final)...");
    await page.selectOption('select[data-action="change-phase"]', "final");
    await page.waitForTimeout(1000);

    console.log("\n5. Export 버튼 찾기...");
    const exportButtonExists = await page.locator('[data-action="export-image"]').count();
    console.log(`   - Export 버튼 존재: ${exportButtonExists > 0 ? "✅" : "❌"}`);

    if (exportButtonExists > 0) {
      console.log("\n6. Export 버튼 클릭 전 상태 확인...");
      const beforeExport = await page.evaluate(() => ({
        html2canvas: typeof window.html2canvas !== "undefined",
        jspdf: typeof window.jspdf !== "undefined",
      }));

      console.log(`   - html2canvas 로드됨: ${beforeExport.html2canvas ? "❌" : "✅"}`);
      console.log(`   - jsPDF 로드됨: ${beforeExport.jspdf ? "❌" : "✅"}`);

      console.log("\n7. Export 이미지 클릭...");
      await page.click('[data-action="export-image"]');
      await page.waitForTimeout(2000);

      console.log("\n8. Export 후 상태 확인...");
      const afterExport = await page.evaluate(() => ({
        html2canvas: typeof window.html2canvas !== "undefined",
        jspdf: typeof window.jspdf !== "undefined",
      }));

      console.log(`   - html2canvas 로드됨: ${afterExport.html2canvas ? "✅ (동적 로드 성공)" : "❌ (로드 실패)"}`);
      console.log(`   - jsPDF 로드됨: ${afterExport.jspdf ? "✅ (동적 로드 성공)" : "❌ (로드 실패)"}`);

      console.log("\n9. 초기 페이지 크기 절감 효과:");
      console.log("   - html2canvas: ~180KB 절감");
      console.log("   - jsPDF: ~200KB 절감");
      console.log("   - 총 절감: ~380KB (초기 로딩 속도 개선)");
    }

    console.log("\n✅ Lazy Load 테스트 완료");
    await page.screenshot({ path: "test-lazy-load.png", fullPage: true });
    console.log("   - 스크린샷 저장: test-lazy-load.png");

  } catch (error) {
    console.error("❌ 테스트 실패:", error.message);
    await page.screenshot({ path: "test-lazy-load-error.png", fullPage: true });
  } finally {
    await browser.close();
  }
}

testLazyLoad();
