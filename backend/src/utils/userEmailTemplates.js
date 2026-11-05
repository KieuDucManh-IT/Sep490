/**
 * Email templates for user account actions (Lock, New Staff, Reset Password)
 */

export function buildLockEmailHtml(user, reason, lockTime) {
  const name = user.FullName || user.Email;
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Thông báo khóa tài khoản - VESTORA</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:32px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <tr>
            <td align="center" style="padding:28px 20px;background:#171717;">
              <div style="font-size:26px;letter-spacing:6px;font-weight:bold;color:#ffffff;">VESTORA</div>
              <p style="margin:8px 0 0;font-size:10px;letter-spacing:2px;color:#d8be90;">FASHION RENTAL &amp; RESALE</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <h2 style="margin:0 0 16px;color:#dc2626;font-size:20px;">Tài khoản của bạn đã bị tạm khóa</h2>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
                Xin chào <strong>${name}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
                Tài khoản VESTORA của bạn (<strong>${user.Email}</strong>) vừa bị tạm khóa bởi Ban Quản trị vào lúc <strong>${lockTime}</strong>.
              </p>
              <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:8px;margin-bottom:24px;">
                <div style="font-size:12px;font-weight:bold;color:#991b1b;margin-bottom:6px;text-transform:uppercase;">Lý do tạm khóa:</div>
                <div style="font-size:14px;color:#7f1d1d;line-height:1.6;">${reason}</div>
              </div>
              <p style="margin:0 0 16px;font-size:13.5px;line-height:1.6;color:#475569;">
                Trong thời gian này, bạn sẽ tạm thời không thể đăng nhập hoặc thực hiện các giao dịch trên hệ thống VESTORA.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                Nếu bạn cho rằng đây là sự nhầm lẫn hoặc cần hỗ trợ, vui lòng liên hệ CSKH qua email <a href="mailto:support@vestora.vn" style="color:#2563eb;">support@vestora.vn</a> hoặc hotline <strong>1800-VESTORA</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f1f5f9;padding:16px 28px;text-align:center;font-size:11.5px;color:#64748b;border-top:1px solid #e2e8f0;">
              © VESTORA. Đây là email tự động, vui lòng không trả lời trực tiếp.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildLockEmailText(user, reason) {
  const name = user.FullName || user.Email;
  const lockTime = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false
  });

  return [
    'VESTORA',
    '--------------------------------------------------',
    `Xin chào ${name},`,
    '',
    `Tài khoản VESTORA của bạn vừa bị tạm khóa bởi Ban Quản trị vào lúc ${lockTime}.`,
    '',
    `Lý do khóa: ${reason}`,
    '',
    'Trong thời gian này, bạn sẽ tạm thời không thể đăng nhập hoặc thực hiện các hoạt động trên hệ thống VESTORA.',
    '',
    'Nếu cần hỗ trợ, vui lòng liên hệ CSKH:',
    '- Email: support@vestora.vn',
    '- Hotline: 1800-VESTORA',
    '',
    'Đây là thư tự động, vui lòng không trả lời.',
    '',
    'Trân trọng,',
    'Ban Quản trị VESTORA',
    '',
    '© VESTORA. All rights reserved.'
  ].join('\n');
}

export function buildNewStaffEmailText(user, rawPassword) {
  const name = user.FullName || user.Email;
  const roleDisplayNames = {
    shopOwner: 'Chủ gian hàng (Shop Owner)',
    brandmanager: 'Quản lý thương hiệu (Brand Manager)',
    warehouseManager: 'Quản lý kho (Warehouse Manager)',
    warehousestaff: 'Nhân viên kho (Warehouse Staff)'
  };
  const roleName = roleDisplayNames[user.Role] || user.Role;

  return [
    'VESTORA',
    '--------------------------------------------------',
    `Xin chào ${name},`,
    '',
    'Tài khoản nhân viên của bạn đã được khởi tạo thành công trên hệ thống quản trị VESTORA.',
    '',
    'THÔNG TIN ĐĂNG NHẬP:',
    `- Địa chỉ Email: ${user.Email}`,
    `- Mật khẩu khởi tạo: ${rawPassword}`,
    `- Vai trò hệ thống: ${roleName}`,
    '',
    'LƯU Ý QUAN TRỌNG VỀ BẢO MẬT:',
    '• Vì lý do an toàn bảo mật thông tin, vui lòng đăng nhập và ĐỔI LẠI MẬT KHẨU ngay trong lần đầu tiên truy cập hệ thống.',
    '• Tuyệt đối không chia sẻ mật khẩu khởi tạo này cho bất kỳ ai khác.',
    '',
    'Nếu bạn cần hỗ trợ kỹ thuật hoặc có bất kỳ thắc mắc nào, vui lòng liên hệ:',
    '- Email hỗ trợ: support@vestora.vn',
    '- Hotline: 1800-VESTORA',
    '',
    'Đây là thư tự động, vui lòng không trả lời trực tiếp email này.',
    '',
    'Trân trọng,',
    'Ban Quản trị VESTORA',
    '',
    '© VESTORA. All rights reserved.'
  ].join('\n');
}

