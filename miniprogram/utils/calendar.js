function pad(num) { return String(num).padStart(2, '0') }

function createMonth(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const previousLast = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = first.getDay(); i > 0; i--) {
    cells.push({ day: previousLast - i + 1, current: false, key: `p-${i}` })
  }
  for (let day = 1; day <= last.getDate(); day++) {
    cells.push({ day, current: true, key: `${year}-${pad(month + 1)}-${pad(day)}` })
  }
  let next = 1
  while (cells.length < 42) cells.push({ day: next, current: false, key: `n-${next++}` })
  return cells
}

module.exports = { createMonth }
