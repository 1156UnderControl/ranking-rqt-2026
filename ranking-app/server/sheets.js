export const SOURCES = {
  hybrid: '1EHN2M7NUj8cuzqTLMfPirKEbsr7a1B3NyW3MFyJZx_E',
  teleop: '1IhxtO3SryJfG6fdzF0YbAsA0XQAuG6uskdgDTPMY8HQ',
}

export function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if (char === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (quoted) throw new Error('Resposta CSV incompleta')
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row) }
  return rows
}

export async function readSheet(id, sheet, range, fetcher = fetch) {
  const key = process.env.GOOGLE_SHEETS_API_KEY
  const url = key
    ? `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`'${sheet}'!${range}`)}?valueRenderOption=UNFORMATTED_VALUE&key=${encodeURIComponent(key)}`
    : `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?${new URLSearchParams({tqx: 'out:csv', sheet, range, headers: '1', tq: sheet === 'CALC' ? "select * format J '0.###############'" : 'select *'})}`
  const response = await fetcher(url, {signal: AbortSignal.timeout(15000), cache: 'no-store'})
  if (!response.ok) throw new Error(`Não foi possível ler ${sheet} (HTTP ${response.status}). Verifique o acesso de leitura da planilha.`)
  if (key) return (await response.json()).values ?? []
  const content = await response.text()
  if (/^\s*<!doctype|^\s*<html/i.test(content)) throw new Error(`A planilha exige login. Configure o acesso de leitura ou a integração do Google Sheets.`)
  return parseCsv(content)
}

export async function loadSource(mode, fetcher = fetch) {
  const id = SOURCES[mode]
  if (!id) throw new Error('Modalidade desconhecida')
  const [data, calculated, cat1, cat2] = await Promise.all([
    readSheet(id, 'DATA', 'A:I', fetcher),
    readSheet(id, 'CALC', 'A:J', fetcher),
    readSheet(id, 'Ranking Cat1', 'A:A', fetcher),
    readSheet(id, 'Ranking Cat2', 'A:A', fetcher),
  ])
  if (!data[0]?.[0]?.includes('Carimbo') || calculated[0]?.[0] !== 'Partida' || calculated[0]?.[9] !== 'Pontuação' || cat1[0]?.[0] !== 'Equipe' || cat2[0]?.[0] !== 'Equipe') throw new Error('Estrutura da planilha mudou; não foi possível validar os cabeçalhos.')
  return {mode, data, calculated, rosters: [cat1, cat2]}
}
