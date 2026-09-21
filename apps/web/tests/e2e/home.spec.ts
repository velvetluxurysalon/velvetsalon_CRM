import { test, expect } from '@playwright/test';

test('home page shows Velvet heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /velvet/i })).toBeVisible();
});
