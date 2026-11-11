import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createDecartClient, models } from "@decartai/sdk";
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  CircleAlert,
  Clock3,
  Film,
  Info,
  LoaderCircle,
  Move,
  RefreshCw,
  Shirt,
  Sparkles,
  Square,
  Sun,
  Upload,
} from "lucide-react";

import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import apiClient, { API_BASE } from "../../services/api";
import productService from "../../services/productService";
import useTryOnVideo from "../../hook/useTryOnVideo";
import "../../styles/WebcamTryOnPage.css";

const model = models.realtime("lucy-vton-3.6");
const SESSION_SECONDS = 30;

function dispose(session) {
  if (!session) return;

  session.cancelled = true;
  session.abort.abort();

  clearTimeout(session.timer);
  clearTimeout(session.startTimer);
  clearInterval(session.countdown);

  session.camera?.getTracks().forEach((track) => track.stop());
  session.remote?.getTracks().forEach((track) => track.stop());
  session.rt?.disconnect();
}

function resolveImageUrl(rawImage) {
  if (typeof rawImage !== "string" || !rawImage) return "";

  try {
    return new URL(rawImage, `${API_BASE}/`).href;
  } catch {
    return "";
  }
}

function SavedVideoCard({ item }) {
  const [failed, setFailed] = useState(false);

  return (
    <article className="vto-saved-card">
      <video
        src={item.url}
        controls
        playsInline
        preload="none"
        aria-label="Video thử đồ đã lưu"
        onError={() => setFailed(true)}
      />

      <div className="vto-saved-info">
        <strong>
          {new Date(item.createdAt).toLocaleString("vi-VN")}
        </strong>

        <span>{Math.round(item.duration)} giây · Đã lưu</span>

        {failed && (
          <p role="status">
            Không phát được video. Bấm Tải lại danh sách để lấy
            liên kết mới.
          </p>
        )}
      </div>
    </article>
  );
}

