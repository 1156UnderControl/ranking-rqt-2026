(() => {
 const timer=document.getElementById('timer');if(!timer)return;
 const base=location.hostname==='127.0.0.1'?location.origin:'https://cronometro-rqt.stemos-6057.chatgpt.site';
 const colors=[{name:'Roxo',hex:'#853fc2'},{name:'Verde',hex:'#50a34c'},{name:'Laranja',hex:'#ef8c26'},{name:'Marrom',hex:'#81502f'}];
 const row=document.createElement('div');row.className='timer-roulette-row';timer.before(row);
 const digits=document.createElement('div');digits.className='timer-digits';const unit=document.querySelector('.time-unit');row.append(digits);digits.append(timer);if(unit)digits.append(unit);
 const box=document.createElement('aside');box.className='roulette';box.setAttribute('aria-label','Sorteio de cores sincronizado');
 box.innerHTML='<span class="roulette-title">SORTEIO DE CORES</span><button class="roulette-button" type="button" aria-label="Sortear entre roxo, verde, laranja e marrom" disabled><span class="roulette-pointer" aria-hidden="true"></span><span class="roulette-disc" aria-hidden="true"><span class="roulette-center">GIRAR</span></span></button><strong class="roulette-result" aria-live="polite">Conectando…</strong><span class="roulette-help">Mesmo resultado em todos os telões</span><span class="roulette-error" role="status"></span>';
 row.append(box);
 const button=box.querySelector('button'),disc=box.querySelector('.roulette-disc'),label=box.querySelector('.roulette-result'),error=box.querySelector('.roulette-error');
 let state=null,anchor=0,server=0,last=0,pending=false,request=null,lastLabel='',lastAngle=null,failed='';
 const now=()=>server+performance.now()-anchor;
 function apply(data,sent){
  if(!Number.isSafeInteger(data.revision)||!Number.isFinite(data.serverNow)||!Number.isFinite(data.started_at)||!Number.isFinite(data.ends_at)||!(data.color===null||Number.isInteger(data.color)&&data.color>=0&&data.color<4))throw new Error('Resposta inválida.');
  if(state&&(data.revision<state.revision||data.revision===state.revision&&data.serverNow<state.serverNow))return;
  anchor=performance.now();server=data.serverNow+(anchor-sent)/2;last=anchor;state=data;render();
 }
 async function sync(force=false){
  if(request&&!force)return;if(force)request?.abort();
  const controller=new AbortController();request=controller;const sent=performance.now();const timeout=setTimeout(()=>controller.abort(),2500);
  try{const response=await fetch(base+'/api/roulette?fresh='+Date.now(),{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error();const data=await response.json();if(request===controller)apply(data,sent);}catch{}finally{clearTimeout(timeout);if(request===controller)request=null;render();}
 }
 function render(){
  const healthy=!!state&&performance.now()-last<4000,t=now();const spinning=!!state&&t<state.ends_at;
  button.disabled=!healthy||pending||spinning;
  const text=!state?'Conectando…':spinning?'Sorteando…':state.color===null?'Clique para sortear':colors[state.color].name;
  if(lastLabel!==text){label.textContent=text;lastLabel=text;}
  label.style.color=state&&state.color!==null&&!spinning?colors[state.color].hex:'';
  error.textContent=!healthy&&state?'Sem conexão · sorteio bloqueado':failed;
  if(state&&state.color!==null){
   const progress=Math.max(0,Math.min(1,(t-state.started_at)/Math.max(1,state.ends_at-state.started_at)));
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   const target=360*5+(315-state.color*90),angle=(reduced?(progress===1?1:0):1-Math.pow(1-progress,3))*target;
   if(angle!==lastAngle){disc.style.transform=`rotate(${angle}deg)`;lastAngle=angle;}
  }
 }
 button.addEventListener('keydown',event=>{if(event.code==='Space'||event.key==='Enter')event.stopPropagation();});
 button.addEventListener('click',async()=>{
  if(button.disabled||!state)return;pending=true;failed='';render();const sent=performance.now();
  try{const response=await fetch(base+'/api/roulette',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision}),signal:AbortSignal.timeout(5000)});const data=await response.json();if(response.ok||response.status===409)apply(data,sent);if(!response.ok)throw new Error(data.error||'Sorteio não confirmado.');}
  catch(e){failed=e.message||'Sorteio não confirmado.';sync(true);}finally{pending=false;render();}
 });
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync(true)});window.addEventListener('focus',()=>sync(true));window.addEventListener('online',()=>sync(true));window.addEventListener('pageshow',()=>sync(true));
 sync();setInterval(sync,500);setInterval(render,33);
})();
