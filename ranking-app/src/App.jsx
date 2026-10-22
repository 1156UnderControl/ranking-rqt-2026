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
  const publicRanking = new URLSearchParams(window.location.search).get('publico') === '1'
  const readView = () => publicRanking ? 'ranking' : ({'#cronograma': 'schedule', '#cronometro': 'timer'}[window.location.hash] || 'ranking')
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
  useEffect(() => {
    const wakeTimer = () => {
      const frame = document.querySelector('.timer-view iframe')
      frame?.contentWindow?.postMessage({type: 'rqt-sync-now'}, window.location.origin)
    }
    window.addEventListener('focus', wakeTimer)
    window.addEventListener('pageshow', wakeTimer)
    const visible = () => {if (document.visibilityState === 'visible') wakeTimer()}
    document.addEventListener('visibilitychange', visible)
    return () => {window.removeEventListener('focus', wakeTimer); window.removeEventListener('pageshow', wakeTimer); document.removeEventListener('visibilitychange', visible)}
  }, [])
  const [sources, setSources] = useState({})
  const [boardIndex, setBoardIndex] = useState(0)
  const [playing, setPlaying] = useState(!publicRanking)
  const [hidden, setHidden] = useState(false)
  const [duration, setDuration] = useState(40)
  const [elapsed, setElapsed] = useState(0)
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

  const board = BOARDS[boardIndex]
  const source = sources[board.mode]
  const rows = source?.categories?.[board.category] ?? []
  const next = useCallback(() => {
    setBoardIndex(index => (index + 1) % BOARDS.length)
    setElapsed(0)
  }, [])

  const previous = () => {
    setBoardIndex(index => (index + BOARDS.length - 1) % BOARDS.length)
    setElapsed(0)
  }

  useEffect(() => {
    if (tableArea.current) tableArea.current.scrollTop = 0
  }, [boardIndex])

  useEffect(() => {
    if (!playing || view !== 'ranking' || !tableArea.current) return
    const area = tableArea.current
    const progress = Math.max(0, Math.min(1, (elapsed - 3) / Math.max(1, duration - 6)))
    area.scrollTo({top: (area.scrollHeight - area.clientHeight) * progress, behavior: 'smooth'})
  }, [elapsed, duration, playing, view])

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
    <header className={`header ${publicRanking ? 'public-header' : ''}`}>
      {!publicRanking && <button onClick={() => setHidden(value => !value)} className="hide-leaderboard-controller-button" aria-label={hidden ? 'Mostrar controles' : 'Ocultar controles'} title={hidden ? 'Mostrar controles' : 'Ocultar controles'}>{hidden ? '◉' : '◌'}</button>}
      <img src={rqtLogo} className="logo" alt="Robôs Que Transformam" />
      <div className="divider" />
      <h1>{view === 'timer' ? 'Cronômetro RQT' : view === 'schedule' ? 'Cronograma RQT' : 'Ranking RQT 🏆'} <small>2026</small></h1>
      {!publicRanking && <div className="view-toggle" role="group" aria-label="Exibição do telão"><button aria-pressed={view === 'ranking'} onClick={() => changeView('ranking')}>Ranking</button><button aria-pressed={view === 'schedule'} onClick={() => changeView('schedule')}>Cronograma</button><button aria-pressed={view === 'timer'} onClick={() => changeView('timer')}>Cronômetro</button></div>}
      {!publicRanking && view === 'ranking' && <a className="ranking-qr" href="/?publico=1" target="_blank" rel="noreferrer"><img src="/ranking-qr.svg" alt="QR code para acompanhar o ranking no celular" /><span>Ranking no celular</span></a>}
    </header>
    {view === 'timer' && <main className="timer-view">
      <iframe src="/cronometro/index.html?v=sync-tabs-2" title="Cronômetro de partidas RQT" allow="autoplay; fullscreen; screen-wake-lock" allowFullScreen />
    </main>}
    {view === 'schedule' && <Schedule hidden={hidden} fullscreen={fullscreen} />}
    {view === 'schedule' && fullscreenError && <p role="status">{fullscreenError}</p>}
    <div className="ranking-view" hidden={view !== 'ranking'}>
    {!publicRanking && !hidden && <nav className="leaderboard-controller" aria-label="Controles do telão">
      <button onClick={previous} aria-label="Categoria anterior" title="Categoria anterior">⏮</button>
      <button onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pausar alternância' : 'Iniciar alternância'} title={playing ? 'Pausar alternância' : 'Iniciar alternância'}>{playing ? 'Ⅱ' : '▶'}</button>
      <button onClick={next} aria-label="Próxima categoria" title="Próxima categoria">⏭</button>
      <button onClick={refresh} disabled={Object.values(sources).some(item => item.loading)} title="Atualizar pontuações" aria-label="Atualizar pontuações">↻</button>
      <select aria-label="Categoria" value={boardIndex} onChange={event => {setBoardIndex(Number(event.target.value)); setElapsed(0)}}>{BOARDS.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}</select>
      <label>Trocar a cada <select aria-label="Duração de cada categoria" value={duration} onChange={event => {setDuration(Number(event.target.value)); setElapsed(0)}}>{[10, 20, 40, 60].map(value => <option key={value} value={value}>{value}s</option>)}</select></label>
      <button onClick={fullscreen}>Tela cheia</button>
      {fullscreenError && <span role="status">{fullscreenError}</span>}
    </nav>}
    {publicRanking && <nav className="public-categories" aria-label="Categorias do ranking">{BOARDS.map((item, index) => <button key={item.label} aria-pressed={index === boardIndex} onClick={() => {setBoardIndex(index); setElapsed(0)}}>{item.label}</button>)}</nav>}
    {!publicRanking && <div className="leaderboard-status__bar" role="progressbar" aria-label="Tempo até a próxima categoria" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.min(elapsed, duration)}>
      <div style={{width: `${Math.min(100, elapsed / duration * 100)}%`}} />
    </div>}
    <main className={`leaderboard ${publicRanking ? 'public-ranking' : ''}`}>
      <div className="board-heading"><h2>{board.label}</h2><span className="page-label">{rows.length} equipes{!publicRanking && <> · {playing ? 'Rolagem e alternância automáticas' : 'Pausado'}</>}</span></div>
      <p className="ranking-rule">{board.mode === 'hybrid' ? 'Soma → mais partidas autônomas → melhor partida → 2ª melhor → menos penalidades. Autônomo ×2,5.' : 'Média dos pontos → melhor partida → 2ª melhor → 3ª melhor.'}</p>
      <div className="data-status" aria-live="polite">
        {source?.updatedAt ? <>Atualizado às {new Date(source.updatedAt).toLocaleTimeString('pt-BR')} · atualização automática a cada 30s{source.loading && ' · Atualizando…'}</> : source?.loading ? 'Buscando dados das planilhas…' : 'Aguardando leitura da planilha'}
      </div>
      {source?.error && <p className="error" role="alert">{source.updatedAt && 'Exibindo a última leitura válida. '}{source.error}</p>}
      {source?.warnings?.length > 0 && <details className="warnings"><summary>{source.warnings.length} aviso(s) na apuração</summary><ul>{source.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
      <div className="table-area">
        {rows.length > 0 ? <div ref={tableArea} className="sheet-values__wrapper" tabIndex={0} aria-label={`Ranking completo: ${board.label}`}><table className="sheet-values">
          <thead><tr><th className="sheet-values__rank">Ranking</th><th>Equipe</th><th className="numeric">Partidas</th><th className="numeric">{board.mode === 'hybrid' ? 'Soma' : 'Média'}</th>{board.mode === 'hybrid' && <><th className="numeric">Autônomas</th><th className="numeric">Faltas</th></>}<th className="best-scores">Melhores partidas<br /><small>{board.mode === 'hybrid' ? '1ª · 2ª' : '1ª · 2ª · 3ª'}</small></th></tr></thead>
          <tbody>{rows.map(team => <tr key={team.name}>
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
