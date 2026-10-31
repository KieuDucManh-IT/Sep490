import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Modal, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

import {
  walletRequest,
  walletPost,
} from "../../services/walletApi";

import "../../styles/Wallet.css";

const TYPES = {
  top_up: "Nạp tiền",
  withdraw: "Rút tiền",
  payment: "Thanh toán mua hàng",
  rental_payment: "Thanh toán thuê",
  rental_deposit: "Thanh toán cọc",
  refund: "Hoàn tiền",
  deposit_refund: "Hoàn cọc",
  adjustment: "Điều chỉnh",
  reversal: "Đảo giao dịch",
};

const STATUSES = {
  otp_pending: "Chờ OTP",
  pending: "Chờ thanh toán",
  queued: "Đang chờ xử lý",
  submitting: "Đang gửi lệnh",
  processing: "Đang xử lý",
  review: "Chờ đối soát",
  success: "Thành công",
  failed: "Không thành công",
  expired: "Hết hạn",
  reversed: "Đã đảo giao dịch",
};

const BANKS = [
  ["970436", "Vietcombank"],
  ["970407", "Techcombank"],
  ["970422", "MB Bank"],
  ["970418", "BIDV"],
  ["970415", "VietinBank"],
  ["970416", "ACB"],
  ["970432", "VPBank"],
  ["970423", "TPBank"],
  ["970403", "Sacombank"],
  ["970405", "Agribank"],
];

const SYNCABLE = new Set([
  "pending",
  "queued",
  "submitting",
  "processing",
  "review",
]);

const money = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);

function Field({ label, children }) {
  return (
    <label className="vw-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function walletErrorMessage(error) {
  const message = error?.message || "";

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Không kết nối được tới hệ thống. Nếu vừa gửi OTP hoặc xác nhận giao dịch, hãy kiểm tra email và lịch sử trước khi thực hiện lại.";
  }

  return message || "Không thực hiện được thao tác. Vui lòng thử lại.";
}

