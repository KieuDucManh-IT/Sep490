import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];

  for (const key of required) {
    if (!process.env[key]?.trim()) {
      throw new Error(`Chưa cấu hình ${key} trong .env`);
    }
  }

  const host = process.env.SMTP_HOST.trim();
  const user = process.env.SMTP_USER.trim();
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const port = Number(process.env.SMTP_PORT || 465);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT không hợp lệ");
  }

  const isGmail = host.toLowerCase().includes("gmail");

  const transportOptions = isGmail
    ? {
      service: "gmail",
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    }
    : {
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    };

  transporter = nodemailer.createTransport(transportOptions);
  return transporter;
}

export async function verifyEmailConnection() {
  await getTransporter().verify();
  console.log("SMTP: kết nối và xác thực thành công");
}

export async function sendEmail(to, subject, text, html) {
  if (!to || typeof to !== "string" || !to.includes("@")) {
    const err = new Error(`Địa chỉ email người nhận không hợp lệ: "${to}"`);
    err.code = "INVALID_RECIPIENT";
    throw err;
  }

  const mailOptions = {
    from: {
      name: "VESTORA",
      address: (
        process.env.SMTP_FROM || process.env.SMTP_USER
      ).trim(),
    },
    to: to.trim(),
    subject: subject || "[VESTORA]",
    text,
  };

  if (html) {
    mailOptions.html = html;
  }

  try {
    const info = await getTransporter().sendMail(mailOptions);

    if (!info.accepted?.length || info.rejected?.length) {
      const error = new Error("SMTP không chấp nhận người nhận");
      error.code = "RECIPIENT_REJECTED";
      throw error;
    }

    console.log("SMTP đã chấp nhận email:", info.messageId);
    return info;
  } catch (error) {
    // Reset transporter khi gặp lỗi để lần gửi sau khởi tạo kết nối mới
    transporter = null;
    throw error;
  }
}
