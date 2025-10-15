import { useCallback, useEffect, useRef, useState } from 'react'
import rqtLogo from './assets/logoRQT.svg'
import './App.css'
import { BsFillPauseFill } from "@react-icons/all-files/bs/BsFillPauseFill";
import { BsSkipForwardFill } from "@react-icons/all-files/bs/BsSkipForwardFill";
import { BsSkipBackwardFill } from "@react-icons/all-files/bs/BsSkipBackwardFill";
import { BsArrowRepeat } from "@react-icons/all-files/bs/BsArrowRepeat";

function App() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sheetValues, setSheetValues] = useState(null)
  const [showValues, setShowValues] = useState(false)
  const [leaderboardType, setLeaderboardType] = useState("Autônomo")

  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
  const AUTO_SPREADSHEET_ID = import.meta.env.VITE_AUTO_SPREADSHEET_ID
  const TELEOP_SPREADSHEET_ID = import.meta.env.VITE_TELEOP_SPREADSHEET_ID
  const SHEET_RANGE_TELEOP = 'RankingTeleop!A2:C18'
  const SHEET_RANGE_AUTO = 'RankingAutonomo!A2:C18'
  const [actualTimeInLeaderboard, setActualTimeInLeaderboard] = useState(0)
  const [timerStopped, setTimerStopped] = useState(true)
  const timerRef = useRef(null)
  const sheetValuesWrapperRef = useRef(null)

  const getRankingLabel = (index) => {
    const position = index + 1
    if (position === 1) {
      return '🥇 1º'
    }
    if (position === 2) {
      return '🥈 2º'
    }
    if (position === 3) {
      return '🥉 3º'
    }
    return `#${position}`
  }

  const startLeaderboardTimer = useCallback(() => {
    if (timerRef.current) {
      return
    }
    setActualTimeInLeaderboard(0)
    timerRef.current = setInterval(() => {
      setActualTimeInLeaderboard((previousTime) => previousTime + 1)
    }, 1000)
    setTimerStopped(false)
  }, [])

  const stopLeaderboardTimer = useCallback(() => {
    if (!timerRef.current) {
      return
    }
    clearInterval(timerRef.current)
    timerRef.current = null
    setTimerStopped(true)
    setActualTimeInLeaderboard(0)
  }, [])

  const toggleTimer = () => {
    if(timerStopped){
      startLeaderboardTimer()
    }else{
      stopLeaderboardTimer()
    }
  }

  const changeLeaderboardType = () => {
    if(leaderboardType === "Autônomo"){
      setLeaderboardType("Teleop")
    }else{
      setLeaderboardType("Autônomo")
    }
  }

  const fetchActualTypeSheetData = async () => {
    if(leaderboardType === "Autônomo"){
      await fetchAutonomousSheetData()
    }else{
      await fetchTeleopSheetData()
    }
  }

  const fetchAutonomousSheetData = async () => {
    await fetchSheetData(AUTO_SPREADSHEET_ID, SHEET_RANGE_AUTO)
  }

  const fetchTeleopSheetData = async () => {
    await fetchSheetData(TELEOP_SPREADSHEET_ID, SHEET_RANGE_TELEOP)
  }

  async function fetchSheetData(SPREADSHEET_ID, SHEET_RANGE = SHEET_RANGE_AUTO) {
    if (!SPREADSHEET_ID) {
      setError('Spreadsheet ID Auto não configurada. Crie uma variável VITE_SPREADSHEET_ID no .env .')
      return
    }

    if (!API_KEY) {
      setError('API key não configurada. Crie uma variável VITE_GOOGLE_API_KEY no .env .')
      return
    }
    setIsLoading(true)
    setError(null)
    setShowValues(false)
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}?key=${API_KEY}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Sheets API responded with ${response.status}`)
      }
      const data = await response.json()
      setSheetValues(data.values || [])
    } catch (err) {
      setSheetValues(null)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleShowInterval = () => {
    if (!sheetValues) {
      setError('Nenhum dado carregado ainda. Clique em Consultar planilha primeiro.')
      return
    }
    console.log(sheetValues)

    setError(null)
    setShowValues(true)
  }

  useEffect(() => {
    startLeaderboardTimer()
    return () => {
      stopLeaderboardTimer()
    }
  }, [startLeaderboardTimer, stopLeaderboardTimer])

  useEffect(() => {
    if(actualTimeInLeaderboard > 60){
      changeLeaderboardType()
      fetchActualTypeSheetData()
      setActualTimeInLeaderboard(0);
    }
  }, [actualTimeInLeaderboard])

  useEffect(() => {
    if (!showValues) {
      return
    }

    const wrapper = sheetValuesWrapperRef.current

    if (!wrapper) {
      return
    }

    let animationFrameId
    let lastTimestamp
    const scrollSpeed = 20

    const resetScroll = () => {
      wrapper.scrollTop = 0
      lastTimestamp = undefined
    }

    if (wrapper.scrollHeight <= wrapper.clientHeight) {
      resetScroll()
      return
    }

    const step = (timestamp) => {
      if (lastTimestamp !== undefined) {
        const delta = timestamp - lastTimestamp
        const maxScrollTop = wrapper.scrollHeight - wrapper.clientHeight
        wrapper.scrollTop += (scrollSpeed * delta) / 1000

        if (wrapper.scrollTop >= maxScrollTop) {
          resetScroll()
        }
      }

      lastTimestamp = timestamp
      animationFrameId = requestAnimationFrame(step)
    }

    animationFrameId = requestAnimationFrame(step)

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      resetScroll()
    }
  }, [showValues, sheetValues])
  return (
    <>
      <div className="header">
        <img src={rqtLogo} className="logo" alt="RQT Logo" />
        <div className="divider"></div>
        <h1>Ranking RQT 🏆</h1>
      </div>
      <div className="leaderboard-controller">
          <button onClick={changeLeaderboardType}>
          <BsSkipBackwardFill />
          </button>
          <button onClick={toggleTimer}>
          <BsFillPauseFill />
          </button>
          <button onClick={fetchActualTypeSheetData}>
          <BsArrowRepeat />
          </button>
          <button onClick={changeLeaderboardType}>
          <BsSkipForwardFill />
          </button>
      </div>
      <h4>Ultima atualização: </h4>
      <div className="leaderboard-status__bar">
        <div id="switch-progress"></div>
      </div>
      <div className="leaderboard">
        <h2 className=''>{leaderboardType}</h2>
      </div>
      <div className="card">
        <div>
          <button onClick={fetchActualTypeSheetData} disabled={isLoading}>
            {isLoading ? 'Buscando...' : 'Consultar planilha'}
          </button>
          <button onClick={handleShowInterval} disabled={isLoading || !sheetValues}>
            Mostrar intervalo + {actualTimeInLeaderboard}
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        {showValues && sheetValues && (
          <div ref={sheetValuesWrapperRef} className="sheet-values__wrapper">
            <table className="sheet-values">
              <thead>
                <tr>
                  <th className="sheet-values__rank">Ranking</th>
                  <th className="sheet-values__team">Equipe</th>
                  <th className="sheet-values__matches">Partidas jogadas</th>
                  <th className="sheet-values__score">Pontuação</th>
                </tr>
              </thead>
              <tbody>
                {sheetValues.map((row, rowIndex) => {
                  const cells = Array.isArray(row) ? row : [row]
                  const [team = '-', matches = '-', score = '-'] = cells
                  return (
                    <tr key={rowIndex}>
                      <td className="sheet-values__rank">{getRankingLabel(rowIndex)}</td>
                      <td>{team || '-'}</td>
                      <td className="sheet-values__matches">{matches || '-'}</td>
                      <td className="sheet-values__score">{score || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

export default App