export default function WebcamTryOnPage() {
  const [params] = useSearchParams();
  const productId = params.get("product");

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(Boolean(productId));
  const [imageFailed, setImageFailed] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [outputReady, setOutputReady] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);

  const video = useTryOnVideo(productId);
  const { startRecording, finishRecording, resetRecording } = video;

  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const sessionRef = useRef(null);

  const clearSession = useCallback(() => {
    // Kết thúc ghi trước khi đóng các luồng video.
    finishRecording();

    const previous = sessionRef.current;
    sessionRef.current = null;

    dispose(previous);

    if (inputRef.current) {
      inputRef.current.srcObject = null;
    }

    if (outputRef.current) {
      outputRef.current.srcObject = null;
    }
  }, [finishRecording]);

  useEffect(() => {
    let active = true;

    clearSession();
    setProduct(null);
    setLoading(Boolean(productId));
    setImageFailed(false);
    setPhase("idle");
    setCameraReady(false);
    setOutputReady(false);
    setHasError(false);
    setSecondsLeft(SESSION_SECONDS);

    setMessage(
      productId
        ? "Đang tải trang phục của bạn…"
        : "Hãy chọn một sản phẩm để bắt đầu thử đồ."
    );

    if (productId) {
      productService
        .getProductById(productId)
        .then((result) => {
          if (!active) return;

          if (!result?.data) {
            throw new Error("Không tìm thấy sản phẩm.");
          }

          setProduct(result.data);

          const image = result.data.images?.[0] || result.data.image;

          if (!resolveImageUrl(image)) {
            setHasError(true);
            setMessage(
              "Trang phục này chưa có ảnh hợp lệ để thử đồ."
            );
          } else {
            setMessage(
              "Mọi thứ đã sẵn sàng. Bắt đầu để mở camera của bạn."
            );
          }
        })
        .catch((error) => {
          if (!active) return;

          setHasError(true);
          setMessage(
            error.message ||
              "Không tải được sản phẩm. Vui lòng thử lại."
          );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
      clearSession();
    };
  }, [productId, clearSession]);

  const imageUrl = resolveImageUrl(
    product?.images?.[0] || product?.image
  );

  const productName =
    product?.name || product?.productName || "Trang phục đã chọn";

  const productLink = productId
    ? `/product/${encodeURIComponent(productId)}`
    : "/catalog";

  const busy = phase !== "idle";
  const productReady = !loading && Boolean(imageUrl) && !imageFailed;
  const canStart = productReady && !busy && !video.busy;
  const canSave = !busy && video.canSave;

  const saving = video.status === "uploading";
  const finishing = video.status === "finishing";

  function stop(
    text = "Đã dừng thử đồ và tắt camera.",
    error = false
  ) {
    clearSession();
    setPhase("idle");
    setCameraReady(false);
    setOutputReady(false);
    setSecondsLeft(SESSION_SECONDS);
    setHasError(error);
    setMessage(text);
  }

  async function start() {
    if (sessionRef.current || !canStart) return;

    resetRecording();

    const session = {
      abort: new AbortController(),
      cancelled: false,
    };

    sessionRef.current = session;

    const isCurrent = () =>
      sessionRef.current === session && !session.cancelled;

    const finish = (text, error = false) => {
      if (isCurrent()) stop(text, error);
    };

    const attachStream = (element, stream) => {
      if (!element || !isCurrent()) return;

      element.srcObject = stream;

      // Chủ động phát vì autoPlay có thể chưa kích hoạt.
      element.play().catch((error) => {
        if (error.name !== "AbortError") {
          finish(
            "Trình duyệt chưa phát được video. Hãy bấm Bắt đầu để thử lại.",
            true
          );
        }
      });
    };

    setPhase("starting");
    setHasError(false);
    setCameraReady(false);
    setOutputReady(false);
    setSecondsLeft(SESSION_SECONDS);
    setMessage("Đang chuẩn bị phiên thử đồ…");

    session.startTimer = setTimeout(() => {
      finish(
        "Kết nối quá lâu. Camera đã được đóng; bạn có thể thử lại.",
        true
      );
    }, 60_000);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Hãy mở bằng localhost hoặc HTTPS để sử dụng camera."
        );
      }

      const response = await fetch(imageUrl, {
        signal: session.abort.signal,
      });

      if (!response.ok) {
        throw new Error("Không tải được ảnh sản phẩm.");
      }

      const garment = await response.blob();

      if (!isCurrent()) return;

      if (
        !garment.type.startsWith("image/") ||
        !garment.size ||
        garment.size > 10 * 1024 * 1024
      ) {
        throw new Error(
          "Ảnh sản phẩm phải hợp lệ và nhỏ hơn 10 MB."
        );
      }

      setMessage(
        "Đang mở camera. Hãy cho phép truy cập khi trình duyệt yêu cầu."
      );

      session.camera = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: model.width,
          height: model.height,
          frameRate: model.fps,
        },
      });

      if (!isCurrent()) {
        dispose(session);
        return;
      }

      session.camera.getVideoTracks().forEach((track) => {
        track.addEventListener(
          "ended",
          () => {
            finish(
              "Camera đã ngắt kết nối. Hãy kiểm tra camera rồi thử lại.",
              true
            );
          },
          { once: true }
        );
      });

      attachStream(inputRef.current, session.camera);
      setMessage("Đang kết nối với phòng thử đồ AI…");

      const token = await apiClient.post(
        "/try-on/token",
        {},
        { signal: session.abort.signal }
      );

      if (!isCurrent()) return;

      if (!token.apiKey) {
        throw new Error("Backend không trả về token thử đồ.");
      }

      const client = createDecartClient({
        apiKey: token.apiKey,
      });

      session.rt = await client.realtime.connect(session.camera, {
        model,
        retries: 0,
        initialState: {
          image: garment,
          prompt: {
            text:
              "Dress the person in the garment shown in the reference image. " +
              "Preserve the person's face and pose.",
            enhance: false,
          },
        },
        onRemoteStream: (stream) => {
          if (!isCurrent()) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          session.remote = stream;
          attachStream(outputRef.current, stream);
        },
      });

      if (!isCurrent()) {
        dispose(session);
        return;
      }

      clearTimeout(session.startTimer);

      session.rt.on("error", (error) => {
        finish(`Lỗi thử đồ: ${error.message}`, true);
      });

      session.rt.on("sessionEnded", () => {
        finish("Phiên thử đồ đã kết thúc.");
      });

      session.rt.on("connectionChange", (state) => {
        if (state === "disconnected") {
          finish("Kết nối thử đồ đã đóng.");
        }
      });

      session.timer = setTimeout(() => {
        finish(
          "Đã hết phiên thử 30 giây. Bạn có thể lưu video vừa ghi."
        );
      }, SESSION_SECONDS * 1000);

      const endsAt = Date.now() + SESSION_SECONDS * 1000;

      session.countdown = setInterval(() => {
        if (isCurrent()) {
          setSecondsLeft(
            Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
          );
        }
      }, 250);

      setPhase("live");
      setMessage(
        "Đã kết nối. Video AI sẽ xuất hiện ở khung bên phải."
      );
    } catch (error) {
      if (!isCurrent()) {
        dispose(session);
        return;
      }

      const cameraErrors = {
        NotAllowedError:
          "Bạn cần cho phép sử dụng camera trong trình duyệt.",
        NotFoundError:
          "Không tìm thấy camera. Hãy kiểm tra thiết bị của bạn.",
        NotReadableError:
          "Không mở được camera. Hãy đóng ứng dụng khác đang sử dụng camera.",
      };

      finish(
        cameraErrors[error.name] ||
          error.message ||
          "Không thể bắt đầu thử đồ. Vui lòng thử lại.",
        true
      );
    }
  }

  const statusTitle = hasError
    ? "Phiên thử gặp sự cố"
    : phase === "starting"
      ? "Đang chuẩn bị phiên thử"
      : phase === "live"
        ? "Phiên thử đang diễn ra"
        : loading
          ? "Đang tải trang phục"
          : productReady
            ? "Phòng thử đã sẵn sàng"
            : "Chọn trang phục để tiếp tục";

  const StatusIcon = hasError
    ? CircleAlert
    : phase === "starting" || loading
      ? LoaderCircle
      : phase === "live"
        ? Sparkles
        : Info;

  const VideoIcon =
    saving || finishing
      ? LoaderCircle
      : video.status === "saved"
        ? Check
        : video.status === "error"
          ? CircleAlert
          : Film;

  const saveLabel = saving
    ? "Đang lưu…"
    : finishing
      ? "Đang xử lý…"
      : video.status === "saved"
        ? "Đã lưu video"
        : "Lưu video";

  return (
    <div className="vto-page">
      <Navbar />

      <main className="vto-main">
        <nav className="vto-breadcrumb" aria-label="Đường dẫn">
          <Link to={productLink}>
            <ArrowLeft size={15} aria-hidden="true" />
            {productId ? "Quay lại sản phẩm" : "Khám phá trang phục"}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Phòng thử đồ AI</span>
        </nav>

        <header className="vto-heading">
          <div>
            <p className="vto-eyebrow">
              <span /> VESTORA VIRTUAL TRY-ON
            </p>
            <h1>
              Thử một phong cách <em>rất riêng bạn.</em>
            </h1>
            <p className="vto-intro">
              Một góc nhìn mới về trang phục yêu thích, ngay trước
              camera của bạn.
            </p>
          </div>

          <span className="vto-session-label">
            <Clock3 size={17} aria-hidden="true" />
            Tối đa 30 giây / phiên
          </span>
        </header>

        <div className="vto-workspace">
          <aside
            className="vto-garment"
            aria-labelledby="vto-garment-title"
          >
            <div className="vto-card-heading">
              <Shirt size={17} aria-hidden="true" />
              <h2 id="vto-garment-title">Trang phục của bạn</h2>
            </div>

            <div
              className={`vto-product-image${
                loading ? " vto-product-image--loading" : ""
              }`}
            >
              {imageUrl && !imageFailed ? (
                <img
                  src={imageUrl}
                  alt={productName}
                  onError={() => {
                    setImageFailed(true);
                    setHasError(true);
                    setMessage(
                      "Không tải được ảnh trang phục. Hãy tải lại trang hoặc chọn một sản phẩm khác."
                    );
                  }}
                />
              ) : (
                <div className="vto-product-placeholder">
                  <Shirt
                    size={36}
                    strokeWidth={1.2}
                    aria-hidden="true"
                  />
                  <span>
                    {loading
                      ? "Đang tải ảnh…"
                      : "Chưa có ảnh trang phục"}
                  </span>
                </div>
              )}

              {imageUrl && !imageFailed && (
                <span className="vto-selected-badge">
                  <Check size={12} aria-hidden="true" />
                  Đã chọn
                </span>
              )}
            </div>

            <div className="vto-product-info">
              <span className="vto-overline">LỰA CHỌN HIỆN TẠI</span>
              <h3>
                {loading
                  ? "Đang tải trang phục…"
                  : product
                    ? productName
                    : "Chọn trang phục yêu thích"}
              </h3>
              <Link to={productLink} className="vto-product-link">
                {productId
                  ? "Xem chi tiết sản phẩm"
                  : "Khám phá bộ sưu tập"}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <div className="vto-garment-note">
              <Sparkles size={17} aria-hidden="true" />
              <p>
                Xem trước phong cách, rồi chọn điều khiến bạn tự tin.
              </p>
            </div>
          </aside>

          <section
            className="vto-studio"
            aria-labelledby="vto-studio-title"
          >
            <div className="vto-studio-header">
              <div>
                <span className="vto-overline">KHÔNG GIAN CỦA BẠN</span>
                <h2 id="vto-studio-title">Phòng thử đồ</h2>
              </div>

              <span
                className={`vto-session-state${
                  phase === "live" ? " vto-session-state--live" : ""
                }`}
              >
                <span />
                {phase === "live"
                  ? "Đang thử đồ"
                  : phase === "starting"
                    ? "Đang chuẩn bị"
                    : "Chưa bắt đầu"}
              </span>
            </div>

            <div className="vto-previews">
              <section
                className="vto-preview"
                aria-labelledby="vto-camera-title"
              >
                <div className="vto-preview-heading">
                  <h3 id="vto-camera-title">
                    <Camera size={16} aria-hidden="true" />
                    Camera của bạn
                  </h3>
                  <span>Góc nhìn gốc</span>
                </div>

                <div
                  className={`vto-video-stage${
                    cameraReady ? " vto-video-stage--playing" : ""
                  }`}
                >
                  <video
                    ref={inputRef}
                    autoPlay
                    muted
                    playsInline
                    aria-label="Video trực tiếp từ camera của bạn"
                    onPlaying={() => {
                      if (
                        sessionRef.current?.camera &&
                        inputRef.current?.srcObject ===
                          sessionRef.current.camera
                      ) {
                        setCameraReady(true);
                      }
                    }}
                  />

                  {!cameraReady && (
                    <div className="vto-empty-state">
                      <div className="vto-empty-icon">
                        <Camera
                          size={27}
                          strokeWidth={1.4}
                          aria-hidden="true"
                        />
                      </div>
                      <h4>
                        {busy ? "Đang mở camera…" : "Xin chào, bạn!"}
                      </h4>
                      <p>
                        {busy
                          ? "Cho phép truy cập camera để tiếp tục."
                          : "Bắt đầu phiên thử để thấy bạn ở đây."}
                      </p>
                      <span className="vto-frame-corner vto-frame-corner--tl" />
                      <span className="vto-frame-corner vto-frame-corner--tr" />
                      <span className="vto-frame-corner vto-frame-corner--bl" />
                      <span className="vto-frame-corner vto-frame-corner--br" />
                    </div>
                  )}

                  {cameraReady && (
                    <span className="vto-video-badge">
                      <span />Camera đang bật
                    </span>
                  )}
                </div>
              </section>

              <section
                className="vto-preview vto-preview--ai"
                aria-labelledby="vto-ai-title"
              >
                <div className="vto-preview-heading">
                  <h3 id="vto-ai-title">
                    <Sparkles size={16} aria-hidden="true" />
                    Diện mạo với AI
                  </h3>
                  <span>Bản xem trước</span>
                </div>

                <div
                  className={`vto-video-stage${
                    outputReady ? " vto-video-stage--playing" : ""
                  }`}
                >
                  <video
                    ref={outputRef}
                    autoPlay
                    muted
                    playsInline
                    aria-label="Video kết quả thử trang phục bằng AI"
                    onPlaying={() => {
                      const session = sessionRef.current;

                      if (
                        session &&
                        !session.cancelled &&
                        session.remote &&
                        outputRef.current?.srcObject === session.remote
                      ) {
                        setOutputReady(true);
                        startRecording(session.remote);
                      }
                    }}
                  />

                  {!outputReady && (
                    <div className="vto-empty-state">
                      <div className="vto-empty-icon vto-empty-icon--ai">
                        {busy ? (
                          <LoaderCircle
                            className="vto-spin"
                            size={28}
                            strokeWidth={1.4}
                            aria-hidden="true"
                          />
                        ) : (
                          <Sparkles
                            size={28}
                            strokeWidth={1.4}
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      <h4>
                        {busy
                          ? "Đang chuẩn bị diện mạo mới…"
                          : "Một phiên bản mới của bạn"}
                      </h4>
                      <p>
                        {busy
                          ? "Video sẽ xuất hiện khi AI trả kết quả."
                          : "Trang phục đã chọn sẽ được thử lên bạn tại đây."}
                      </p>
                      <span className="vto-ai-caption">
                        VESTORA · VIRTUAL TRY-ON
                      </span>
                    </div>
                  )}

                  {outputReady && (
                    <span className="vto-video-badge">
                      <Sparkles size={12} aria-hidden="true" />
                      Kết quả AI
                    </span>
                  )}
                </div>
              </section>
            </div>

            <div className="vto-control-panel">
              <div className="vto-action-row">
                <div className="vto-buttons">
                  <button
                    type="button"
                    className="vto-button vto-button--primary"
                    onClick={start}
                    disabled={!canStart}
                  >
                    {phase === "starting" ? (
                      <LoaderCircle
                        className="vto-spin"
                        size={18}
                        aria-hidden="true"
                      />
                    ) : (
                      <Camera size={18} aria-hidden="true" />
                    )}

                    {phase === "starting"
                      ? "Đang kết nối…"
                      : phase === "live"
                        ? "Đang thử trang phục"
                        : video.canSave
                          ? "Bỏ video và thử lại"
                          : "Bắt đầu thử đồ"}
                  </button>

                  <button
                    type="button"
                    className="vto-button vto-button--secondary"
                    onClick={() => stop()}
                    disabled={!busy}
                  >
                    <Square size={14} aria-hidden="true" />
                    Dừng
                  </button>

                  <button
                    type="button"
                    className="vto-button vto-button--secondary"
                    onClick={video.saveVideo}
                    disabled={!canSave}
                  >
                    {saving || finishing ? (
                      <LoaderCircle
                        className="vto-spin"
                        size={16}
                        aria-hidden="true"
                      />
                    ) : video.status === "saved" ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <Upload size={16} aria-hidden="true" />
                    )}
                    {saveLabel}
                  </button>
                </div>

                <div className="vto-time">
                  <Clock3 size={16} aria-hidden="true" />
                  <span>
                    {phase === "live" ? (
                      <>
                        <strong>{secondsLeft}s</strong> còn lại
                      </>
                    ) : (
                      "30 giây khám phá"
                    )}
                  </span>
                </div>
              </div>

              <div
                className={`vto-status${
                  hasError ? " vto-status--error" : ""
                }`}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <StatusIcon
                  className={
                    phase === "starting" || loading ? "vto-spin" : ""
                  }
                  size={19}
                  aria-hidden="true"
                />
                <div>
                  <strong>{statusTitle}</strong>
                  <p>
                    {phase === "live" && outputReady
                      ? "Kết quả AI đang hiển thị. Bấm Dừng khi bạn muốn kết thúc."
                      : message}
                  </p>
                </div>
              </div>

              {video.notice && (
                <div
                  className={`vto-recording-note${
                    video.status === "error"
                      ? " vto-recording-note--error"
                      : ""
                  }`}
                  role="status"
                >
                  <VideoIcon
                    size={16}
                    className={saving || finishing ? "vto-spin" : ""}
                    aria-hidden="true"
                  />
                  <p>{video.notice}</p>
                </div>
              )}

              <p className="vto-disclosure">
                <Info size={15} aria-hidden="true" />
                <span>
                  Khi bấm bắt đầu, video camera và ảnh trang phục được
                  gửi tới Decart để xử lý AI. Video kết quả được ghi tạm
                  trong trình duyệt và chỉ tải lên Cloudinary khi bạn
                  bấm Lưu video. Kết quả chỉ tham khảo ngoại hình,
                  không xác nhận độ vừa vặn.
                </span>
              </p>
            </div>
          </section>
        </div>

        <section
          className="vto-video-library"
          aria-labelledby="vto-library-title"
        >
          <div className="vto-library-heading">
            <div>
              <span className="vto-overline">
                LƯU GIỮ DIỆN MẠO YÊU THÍCH
              </span>
              <h2 id="vto-library-title">Video thử đồ đã lưu</h2>
              <p>Các video gần nhất của bạn với trang phục này.</p>
            </div>

            <button
              type="button"
              className="vto-button vto-button--secondary"
              onClick={video.refreshVideos}
              disabled={!productId || video.busy}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Tải lại danh sách
            </button>
          </div>

          {video.historyError && (
            <p className="vto-library-error" role="status">
              {video.historyError}
            </p>
          )}

          {!video.historyError && video.videos.length === 0 && (
            <div className="vto-library-empty">
              <Film
                size={25}
                strokeWidth={1.4}
                aria-hidden="true"
              />
              <p>
                Chưa có video đã lưu. Kết thúc phiên thử rồi bấm
                Lưu video để giữ lại diện mạo bạn thích.
              </p>
            </div>
          )}

          <div className="vto-saved-grid">
            {video.videos.map((item) => (
              <SavedVideoCard
                key={`${item.id}:${item.url}`}
                item={item}
              />
            ))}
          </div>
        </section>

        <section className="vto-tips" aria-labelledby="vto-tips-title">
          <div className="vto-tips-intro">
            <span className="vto-overline">MỘT CHÚT CHUẨN BỊ</span>
            <h2 id="vto-tips-title">Để lên hình đẹp hơn</h2>
          </div>

          <div className="vto-tip">
            <span>
              <Sun size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <h3>Ánh sáng tự nhiên</h3>
              <p>Đứng ở nơi đủ sáng, tránh ngược sáng.</p>
            </div>
          </div>

          <div className="vto-tip">
            <span>
              <Move size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <h3>Giữ khoảng cách vừa đủ</h3>
              <p>Để vùng cơ thể cần thử nằm trong khung hình.</p>
            </div>
          </div>

          <div className="vto-tip">
            <span>
              <Shirt size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <h3>Trang phục gọn gàng</h3>
              <p>Ưu tiên đồ đơn giản, ít che khuất cơ thể.</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}