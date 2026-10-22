export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()

function count(value, label) {
  const text = String(value ?? '').trim().replace(',', '.')
  const number = Number(text)
  if (!text || !Number.isFinite(number) || number < 0 || !Number.isInteger(number)) throw new Error(`${label} inválido`)
  return number
}

export function readFinalScore(value) {
  // CALC!J already includes disk penalties and the autonomous multiplier.
  // CSV requests suppress thousands separators; the API returns raw numbers.
  const text = String(value ?? '').trim().replace(',', '.')
  if (!/^-?\d+(?:\.\d+)?$/.test(text) || !Number.isFinite(Number(text))) throw new Error('Pontuação final ausente ou inválida em CALC!J; aguarde ou corrija o cálculo da planilha')
  return Number(text)
}

const matchId = value => String(value ?? '').trim().replace(',', '.')

// Competition criteria only. Team names are never used to break an official tie.
export function compareTeams(a, b, mode) {
  if (Boolean(a.matches) !== Boolean(b.matches)) return a.matches ? -1 : 1
  // Compare exact ratios before formatting the displayed average.
  const primary = mode === 'teleop' ? b.total * a.matches - a.total * b.matches : b.total - a.total
  if (primary) return primary
  if (mode === 'hybrid' && a.autonomousMatches !== b.autonomousMatches) return b.autonomousMatches - a.autonomousMatches
  const length = mode === 'hybrid' ? 2 : 3
  for (let i = 0; i < length; i++) {
    const left = a.scores[i] ?? -Infinity
    const right = b.scores[i] ?? -Infinity
    if (left !== right) return left > right ? -1 : 1
  }
  return mode === 'hybrid' ? a.faults - b.faults : 0
}

export function buildRankings({mode, data, calculated, rosters}) {
  const warnings = []
  const categories = rosters.map(rows => rows.slice(1).filter(row => String(row[0] ?? '').trim()).map(row => ({
    name: String(row[0]).trim(), total: 0, average: 0, matches: 0, autonomousMatches: 0, faults: 0, scores: [],
  })))
  const teams = new Map()
  for (const category of categories) for (const team of category) {
    const key = normalize(team.name)
    if (teams.has(key)) throw new Error(`Equipe repetida nas categorias: ${team.name}`)
    teams.set(key, team)
  }
  const calculatedMatches = new Map()
  for (const row of calculated.slice(1)) {
    const id = matchId(row[0])
    if (!id) continue
    if (calculatedMatches.has(id)) throw new Error(`Partida ${id} repetida na aba CALC`)
    calculatedMatches.set(id, row)
  }
  const seen = new Set()
  for (const [index, row] of data.entries()) {
    if (index === 0 || row.every(cell => !String(cell ?? '').trim())) continue
    try {
      const id = matchId(row[1])
      if (!id) throw new Error('Número de partida ausente')
      if (seen.has(id)) throw new Error(`Partida ${id} repetida; mantida a primeira resposta, como na planilha`)
      seen.add(id)
      const names = mode === 'hybrid' ? [row[2]] : [row[2], row[3]]
      const participants = names.map(name => teams.get(normalize(name)))
      if (participants.some(team => !team)) throw new Error(`Equipe sem categoria: ${names.filter((_, i) => !participants[i]).join(', ')}`)
      if (new Set(participants).size !== participants.length) throw new Error('Mesma equipe nas duas posições da partida')
      const calc = calculatedMatches.get(id)
      if (!calc) throw new Error(`Partida ${id} ainda sem cálculo na aba CALC`)
      const calculatedNames = mode === 'hybrid' ? [calc[1]] : [calc[1], calc[2]]
      if (names.some((name, i) => normalize(name) !== normalize(calculatedNames[i]))) throw new Error(`Partida ${id}: equipes de DATA e CALC ainda não correspondem`)
      const faults = count(calc[mode === 'hybrid' ? 2 : 3], 'Faltas em CALC')
      if (faults !== count(row[mode === 'hybrid' ? 3 : 4], 'Faltas em DATA')) throw new Error(`Partida ${id}: penalidades de DATA e CALC ainda não correspondem`)
      let autonomous = false
      if (mode === 'hybrid') {
        const method = normalize(calc[7])
        if (!['autonomo', 'teleoperado', 'tele-operado', 'manual'].includes(method)) throw new Error('Modalidade inválida em CALC')
        if (method !== normalize(row[8])) throw new Error(`Partida ${id}: método de DATA e CALC ainda não corresponde`)
        autonomous = method === 'autonomo'
      }
      const result = {score: readFinalScore(calc[9]), autonomous, faults}
      for (const team of participants) {
        team.total += result.score
        team.matches++
        team.autonomousMatches += Number(result.autonomous)
        team.faults += result.faults
        team.scores.push(result.score)
      }
    } catch (error) { warnings.push(`DATA, linha ${index + 1}: ${error.message}`) }
  }
  return {categories: categories.map(category => {
    for (const team of category) {
      team.scores.sort((a, b) => b - a)
      team.average = team.matches ? team.total / team.matches : 0
      if (mode === 'hybrid' && team.matches > 2) warnings.push(`${team.name}: ${team.matches} partidas híbridas registradas; o edital prevê duas. Revisar os lançamentos.`)
    }
    category.sort((a, b) => compareTeams(a, b, mode) || a.name.localeCompare(b.name, 'pt-BR'))
    for (let i = 0; i < category.length; i++) {
      category[i].rank = i > 0 && compareTeams(category[i - 1], category[i], mode) === 0 ? category[i - 1].rank : i + 1
    }
    return category
  }), warnings}
}
