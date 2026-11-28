import Replicate from 'replicate';
import cloudinary from '../config/cloudinary.js';

let replicateClient = null;

// Bộ nhớ đệm lưu ảnh trang phục đã bóc tách để tránh gọi lại Replicate nhiều lần
const garmentIsolationCache = new Map();

function getReplicateClient() {
  if (!replicateClient) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new Error('Chưa cấu hình REPLICATE_API_TOKEN trong file môi trường .env');
    }
    replicateClient = new Replicate({ auth: token, useFileOutput: false });
  }
  return replicateClient;
}

/**
 * Wrapper gọi Replicate có cơ chế tự động chờ và thử lại (Auto-retry & Backoff)
 * khi gặp mã lỗi 429 Too Many Requests (Rate limit / Throttled).
 */
async function safeReplicateRun(modelVersion, options, maxRetries = 2) {
  const replicate = getReplicateClient();
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await replicate.run(modelVersion, options);
    } catch (err) {
      const errText = String(err?.message || err || '');
      const isRateLimit =
        err?.status === 429 ||
        /429|throttled|rate limit|too many requests/i.test(errText);

      if (isRateLimit && attempt < maxRetries) {
        attempt++;
        let waitSeconds = 9;
        const retryMatch =
          errText.match(/retry_after["':\s]*(\d+)/i) ||
          errText.match(/resets in ~?(\d+)s/i);
        if (retryMatch && retryMatch[1]) {
          waitSeconds = Math.min(Math.max(parseInt(retryMatch[1], 10), 3), 15);
        }

        console.warn(
          `[TryOnService] Replicate bị 429 Rate Limit (Lần ${attempt}/${maxRetries}). Đang tự động đợi ${waitSeconds}s rồi thử lại...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000 + 800));
        continue;
      }

      if (isRateLimit) {
        throw new Error(
          'Hệ thống AI đang tạm thời đạt giới hạn (Rate limit 6 lượt/phút do tài khoản Replicate dưới $5 credit). Vui lòng đợi khoảng 10 giây và thử lại, hoặc nạp thêm credit Replicate để mở khóa tốc độ cao.'
        );
      }

      throw err;
    }
  }
}

/**
 * Chuyển đổi và làm giàu mô tả trang phục sang tiếng Anh chuyên ngành thời trang.
 * Mô hình Diffusion (CLIP Text Encoder) của IDM-VTON hiểu tiếng Anh sâu sắc hơn,
 * giúp nhận diện chính xác các chi tiết kết cấu như: xếp ly (pleats), vải rủ, nếp gấp...
 */
export function enhanceGarmentDescription(rawName = '', category = 'upper_body') {
  const lower = (rawName || '').toLowerCase();
  const tokens = [];

  // 1. Chi tiết kết cấu đặc biệt (Xếp ly / Dập ly / Xếp nếp)
  if (/xếp ly|xếp li|dập ly|dap ly|ly xếp|pleat|pleated/.test(lower)) {
    tokens.push('short pleated tennis skirt with sharp vertical accordion pleats, elegant pleated skirt');
  } else if (/chữ a|chu a|a-line/.test(lower)) {
    tokens.push('A-line silhouette skirt');
  } else if (/bút chì|but chi|pencil/.test(lower)) {
    tokens.push('pencil fitted skirt');
  } else if (/chân váy|chan vay|skirt/.test(lower)) {
    tokens.push('short fashion skirt');
  }

  // 2. Quần
  if (/quần âu|quan au|quần tây|quan tay|trousers|slacks/.test(lower)) {
    tokens.push('tailored formal trousers');
  } else if (/quần đùi|quần short|shorts/.test(lower)) {
    tokens.push('stylish shorts');
  } else if (/jean|jeans|quần bò/.test(lower)) {
    tokens.push('denim jeans');
  }

  // 3. Áo / Vest / Bộ
  if (/bộ vest|bộ suit|bo vest|bo suit|set vest|cả bộ|nguyên bộ/.test(lower)) {
    tokens.push('complete matching tailored suit with blazer and trousers');
  } else if (/vest|blazer/.test(lower)) {
    tokens.push('tailored blazer suit jacket');
  } else if (/áo dài|ao dai/.test(lower)) {
    tokens.push('traditional Vietnamese Ao Dai dress');
  } else if (/dạ hội|evening gown|maxi/.test(lower)) {
    tokens.push('luxury evening gown dress');
  } else if (/đầm|dam|váy liền|dress/.test(lower)) {
    tokens.push('elegant dress');
  } else if (/sơ mi|so mi|shirt/.test(lower)) {
    tokens.push('formal buttoned shirt');
  } else if (/áo thun|t-shirt|tee/.test(lower)) {
    tokens.push('cotton t-shirt');
  }

  // 4. Nhận diện màu sắc
  if (/trắng|white/.test(lower)) tokens.push('white');
  if (/đen|black/.test(lower)) tokens.push('black');
  if (/be|beige|kem|cream/.test(lower)) tokens.push('beige cream');
  if (/xanh navy|navy/.test(lower)) tokens.push('navy blue');
  else if (/xanh|blue/.test(lower)) tokens.push('blue');
  if (/đỏ|red/.test(lower)) tokens.push('red');
  if (/hồng|pink/.test(lower)) tokens.push('pink');
  if (/xám|ghi|grey|gray/.test(lower)) tokens.push('grey');

  // 5. Phụ kiện thời trang (Túi xách, Kính, Nón, Giày, Khăn...)
  if (/túi|tui|bag|clutch|handbag|tote/.test(lower)) {
    tokens.push('luxury designer leather handbag accessory carried by model');
  } else if (/kính|kinh|glasses|sunglasses|eyewear/.test(lower)) {
    tokens.push('stylish designer fashion sunglasses eyewear on face');
  } else if (/mũ|nón|hat|cap|beret/.test(lower)) {
    tokens.push('fashion elegant hat headwear');
  } else if (/khuyên|vòng|dây chuyền|jewelry|necklace|earrings/.test(lower)) {
    tokens.push('luxury sparkling jewelry fashion accessory');
  } else if (/giày|giay|shoes|heels|sneakers|boots/.test(lower)) {
    tokens.push('designer high-end footwear shoes');
  } else if (/khăn|scarf/.test(lower)) {
    tokens.push('silk luxury scarf wrapped around neck');
  } else if (category === 'accessories') {
    tokens.push('luxury fashion accessory');
  }

  if (tokens.length === 0) {
    if (category === 'lower_body') return 'skirt, trousers, lower body garment';
    if (category === 'dresses') return 'full body dress outfit';
    if (category === 'accessories') return 'fashion luxury accessory';
    return 'upper body clothing';
  }

  return tokens.join(', ');
}

/**
 * Tự động phân loại danh mục quần áo cho AI IDM-VTON:
 * Hỗ trợ 4 categories: 'dresses', 'upper_body', 'lower_body', 'accessories'
 */
export function detectGarmentCategory(name = '', categoryStr = '') {
  const combined = `${name} ${categoryStr}`.toLowerCase();

  // Phụ kiện: túi, kính, nón, khăn, trang sức, giày
  if (
    /túi|tui|bag|kính|kinh|glasses|mũ|nón|hat|khuyên|vòng|jewelry|giày|giay|shoes|phụ kiện|accessory|accessories/.test(
      combined
    )
  ) {
    return 'accessories';
  }

  // Đầm, váy liền thân, áo dài, jumpsuit, cả bộ vest/suit nguyên bộ -> 'dresses'
  if (
    /đầm|dam|váy|vay|áo dài|ao dai|dress|gown|jumpsuit|maxi|cả bộ|ca bo|nguyên bộ|nguyen bo|bộ vest|bo vest|bộ suit|bo suit|set vest|combo|outfit/.test(
      combined
    )
  ) {
    return 'dresses';
  }

  // Quần dài, quần short, chân váy -> 'lower_body'
  if (
    /quần|quan|chân váy|chan vay|pants|trouser|trousers|skirt|short|shorts|jean|jeans/.test(
      combined
    )
  ) {
    return 'lower_body';
  }

  // Mặc định: vest, suit, áo sơ mi, blazer, áo khoác -> 'upper_body'
  return 'upper_body';
}

/**
 * Tách trang phục ra khỏi ảnh người mẫu cũ bằng AI BiRefNet (High-resolution background/subject matting)
 * Sau đó đưa trang phục lên nền trắng chuẩn (RGB 255, 255, 255) qua Cloudinary
 * để mô hình IDM-VTON nhận diện ve áo, cổ áo và nếp gấp hoàn hảo nhất.
 *
 * @param {string} imageUrl - URL ảnh trang phục (ảnh mẫu hoặc ảnh sản phẩm)
 * @param {string} category - Danh mục trang phục ('upper_body', 'lower_body', 'dresses')
 * @returns {Promise<string>} URL ảnh trang phục trên nền trắng
 */
export async function isolateGarmentImage(imageUrl, category = 'upper_body') {
  if (process.env.ENABLE_GARMENT_EXTRACTION === 'false') {
    return imageUrl;
  }
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
    return imageUrl;
  }

  // 1. Kiểm tra cache: nếu ảnh sản phẩm này đã được tách trước đó, lấy luôn từ cache
  // Giúp tiết kiệm 100% quota Replicate và không bị dính giới hạn burst of 1 request
  if (garmentIsolationCache.has(imageUrl)) {
    console.log('[TryOnService] [isolateGarmentImage] Lấy ảnh đã tách từ Cache (tiết kiệm quota):', imageUrl);
    return garmentIsolationCache.get(imageUrl);
  }

  const replicate = getReplicateClient();
  try {
    console.log('[TryOnService] [isolateGarmentImage] Bóc tách trang phục bằng AI BiRefNet:', imageUrl);
    const birefnetVersion =
      'lucataco/birefnet:959550b07e5c544b82d029580e0c804f86d84a3c1032cf05d3cf55ff1153cfb5';

    const output = await replicate.run(birefnetVersion, {
      input: {
        image: imageUrl,
      },
    });

    let extractedUrl = '';
    if (typeof output === 'string') {
      extractedUrl = output;
    } else if (output && typeof output.url === 'function') {
      const resolvedUrl = output.url();
      extractedUrl = typeof resolvedUrl === 'string' ? resolvedUrl : resolvedUrl?.href || String(resolvedUrl);
    } else if (Array.isArray(output) && output.length > 0) {
      const item = output[0];
      extractedUrl = typeof item === 'string' ? item : item?.url ? String(item.url()) : String(item);
    } else if (output && typeof output.toString === 'function') {
      extractedUrl = output.toString();
    }

    if (!extractedUrl || !extractedUrl.startsWith('http')) {
      console.warn('[TryOnService] Không lấy được URL sau khi tách trang phục, dùng lại ảnh gốc');
      return imageUrl;
    }

    // Đặt trang phục đã tách lên nền trắng chuẩn để IDM-VTON nhận diện phom dáng chuẩn nhất
    let whiteBgUrl = extractedUrl;
    try {
      const uploadRes = await cloudinary.uploader.upload(extractedUrl, {
        folder: 'vestora/tryon/isolated_garments',
        resource_type: 'image',
        background: 'white',
        format: 'jpg',
      });
      if (uploadRes?.secure_url) {
        whiteBgUrl = uploadRes.secure_url;
      }
    } catch (cloudErr) {
      console.warn('[TryOnService] Lỗi khi upload ảnh tách nền sang Cloudinary:', cloudErr.message);
      if (extractedUrl.includes('cloudinary.com')) {
        whiteBgUrl = extractedUrl.replace('/upload/', '/upload/b_white,c_pad,w_768,h_1024/');
      }
    }

    // Lưu vào cache để những lần thử đồ sau (đổi size/đổi mẫu/combo) không phải tách lại
    garmentIsolationCache.set(imageUrl, whiteBgUrl);

    console.log('[TryOnService] Tách trang phục thành công ->', whiteBgUrl);
    return whiteBgUrl;
  } catch (err) {
    console.warn(
      '[TryOnService] Tách trang phục gặp sự cố hoặc đạt giới hạn gọi Replicate, tự động fallback dùng ảnh gốc:',
      err.message
    );
    return imageUrl;
  }
}

/**
 * Gọi Replicate AI IDM-VTON để ghép trang phục lên người mẫu/khách hàng
 *
 * @param {Object} params
 * @param {string} params.humanImageUrl - Link ảnh người mẫu/khách hàng
 * @param {string} params.garmentImageUrl - Link ảnh trang phục (sản phẩm)
 * @param {string} [params.category] - 'upper_body' | 'lower_body' | 'dresses' | 'accessories'
 * @param {string} [params.garmentDescription] - Mô tả trang phục
 * @param {boolean} [params.crop=false] - Cắt tự động theo tỷ lệ 3:4 nếu ảnh không chuẩn
 * @param {number} [params.steps=30] - Số bước inference (20 - 40)
 * @param {boolean} [params.autoIsolate=true] - Tự động tách trang phục ra khỏi ảnh mẫu nếu bật
 * @returns {Promise<Object>}
 */
export async function generateTryOn({
  humanImageUrl,
  garmentImageUrl,
  category = 'upper_body',
  garmentDescription = 'garment clothing',
  crop = false,
  steps = 30,
  autoIsolate = true,
}) {
  const replicate = getReplicateClient();
  const startTime = Date.now();

  const validCategories = ['upper_body', 'lower_body', 'dresses'];
  let normalizedCategory = category;
  if (!validCategories.includes(category)) {
    if (category === 'accessories') {
      normalizedCategory = /giày|giay|shoes|sneaker|boots/.test((garmentDescription || '').toLowerCase())
        ? 'lower_body'
        : 'upper_body';
    } else {
      normalizedCategory = 'upper_body';
    }
  }

  // Tiền xử lý: Tách trang phục ra khỏi ảnh người mẫu cũ để tránh lem da/mặt/nền cũ
  let processedGarmentUrl = garmentImageUrl;
  if (autoIsolate && process.env.ENABLE_GARMENT_EXTRACTION !== 'false') {
    processedGarmentUrl = await isolateGarmentImage(garmentImageUrl, normalizedCategory);
  }

  // Làm giàu prompt mô tả bằng tiếng Anh chuẩn thời trang để định hướng U-Net diffusion
  const promptDescription = enhanceGarmentDescription(garmentDescription, normalizedCategory);

  // IDM-VTON: với lower_body (chân váy, quần) và dresses BẮT BUỘC dùng DressCode (force_dc: true)
  // để mô hình nạp đúng trọng số giải phẫu học thân dưới thay vì VITON-HD (chỉ có áo thân trên)
  const isDressCode = normalizedCategory === 'lower_body' || normalizedCategory === 'dresses';

  const input = {
    human_img: humanImageUrl,
    garm_img: processedGarmentUrl,
    garment_des: promptDescription,
    category: normalizedCategory,
    crop: crop === false ? false : true, // Mặc định auto-crop 3:4 để tránh méo xệch thân người
    force_dc: isDressCode,
    steps: Math.min(Math.max(Number(steps) || 35, 20), 40),
  };

  console.log('[TryOnService] Starting AI IDM-VTON generation with params:', {
    category: input.category,
    garment_des: input.garment_des,
    crop: input.crop,
    force_dc: input.force_dc,
    steps: input.steps,
    human_img: input.human_img,
    garm_img: input.garm_img,
    original_garm_img: garmentImageUrl,
  });

  const modelVersion =
    'cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985';

  let rawOutput;
  try {
    rawOutput = await safeReplicateRun(modelVersion, { input });
  } catch (runErr) {
    const errText = String(runErr?.message || runErr || '');
    console.warn('[TryOnService] Replicate run lần 1 gặp lỗi:', errText);

    // Nếu lỗi "list index out of range", thường do tính năng crop=true cắt sai khung người
    // hoặc OpenPose không nhận diện được. Thử tự động retry 1 lần với crop = false
    if (/list index out of range/i.test(errText) && input.crop) {
      console.log('[TryOnService] Thử lại tự động với crop = false...');
      try {
        rawOutput = await safeReplicateRun(modelVersion, {
          input: { ...input, crop: false },
        });
      } catch (retryErr) {
        throw new Error(
          'Mô hình AI không nhận diện được vóc dáng người mẫu trong ảnh (OpenPose pose detection failed). Vui lòng chọn hoặc tải ảnh chụp đứng thẳng người, rõ toàn thân, không bị che khuất ngực/eo.'
        );
      }
    } else if (/list index out of range/i.test(errText)) {
      throw new Error(
        'Mô hình AI không nhận diện được vóc dáng người mẫu trong ảnh (OpenPose pose detection failed). Vui lòng chọn hoặc tải ảnh chụp đứng thẳng người, rõ toàn thân, không bị che khuất ngực/eo.'
      );
    } else {
      throw runErr;
    }
  }

  let rawUrl = '';
  if (typeof rawOutput === 'string') {
    rawUrl = rawOutput;
  } else if (rawOutput && typeof rawOutput.url === 'function') {
    const resolvedUrl = rawOutput.url();
    rawUrl = typeof resolvedUrl === 'string' ? resolvedUrl : resolvedUrl?.href || String(resolvedUrl);
  } else if (Array.isArray(rawOutput) && rawOutput.length > 0) {
    const item = rawOutput[0];
    rawUrl = typeof item === 'string' ? item : item?.url ? String(item.url()) : String(item);
  } else if (rawOutput && typeof rawOutput.toString === 'function') {
    rawUrl = rawOutput.toString();
  }

  if (!rawUrl || !rawUrl.startsWith('http')) {
    throw new Error('Mô hình AI không trả về liên kết ảnh hợp lệ');
  }

  // Lưu trữ vĩnh viễn trên Cloudinary của hệ thống để tránh URL Replicate hết hạn sau 24h
  let finalImageUrl = rawUrl;
  try {
    const uploadedToCloudinary = await cloudinary.uploader.upload(rawUrl, {
      folder: 'vestora/tryon/results',
      resource_type: 'image',
    });
    if (uploadedToCloudinary?.secure_url) {
      finalImageUrl = uploadedToCloudinary.secure_url;
    }
  } catch (cloudErr) {
    console.warn(
      '[TryOnService] Không thể lưu lại ảnh sang Cloudinary, tiếp tục dùng Replicate URL:',
      cloudErr.message
    );
  }

  const durationMs = Date.now() - startTime;
  console.log(`[TryOnService] Thành công sau ${(durationMs / 1000).toFixed(1)}s ->`, finalImageUrl);

  return {
    resultImageUrl: finalImageUrl,
    replicateUrl: rawUrl,
    humanImageUrl,
    garmentImageUrl,
    isolatedGarmentUrl: processedGarmentUrl,
    category: normalizedCategory,
    processingTimeMs: durationMs,
  };
}

