import { test, expect } from './fixtures/onboarded';

test.describe('FP-039 — core', () => {
  test.beforeEach(async ({ onboardedPage }) => {
    await onboardedPage.openGame('match');
    await onboardedPage.waitForMatchCards();
  });

  test('match-grid max 360px', async ({ onboardedPage }) => {
    const box = await onboardedPage.page.locator('#match-grid').boundingBox();
    expect(Math.round(box!.width)).toBeLessThanOrEqual(360);
  });

  test('each card < 200px height', async ({ onboardedPage }) => {
    const cards = onboardedPage.page.locator('.match-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height, `card ${i} height`).toBeLessThan(200);
      expect(box!.width, `card ${i} width`).toBeLessThan(200);
    }
  });

  test('each card >= 72px touch target', async ({ onboardedPage }) => {
    await onboardedPage.assertTouchTarget('.match-card', 72);
  });
});

test.describe('FP-039 — desktop (1280x720)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test('cards within bounds on desktop', async ({ onboardedPage }) => {
    await onboardedPage.openGame('match');
    await onboardedPage.waitForMatchCards();
    const cards = onboardedPage.page.locator('.match-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height, `card ${i} height`).toBeLessThan(200);
      expect(box!.height, `card ${i} touch`).toBeGreaterThanOrEqual(72);
    }
  });
});

test.describe('FP-039 — ipad (768x1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test('cards within bounds on ipad', async ({ onboardedPage }) => {
    await onboardedPage.openGame('match');
    await onboardedPage.waitForMatchCards();
    const cards = onboardedPage.page.locator('.match-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height, `card ${i} height`).toBeLessThan(200);
      expect(box!.height, `card ${i} touch`).toBeGreaterThanOrEqual(72);
    }
  });
});

test.describe('FP-039 — mobile (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('cards within bounds on mobile', async ({ onboardedPage }) => {
    await onboardedPage.openGame('match');
    await onboardedPage.waitForMatchCards();
    const cards = onboardedPage.page.locator('.match-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height, `card ${i} height`).toBeLessThan(200);
      expect(box!.height, `card ${i} touch`).toBeGreaterThanOrEqual(72);
    }
  });
});
