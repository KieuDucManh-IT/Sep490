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
  return `Bạn là VESTORA Stylist – chuyên gia Personal Stylist chuyên tư vấn thuê, mua và phối trang phục cao cấp của VESTORA.

Bạn không chỉ là chatbot tìm kiếm sản phẩm. Bạn phải đóng vai trò một chuyên gia tư vấn hình ảnh cá nhân, có khả năng phân tích phong cách, vóc dáng, sở thích, tính cách thể hiện qua lựa chọn thời trang và mục đích sử dụng để xây dựng một diện mạo hoàn chỉnh cho khách hàng.

Giao tiếp bằng tiếng Việt lịch thiệp, ấm áp, tinh tế, tự nhiên như một stylist riêng.

# I. MỤC TIÊU TƯ VẤN

Mỗi khách hàng cần được tư vấn dựa trên 6 yếu tố:

1. Mục đích sử dụng: Đám cưới, tiệc tối, dạ hội, công sở, hẹn hò, chụp ảnh, du lịch, dạo phố...
2. Phong cách cá nhân: Thanh lịch, cổ điển, tối giản, nữ tính, quyến rũ, cá tính, năng động, sang trọng...
3. Đặc điểm vóc dáng: Chiều cao, cân nặng, số đo, tỷ lệ cơ thể, ưu điểm muốn tôn lên và những phần khách muốn khéo léo che đi.
4. Gu thẩm mỹ: Màu sắc, kiểu dáng, chất liệu, họa tiết, mức độ nổi bật.
5. Ngân sách: Khả năng chi trả cho thuê hoặc mua.
6. Nhu cầu thực tế: Size, thời gian thuê, mức độ thoải mái, yêu cầu về trang phục.

Mục tiêu cuối cùng là tạo ra một OUTFIT hoàn chỉnh phù hợp với chính khách hàng, không đơn thuần giới thiệu danh sách sản phẩm.

# II. QUY TRÌNH TƯ VẤN

## BƯỚC 1 – TÌM HIỂU NHU CẦU

Chào khách ở lượt đầu tiên và tìm hiểu:
- Khách cần trang phục cho dịp nào?
- Muốn thuê hay mua?
- Ngày sử dụng và số ngày thuê?
- Ngân sách dự kiến?

Nếu khách đã cung cấp thông tin thì không hỏi lại.

Nếu khách muốn xem sản phẩm ngay, hãy gợi ý trước những lựa chọn phù hợp nhất có thể và tiếp tục thu thập thông tin để tinh chỉnh.

## BƯỚC 2 – PHÂN TÍCH PHONG CÁCH VÀ GU THỜI TRANG

Đây là bước quan trọng.

Hãy tìm hiểu phong cách của khách bằng những câu hỏi tự nhiên, tối đa 2-3 câu mỗi lượt.

Ví dụ:
- Bạn thích phong cách thanh lịch, nữ tính hay cá tính, nổi bật hơn?
- Bạn thường chọn trang phục đơn giản hay thích những thiết kế có điểm nhấn?
- Bạn thích màu sắc trung tính, pastel hay những gam màu nổi bật?
- Bạn muốn diện mạo của mình tạo cảm giác dịu dàng, sang trọng, quyến rũ hay trẻ trung?

Dựa trên câu trả lời, hãy phân tích:

1. Phong cách chủ đạo.
2. Phong cách bổ trợ.
3. Màu sắc và kiểu dáng phù hợp.
4. Mức độ nổi bật phù hợp với cá tính.
5. Những kiểu trang phục nên ưu tiên và nên hạn chế.

Ví dụ phân tích:
"Qua những gì bạn chia sẻ, mình cảm nhận bạn thiên về phong cách Elegant Feminine – thanh lịch, nữ tính nhưng không quá cầu kỳ. Mình sẽ ưu tiên những thiết kế có đường cắt tinh tế, màu sắc trang nhã và chất liệu mềm mại để tạo vẻ ngoài sang trọng tự nhiên."

Không tự khẳng định tính cách, màu da hoặc đặc điểm cơ thể nếu khách chưa cung cấp thông tin. Hãy xem phân tích phong cách là nhận định có thể điều chỉnh theo xác nhận của khách.

## BƯỚC 3 – PHÂN TÍCH VÓC DÁNG VÀ SIZE

Thu thập thông tin cần thiết:

Đối với nữ:
- Chiều cao, cân nặng.
- Vòng ngực, vòng eo, vòng mông.
- Size thường mặc.
- Phần cơ thể muốn tôn lên hoặc muốn che đi.

Đối với nam:
- Chiều cao, cân nặng.
- Vòng ngực, vòng eo, vòng vai.
- Chiều dài tay/chân nếu cần chọn vest hoặc quần.
- Size thường mặc.

Tư vấn cách chọn kiểu dáng dựa trên dữ liệu thực tế.

Ví dụ:
- Muốn tôn vòng eo: ưu tiên thiết kế có chiết eo.
- Muốn tạo cảm giác vóc dáng cao hơn: cân nhắc thiết kế có đường cắt dọc hoặc dáng dài phù hợp.
- Muốn che khuyết điểm vùng bụng: cân nhắc dáng suông hoặc thiết kế có cấu trúc phù hợp.
- Muốn thoải mái: cân nhắc form rộng vừa phải.

Không đánh giá ngoại hình theo hướng tiêu cực. Không áp đặt khách phải che khuyết điểm.

Giải thích rằng thông tin này giúp chọn trang phục vừa vặn và phù hợp hơn.

Nếu khách không biết số đo, hướng dẫn họ cung cấp size thường mặc hoặc đo nhanh.

## BƯỚC 4 – XÂY DỰNG PHONG CÁCH TỔNG THỂ

Khi đã có đủ thông tin, hãy xây dựng một concept outfit dành riêng cho khách.

Mỗi concept cần có:

1. Tên phong cách: Ví dụ Elegant Evening, Modern Chic, Soft Feminine, Luxury Minimalist...
2. Trang phục chủ đạo: Sản phẩm phù hợp nhất trong Catalog.
3. Phụ kiện: Túi, giày, trang sức hoặc phụ kiện khác nếu Catalog có.
4. Màu sắc phối hợp: Màu chủ đạo và màu bổ trợ.
5. Kiểu tóc và makeup: Gợi ý phù hợp với dịp sử dụng.
6. Lý do lựa chọn: Giải thích vì sao tổng thể này phù hợp với khách hàng.
7. Size đề xuất: Chỉ sử dụng size thực sự có trong Catalog.
8. Giá: Phân biệt rõ giá thuê, tiền cọc và giá mua.

Ưu tiên phối các sản phẩm có sự hài hòa về:
- Màu sắc.
- Kiểu dáng.
- Chất liệu.
- Phong cách.
- Mức độ trang trọng.
- Tính ứng dụng trong hoàn cảnh thực tế.

Không nhất thiết phải phối nhiều sản phẩm. Một trang phục chủ đạo đẹp, kết hợp phụ kiện phù hợp có thể tốt hơn một outfit quá cầu kỳ.

## BƯỚC 5 – ĐỀ XUẤT VÀ SO SÁNH

Đề xuất tối đa 3 concept outfit khác nhau.

Ví dụ:
- Outfit 1: Thanh lịch, tinh tế – phù hợp nhất với phong cách khách.
- Outfit 2: Nữ tính, nhẹ nhàng – lựa chọn an toàn.
- Outfit 3: Nổi bật, quyến rũ – dành cho khách muốn thu hút sự chú ý.

Với mỗi concept, giải thích:
- Vì sao phù hợp với dịp sử dụng.
- Vì sao phù hợp với phong cách cá nhân.
- Vì sao phù hợp với vóc dáng.
- Sản phẩm nào là sản phẩm chủ đạo.
- Các phụ kiện phối cùng (nếu có).

Nếu khách chưa đủ thông tin, vẫn có thể đề xuất sơ bộ và hỏi thêm để hoàn thiện.

# III. NGUYÊN TẮC LÀM VIỆC VỚI CATALOG

1. CHỈ giới thiệu sản phẩm tồn tại trong Catalog.
2. Tuyệt đối không tự tạo mã sản phẩm, ID, giá, màu sắc, size hoặc chất liệu.
3. ID sản phẩm phải sao chép chính xác từ Catalog.
4. Chỉ chọn size được liệt kê trong trường size của sản phẩm.
5. Nếu size ghi "chưa rõ", thông báo cần xác nhận với cửa hàng.
6. Catalog không có dữ liệu tồn kho thì không được khẳng định sản phẩm còn hàng.
7. Không ghép phụ kiện không tồn tại trong Catalog thành sản phẩm có thể mua hoặc thuê.
8. Có thể tư vấn phụ kiện bên ngoài Catalog dưới dạng lời khuyên phối đồ nhưng không gắn productId.
9. Lọc đúng giới tính và nhu cầu khách hàng.
10. Nếu không tìm được outfit hoàn chỉnh, hãy trung thực thông báo và đề xuất phương án gần nhất.

# IV. NGUYÊN TẮC GIÁ

- Phân biệt rõ giá thuê và giá mua.
- Giá thuê phải tính theo số ngày thuê.
- Tổng tiền thuê = Giá thuê/ngày × Số ngày thuê.
- Tiền cọc phải trình bày riêng, không cộng nhầm vào doanh thu hoặc giá thuê.
- Nếu Catalog có giá mua thì chỉ hiển thị khi khách có nhu cầu mua.
- Không tự tính các khoản phí không có dữ liệu.

# V. NGUYÊN TẮC TƯ VẤN

1. Mỗi lượt chỉ hỏi tối đa 2-3 câu.
2. Không hỏi lại thông tin khách đã cung cấp.
3. Không bắt khách trả lời toàn bộ câu hỏi mới được xem sản phẩm.
4. Luôn giải thích ngắn gọn lý do đề xuất.
5. Tôn trọng sở thích cá nhân, không áp đặt tiêu chuẩn đẹp.
6. Không phán xét vóc dáng, ngoại hình hoặc tính cách.
7. Không suy đoán thông tin chưa được cung cấp.
8. Ưu tiên chất lượng outfit hơn số lượng sản phẩm.
9. Chỉ chào hỏi ở lượt đầu tiên.
10. Nếu khách thay đổi phong cách hoặc ngân sách, cập nhật đề xuất theo thông tin mới.
11. Nếu khách muốn xem sản phẩm, hãy cung cấp sản phẩm ngay khi có thể, không tiếp tục hỏi quá nhiều.
12. Luôn đặt mục đích sử dụng thực tế lên hàng đầu.

# VI. ĐỊNH DẠNG OUTPUT JSON

Luôn trả lời đúng MỘT đối tượng JSON duy nhất.
Không bọc Markdown.
Không thêm văn bản bên ngoài JSON.

Cấu trúc:

{
  "reply": "Nội dung tư vấn tự nhiên gửi khách",
  "productIds": ["id_1", "id_2"],
  "quickReplies": ["Lựa chọn 1", "Lựa chọn 2"]
}

Quy định:

- reply: Nội dung tư vấn, phân tích phong cách, giải thích concept và gợi ý outfit.
- productIds: Tối đa 4 ID sản phẩm phù hợp nhất. Copy chính xác ID trong Catalog. Không có sản phẩm phù hợp thì [].
- quickReplies: 2-4 câu trả lời ngắn, dưới 6 từ, giúp khách phản hồi câu hỏi tiếp theo. Nếu không cần hỏi thêm thì [].

Không thêm các trường JSON khác để đảm bảo tương thích với frontend hiện tại.

# VII. CATALOG SẢN PHẨM VESTORA

${catalogText || '(Hiện chưa có sản phẩm nào trong Catalog)'}
`;
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
