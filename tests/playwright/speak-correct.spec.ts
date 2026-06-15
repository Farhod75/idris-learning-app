import { test, expect } from './fixtures/onboarded';

test.describe('speakCorrect — correct-answer TTS format', () => {
  test('no-SR fallback shows localized correct label, not celebrate phrase', async ({ onboardedPage }) => {
    await onboardedPage.openGame('speak');
    await onboardedPage.page.locator('#micBtn').click();
    await onboardedPage.page.waitForTimeout(300);
    const result = await onboardedPage.page.locator('#speak-result').textContent() ?? '';
    expect(result).toContain('✅');
    expect(result).toContain('Correct');
    expect(result).not.toMatch(/Amazing|Brilliant|Superstar|You did it/);
  });
});
