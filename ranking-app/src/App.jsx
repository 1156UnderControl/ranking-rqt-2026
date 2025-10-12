import { useState } from 'react'
import rqtLogo from './assets/logoRQT.svg'
import './App.css'
import { BsFillPauseFill } from "@react-icons/all-files/bs/BsFillPauseFill";
import { BsSkipForwardFill } from "@react-icons/all-files/bs/BsSkipForwardFill";
import { BsSkipBackwardFill } from "@react-icons/all-files/bs/BsSkipBackwardFill";
import { BsArrowRepeat } from "@react-icons/all-files/bs/BsArrowRepeat";

function App() {
  const [count, setCount] = useState(0)


  var leaderboard_type = "Autônomo";

  return (
    <>
      <div className="header">
        <img src={rqtLogo} className="logo" alt="RQT Logo" />
        <div className="divider"></div>
        <h1>Ranking RQT 🏆</h1>
      </div>
      <div className="leaderboard-controller">
          <button onClick={() => setCount((count) => count + 1)}>
          <BsSkipBackwardFill />
          </button>
          <button onClick={() => setCount((count) => count + 1)}>
          <BsFillPauseFill />
          </button>
          <button onClick={() => setCount((count) => count + 1)}>
          <BsArrowRepeat />
          </button>
          <button onClick={() => setCount((count) => count + 1)}>
          <BsSkipForwardFill />
          </button>
      </div>
      <h4>Ultima atualização: </h4>
      <div class="leaderboard-status__bar">
        <div id="switch-progress"></div>
      </div>
      <div class="leaderboard">
        <h2 className=''>{leaderboard_type}</h2>
        
      </div>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
