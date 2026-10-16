export function registerOtpTemplate(otp) {
  const code = String(otp);

  if (!/^\d{6}$/.test(code)) {
    throw new Error("OTP phải gồm 6 chữ số");
  }

  return {
    subject: "VESTORA | Xác thực email đăng ký",

    text: [
      "Chào mừng bạn đến với VESTORA!",
      "",
      `Mã xác thực của bạn: ${code}`,
      "Mã có hiệu lực trong 5 phút.",
      "",
      "Nhập mã trên trang đăng ký để hoàn tất tạo tài khoản.",
      "Không chia sẻ mã này với bất kỳ ai.",
      "Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.",
      "",
      "Trân trọng,",
      "Đội ngũ VESTORA",
    ].join("\n"),

    html: `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Xác thực email VESTORA</title>
</head>
<body style="margin:0;padding:0;background:#f4f1eb;
             font-family:Arial,Helvetica,sans-serif;color:#25221d;">

  <div style="display:none;max-height:0;overflow:hidden;
              opacity:0;mso-hide:all;">
    Hoàn tất đăng ký VESTORA. Mã xác thực có hiệu lực trong 5 phút.
  </div>

  <table role="presentation" width="100%" cellpadding="0"
         cellspacing="0" border="0" style="background:#f4f1eb;">
    <tr>
      <td align="center" style="padding:36px 12px;">

        <table role="presentation" width="100%" cellpadding="0"
               cellspacing="0" border="0"
               style="max-width:560px;background:#ffffff;
                      border:1px solid #e6dfd3;border-radius:16px;">

          <tr>
            <td align="center"
                style="padding:34px 20px;background:#1e1c19;
                       border-radius:16px 16px 0 0;">
              <div style="font-size:30px;letter-spacing:7px;
                          font-weight:bold;color:#ffffff;">
                VESTORA
              </div>
              <p style="margin:12px 0 0;font-size:10px;
                        letter-spacing:2px;color:#d8be90;">
                FASHION RENTAL &amp; RESALE
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 28px 20px;">
              <p style="margin:0 0 12px;font-size:11px;
                        font-weight:bold;letter-spacing:2px;color:#96723d;">
                CHÀO MỪNG ĐẾN VỚI VESTORA
              </p>
              <h1 style="margin:0 0 16px;font-family:Georgia,serif;
                         font-size:28px;line-height:1.3;color:#25221d;">
                Xác thực email của bạn
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.8;color:#686157;">
                Cảm ơn bạn đã lựa chọn VESTORA. Nhập mã xác thực
                bên dưới trên trang đăng ký để hoàn tất tạo tài khoản
                và bắt đầu khám phá phong cách của riêng bạn.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 28px 24px;">
              <table role="presentation" width="100%" cellpadding="0"
                     cellspacing="0" border="0"
                     style="background:#faf6ee;border:1px solid #e7d8bd;
                            border-radius:12px;">
                <tr>
                  <td align="center" style="padding:24px 10px;">
                    <p style="margin:0 0 14px;font-size:11px;
                              letter-spacing:2px;color:#806942;">
                      MÃ XÁC THỰC
                    </p>
                    <div style="font-family:'Courier New',monospace;
                                font-size:36px;letter-spacing:6px;
                                font-weight:bold;color:#25221d;">
                      ${code}
                    </div>
                    <p style="margin:16px 0 0;font-size:13px;
                              line-height:1.6;color:#686157;">
                      Có hiệu lực trong <strong>5 phút</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 28px 30px;">
              <p style="margin:0 0 12px;font-size:13px;
                        line-height:1.8;color:#686157;">
                Không chia sẻ mã xác thực với bất kỳ ai.
                Nếu đã yêu cầu gửi lại mã, hãy sử dụng mã mới nhất.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.8;color:#686157;">
                Nếu bạn không thực hiện đăng ký này, bạn có thể
                bỏ qua email. Tài khoản chỉ được tạo sau khi xác thực.
              </p>
              <p style="margin:24px 0 0;font-size:14px;line-height:1.8;">
                Trân trọng,<br><strong>Đội ngũ VESTORA</strong>
              </p>
            </td>
          </tr>

          <tr>
            <td align="center"
                style="padding:20px;border-top:1px solid #ece6dc;">
              <p style="margin:0;font-size:11px;line-height:1.8;color:#8b8479;">
                Email tự động từ hệ thống VESTORA.<br>
                © ${new Date().getFullYear()} VESTORA
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}