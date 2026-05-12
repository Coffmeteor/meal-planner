export const COMMON_PORTIONS = {
  '个': { '鸡蛋': 50, '蛋': 50, '红薯': 200, '紫薯': 180, '土豆': 150 },
  '碗': { '米饭': 150, '饭': 150, '粥': 200, '面': 200 },
  '杯': { '牛奶': 250, '豆浆': 250, '酸奶': 200, '水': 200 },
  '盒': { '酸奶': 150, '牛奶': 250 },
  '根': { '香蕉': 100, '黄瓜': 150, '玉米': 200 },
  '片': { '面包': 40, '吐司': 40, '芝士': 20 },
  '勺': { '油': 10, '糖': 10, '盐': 5 },
  '把': { '坚果': 20, '花生': 20 },
  '只': { '鸡腿': 150, '鸡翅': 50 },
  '块': { '豆腐': 100, '牛肉': 100, '鱼肉': 100 },
  '克': { '_default': 1 },
  '毫升': { '_default': 1, '牛奶': 1, '豆浆': 1, '水': 1 },
}

export function estimateGrams(name, quantity, unit) {
  const amount = Math.max(0, Number(quantity) || 0)
  const normalizedUnit = String(unit || '克')
  const unitMap = COMMON_PORTIONS[normalizedUnit]

  if (!unitMap) {
    return { grams: amount, confidence: 0.2 }
  }

  const matchedKey = Object.keys(unitMap).find((key) => key !== '_default' && String(name || '').includes(key))
  const gramsPerUnit = matchedKey ? unitMap[matchedKey] : unitMap._default

  if (!gramsPerUnit) {
    return { grams: amount, confidence: 0.2 }
  }

  return {
    grams: Math.round(amount * gramsPerUnit),
    confidence: matchedKey || normalizedUnit === '克' ? 0.9 : 0.6,
  }
}