export function buildResetPasswordEmailHtml(user, newPassword, resetTime) {
  const name = user.FullName || user.Email;
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Đặt lại mật khẩu - VESTORA</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:32px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <tr>
            <td align="center" style="padding:28px 20px;background:#171717;">
              <div style="font-size:26px;letter-spacing:6px;font-weight:bold;color:#ffffff;">VESTORA</div>
              <p style="margin:8px 0 0;font-size:10px;letter-spacing:2px;color:#d8be90;">FASHION RENTAL &amp; RESALE</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Thông báo đặt lại mật khẩu</h2>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
                Xin chào <strong>${name}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
                Mật khẩu tài khoản VESTORA của bạn vừa được Quản trị viên khởi tạo lại vào lúc <strong>${resetTime}</strong>.
              </p>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:20px;border-radius:12px;margin-bottom:24px;text-align:center;">
                <div style="font-size:12px;font-weight:bold;color:#166534;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;">Mật khẩu mới (tạm thời):</div>
                <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:bold;color:#15803d;letter-spacing:2px;">${newPassword}</div>
              </div>
              <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px;border-radius:6px;margin-bottom:20px;font-size:13px;color:#92400e;line-height:1.5;">
                <strong>LƯU Ý BẢO MẬT:</strong> Bạn <u>bắt buộc</u> phải đổi lại mật khẩu mới ngay trong lần đăng nhập đầu tiên để bảo vệ an toàn cho tài khoản.
              </div>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                Nếu bạn không yêu cầu hành động này, vui lòng liên hệ ngay với chúng tôi qua <a href="mailto:support@vestora.vn" style="color:#2563eb;">support@vestora.vn</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f1f5f9;padding:16px 28px;text-align:center;font-size:11.5px;color:#64748b;border-top:1px solid #e2e8f0;">
              © VESTORA. Đây là email tự động, vui lòng không trả lời trực tiếp.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildResetPasswordEmailText(user, newPassword) {
  const name = user.FullName || user.Email;
  const resetTime = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false
  });

  return [
    'VESTORA',
    '--------------------------------------------------',
    `Xin chào ${name},`,
    '',
    `Mật khẩu tài khoản VESTORA của bạn vừa được Quản trị viên đặt lại vào lúc ${resetTime}.`,
    '',
    'THÔNG TIN ĐĂNG NHẬP MỚI:',
    `- Địa chỉ Email: ${user.Email}`,
    `- Mật khẩu mới (tạm thời): ${newPassword}`,
    '',
    'LƯU Ý QUAN TRỌNG VỀ BẢO MẬT (BẮT BUỘC):',
    '• Đây là mật khẩu tạm thời do Quản trị viên hệ thống cấp.',
    '• Vì lý do an toàn bảo mật, bạn BẮT BUỘC phải đăng nhập và ĐỔI LẠI MẬT KHẨU ngay khi truy cập hệ thống.',
    '• Tuyệt đối không chia sẻ mật khẩu tạm thời này cho bất kỳ ai khác.',
    '',
    'Nếu bạn không yêu cầu hoặc có thắc mắc, vui lòng liên hệ ngay với Ban Quản trị VESTORA:',
    '- Email hỗ trợ: support@vestora.vn',
    '- Hotline: 1800-VESTORA',
    '',
    'Đây là thư tự động, vui lòng không trả lời trực tiếp email này.',
    '',
    'Trân trọng,',
    'Ban Quản trị VESTORA',
    '',
    '© VESTORA. All rights reserved.'
  ].join('\n');
}

