import {useCallback, useEffect, useRef, useState} from 'react'
import rqtLogo from './assets/logoRQT.svg'
import './App.css'
import Schedule from './Schedule.jsx'

const BOARDS = [
  {mode: 'hybrid', category: 0, label: 'Híbrido Categoria 1'},
  {mode: 'hybrid', category: 1, label: 'Híbrido Categoria 2'},
  {mode: 'teleop', category: 0, label: 'Teleoperado Categoria 1'},
  {mode: 'teleop', category: 1, label: 'Teleoperado Categoria 2'},
]
const number = value => value.toLocaleString('pt-BR', {maximumFractionDigits: 2})
const medal = rank => rank <= 3 ? `${['🥇', '🥈', '🥉'][rank - 1]} ${rank}º` : `${rank}º`

export default function App() {
  const readView = () => ({'#cronograma': 'schedule', '#cronometro': 'timer'}[window.location.hash] || 'ranking')
  const [view, setView] = useState(readView)
  const changeView = next => {
    setView(next)
    const hash = {schedule: '#cronograma', timer: '#cronometro'}[next] || ''
    window.history.pushState(null, '', window.location.pathname + window.location.search + hash)
  }
  useEffect(() => {
    const sync = () => setView(readView())
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync)}
  }, [])
  const [sources, setSources] = useState({})
  const [boardIndex, setBoardIndex] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [duration, setDuration] = useState(40)
  const [elapsed, setElapsed] = useState(0)
  const [pageSize, setPageSize] = useState(8)
  const [fullscreenError, setFullscreenError] = useState('')
  const tableArea = useRef(null)
  const activeRequest = useRef(null)

  const refresh = useCallback(async () => {
    if (activeRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), 20000)
    await Promise.allSettled(['hybrid', 'teleop'].map(async mode => {
      setSources(previous => ({...previous, [mode]: {...previous[mode], loading: true}}))
      try {
        const response = await fetch(`/api/rankings?mode=${mode}`, {signal: controller.signal, cache: 'no-store'})
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Falha na atualização')
        if (!Array.isArray(payload.categories) || payload.categories.length !== 2) throw new Error('Resposta de ranking inválida')
        if (controller.signal.aborted) return
        setSources(previous => ({...previous, [mode]: {...payload, loading: false, error: null}}))
      } catch (error) {
        if (controller.signal.reason === 'unmounted') return
        setSources(previous => ({...previous, [mode]: {...previous[mode], loading: false, error: error.name === 'AbortError' ? 'A leitura excedeu o tempo limite.' : error.message}}))
      }
    }))
    clearTimeout(timeout)
    if (activeRequest.current === controller) activeRequest.current = null
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => {clearInterval(interval); activeRequest.current?.abort('unmounted'); activeRequest.current = null}
  }, [refresh])

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setPageSize(Math.max(1, Math.floor((entry.contentRect.height - 62) / 62))))
    observer.observe(tableArea.current)
    return () => observer.disconnect()
  }, [])

  const board = BOARDS[boardIndex]
  const source = sources[board.mode]
  const rows = source?.categories?.[board.category] ?? []
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(pageIndex, pages - 1)
  const visibleRows = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  const next = useCallback(() => {
    if (currentPage + 1 < pages) setPageIndex(currentPage + 1)
    else {setBoardIndex(index => (index + 1) % BOARDS.length); setPageIndex(0)}
    setElapsed(0)
  }, [currentPage, pages])

  const previous = () => {
    if (currentPage > 0) setPageIndex(currentPage - 1)
    else {
      const index = (boardIndex + BOARDS.length - 1) % BOARDS.length
      const prior = BOARDS[index]
      const count = sources[prior.mode]?.categories?.[prior.category]?.length ?? 0
      setBoardIndex(index); setPageIndex(Math.max(0, Math.ceil(count / pageSize) - 1))
    }
    setElapsed(0)
  }

  useEffect(() => {
    if (!playing || view !== 'ranking') return
    const interval = setInterval(() => setElapsed(value => value + 1), 1000)
    return () => clearInterval(interval)
  }, [playing, view])
  useEffect(() => {if (view === 'ranking' && elapsed >= duration) next()}, [elapsed, duration, next, view])

  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
      setFullscreenError('')
    } catch {setFullscreenError('Use a opção de tela cheia do navegador.')}
  }

  return <>
    <header className="header">
      <button onClick={() => setHidden(value => !value)} className="hide-leaderboard-controller-button" aria-label={hidden ? 'Mostrar controles' : 'Ocultar controles'} title={hidden ? 'Mostrar controles' : 'Ocultar controles'}>{hidden ? '◉' : '◌'}</button>
      <img src={rqtLogo} className="logo" alt="Robôs Que Transformam" />
      <div className="divider" />
      <h1>{view === 'timer' ? 'Cronômetro RQT' : view === 'schedule' ? 'Cronograma RQT' : 'Ranking RQT 🏆'} <small>2026</small></h1>
      <div className="view-toggle" role="group" aria-label="Exibição do telão"><button aria-pressed={view === 'ranking'} onClick={() => changeView('ranking')}>Ranking</button><button aria-pressed={view === 'schedule'} onClick={() => changeView('schedule')}>Cronograma</button><button aria-pressed={view === 'timer'} onClick={() => changeView('timer')}>Cronômetro</button></div>
    </header>
    {view === 'timer' && <main className="timer-view">
      <iframe src="/cronometro/index.html" title="Cronômetro de partidas RQT" allow="autoplay; fullscreen; screen-wake-lock" allowFullScreen />
    </main>}
    {view === 'schedule' && <Schedule hidden={hidden} fullscreen={fullscreen} />}
    {view === 'schedule' && fullscreenError && <p role="status">{fullscreenError}</p>}
    <div className="ranking-view" hidden={view !== 'ranking'}>
    {!hidden && <nav className="leaderboard-controller" aria-label="Controles do telão">
      <button onClick={previous} aria-label="Página anterior" title="Página anterior">⏮</button>
      <button onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pausar alternância' : 'Iniciar alternância'} title={playing ? 'Pausar alternância' : 'Iniciar alternância'}>{playing ? 'Ⅱ' : '▶'}</button>
      <button onClick={next} aria-label="Próxima página" title="Próxima página">⏭</button>
      <button onClick={refresh} disabled={Object.values(sources).some(item => item.loading)} title="Atualizar pontuações" aria-label="Atualizar pontuações">↻</button>
      <select aria-label="Categoria" value={boardIndex} onChange={event => {setBoardIndex(Number(event.target.value)); setPageIndex(0); setElapsed(0)}}>{BOARDS.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}</select>
      <label>Trocar a cada <select aria-label="Duração de cada página" value={duration} onChange={event => {setDuration(Number(event.target.value)); setElapsed(0)}}>{[10, 20, 40, 60].map(value => <option key={value} value={value}>{value}s</option>)}</select></label>
      <button onClick={fullscreen}>Tela cheia</button>
      {fullscreenError && <span role="status">{fullscreenError}</span>}
    </nav>}
    <div className="leaderboard-status__bar" role="progressbar" aria-label="Tempo até a próxima página" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.min(elapsed, duration)}>
      <div style={{width: `${Math.min(100, elapsed / duration * 100)}%`}} />
    </div>
    <main className="leaderboard">
      <div className="board-heading"><h2>{board.label}</h2><span className="page-label">Página {currentPage + 1} de {pages} · {playing ? 'Alternância automática' : 'Pausado'}</span></div>
      <p className="ranking-rule">{board.mode === 'hybrid' ? 'Soma → mais partidas autônomas → melhor partida → 2ª melhor → menos penalidades. Autônomo ×2,5.' : 'Média dos pontos → melhor partida → 2ª melhor → 3ª melhor.'}</p>
      <div className="data-status" aria-live="polite">
        {source?.updatedAt ? <>Atualizado às {new Date(source.updatedAt).toLocaleTimeString('pt-BR')} · atualização automática a cada 30s{source.loading && ' · Atualizando…'}</> : source?.loading ? 'Buscando dados das planilhas…' : 'Aguardando leitura da planilha'}
      </div>
      {source?.error && <p className="error" role="alert">{source.updatedAt && 'Exibindo a última leitura válida. '}{source.error}</p>}
      {source?.warnings?.length > 0 && <details className="warnings"><summary>{source.warnings.length} aviso(s) na apuração</summary><ul>{source.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
      <div ref={tableArea} className="table-area">
        {rows.length > 0 ? <div className="sheet-values__wrapper"><table className="sheet-values">
          <thead><tr><th className="sheet-values__rank">Ranking</th><th>Equipe</th><th className="numeric">Partidas</th><th className="numeric">{board.mode === 'hybrid' ? 'Soma' : 'Média'}</th>{board.mode === 'hybrid' && <><th className="numeric">Autônomas</th><th className="numeric">Faltas</th></>}<th className="best-scores">Melhores partidas<br /><small>{board.mode === 'hybrid' ? '1ª · 2ª' : '1ª · 2ª · 3ª'}</small></th></tr></thead>
          <tbody>{visibleRows.map(team => <tr key={team.name}>
            <td className="sheet-values__rank">{team.matches ? medal(team.rank) : <span className="not-played">Aguardando</span>}</td>
            <td className="team-name" title={team.name}>{team.name}</td><td className="numeric">{team.matches}</td><td className="numeric sheet-values__score" title={String(board.mode === 'hybrid' ? team.total : team.average)}>{number(board.mode === 'hybrid' ? team.total : team.average)}</td>
            {board.mode === 'hybrid' && <><td className="numeric">{team.autonomousMatches}</td><td className="numeric">{team.faults}</td></>}
            <td className="best-scores" title={team.scores.map(number).join(' · ')}><div>{team.scores.length ? team.scores.slice(0, board.mode === 'hybrid' ? 2 : 3).map(number).join(' · ') : 'Sem partidas'}</div></td>
          </tr>)}</tbody>
        </table></div> : <div className="empty-state">{source?.error ? 'Não foi possível carregar este ranking.' : source?.loading ? 'Carregando equipes…' : 'Nenhuma equipe cadastrada nesta categoria.'}</div>}
      </div>
      <footer>Empates em todos os critérios mantêm a mesma posição. {rows.length} equipes nesta categoria. Média exibida com até 2 casas; classificação sem arredondamento.</footer>
    </main>
    </div>
  </>
}
