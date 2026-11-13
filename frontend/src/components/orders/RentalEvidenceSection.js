import React, {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';

import { createPortal } from 'react-dom';

import {
    AlertCircle,
    Film,
    Loader2,
    PackageCheck,
    RefreshCw,
    UploadCloud,
    Video,
    X,
} from 'lucide-react';

import {
    getRentalEvidence,
    uploadRentalEvidence,
} from '../../services/rentalEvidenceApi';

import '../../styles/OrderEvidence.css';

const labels = {
    packing: 'Video đóng hàng',
    receiving: 'Video nhận hàng',
};

const sizeLabel = (bytes) =>
    `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} MB`;

const dateLabel = (date) =>
    new Date(date).toLocaleString('vi-VN');

export default function RentalEvidenceSection({
    orderId,
    orderType = 'rental',
}) {
    const [data, setData] = useState({
        videos: [],
        uploadKind: null,
        maxBytes: 50 * 1024 * 1024,
    });

    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);

    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState('');

    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const [error, setError] = useState('');

    const inputId = useId();

    const inputRef = useRef(null);
    const controllerRef = useRef(null);
    const mounted = useRef(false);
    const sequence = useRef(0);

    const load = useCallback(
        async (showError = true) => {
            const request = ++sequence.current;

            try {
                const response = await getRentalEvidence(
                    orderId,
                    orderType
                );

                if (
                    mounted.current &&
                    request === sequence.current
                ) {
                    setData((previous) => ({
                        ...response.data,

                        // Giữ URL còn hạn để việc tải lại danh sách
                        // không làm video đang phát bị khởi động lại.
                        videos: response.data.videos.map((video) => {
                            const existing = previous.videos.find(
                                (item) => item._id === video._id
                            );

                            const hasValidUrl =
                                existing &&
                                new Date(
                                    existing.urlExpiresAt
                                ).getTime() > Date.now() + 60000;

                            return hasValidUrl
                                ? {
                                    ...video,
                                    url: existing.url,
                                    urlExpiresAt: existing.urlExpiresAt,
                                }
                                : video;
                        }),
                    }));

                    setLoadFailed(false);
                }
            } catch (err) {
                if (
                    mounted.current &&
                    request === sequence.current &&
                    showError
                ) {
                    setLoadFailed(true);
                    setError(err.message);
                }
            } finally {
                if (
                    mounted.current &&
                    request === sequence.current
                ) {
                    setLoading(false);
                }
            }
        },
        [orderId, orderType]
    );

    useEffect(() => {
        mounted.current = true;

        load();

        const refresh = () => {
            if (
                !controllerRef.current &&
                !document.hidden
            ) {
                load(false);
            }
        };

        const timer = setInterval(refresh, 30000);

        window.addEventListener('focus', refresh);

        return () => {
            mounted.current = false;
            sequence.current += 1;

            controllerRef.current?.abort();

            clearInterval(timer);
            window.removeEventListener('focus', refresh);
        };
    }, [load]);

    useEffect(() => {
        if (!file) {
            setPreview('');
            return undefined;
        }

        const url = URL.createObjectURL(file);

        setPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [file]);

    const chooseFile = (event) => {
        const selected = event.target.files?.[0];

        if (!selected) return;

        const supportedTypes = [
            'video/mp4',
            'video/quicktime',
            'video/webm',
        ];

        if (
            !/\.(mp4|mov|webm)$/i.test(selected.name) ||
            !supportedTypes.includes(selected.type)
        ) {
            setError(
                'Vui lòng chọn video MP4, MOV hoặc WebM.'
            );

            event.target.value = '';
            return;
        }

        if (
            selected.size === 0 ||
            selected.size > data.maxBytes
        ) {
            setError(
                'Video phải có dữ liệu và không được vượt quá 50 MB.'
            );

            event.target.value = '';
            return;
        }

        setFile(selected);
    };

    const submit = async () => {
        if (
            !file ||
            !data.uploadKind ||
            controllerRef.current
        ) {
            return;
        }

        const controller = new AbortController();

        controllerRef.current = controller;

        setUploading(true);
        setProgress(0);

        try {
            const video = await uploadRentalEvidence(
                orderId,
                data.uploadKind,
                file,
                {
                    orderType,
                    signal: controller.signal,

                    onProgress: (value) => {
                        if (mounted.current) {
                            setProgress(value);
                        }
                    },
                }
            );

            if (!mounted.current) return;

            sequence.current += 1;

            setData((old) => ({
                ...old,

                videos: [
                    video,
                    ...old.videos.filter(
                        (item) => item._id !== video._id
                    ),
                ],
            }));

            setFile(null);

            if (inputRef.current) {
                inputRef.current.value = '';
            }
        } catch (err) {
            if (
                mounted.current &&
                err.name !== 'AbortError'
            ) {
                setError(err.message);
            }
        } finally {
            controllerRef.current = null;

            if (mounted.current) {
                setUploading(false);
            }
        }
    };

    const clearSelection = () => {
        setFile(null);

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <section
            className="order-section evidence-section"
            aria-label="Video bằng chứng giao nhận"
        >
            <div className="order-section-heading">
                <h4>
                    <Video size={20} />
                    5. VIDEO BẰNG CHỨNG GIAO NHẬN
                </h4>

                <button
                    type="button"
                    className="evidence-refresh"
                    disabled={uploading || loading}
                    onClick={() => load()}
                    aria-label="Tải lại video"
                >
                    <RefreshCw size={15} />
                    Tải lại
                </button>
            </div>

            <p className="evidence-intro">
                Theo dõi tình trạng kiện hàng khi đóng gói và
                khi nhận. Chi nhánh và khách hàng đều xem được
                các video của đơn này.
            </p>

            {loading ? (
                <p className="evidence-empty" role="status">
                    <Loader2
                        size={18}
                        className="animate-spin"
                    />
                    Đang tải video...
                </p>
            ) : loadFailed ? (
                <p className="evidence-empty">
                    Chưa tải được video. Nhấn “Tải lại” để thử lại.
                </p>
            ) : (
                <div className="evidence-columns">
                    {['packing', 'receiving'].map((kind) => {
                        const videos = data.videos.filter(
                            (item) => item.kind === kind
                        );

                        const canUpload =
                            data.uploadKind === kind;

                        return (
                            <div
                                className="evidence-group"
                                key={kind}
                            >
                                <div className="evidence-group-title">
                                    {kind === 'packing' ? (
                                        <PackageCheck size={20} />
                                    ) : (
                                        <Film size={20} />
                                    )}

                                    <div>
                                        <h5>{labels[kind]}</h5>

                                        <span>
                                            {kind === 'packing'
                                                ? 'Chi nhánh cung cấp'
                                                : 'Khách hàng cung cấp'}
                                        </span>
                                    </div>

                                    <span className="evidence-count">
                                        {videos.length}
                                    </span>
                                </div>

                                {videos.length === 0 && (
                                    <div className="evidence-empty">
                                        <Video size={25} />

                                        <span>
                                            Chưa có{' '}
                                            {labels[kind].toLowerCase()}.
                                        </span>
                                    </div>
                                )}

                                <div className="evidence-videos">
                                    {videos.map((video) => (
                                        <article
                                            className="evidence-video-card"
                                            key={video._id}
                                        >
                                            <video
                                                controls
                                                playsInline
                                                preload="none"
                                                src={video.url}
                                                aria-label={
                                                    `${labels[kind]}: ${video.originalName}`
                                                }
                                            />

                                            <div className="evidence-video-meta">
                                                <strong
                                                    title={video.originalName}
                                                >
                                                    {video.originalName}
                                                </strong>

                                                <span>
                                                    {video.uploaderName}
                                                    {' · '}
                                                    {dateLabel(video.createdAt)}
                                                </span>

                                                <div>
                                                    <span>
                                                        {sizeLabel(video.bytes)}
                                                    </span>

                                                    <a
                                                        href={video.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Mở video
                                                    </a>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>

                                {canUpload && (
                                    <div className="evidence-upload">
                                        <label htmlFor={inputId}>
                                            <UploadCloud size={20} />
                                            Chọn{' '}
                                            {labels[kind].toLowerCase()}
                                        </label>

                                        <input
                                            ref={inputRef}
                                            id={inputId}
                                            type="file"
                                            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
                                            disabled={uploading}
                                            onChange={chooseFile}
                                        />

                                        <p>
                                            MP4, MOV, WebM · Tối đa 50 MB/video
                                        </p>

                                        {file && (
                                            <div className="evidence-preview">
                                                {preview && (
                                                    <video
                                                        src={preview}
                                                        controls
                                                        playsInline
                                                        preload="metadata"
                                                        aria-label="Xem trước video đã chọn"
                                                    />
                                                )}

                                                <span>
                                                    {file.name}
                                                    {' · '}
                                                    {sizeLabel(file.size)}
                                                </span>

                                                <div className="evidence-upload-actions">
                                                    <button
                                                        className="evidence-primary"
                                                        type="button"
                                                        disabled={uploading}
                                                        onClick={submit}
                                                    >
                                                        {uploading ? (
                                                            <Loader2
                                                                size={16}
                                                                className="animate-spin"
                                                            />
                                                        ) : (
                                                            <UploadCloud size={16} />
                                                        )}

                                                        {uploading
                                                            ? 'Đang tải video...'
                                                            : 'Tải video lên'}
                                                    </button>

                                                    <button
                                                        className="evidence-secondary"
                                                        type="button"
                                                        disabled={uploading}
                                                        onClick={clearSelection}
                                                    >
                                                        Bỏ chọn
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {uploading && (
                                            <div
                                                className="evidence-progress"
                                                role="status"
                                                aria-live="polite"
                                            >
                                                <progress
                                                    value={progress}
                                                    max="100"
                                                />

                                                <span>
                                                    {progress < 100
                                                        ? `Đã gửi ${progress}%`
                                                        : 'Đang xử lý và lưu video, vui lòng chờ...'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {error &&
                createPortal(
                    <div
                        className="evidence-error-overlay"
                        onClick={() => setError('')}
                    >
                        <div
                            className="evidence-error-popup"
                            role="alertdialog"
                            aria-modal="true"
                            aria-label="Không thể xử lý video"
                            onClick={(event) =>
                                event.stopPropagation()
                            }
                        >
                            <button
                                className="evidence-error-close"
                                type="button"
                                onClick={() => setError('')}
                                aria-label="Đóng thông báo"
                            >
                                <X size={20} />
                            </button>

                            <AlertCircle size={30} />

                            <h4>Không thể xử lý video</h4>

                            <p>{error}</p>

                            <button
                                type="button"
                                className="evidence-primary"
                                autoFocus
                                onClick={() => setError('')}
                            >
                                Đã hiểu
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
        </section>
    );
}