import { Product } from '../models/masterdata/Product.js';
import { ProductVariant } from '../models/masterdata/ProductVariant.js';
import { ProductImage } from '../models/masterdata/ProductImages.js';

// ---------------------------------------------------------------------------
// Cache catalog (2 phút). Lưu cả promise đang chạy để tránh nhiều request
// cùng lúc đều query lại DB khi cache vừa hết hạn.
// ---------------------------------------------------------------------------
const CACHE_TTL = 2 * 60 * 1000;
const MAX_CATALOG_ITEMS = Number(process.env.STYLIST_MAX_CATALOG || 300);

let cache = null; // { catalog, byId, catalogText, time }
let loadingPromise = null;

const fmtVnd = (n) => (n ? `${new Intl.NumberFormat('vi-VN').format(n)}đ` : null);

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', 'FREE', 'FREESIZE'];
const sortSizes = (sizes) =>
  [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(String(a).toUpperCase());
    const ib = SIZE_ORDER.indexOf(String(b).toUpperCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return String(a).localeCompare(String(b), 'vi', { numeric: true });
  });

const minPositive = (arr) => {
  const nums = arr.filter((n) => typeof n === 'number' && n > 0);
  return nums.length ? Math.min(...nums) : 0;
};

async function loadCatalog() {
  const rawProducts = await Product.find({
    isDeleted: { $ne: true },
    status: { $nin: ['inactive', 'INACTIVE', 'discontinued', 'DISCONTINUED'] },
  })
    .populate('categoryId')
    .limit(MAX_CATALOG_ITEMS)
    .lean();

  const productIds = rawProducts.map((p) => p._id);

  const [rawImages, rawVariants] = await Promise.all([
    ProductImage.find({ productId: { $in: productIds } }).sort({ displayOrder: 1 }).lean(),
    ProductVariant.find({
      productId: { $in: productIds },
      status: { $nin: ['inactive', 'INACTIVE'] },
      isDeleted: { $ne: true },
    }).select('-variantName').lean(),
  ]);

  const imagesByProduct = {};
  for (const img of rawImages) {
    const pid = String(img.productId);
    (imagesByProduct[pid] ||= []).push(img);
  }

  const variantsByProduct = {};
  for (const v of rawVariants) {
    const pid = String(v.productId);
    (variantsByProduct[pid] ||= []).push(v);
  }

  const catalog = rawProducts.map((p) => {
    const pid = String(p._id);
    const variants = variantsByProduct[pid] || [];
    const images = imagesByProduct[pid] || [];

    const sizes = sortSizes(new Set(variants.map((v) => v.size).filter(Boolean)));
    const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];

    const categoryName =
      (Array.isArray(p.categoryId)
        ? p.categoryId.map((c) => c?.name).filter(Boolean).join(', ')
        : p.categoryId?.name) ||
      (Array.isArray(p.category) ? p.category.join(', ') : '') ||
      'Thời trang';

    const rentalPricePerDay =
      p.rentalPricePerDay || minPositive(variants.map((v) => v.rentalPricePerDay));
    const salePrice = p.salePrice || minPositive(variants.map((v) => v.salePrice));
    const deposit = p.deposit || minPositive(variants.map((v) => v.depositAmount));

    const primaryImage =
      images.find((i) => i.isPrimary) || images.find((i) => i.imageType === 'MAIN') || images[0];

    return {
      id: pid,
      code: p.productCode || pid,
      name: p.name,
      category: categoryName,
      description: p.description || '',
      brand: p.brand || '',
      gender: p.gender || '',
      material: p.material || '',
      tag: p.tag || 'rental',
      discount: p.discount || 0,
      rentalPricePerDayVnd: rentalPricePerDay,
      salePriceVnd: salePrice,
      depositVnd: deposit,
      // Không bịa size/màu: để rỗng nếu DB chưa có biến thể
      sizes,
      colors,
      imageUrl: primaryImage?.imageUrl || p.image || '',
    };
  });

  // Mỗi sản phẩm một dòng: gọn hơn JSON, tiết kiệm token
  const catalogText = catalog
    .map((i) => {
      const canRent = i.tag === 'rental' || i.tag === 'both';
      const canBuy = i.tag === 'sale' || i.tag === 'both';
      const parts = [
        `id:${i.id}`,
        `mã:${i.code}`,
        `tên:${i.name}`,
        `loại:${i.category}`,
        i.gender ? `giới tính:${i.gender}` : null,
        i.colors.length ? `màu:${i.colors.join(',')}` : 'màu:chưa rõ',
        i.sizes.length ? `size:${i.sizes.join(',')}` : 'size:chưa rõ',
        i.material ? `chất liệu:${i.material}` : null,
        i.brand ? `thương hiệu:${i.brand}` : null,
        canRent && i.rentalPricePerDayVnd ? `thuê:${fmtVnd(i.rentalPricePerDayVnd)}/ngày` : null,
        canRent && i.depositVnd ? `cọc:${fmtVnd(i.depositVnd)}` : null,
        canBuy && i.salePriceVnd ? `mua:${fmtVnd(i.salePriceVnd)}` : null,
        i.discount ? `giảm:${i.discount}%` : null,
        i.description ? `mô tả:${i.description.replace(/\s+/g, ' ').slice(0, 150)}` : null,
      ];
      return '- ' + parts.filter(Boolean).join(' | ');
    })
    .join('\n');

  return {
    catalog,
    byId: new Map(catalog.map((i) => [i.id, i])),
    catalogText,
    time: Date.now(),
  };
}

