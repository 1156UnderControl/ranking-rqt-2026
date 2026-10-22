import {parseCsv} from './sheets.js'

export const SCHEDULE_ID = '1MoXLsNdB4P640zFobHNeUsguvxNHx9WrA4RWYuv0Ma0'
const clean = value => String(value ?? '').trim()
const isTime = value => /^\d{1,2}:\d{2}$/.test(clean(value))

export function parseSchedule(rows) {
  const researchStart = rows.findIndex(row => clean(row[0]).toUpperCase() === 'DESAFIO PESQUISA')
  if (researchStart < 0 || !rows.some(row => /cronograma geral/i.test(clean(row[0])))) throw new Error('A estrutura da aba cronograma impressão mudou. Confira os títulos das seções.')
  const teams = rows.slice(researchStart + 1).filter(row => /^\d+$/.test(clean(row[4])) && clean(row[5])).map(row => ({number:clean(row[4]),name:clean(row[5]),category:clean(row[6])}))
  const events = []
  let tables = []
  for (let i = 0; i < researchStart; i++) {
    const row = rows[i]
    if (!isTime(row[0]) || !clean(row[1])) continue
    let assignments = row.slice(2,8).map(clean)
    if (assignments.some(value => /^Mesa \d+$/i.test(value))) {
      tables = assignments
      assignments = rows[i + 1]?.slice(2,8).map(clean) ?? []
    }
    const title = clean(row[1]).replace(/^#\s*/, '')
    const type = /partida híbrida/i.test(title) ? 'hybrid' : /partida teleoperada/i.test(title) ? 'teleop' : 'event'
    events.push({time:clean(row[0]),title,type,tables:type === 'event' ? [] : Array.from({length:6},(_,index) => ({label:tables[index] || `Mesa ${index + 1}`,assignment:assignments[index] || '',teams:type === 'teleop' ? (assignments[index] || '').split('+').map(clean).filter(Boolean).map(number => teams.find(team=>team.number === number) ?? {number,name:'Equipe não identificada na planilha',category:''}) : []}))})
  }
  const research = rows.slice(researchStart + 1).filter(row=>isTime(row[0]) && clean(row[1])).map(row=>({time:clean(row[0]),teams:row.slice(1,3).map(clean).filter(Boolean)}))
  if (!events.length || !teams.length) throw new Error('Cronograma incompleto na planilha.')
  return {events,research,teams}
}

export async function loadSchedule(fetcher = fetch) {
  // CSV export preserves mixed numeric/text columns; gviz inference discards some table assignments.
  const response = await fetcher(`https://docs.google.com/spreadsheets/d/${SCHEDULE_ID}/export?format=csv&gid=1518659089&range=A1:H150`,{signal:AbortSignal.timeout(15000),cache:'no-store'})
  if (!response.ok) throw new Error(`Não foi possível ler o cronograma (HTTP ${response.status}).`)
  const text = await response.text()
  if (/^\s*<!doctype|^\s*<html/i.test(text)) throw new Error('A planilha do cronograma exige login.')
  return parseSchedule(parseCsv(text))
}