export default function WalletPage() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState({
    items: [],
    pages: 1,
    total: 0,
  });

  const [page, setPage] = useState(1);
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [tab, setTab] = useState("topup");

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const loadingRef = useRef(null);
  const hasLoadedRef = useRef(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [setup, setSetup] = useState({
    password: "",
    confirmPassword: "",
    otp: "",
  });

  const [topupAmount, setTopupAmount] = useState("100000");
  const [payment, setPayment] = useState(null);

  const [withdraw, setWithdraw] = useState({
    amount: "",
    bankBin: "970436",
    accountNumber: "",
    accountName: "",
    walletPassword: "",
  });

  const [pendingWithdrawal, setPendingWithdrawal] = useState(null);
  const [withdrawOtp, setWithdrawOtp] = useState("");

  const load = useCallback(async () => {
    const key = JSON.stringify([page, type, status]);

    while (loadingRef.current) {
      const current = loadingRef.current;

      if (current.key === key) return current.promise;

      await current.promise.catch(() => { });
    }

    const request = {
      key,
      promise: (async () => {
        const result = await walletRequest();

        setData(result);
        hasLoadedRef.current = true;

        if (!result.requiresSetup && result.wallet.status === "active") {
          const params = new URLSearchParams({
            page: String(page),
            type,
            status,
          });

          const list = await walletRequest(`/transactions?${params}`);
          setHistory(list);

          setPayment((payment) => {
            if (!payment) return payment;

            return (
              list.items.find((item) => item.id === payment.id) || payment
            );
          });
        }
      })(),
    };

    loadingRef.current = request;

    try {
      await request.promise;
    } finally {
      if (loadingRef.current === request) {
        loadingRef.current = null;
      }
    }
  }, [page, type, status]);

  useEffect(() => {
    let active = true;

    load().catch((err) => {
      if (!active) return;

      if (!hasLoadedRef.current) {
        setError(walletErrorMessage(err));
      } else {
        console.warn("[wallet-refresh]", err.message);
      }
    });

    const timer = setInterval(() => {
      if (document.hidden || busyRef.current) return;

      load().catch((err) => {
        console.warn("[wallet-refresh]", err.message);
      });
    }, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderCode = params.get("orderCode");

    if (!orderCode || !/^\d+$/.test(orderCode)) return;

    walletPost(`/top-ups/${orderCode}/sync`)
      .then(() => {
        setNotice("Đã kiểm tra trạng thái nạp tiền.");
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        window.history.replaceState({}, "", "/wallet");
      });
  }, []);

  async function run(action) {
    if (busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      // Nút Tải lại/Làm mới gọi run() không truyền action.
      if (typeof action !== "function") {
        await load();
        return;
      }

      await action();

      // Thao tác đã thành công. Lỗi tải lại không đổi kết quả thao tác.
      try {
        if (loadingRef.current) {
          await loadingRef.current.promise.catch(() => { });
        }

        await load();
      } catch (refreshError) {
        console.warn("[wallet-refresh]", refreshError.message);
      }
    } catch (err) {
      setNotice("");
      setError(walletErrorMessage(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function closeNotification() {
    setError("");
    setNotice("");
  }

  function changeWithdraw(event) {
    const { name, value } = event.target;

    setWithdraw((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function submitSetup(event) {
    event.preventDefault();

    run(async () => {
      const result = await walletPost("/password/setup", setup);

      setNotice(result.message);
      setSetup({ password: "", confirmPassword: "", otp: "" });
    });
  }

  function submitTopup(event) {
    event.preventDefault();

    run(async () => {
      const result = await walletPost("/top-ups", {
        amount: Number(topupAmount),
      });

      setPayment(result.transaction);
      setNotice(result.message);
    });
  }

  function requestWithdrawal(event) {
    event.preventDefault();

    run(async () => {
      const result = await walletPost("/withdrawals/send-otp", {
        ...withdraw,
        amount: Number(withdraw.amount),
      });

      setPendingWithdrawal(result.transaction);
      setWithdrawOtp("");
      setNotice(result.message);

      setWithdraw((current) => ({
        ...current,
        walletPassword: "",
      }));
    });
  }

  function confirmWithdrawal(event) {
    event.preventDefault();

    run(async () => {
      const result = await walletPost("/withdrawals/confirm", {
        transactionId: pendingWithdrawal.id,
        otp: withdrawOtp,
      });

      setNotice(result.message);
      setPendingWithdrawal(null);
      setWithdrawOtp("");
    });
  }

  const wallet = data?.wallet;
  const isLocked = wallet && wallet.status !== "active";
  const insufficientBalance = (wallet?.availableBalance || 0) < 10000;

  return (
    <div className="vw-page">
      <Navbar />

      <main className="vw-main">
        <nav className="vw-breadcrumb" aria-label="Đường dẫn">
          <Link to="/">Trang chủ</Link>
          <span>/</span>
          <Link to="/profile">Tài khoản</Link>
          <span>/</span>
          <span>Ví của tôi</span>
        </nav>

        <header className="vw-heading">
          <div>
            <p className="vw-eyebrow">VESTORA · TÀI KHOẢN</p>
            <h1>Ví của tôi</h1>
            <p>Quản lý số dư và theo dõi các giao dịch của bạn.</p>
          </div>

          <Link className="vw-secondary" to="/profile">
            Về hồ sơ
          </Link>
        </header>

        <Modal
          show={Boolean(error || notice)}
          onHide={closeNotification}
          centered
          aria-labelledby="wallet-notification-title"
        >
          <Modal.Header closeButton>
            <Modal.Title
              id="wallet-notification-title"
              className={error ? "text-danger" : ""}
            >
              {error ? "Không thực hiện được thao tác" : "Thông báo"}
            </Modal.Title>
          </Modal.Header>

          <Modal.Body style={{ whiteSpace: "pre-line" }}>
            {error || notice}
          </Modal.Body>

          <Modal.Footer>
            <Button variant="dark" onClick={closeNotification}>
              Đã hiểu
            </Button>
          </Modal.Footer>
        </Modal>

        {!data ? (
          <section className="vw-card">
            <p>{error ? "Chưa tải được Ví." : "Đang tải Ví..."}</p>
            <button
              className="vw-secondary"
              onClick={() => run()}
              disabled={busy}
            >
              Tải lại
            </button>
          </section>
        ) : data.requiresSetup ? (
          <section className="vw-card vw-setup">
            <p className="vw-eyebrow">BẢO MẬT VÍ</p>
            <h2>Thiết lập mật khẩu Ví</h2>

            <p>
              Tạo mật khẩu riêng và xác nhận email trước khi sử dụng Ví.
              OTP được gửi đến {data.email}.
            </p>

            <form onSubmit={submitSetup}>
              <fieldset disabled={busy}>
                <Field label="Mật khẩu Ví">
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={setup.password}
                    onChange={(event) =>
                      setSetup({
                        ...setup,
                        password: event.target.value,
                      })
                    }
                  />
                </Field>

                <p className="vw-hint">
                  Ít nhất 8 ký tự, có chữ hoa, chữ thường, số và ký tự
                  đặc biệt; không chứa khoảng trắng.
                </p>

                <Field label="Nhập lại mật khẩu Ví">
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={setup.confirmPassword}
                    onChange={(event) =>
                      setSetup({
                        ...setup,
                        confirmPassword: event.target.value,
                      })
                    }
                  />
                </Field>

                <div className="vw-otp-row">
                  <Field label="OTP email">
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={setup.otp}
                      onChange={(event) =>
                        setSetup({
                          ...setup,
                          otp: event.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </Field>

                  <button
                    type="button"
                    className="vw-secondary"
                    onClick={() =>
                      run(async () => {
                        const result = await walletPost(
                          "/password/send-otp"
                        );
                        setNotice(result.message);
                      })
                    }
                  >
                    Gửi OTP
                  </button>
                </div>

                <button className="vw-primary" type="submit">
                  {busy ? "Đang xử lý..." : "Kích hoạt Ví"}
                </button>
              </fieldset>
            </form>
          </section>
        ) : (
          <>
            <section className="vw-balances">
              <article className="vw-balance-main">
                <span>Số dư khả dụng</span>
                <strong>{money(wallet.availableBalance)}</strong>
                <p>Sẵn sàng cho giao dịch tiếp theo của bạn.</p>
              </article>

              <article className="vw-card vw-balance-small">
                <span>Tổng số dư</span>
                <strong>{money(wallet.balance)}</strong>
              </article>

              <article className="vw-card vw-balance-small">
                <span>Đang khóa</span>
                <strong>{money(wallet.lockedBalance)}</strong>
                <small>Các yêu cầu rút đang được xử lý.</small>
              </article>
            </section>

            {isLocked ? (
              <div className="vw-message vw-error">
                Ví đang bị khóa. Vui lòng liên hệ shop để kiểm tra.
              </div>
            ) : (
              <>
                <section className="vw-card vw-actions">
                  <div className="vw-tabs">
                    <button
                      type="button"
                      className={tab === "topup" ? "is-active" : ""}
                      onClick={() => setTab("topup")}
                      aria-pressed={tab === "topup"}
                    >
                      Nạp tiền
                    </button>
                    <button
                      type="button"
                      className={tab === "withdraw" ? "is-active" : ""}
                      onClick={() => setTab("withdraw")}
                      aria-pressed={tab === "withdraw"}
                    >
                      Rút tiền
                    </button>
                  </div>

                  {tab === "topup" ? (
                    <div className="vw-action-grid">
                      <form onSubmit={submitTopup}>
                        <h2>Nạp vào Ví</h2>
                        <p className="vw-muted">
                          Thanh toán qua mã QR hoặc trang thanh toán.
                        </p>

                        <fieldset disabled={busy}>
                          <Field label="Số tiền nạp (VND)">
                            <input
                              type="number"
                              min={10000}
                              max={20000000}
                              step={1}
                              required
                              value={topupAmount}
                              onChange={(event) =>
                                setTopupAmount(event.target.value)
                              }
                            />
                          </Field>

                          <div className="vw-presets">
                            {[100000, 200000, 500000].map((amount) => (
                              <button
                                type="button"
                                key={amount}
                                onClick={() =>
                                  setTopupAmount(String(amount))
                                }
                              >
                                {money(amount)}
                              </button>
                            ))}
                          </div>

                          <button className="vw-primary" type="submit">
                            {busy ? "Đang xử lý..." : "Tạo mã nạp tiền"}
                          </button>
                        </fieldset>
                      </form>

                      <div className="vw-payment-box">
                        {payment?.status === "success" ? (
                          <p>Đã nạp thành công {money(payment.amount)}.</p>
                        ) : payment?.qrCode ? (
                          <>
                            <QRCodeSVG
                              value={payment.qrCode}
                              size={190}
                              marginSize={4}
                              title="Mã QR nạp tiền Ví"
                            />
                            <strong>{money(payment.amount)}</strong>

                            <a
                              href={payment.checkoutUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="vw-secondary"
                            >
                              Mở trang thanh toán
                            </a>

                            <p className="vw-hint">
                              Số dư được cập nhật sau khi xác nhận
                              thanh toán thành công.
                            </p>
                          </>
                        ) : (
                          <p>
                            Mã QR sẽ xuất hiện sau khi bạn tạo yêu cầu
                            nạp tiền.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : pendingWithdrawal ? (
                    <form
                      className="vw-withdraw-form"
                      onSubmit={confirmWithdrawal}
                    >
                      <h2>Xác nhận rút tiền</h2>

                      <div className="vw-confirm-summary">
                        <strong>{money(pendingWithdrawal.amount)}</strong>
                        <p>
                          Tài khoản nhận:{" "}
                          {pendingWithdrawal.bankAccount}
                        </p>
                        <p>Mã ngân hàng: {pendingWithdrawal.bankBin}</p>
                      </div>

                      <fieldset disabled={busy}>
                        <Field label="OTP đã gửi đến email tài khoản">
                          <input
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            required
                            value={withdrawOtp}
                            onChange={(event) =>
                              setWithdrawOtp(
                                event.target.value.replace(/\D/g, "")
                              )
                            }
                          />
                        </Field>

                        <div className="vw-button-row">
                          <button className="vw-primary" type="submit">
                            Xác nhận rút
                          </button>

                          <button
                            type="button"
                            className="vw-secondary"
                            onClick={() => {
                              setPendingWithdrawal(null);
                              setWithdrawOtp("");
                            }}
                          >
                            Quay lại
                          </button>
                        </div>

                        <p className="vw-hint">
                          OTP có hiệu lực 5 phút. Yêu cầu chưa xác nhận
                          sẽ tự hết hạn.
                        </p>
                      </fieldset>
                    </form>
                  ) : (
                    <form
                      className="vw-withdraw-form"
                      onSubmit={requestWithdrawal}
                    >
                      <h2>Rút về tài khoản ngân hàng</h2>
                      <p className="vw-muted">
                        Khả dụng: {money(wallet.availableBalance)}
                      </p>
                      {insufficientBalance && (
                        <p className="vw-hint">
                          Cần ít nhất 10.000đ số dư khả dụng để rút tiền.
                        </p>
                      )}

                      <fieldset disabled={busy || insufficientBalance}>
                        <div className="vw-two-columns">
                          <Field label="Số tiền rút (VND)">
                            <input
                              name="amount"
                              type="number"
                              min={10000}
                              max={Math.min(
                                Math.max(10000, wallet.availableBalance || 0),
                                20000000
                              )}
                              step={1}
                              required
                              value={withdraw.amount}
                              onChange={changeWithdraw}
                            />
                          </Field>

                          <Field label="Ngân hàng">
                            <select
                              name="bankBin"
                              value={withdraw.bankBin}
                              onChange={changeWithdraw}
                            >
                              {BANKS.map(([bin, name]) => (
                                <option key={bin} value={bin}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Số tài khoản">
                            <input
                              name="accountNumber"
                              inputMode="numeric"
                              pattern="[0-9]{6,20}"
                              required
                              value={withdraw.accountNumber}
                              onChange={changeWithdraw}
                            />
                          </Field>

                          <Field label="Tên chủ tài khoản">
                            <input
                              name="accountName"
                              minLength={2}
                              maxLength={100}
                              required
                              value={withdraw.accountName}
                              onChange={changeWithdraw}
                            />
                          </Field>
                        </div>

                        <Field label="Mật khẩu Ví">
                          <input
                            name="walletPassword"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={withdraw.walletPassword}
                            onChange={changeWithdraw}
                          />
                        </Field>

                        <button className="vw-primary" type="submit">
                          {busy ? "Đang xử lý..." : "Tiếp tục · Gửi OTP"}
                        </button>
                      </fieldset>
                    </form>
                  )}
                </section>

                <section className="vw-card vw-history">
                  <div className="vw-history-heading">
                    <div>
                      <p className="vw-eyebrow">GIAO DỊCH CỦA BẠN</p>
                      <h2>Lịch sử giao dịch</h2>
                    </div>

                    <button
                      type="button"
                      className="vw-secondary"
                      onClick={() => run(async () => { })}
                      disabled={busy}
                    >
                      Làm mới
                    </button>
                  </div>

                  <div className="vw-filters">
                    <select
                      aria-label="Lọc loại giao dịch"
                      value={type}
                      onChange={(event) => {
                        setType(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">Tất cả giao dịch</option>
                      {Object.entries(TYPES).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Lọc trạng thái"
                      value={status}
                      onChange={(event) => {
                        setStatus(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">Tất cả trạng thái</option>
                      {Object.entries(STATUSES).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {history.items.length === 0 ? (
                    <div className="vw-empty">
                      Chưa có giao dịch phù hợp.
                    </div>
                  ) : (
                    <div className="vw-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Giao dịch</th>
                            <th>Thời gian</th>
                            <th>Số tiền</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>

                        <tbody>
                          {history.items.map((item) => {
                            const completed = item.status === "success";
                            const credit = item.direction === "credit";

                            return (
                              <tr key={item.id}>
                                <td>
                                  <strong>{TYPES[item.type] || item.type}</strong>
                                  <small>{item.code}</small>
                                  {item.bankAccount && (
                                    <small>{item.bankAccount}</small>
                                  )}
                                </td>

                                <td>
                                  {new Date(item.createdAt).toLocaleString(
                                    "vi-VN"
                                  )}
                                </td>

                                <td
                                  className={
                                    completed && credit ? "vw-credit" : ""
                                  }
                                >
                                  {completed ? (credit ? "+" : "−") : ""}
                                  {money(item.amount)}
                                </td>

                                <td>
                                  <span
                                    className={`vw-badge vw-status-${item.status}`}
                                  >
                                    {STATUSES[item.status] || item.status}
                                  </span>
                                </td>

                                <td>
                                  {item.status === "otp_pending" ? (
                                    <button
                                      className="vw-text-button"
                                      disabled={busy}
                                      onClick={() => {
                                        setTab("withdraw");
                                        setPendingWithdrawal(item);
                                        setWithdrawOtp("");
                                      }}
                                    >
                                      Nhập OTP
                                    </button>
                                  ) : SYNCABLE.has(item.status) &&
                                    ["top_up", "withdraw"].includes(
                                      item.type
                                    ) ? (
                                    <button
                                      className="vw-text-button"
                                      disabled={busy}
                                      onClick={() =>
                                        run(async () => {
                                          const result = await walletPost(
                                            `/transactions/${item.id}/sync`
                                          );
                                          setNotice(result.message);
                                        })
                                      }
                                    >
                                      Kiểm tra
                                    </button>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="vw-pagination">
                    <button
                      className="vw-secondary"
                      disabled={page <= 1 || busy}
                      onClick={() => setPage((value) => value - 1)}
                    >
                      Trước
                    </button>

                    <span>
                      Trang {page}/{history.pages}
                    </span>

                    <button
                      className="vw-secondary"
                      disabled={page >= history.pages || busy}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      Sau
                    </button>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}