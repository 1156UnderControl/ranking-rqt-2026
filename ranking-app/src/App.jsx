import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import rqtLogo from './assets/logoRQT.svg'
import './App.css'
import { BsFillPauseFill } from "@react-icons/all-files/bs/BsFillPauseFill";
import { BsFillPlayFill } from "@react-icons/all-files/bs/BsFillPlayFill";
import { BsSkipForwardFill } from "@react-icons/all-files/bs/BsSkipForwardFill";
import { BsSkipBackwardFill } from "@react-icons/all-files/bs/BsSkipBackwardFill";
import { BsArrowRepeat } from "@react-icons/all-files/bs/BsArrowRepeat";
import { FaEye } from "@react-icons/all-files/fa/FaEye";
import { FaEyeSlash } from "@react-icons/all-files/fa/FaEyeSlash";


function App() {
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sheetValues, setSheetValues] = useState(null)
  const [showValues, setShowValues] = useState(false)
  const [leaderboardType, setLeaderboardType] = useState("Autônomo Categoria 1")
  const timeInResetRef = useRef(0)

  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
  const AUTO_SPREADSHEET_ID = import.meta.env.VITE_AUTO_SPREADSHEET_ID
  const TELEOP_SPREADSHEET_ID = import.meta.env.VITE_TELEOP_SPREADSHEET_ID
  const SHEET_RANGE_TELEOP_CAT_1 = 'RankingTeleop1!A3:C13'
  const SHEET_RANGE_TELEOP_CAT_2 = 'RankingTeleop2!A3:C8'
  const SHEET_RANGE_AUTO_CAT_1 = 'RankingAutonomo1!A3:C13'
  const SHEET_RANGE_AUTO_CAT_2 = 'RankingAutonomo2!A3:C8'
  const [actualTimeInLeaderboard, setActualTimeInLeaderboard] = useState(0)
  const [timerStopped, setTimerStopped] = useState(true)
  const [hideController, setHideController] = useState(false);
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

  const parseNumber = (value, fallback = 0) => {
    if (typeof value === 'string' && value.trim().toUpperCase() === '#DIV/0!') {
      return 0
    }

    if (typeof value === 'number') {
      return value
    }

    if (typeof value === 'string') {
      const normalized = value.replace(/[^\d,.-]/g, '').replace(',', '.')
      const parsed = Number(normalized)

      if (Number.isFinite(parsed)) {
        return parsed
      }
    }

    return fallback
  }

  const sortedSheetValues = useMemo(() => {
    if (!sheetValues) {
      return []
    }

    return sheetValues
      .map((row, index) => ({
        row: Array.isArray(row) ? row : [row],
        originalIndex: index,
      }))
      .sort((a, b) => {
        const [, matchesARaw, scoreARaw] = a.row
        const [, matchesBRaw, scoreBRaw] = b.row

        const scoreA = parseNumber(scoreARaw, 0)
        const scoreB = parseNumber(scoreBRaw, 0)

        if (scoreA !== scoreB) {
          return scoreB - scoreA
        }

        const matchesA = parseNumber(matchesARaw, Number.POSITIVE_INFINITY)
        const matchesB = parseNumber(matchesBRaw, Number.POSITIVE_INFINITY)

        if (matchesA !== matchesB) {
          return matchesA - matchesB
        }

        return a.originalIndex - b.originalIndex
      })
      .map((entry) => entry.row)
  }, [sheetValues])

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
    var nextType;

    switch(leaderboardType){
      case "Autônomo Categoria 1":
        nextType = "Autônomo Categoria 2"
        break;
      case "Autônomo Categoria 2":
        nextType = "Teleoperado Categoria 1"
        break;
      case "Teleoperado Categoria 1":
        nextType = "Teleoperado Categoria 2"
        break;
      case "Teleoperado Categoria 2":
        nextType = "Autônomo Categoria 1"
        break;
      default:
        nextType = "Autônomo Categoria 1"
    }
    console.log("Changing leaderboard to: ", nextType);
    setLeaderboardType(nextType)
    setActualTimeInLeaderboard(0)
  }

  useEffect(() => {
    fetchActualTypeSheetData()
  }, [leaderboardType])

  const fetchActualTypeSheetData = async () => {
    if(leaderboardType.includes("Autônomo")){
      await fetchAutonomousSheetData()
    }else{  
      await fetchTeleopSheetData()
    }
  }

  const fetchAutonomousSheetData = async () => {
    console.log("Fetching autonomous sheet data for type: ", leaderboardType);
    if(leaderboardType === "Autônomo Categoria 1"){
      await fetchSheetData(AUTO_SPREADSHEET_ID, SHEET_RANGE_AUTO_CAT_1)
    }else{
      await fetchSheetData(AUTO_SPREADSHEET_ID, SHEET_RANGE_AUTO_CAT_2)
    }
  }

  const fetchTeleopSheetData = async () => {
    if(leaderboardType === "Teleoperado Categoria 1"){
      await fetchSheetData(TELEOP_SPREADSHEET_ID, SHEET_RANGE_TELEOP_CAT_1)
    }else{
      await fetchSheetData(TELEOP_SPREADSHEET_ID, SHEET_RANGE_TELEOP_CAT_2)
    }
  }

  async function fetchSheetData(SPREADSHEET_ID, SHEET_RANGE = SHEET_RANGE_AUTO) {
    console.log("Fetching sheet data for: ", SPREADSHEET_ID, SHEET_RANGE);
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
      setShowValues(true)
      setLastFetchTime(new Date().getHours() + ':' + new Date().getMinutes().toString().padStart(2, '0'));
    } catch (err) {
      setSheetValues(null)
      setError(err.message)
      setShowValues(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    startLeaderboardTimer()
    return () => {
      stopLeaderboardTimer()
    }
  }, [startLeaderboardTimer, stopLeaderboardTimer])

  useEffect(() => {
    fetchActualTypeSheetData()
  }, [])

  useEffect(() => {
    if(actualTimeInLeaderboard > 40){
      changeLeaderboardType()
    }
  }, [actualTimeInLeaderboard])

  useEffect(() => {
    if (!showValues || sortedSheetValues.length === 0) {
      return
    }

    const wrapper = sheetValuesWrapperRef.current

    if (!wrapper) {
      return
    }

    let animationFrameId
    let lastTimestamp
    let scrollPosition = 0
    const scrollSpeed = 35

    const resetScroll = () => {
      scrollPosition = 0
      wrapper.scrollTop = 0
      lastTimestamp = undefined 
      timeInResetRef.current = 0
    }

    const step = (timestamp) => {
      if (lastTimestamp !== undefined) {
        const delta = timestamp - lastTimestamp
        const maxScrollTop = wrapper.scrollHeight - wrapper.clientHeight
        const increment = (scrollSpeed * delta) / 1000
        if(scrollPosition <= maxScrollTop-3){
          timeInResetRef.current = 0
          scrollPosition = (scrollPosition + increment) % maxScrollTop
        }else{
          timeInResetRef.current += 1
          if(timeInResetRef.current > 100){
            scrollPosition = (scrollPosition + increment) % maxScrollTop
          }else{
            scrollPosition = maxScrollTop;
          }
        }
        wrapper.scrollTop = scrollPosition
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
  }, [showValues, sortedSheetValues])

  const toggleHideController = () => {
    setHideController((prev) => !prev);
  }

  function rightIconForTimer(){
    if(timerStopped){
      return <BsFillPlayFill />
    }else{
      return <BsFillPauseFill />
    }
  }

  function hideControllerIcon(){
    if(hideController){
      return <FaEye />
    }else{
      return <FaEyeSlash />
    }
  }

  return (
    <>
      <div className="header">
        <button onClick={toggleHideController} className='hide-leaderboard-controller-button'>
          {hideControllerIcon()}
        </button>
        <img src={rqtLogo} className="logo" alt="RQT Logo" />
        <div className="divider"></div>
        <h1>Ranking RQT 🏆</h1>
      </div>
      {!hideController && (      
        <div className="leaderboard-controller">
          <button onClick={toggleTimer}>
          {rightIconForTimer()}
          </button>
          <button onClick={fetchActualTypeSheetData}>
          <BsArrowRepeat />
          </button>
          <button onClick={changeLeaderboardType}>
          <BsSkipForwardFill />
          </button>
          <h4>Ultima atualização: {lastFetchTime} </h4>
        </div>
        )
      }
      <div className="leaderboard-status__bar">
        <div id="switch-progress"></div>
      </div>
      <div className="leaderboard">
        <h2 className=''>{leaderboardType}</h2>
        {error && <p role="alert">{error}</p>}
        {isLoading && <p>Buscando dados...</p>}
        {showValues && (
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
                {sortedSheetValues.map((row, rowIndex) => {
                  const [team = '-', matches = '-', score = '-'] = row
                  const teamValue = typeof team === 'string' && team.trim() !== '' ? team : '-'
                  const matchesValue = parseNumber(matches, 0)
                  const scoreValue = parseNumber(score, 0)
                  return (
                    <tr key={rowIndex}>
                      <td className="sheet-values__rank">{getRankingLabel(rowIndex)}</td>
                      <td>{teamValue}</td>
                      <td className="sheet-values__matches">{matchesValue}</td>
                      <td className="sheet-values__score">{scoreValue}</td>
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
