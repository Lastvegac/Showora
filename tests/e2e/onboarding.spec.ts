import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('registration, verified email, real tenant login, RBAC, team and invitation on desktop/mobile', async ({
  page,
  request,
}, info) => {
  const id = randomUUID().slice(0, 8);
  const email = `browser-${id}@example.test`;
  const slug = `browser-${id}`;
  const password = 'browser integration passphrase';
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/register');
  await page.getByLabel(/^Họ và tên/).fill('Browser Owner');
  await page.getByLabel(/^Tên doanh nghiệp/).fill('Browser Test Workspace');
  await page.getByLabel(/^Email công việc/).fill(email);
  await page.getByLabel(/^Tên miền doanh nghiệp/).fill(slug);
  await page.getByLabel(/^Mật khẩu/).fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Tạo không gian doanh nghiệp/ }).click();
  await expect(page.getByText(/Yêu cầu đã được tiếp nhận/)).toBeVisible();
  let messageId = '';
  await expect
    .poll(
      async () => {
        const response = await request.get('http://127.0.0.1:8025/api/v1/messages');
        const mailbox = (await response.json()) as {
          messages: { ID: string; To: { Address: string }[] }[];
        };
        messageId =
          mailbox.messages.find((message) =>
            message.To.some((recipient) => recipient.Address === email),
          )?.ID ?? '';
        return !!messageId;
      },
      { timeout: 20000 },
    )
    .toBe(true);
  const message = (await (
    await request.get(`http://127.0.0.1:8025/api/v1/message/${messageId}`)
  ).json()) as { Text: string };
  const link = message.Text.match(/http:\/\/localhost:5178\/verify-email\?token=[a-f0-9]+/)?.[0];
  expect(link).toBeTruthy();
  await page.goto(link!);
  await page.getByRole('button', { name: /Xác minh và tạo doanh nghiệp/ }).click();
  await expect(page.getByText(/Không gian doanh nghiệp của bạn đã sẵn sàng/)).toBeVisible();
  await page.getByRole('link', { name: /Đến không gian doanh nghiệp/ }).click();
  await expect(page).toHaveURL(new RegExp(`${slug}\\.localhost:5178/login`));
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Mật khẩu/).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào Owner/ })).toBeVisible();
  await expect(page.getByText('Browser Test Workspace', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('dashboard-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: 'Nhóm kinh doanh', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Đội ngũ mạnh bắt đầu từ một nhóm' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tạo nhóm', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Tên nhóm/).fill('Nhóm phát triển');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('combobox').selectOption('manager');
  await dialog.getByRole('button', { name: 'Lưu nhóm' }).click();
  await expect(page.getByRole('heading', { name: 'Nhóm phát triển', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Vai trò & phân quyền', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo vai trò', exact: true }).click();
  await dialog.getByLabel(/^Tên vai trò/).fill('Người xem sản phẩm');
  await dialog.getByLabel('products.read', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Lưu vai trò' }).click();
  await expect(
    page.getByRole('heading', { name: 'Người xem sản phẩm', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Đội ngũ', exact: true }).click();
  await page.getByRole('button', { name: 'Mời thành viên', exact: true }).click();
  await dialog.getByLabel(/^Email công việc/).fill(`editor-${id}@example.test`);
  await dialog.getByLabel(/Biên tập nội dung/).check();
  await dialog.getByRole('button', { name: 'Gửi lời mời' }).click();
  await expect(page.getByText(`editor-${id}@example.test`, { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('members-desktop.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đội ngũ của bạn' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Mở điều hướng' }).click();
  await dialog.getByRole('link', { name: 'Tổng quan', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào Owner/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: info.outputPath('dashboard-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng trở lại/ })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('registration shows accessible validation on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/register');
  await page.getByRole('button', { name: /Tạo không gian doanh nghiệp/ }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.locator('input[aria-invalid="true"]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
