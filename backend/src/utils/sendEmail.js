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

  const port = Number(process.env.SMTP_PORT || 465);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT không hợp lệ");
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST.trim(),
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  return transporter;
}

export async function verifyEmailConnection() {
  await getTransporter().verify();
  console.log("SMTP: kết nối và xác thực thành công");
}

export async function sendEmail(to, subject, text, html) {
  const info = await getTransporter().sendMail({
    from: {
      name: "VESTORA",
      address: (
        process.env.SMTP_FROM || process.env.SMTP_USER
      ).trim(),
    },
    to,
    subject,
    text,
    html,
  });

  if (!info.accepted?.length || info.rejected?.length) {
    const error = new Error("SMTP không chấp nhận người nhận");
    error.code = "RECIPIENT_REJECTED";
    throw error;
  }

  console.log("SMTP đã chấp nhận email:", info.messageId);

  return info;
}