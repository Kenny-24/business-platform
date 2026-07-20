function pad(num) {
  return String(num).padStart(2, '0')
}

function createCell(year, monthIndex, day, current) {
  const date = new Date(year, monthIndex, day)
  const cellYear = date.getFullYear()
  const cellMonth = date.getMonth()
  const cellDay = date.getDate()

  return {
    year: cellYear,
    month: cellMonth,
    day: cellDay,
    current,
    key: `${cellYear}-${pad(cellMonth + 1)}-${pad(cellDay)}`
  }
}

function createMonth(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const cells = []

  for (let offset = first.getDay(); offset > 0; offset -= 1) {
    cells.push(createCell(year, monthIndex, 1 - offset, false))
  }

  for (let day = 1; day <= lastDay; day += 1) {
    cells.push(createCell(year, monthIndex, day, true))
  }

  let nextDay = 1
  while (cells.length < 42) {
    cells.push(createCell(year, monthIndex + 1, nextDay, false))
    nextDay += 1
  }

  return cells
}

module.exports = { createMonth }
