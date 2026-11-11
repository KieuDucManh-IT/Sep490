import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../services/api";

const MAX_BYTES = 20 * 1024 * 1024;

export default function useTryOnVideo(productId) {
  const [status, setStatus] = useState("idle");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(null);
  const [videos, setVideos] = useState([]);
  const [historyError, setHistoryError] = useState("");

  const recorderRef = useRef(null);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const savingRef = useRef(false);

  const resetRecording = useCallback(() => {
    generationRef.current += 1;

    const previous = recorderRef.current;
    recorderRef.current = null;

    if (previous && previous.state !== "inactive") {
      previous.stop();
    }

    savingRef.current = false;
    setDraft(null);
    setStatus("idle");
    setNotice("");
  }, []);

  const refreshVideos = useCallback(async () => {
    if (!productId) return;

    const generation = generationRef.current;

    try {
      const result = await apiClient.get("/try-on/videos", {
        params: { productId },
      });

      if (
        mountedRef.current &&
        generation === generationRef.current
      ) {
        setVideos(result.data || []);
        setHistoryError("");
      }
    } catch (error) {
      if (
        mountedRef.current &&
        generation === generationRef.current
      ) {
        setHistoryError(
          error.message || "Không tải được video đã lưu."
        );
      }
    }
  }, [productId]);

  useEffect(() => {
    mountedRef.current = true;
    resetRecording();
    setVideos([]);
    setHistoryError("");
    refreshVideos();

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;

      const recorder = recorderRef.current;
      recorderRef.current = null;

      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  }, [productId, resetRecording, refreshVideos]);

  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      if (mountedRef.current) setStatus("finishing");
      recorder.stop();
    }
  }, []);

  const startRecording = useCallback(
    (stream) => {
      if (recorderRef.current || !stream?.getVideoTracks().length) {
        return;
      }

      const generation = generationRef.current;

      const isCurrent = () =>
        mountedRef.current &&
        generation === generationRef.current;

      try {
        if (!window.MediaRecorder) {
          throw new Error(
            "Trình duyệt chưa hỗ trợ ghi video. Hãy thử Chrome hoặc Edge."
          );
        }

        const mimeType = [
          "video/webm;codecs=vp8",
          "video/webm",
          "video/mp4",
        ].find((type) => MediaRecorder.isTypeSupported(type));

        if (!mimeType) {
          throw new Error(
            "Trình duyệt không hỗ trợ định dạng ghi video phù hợp."
          );
        }

        const recordingId = crypto.randomUUID();

        // Chỉ ghi hình AI, không ghi âm thanh.
        const recorder = new MediaRecorder(
          new MediaStream(stream.getVideoTracks()),
          {
            mimeType,
            videoBitsPerSecond: 1_500_000,
          }
        );

        recorderRef.current = recorder;

        const chunks = [];
        let bytes = 0;
        let failed = false;
        let timer;

        recorder.ondataavailable = (event) => {
          if (!event.data.size || failed) return;

          bytes += event.data.size;

          if (bytes > MAX_BYTES) {
            failed = true;

            if (isCurrent()) {
              setStatus("error");
              setNotice("Video vượt 20 MB. Hãy thử một phiên ngắn hơn.");
            }

            if (recorder.state !== "inactive") recorder.stop();
            return;
          }

          chunks.push(event.data);
        };

        recorder.onerror = () => {
          failed = true;

          if (isCurrent()) {
            setStatus("error");
            setNotice("Không ghi được video của phiên này.");
          }
        };

        recorder.onstop = () => {
          clearTimeout(timer);

          if (!isCurrent() || failed) return;

          if (!chunks.length) {
            setStatus("error");
            setNotice("Chưa có hình ảnh AI để lưu.");
            return;
          }

          const blob = new Blob(chunks, {
            type: recorder.mimeType.split(";")[0],
          });

          chunks.length = 0;

          setDraft({
            blob,
            productId,
            recordingId,
          });

          setStatus("ready");
          setNotice(
            "Video đã sẵn sàng. Bấm Lưu video trước khi bắt đầu phiên mới."
          );
        };

        recorder.start(1000);

        timer = setTimeout(() => {
          if (recorder.state !== "inactive") {
            if (isCurrent()) setStatus("finishing");
            recorder.stop();
          }
        }, 30_000);

        setStatus("recording");
        setNotice("Đang ghi video kết quả AI...");
      } catch (error) {
        recorderRef.current = null;

        if (isCurrent()) {
          setStatus("error");
          setNotice(error.message);
        }
      }
    },
    [productId]
  );

  async function saveVideo() {
    if (!draft || savingRef.current || status !== "ready") return;

    const generation = generationRef.current;

    const isCurrent = () =>
      mountedRef.current &&
      generation === generationRef.current;

    savingRef.current = true;
    setStatus("uploading");
    setNotice("Đang lưu video lên Cloudinary...");

    try {
      const extension =
        draft.blob.type === "video/mp4" ? "mp4" : "webm";

      const form = new FormData();
      form.append("productId", draft.productId);
      form.append("recordingId", draft.recordingId);
      form.append("video", draft.blob, `try-on.${extension}`);

      const result = await apiClient.post("/try-on/videos", form, {
        timeout: 120_000,
      });

      if (!result.data?.id || !result.data?.url) {
        throw new Error("Backend chưa trả về thông tin video.");
      }

      if (!isCurrent()) return;

      setVideos((previous) =>
        [
          result.data,
          ...previous.filter((item) => item.id !== result.data.id),
        ].slice(0, 20)
      );

      setDraft(null);
      setStatus("saved");
      setNotice("Đã lưu video lên Cloudinary.");
    } catch (error) {
      if (isCurrent()) {
        // Giữ nguyên bản ghi để người dùng lưu lại.
        setStatus("ready");
        setNotice(
          error.message || "Lưu chưa thành công. Hãy thử lại."
        );
      }
    } finally {
      if (isCurrent()) savingRef.current = false;
    }
  }

  return {
    startRecording,
    finishRecording,
    resetRecording,
    saveVideo,
    refreshVideos,
    videos,
    historyError,
    notice,
    status,
    canSave: Boolean(draft) && status === "ready",
    busy: ["recording", "finishing", "uploading"].includes(status),
  };
}