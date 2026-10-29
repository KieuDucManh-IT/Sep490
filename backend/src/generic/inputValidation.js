export const inputError = (message) => Object.assign(new Error(message), { statusCode: 400 });

export const validateInput = (payload, current, fields, rules) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw inputError('Dữ liệu gửi lên phải là một đối tượng.');
  const allowed = new Set(fields);
  const unknown = Object.keys(payload).filter((key) => !allowed.has(key));
  if (unknown.length) throw inputError(`Trường không được hỗ trợ: ${unknown.join(', ')}.`);

  const candidate = { ...(current || {}), ...payload };
  const normalized = {};
  for (const [key, rule] of Object.entries(rules)) {
    const value = candidate[key];
    if (rule.required && (value === undefined || value === null || value === '')) throw inputError(`${rule.label} là bắt buộc.`);
    if (value === undefined) continue;
    if (value === null) {
      if (rule.nullable) normalized[key] = null;
      continue;
    }
    if (value === '' && rule.type !== 'string') continue;
    if (rule.type === 'string') {
      if (typeof value !== 'string') throw inputError(`${rule.label} phải là chuỗi.`);
      const trimmed = value.trim();
      if (!trimmed && rule.required) throw inputError(`${rule.label} không được để trống.`);
      if (trimmed.length > (rule.maxLength || 500)) throw inputError(`${rule.label} vượt quá độ dài cho phép.`);
      if (rule.enum && !rule.enum.includes(trimmed)) throw inputError(`${rule.label} không hợp lệ.`);
      if (rule.email && trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw inputError(`${rule.label} không đúng định dạng email.`);
      normalized[key] = trimmed;
    } else if (rule.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw inputError(`${rule.label} phải là số hợp lệ.`);
      if (rule.min != null && value < rule.min) throw inputError(`${rule.label} không được nhỏ hơn ${rule.min}.`);
      if (rule.integer && !Number.isInteger(value)) throw inputError(`${rule.label} phải là số nguyên.`);
      normalized[key] = value;
    } else if (rule.type === 'objectId') {
      const objectId = typeof value === 'string' ? value : value?.toString?.();
      if (typeof objectId !== 'string' || !/^[a-f\d]{24}$/i.test(objectId)) throw inputError(`${rule.label} không hợp lệ.`);
      normalized[key] = objectId;
    } else if (rule.type === 'object') {
      if (typeof value !== 'object' || Array.isArray(value)) throw inputError(`${rule.label} phải là object.`);
      normalized[key] = value;
    } else if (rule.type === 'boolean') {
      if (typeof value !== 'boolean') throw inputError(`${rule.label} phải là boolean.`);
      normalized[key] = value;
    }
  }
  return Object.fromEntries(Object.keys(payload).filter((key) => key in normalized).map((key) => [key, normalized[key]]));
};