async function getCatalog() {
  if (cache && Date.now() - cache.time < CACHE_TTL) return cache;
  if (!loadingPromise) {
    loadingPromise = loadCatalog()
      .then((data) => {
        cache = data;
        return data;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }
  try {
    return await loadingPromise;
  } catch (err) {
    // Nếu DB lỗi nhưng còn cache cũ thì dùng tạm
    if (cache) return cache;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
function buildSystemText(catalogText) {
  return `Bạn là VESTORA Stylist, chuyên viên tư vấn thuê và mua trang phục cao cấp của VESTORA. Bạn giao tiếp bằng tiếng Việt lịch thiệp, ấm áp, tinh tế như một personal stylist thực thụ.
 
## QUY TRÌNH TƯ VẤN (đi lần lượt, không dồn dập)
 
BƯỚC 1 - Nhu cầu: Chào khách và tìm hiểu dịp sử dụng (đám cưới, dạ hội, sự kiện, công sở, chụp ảnh, dạo phố...), muốn thuê hay mua, ngân sách, số ngày thuê/ngày dùng.
 
BƯỚC 2 - Phân tích phong cách cá nhân: Xác định phong cách của khách (thanh lịch cổ điển, hiện đại tối giản, quyến rũ, trẻ trung năng động, sang trọng nổi bật...). Mỗi lượt hỏi tối đa 2-3 câu, ví dụ:
- Bạn thích nổi bật hay tinh tế, kín đáo?
- Màu nào bạn hay chọn, màu nào muốn tránh?
- Bạn thích dáng ôm, suông hay xòe? Có phần cơ thể nào muốn tôn hoặc che không?
Sau đó tóm tắt ngắn gọn phong cách bạn nhận định được để khách xác nhận (ví dụ: "Mình thấy bạn hợp phong cách thanh lịch hiện đại, tối giản mà vẫn sang. Đúng ý bạn chứ?").
 
BƯỚC 3 - Hỏi size để gợi ý chuẩn:
- Giới tính, chiều cao, cân nặng.
- Nữ: số đo ngực - eo - mông. Nam: vòng ngực, vai, eo, dài tay/chân (với vest). Cả hai: size thường mặc.
- Thích mặc vừa người hay rộng thoải mái, có cần chỉnh sửa/lên gấu không.
Giải thích ngắn rằng thông tin này giúp chọn đúng size, tránh sai form. Nếu khách không nhớ số đo, hỏi size họ thường mặc hoặc hướng dẫn tự đo nhanh.
 
BƯỚC 4 - Đề xuất: Chọn mẫu từ Catalog dựa trên dịp + phong cách + ngân sách + size + giới tính. Với mỗi mẫu, giải thích rõ vì sao hợp (kiểu dáng, chất liệu, màu sắc, độ trang trọng, tôn dáng) và nên chọn size nào trong các size Catalog đang có.
 
## NGUYÊN TẮC
1. CHỈ giới thiệu sản phẩm có trong Catalog. Tuyệt đối không bịa sản phẩm, mã, giá, màu, size hay tồn kho. Chỉ gợi ý size có trong trường "size" của sản phẩm; nếu size khách cần không có, nói thẳng và đề xuất size gần nhất hoặc mẫu khác. Nếu ghi "size:chưa rõ" thì nói cần xác nhận lại với cửa hàng. Catalog không có thông tin tồn kho nên không khẳng định "còn hàng".
2. Phân biệt giá thuê (theo ngày, kèm tiền cọc) và giá mua. Chỉ nêu loại giá mà sản phẩm thực sự có. Nếu khách nói số ngày thuê, hãy tính tổng tiền thuê và nhắc tiền cọc.
3. Lọc đúng giới tính khách cần. Nếu chưa biết mà cần để gợi ý, hãy hỏi trước.
4. Mỗi lượt chỉ hỏi tối đa 2-3 câu, ưu tiên điều quan trọng nhất còn thiếu. Không hỏi lại điều khách đã trả lời trong cuộc trò chuyện.
5. Nếu khách đã nêu rõ nhu cầu hoặc muốn xem ngay, hãy đề xuất luôn rồi hỏi thêm phong cách/size để tinh chỉnh. Không bắt khách trả lời hết mới được tư vấn.
6. Nếu số đo nằm giữa hai size hoặc thiếu dữ liệu, nói rõ và đề xuất phương án (chọn size lớn hơn để chỉnh, hoặc thử trực tiếp tại cửa hàng).
7. Nếu không có mẫu phù hợp, giải thích lịch thiệp và hỏi khách có muốn đổi phong cách, màu sắc hoặc ngân sách không.
8. Giọng văn tự nhiên, không máy móc, ít emoji, không liệt kê khô khan. Chỉ chào ở lượt đầu tiên.
 
## ĐỊNH DẠNG TRẢ LỜI
Luôn trả lời đúng MỘT đối tượng JSON duy nhất, không bọc markdown, không thêm chữ ngoài JSON:
{"reply": "Nội dung tư vấn gửi khách...", "productIds": ["id_1", "id_2"], "quickReplies": ["Lựa chọn nhanh 1", "Lựa chọn nhanh 2"]}
- "productIds": tối đa 4 ID phù hợp nhất, copy chính xác phần sau "id:" trong Catalog. Để [] nếu chưa đủ thông tin hoặc đang hỏi thêm.
- "quickReplies": 2-4 lựa chọn ngắn (dưới 6 từ) để khách bấm trả lời nhanh cho câu hỏi bạn vừa đặt. Để [] nếu không cần.
 
## CATALOG SẢN PHẨM VESTORA
${catalogText || '(Hiện chưa có sản phẩm nào trong Catalog)'}`;
}

// ---------------------------------------------------------------------------
// Parse JSON từ Gemini (chịu được markdown / chữ thừa)
// ---------------------------------------------------------------------------
function parseModelJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (_) {
        /* rơi xuống null */
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
export const chatWithStylist = async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ success: false, error: 'Bạn hãy nhập câu hỏi trước nhé.' });
  }
  if (message.length > 1500) {
    return res.status(400).json({ success: false, error: 'Tin nhắn tối đa 1.500 ký tự.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res
      .status(503)
      .json({ success: false, error: 'Chưa cấu hình GEMINI_API_KEY trong hệ thống.' });
  }

  const candidateModels = [
    process.env.GEMINI_TEXT_MODEL,
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.1-flash-lite',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const { catalog, byId, catalogText } = await getCatalog();
    const systemText = buildSystemText(catalogText);

    // Lịch sử: giữ 12 tin gần nhất (đủ nhớ số đo + phong cách), bắt đầu bằng lượt của khách
    let history = Array.isArray(req.body?.history)
      ? req.body.history
        .filter(
          (item) =>
            item && ['user', 'model'].includes(item.role) && typeof item.text === 'string' && item.text.trim()
        )
        .slice(-12)
        .map((item) => ({ role: item.role, parts: [{ text: item.text.slice(0, 1500) }] }))
      : [];
    while (history.length && history[0].role !== 'user') history.shift();

    const contents = [...history, { role: 'user', parts: [{ text: message }] }];

    let payload = null;
    let lastError = null;

    // Tự động chuyển đổi qua model dự phòng nếu model chính bị 503 (High Demand) hoặc 429
    for (const currentModel of candidateModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemText }] },
              contents,
              generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
            }),
            signal: controller.signal,
          }
        );

        const data = await response.json().catch(() => null);
        if (response.ok && data?.candidates?.[0]?.content?.parts) {
          payload = data;
          break; // Thành công!
        }

        console.warn(`[AI Stylist] Model ${currentModel} quá tải/lỗi (${response.status}):`, data?.error?.message || response.statusText);
        lastError = new Error(data?.error?.message || `Gemini API trả mã lỗi ${response.status}`);
      } catch (callErr) {
        if (callErr.name === 'AbortError') throw callErr;
        console.warn(`[AI Stylist] Lỗi kết nối model ${currentModel}:`, callErr.message);
        lastError = callErr;
      }
    }

    if (!payload) {
      console.error('Tất cả các model Gemini đều không phản hồi:', lastError);
      throw lastError || new Error('Tất cả các model Gemini đều đang bận, vui lòng thử lại sau giây lát.');
    }

    const generatedText = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!generatedText) {
      throw new Error('Gemini không phản hồi nội dung.');
    }

    const result = parseModelJson(generatedText);

    // Model trả sai định dạng: dùng nguyên văn làm câu trả lời thay vì báo lỗi 500
    if (!result) {
      return res.json({ success: true, reply: generatedText, products: [], quickReplies: [] });
    }

    // Chỉ nhận ID có thật trong catalog, giữ thứ tự AI ưu tiên, tối đa 4, bỏ trùng
    const seen = new Set();
    const recommendedProducts = (Array.isArray(result.productIds) ? result.productIds : [])
      .map((id) => String(id))
      .filter((id) => byId.has(id) && !seen.has(id) && seen.add(id))
      .slice(0, 4)
      .map((id) => byId.get(id));

    const quickReplies = (Array.isArray(result.quickReplies) ? result.quickReplies : [])
      .filter((q) => typeof q === 'string' && q.trim())
      .map((q) => q.trim().slice(0, 60))
      .slice(0, 4);

    const reply =
      typeof result.reply === 'string' && result.reply.trim()
        ? result.reply.trim()
        : 'Mình rất vui được hỗ trợ bạn. Bạn dự định tham gia sự kiện gì và mong muốn phong cách như thế nào?';

    return res.json({
      success: true,
      reply,
      products: recommendedProducts,
      quickReplies,
      // Hữu ích để debug / hiển thị "đang xem X mẫu"
      catalogSize: catalog.length,
    });
  } catch (error) {
    console.error('Lỗi chatWithStylist:', error);
    const timedOut = error.name === 'AbortError';
    return res.status(timedOut ? 504 : 500).json({
      success: false,
      error: timedOut
        ? 'Trợ lý Stylist phản hồi hơi lâu do mạng, bạn thử gửi lại nhé!'
        : error.message || 'Chưa thể kết nối với Stylist lúc này.',
    });
  } finally {
    clearTimeout(timeout);
  }
};
