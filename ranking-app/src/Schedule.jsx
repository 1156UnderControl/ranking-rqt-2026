import {useEffect,useRef,useState} from 'react'
import './Schedule.css'

const SECTIONS = [{id:'general',label:'Programação geral'},{id:'hybrid',label:'Mesas · Híbrido'},{id:'teleop',label:'Mesas · Teleoperado'},{id:'research',label:'Desafio Pesquisa'},{id:'teams',label:'Números das equipes'}]
const chunks = (items,size) => Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size))

export default function Schedule({hidden,fullscreen}) {
  const [data,setData]=useState(null)
  const [error,setError]=useState('')
  const [section,setSection]=useState('general')
  const [page,setPage]=useState(0)
  const [playing,setPlaying]=useState(true)
  const [duration,setDuration]=useState(20)
  const [elapsed,setElapsed]=useState(0)
  const [compact,setCompact]=useState(true)
  const area=useRef(null)
  useEffect(()=>{
    let disposed=false,controller
    const refresh=async()=>{
      if(controller) return
      controller=new AbortController()
      const timeout=setTimeout(()=>controller.abort(),20000)
      try {
        const response=await fetch('/api/schedule',{signal:controller.signal,cache:'no-store'})
        const payload=await response.json()
        if(!response.ok) throw new Error(payload.error || 'Não foi possível atualizar o cronograma.')
        if(!Array.isArray(payload.events)||!Array.isArray(payload.research)||!Array.isArray(payload.teams)) throw new Error('Resposta de cronograma inválida.')
        if(!disposed){setData(payload);setError('')}
      } catch(e){if(!disposed)setError(e.name==='AbortError'?'A leitura excedeu o tempo limite.':e.message)}
      finally{clearTimeout(timeout);controller=null}
    }
    refresh();const timer=setInterval(refresh,30000)
    return()=>{disposed=true;clearInterval(timer);controller?.abort()}
  },[])
  useEffect(()=>{const observer=new ResizeObserver(([entry])=>setCompact(entry.contentRect.height<500));observer.observe(area.current);return()=>observer.disconnect()},[])
  const events=data?.events ?? []
  const groups=section==='general'?chunks(events,compact?4:6):section==='research'?chunks(data?.research??[],compact?2:3):section==='teams'?chunks(data?.teams??[],compact?6:9):events.filter(event=>event.type===section).map(event=>[event])
  const total=Math.max(1,groups.length),current=Math.min(page,total-1),items=groups[current]??[]
  const move=delta=>{setPage((current+delta+total)%total);setElapsed(0)}
  useEffect(()=>{if(!playing||!data)return;const timer=setInterval(()=>setElapsed(value=>value+1),1000);return()=>clearInterval(timer)},[playing,data])
  useEffect(()=>{if(elapsed>=duration){setPage(value=>(Math.min(value,total-1)+1)%total);setElapsed(0)}},[elapsed,duration,total])
  const match=items[0]
  return <section className="schedule-shell">
    {!hidden&&<nav className="schedule-controls" aria-label="Controles do cronograma">
      <select aria-label="Seção do cronograma" value={section} onChange={e=>{setSection(e.target.value);setPage(0);setElapsed(0)}}>{SECTIONS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select>
      <button onClick={()=>move(-1)} aria-label="Cronograma: página anterior">←</button>
      <button onClick={()=>setPlaying(value=>!value)} aria-label={playing?'Pausar cronograma':'Iniciar cronograma'}>{playing?'Pausar':'Reproduzir'}</button>
      <button onClick={()=>move(1)} aria-label="Cronograma: próxima página">→</button>
      <label>Trocar a cada <select aria-label="Duração do cronograma" value={duration} onChange={e=>{setDuration(Number(e.target.value));setElapsed(0)}}>{[10,20,40,60].map(value=><option key={value} value={value}>{value}s</option>)}</select></label>
      <button onClick={fullscreen}>Tela cheia</button>
    </nav>}
    <main className="schedule-main" ref={area}>
      <div className="schedule-heading"><div><p className="schedule-eyebrow">ROBÔS QUE TRANSFORMAM · 2026</p><h2>{SECTIONS.find(s=>s.id===section).label}</h2></div><div className="schedule-counter"><strong>{String(current+1).padStart(2,'0')}</strong><span>/ {String(total).padStart(2,'0')}<br/>{playing?'Alternância automática':'Pausado'}</span></div></div>
      {error&&<p className="error" role="alert">{data?'Exibindo a última leitura válida. ':''}{error}</p>}
      {!data?<div className="schedule-empty">{error?'Cronograma indisponível':'Carregando a programação…'}</div>:!items.length?<div className="schedule-empty">Nenhuma atividade nesta seção.</div>:<>
        {section==='general'&&<div className="agenda-grid">{items.map((event,i)=><article className={`agenda-card ${event.type}`} key={`${event.time}-${i}`}><time>{event.time}</time><div><span className="agenda-kind">{event.type==='hybrid'?'CIRCUITO HÍBRIDO':event.type==='teleop'?'CIRCUITO TELEOPERADO':'PROGRAMAÇÃO'}</span><h3>{event.title}</h3>{event.tables.length>0&&<p>Distribuição de equipes na seção Mesas</p>}</div></article>)}</div>}
        {(section==='hybrid'||section==='teleop')&&<><div className="match-heading"><time>{match.time}</time><h3>{match.title}</h3><span>6 mesas</span></div><div className="tables-grid">{match.tables.map(table=><article className="table-card" key={table.label}><div className="table-card-heading"><span>{table.label}</span>{section==='teleop'&&<b>{table.assignment}</b>}</div>{table.teams.length?table.teams.map((team,i)=><div className="alliance-team" key={`${team.number}-${i}`}><span className="team-number">{team.number}</span><div><h4>{team.name}</h4>{team.category&&<small>Categoria {team.category}</small>}</div></div>):<h4 className="hybrid-assignment">{table.assignment||'A definir na planilha'}</h4>}</article>)}</div></>}
        {section==='research'&&<div className="research-list">{items.map((item,i)=><article className="research-card" key={`${item.time}-${i}`}><time>{item.time}</time><div>{item.teams.map((team,index)=><h3 key={index}>{team}</h3>)}</div></article>)}</div>}
        {section==='teams'&&<div className="teams-grid">{items.map(team=><article className="roster-card" key={team.number}><span className="team-number">{team.number}</span><div><h3>{team.name}</h3><p>Categoria {team.category}</p></div></article>)}</div>}
      </>}
      <div className="schedule-bottom"><span>Programação conforme a organização · horários previstos</span><span>{data?.updatedAt?`Atualizado às ${new Date(data.updatedAt).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})} · a cada 30s`:'Fonte: cronograma impressão'}</span></div>
    </main>
    <div className="schedule-progress" role="progressbar" aria-label="Tempo até a próxima página do cronograma" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.min(elapsed,duration)}><div style={{width:`${Math.min(100,elapsed/duration*100)}%`}}/></div>
  </section>
}
