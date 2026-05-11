export function formatCalories(value) {
  return `${Math.round(Number(value) || 0)} 千卡`
}

export function formatMacro(value) {
  return `${Math.round(Number(value) || 0)}g`
}

export function formatMacros({ protein = 0, carbs = 0, fat = 0 }) {
  return `蛋白 ${formatMacro(protein)} / 碳水 ${formatMacro(carbs)} / 脂肪 ${formatMacro(fat)}`
}

export function formatTime(time) {
  if (!time) return ''
  const [hour = '00', minute = '00'] = String(time).split(':')
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

export function formatDate(dateValue) {
  const date = parseDate(dateValue)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function parseDate(dateValue) {
  if (typeof dateValue === 'string') {
    const [year, month, day] = dateValue.split('-').map(Number)
    if (year && month && day) {
      return new Date(year, month - 1, day)
    }
  }

  return new Date(dateValue)
}
