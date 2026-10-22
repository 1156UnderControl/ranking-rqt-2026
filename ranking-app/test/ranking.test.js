import test from 'node:test'
import assert from 'node:assert/strict'
import {readFinalScore, buildRankings, compareTeams} from '../src/ranking.js'
import {parseCsv, loadSource, readSheet} from '../server/sheets.js'
import handler from '../api/rankings.js'

// Fixtures supply final spreadsheet points explicitly, independent of mission formulas.
const h = (id, name, score=80, faults=0, method='Teleoperado') => ({data:['now',id,name,faults,0,0,0,'Fora',method],calc:[id,name,faults,0,0,0,'Fora',method,'',score]})
const t = (id, a, b, score=80, faults=0) => ({data:['now',id,a,b,faults,0,0,'Não','Nenhum'],calc:[id,a,b,faults,0,0,'Não','Nenhum','',score]})
const roster = (...names) => [['Equipe'], ...names.map(name=>[name])]
const rank = (mode, matches, cat1=['A','B','C'], cat2=['D']) => buildRankings({mode,data:[['Carimbo'],...matches.map(x=>x.data)],calculated:[['Partida'],...matches.map(x=>x.calc).filter(Boolean)],rosters:[roster(...cat1),roster(...cat2)]})
const team = (scores, options={}) => ({total:scores.reduce((a,b)=>a+b,0),matches:scores.length,scores,autonomousMatches:0,faults:0,...options})

test('hybrid uses final spreadsheet points without reapplying autonomous multiplication',()=>{
  const {categories}=rank('hybrid',[h('1','A',600,1,'Autônomo')])
  assert.equal(categories[0][0].total,600)
  assert.equal(categories[0][0].autonomousMatches,1)
  assert.equal(categories[0][0].faults,1)
})
test('disk deductions are already included in CALC and are never applied again',()=>{
  const hybrid=rank('hybrid',[h('1','A',175,3)])
  const teleop=rank('teleop',[t('1','A','D',50,12)])
  assert.equal(hybrid.categories[0][0].total,175)
  assert.equal(hybrid.categories[0][0].faults,3)
  assert.equal(teleop.categories[0][0].total,50)
  assert.equal(teleop.categories[0][0].faults,12)
})
test('final points preserve zero and decimals and reject blank or formula errors',()=>{
  assert.equal(readFinalScore(0),0)
  assert.equal(readFinalScore('312,5'),312.5)
  assert.equal(readFinalScore('1200.25'),1200.25)
  for(const value of ['',null,undefined,'#N/A','#REF!','Infinity','12abc']) assert.throws(()=>readFinalScore(value),/Pontuação final/)
})
test('average beats total in teleop, including teams with unequal match counts',()=>{
  const {categories,warnings}=rank('teleop',[t('1','A','D',180),t('2','B','D'),t('3','B','D')])
  assert.equal(warnings.length,0)
  assert.equal(categories[0][0].name,'A')
  assert.equal(categories[0][0].average,180)
  assert.equal(categories[0][1].total,160)
  assert.ok(compareTeams(team([200]),team([150,150]),'teleop')<0)
})
test('all three teleop tiebreak levels are applied in order',()=>{
  assert.ok(compareTeams(team([200,100]),team([180,120]),'teleop')<0)
  assert.ok(compareTeams(team([200,150,50]),team([200,140,60]),'teleop')<0)
  assert.ok(compareTeams(team([200,150,100,50]),team([200,150,90,60]),'teleop')<0)
})
test('fourth best teleop match does not create an unlisted tiebreak',()=>{
  assert.equal(compareTeams(team([200,150,100,80,20]),team([200,150,100,60,40]),'teleop'),0)
})
test('hybrid total is primary and autonomous count is first tiebreak',()=>{
  assert.ok(compareTeams(team([200],{autonomousMatches:0}),team([180],{autonomousMatches:1}),'hybrid')<0)
  assert.ok(compareTeams(team([100,100],{autonomousMatches:2}),team([150,50],{autonomousMatches:1}),'hybrid')<0)
})
test('hybrid best, second best, then fewer penalties',()=>{
  assert.ok(compareTeams(team([160,40]),team([150,50]),'hybrid')<0)
  assert.ok(compareTeams(team([160,40],{faults:1}),team([160,40],{faults:2}),'hybrid')<0)
  assert.equal(compareTeams(team([160,40]),team([160,40]),'hybrid'),0)
})
test('displayed positions use full criteria with shared ranks and gaps',()=>{
  const result=rank('teleop',[t('1','A','D',180),t('2','B','D',180),t('3','C','D')])
  assert.deepEqual(result.categories[0].map(x=>[x.name,x.rank]),[['A',1],['B',1],['C',3]])
})
test('zero-score played teams rank above unplayed teams',()=>{
  const result=rank('hybrid',[h('1','B',0,8)])
  assert.equal(result.categories[0][0].name,'B')
  assert.equal(result.categories[0][0].rank,1)
})
test('both alliance members receive the same final match points across categories',()=>{
  const result=rank('teleop',[t('1','A','D',130)])
  assert.equal(result.categories[0][0].total,130)
  assert.equal(result.categories[1][0].total,130)
})
test('names tolerate capitalization, accents and whitespace without fuzzy merges',()=>{
  const result=rank('hybrid',[h('1','  emeb SAO  JOAO  ')],['EMEB São João'],['D'])
  assert.equal(result.categories[0][0].matches,1)
  assert.equal(result.warnings.length,0)
})
test('duplicate DATA IDs preserve the first response as XLOOKUP does',()=>{
  const duplicate=h('1.1','B'); duplicate.calc=null
  const result=rank('hybrid',[h('1,1','A'),duplicate])
  assert.equal(result.categories[0].find(x=>x.name==='B').matches,0)
  assert.match(result.warnings[0],/repetida/)
})
test('invalid points, method, penalties and unknown participants cannot invent points',()=>{
  const result=rank('hybrid',[h('1','Unknown'),h('2','A','#REF!'),h('3','A',80,-1),h('4','A',80,0,'???')])
  assert.equal(result.warnings.length,4)
  assert.ok(result.categories[0].every(x=>x.matches===0))
})
test('responses without a final CALC score wait with a warning',()=>{
  const missing=h('1','A'); missing.calc=null
  const pending=h('2','B'); pending.calc[9]=''
  const result=rank('hybrid',[missing,pending])
  assert.equal(result.warnings.length,2)
  assert.ok(result.categories[0].every(x=>x.matches===0))
})
test('CALC placeholders without form submissions do not create games or warnings',()=>{
  const result=buildRankings({mode:'hybrid',data:[['Carimbo'],[]],calculated:[['Partida'],['1.1','#N/A','','','','','','','','#N/A']],rosters:[roster('A'),roster()]})
  assert.equal(result.categories[0][0].matches,0)
  assert.deepEqual(result.warnings,[])
})
test('mismatched DATA and CALC teams, penalties or methods are not combined',()=>{
  const wrongName=h('1','A'); wrongName.calc[1]='B'
  const wrongFaults=h('2','A'); wrongFaults.calc[2]=1
  const wrongMethod=h('3','A'); wrongMethod.calc[7]='Autônomo'
  const result=rank('hybrid',[wrongName,wrongFaults,wrongMethod])
  assert.equal(result.warnings.length,3)
  assert.ok(result.categories[0].every(x=>x.matches===0))
})
test('empty categories and blank form rows are handled',()=>{
  const result=rank('hybrid',[{data:[]}],[],[])
  assert.deepEqual(result.categories,[[],[]])
  assert.deepEqual(result.warnings,[])
})
test('duplicate roster entries and ambiguous CALC rows cannot double-credit a team',()=>{
  assert.throws(()=>rank('hybrid',[],['A'],['A']),/repetida/)
  assert.throws(()=>rank('hybrid',[h('1.1','A'),h('1,1','B')]),/repetida na aba CALC/)
})
test('CSV handles quoted names, embedded line breaks, escaped quotes and BOM',()=>{
  assert.deepEqual(parseCsv('\ufeff"Equipe","Nome"\r\n"A, B","linha\ncom ""aspas"""\r\n'),[['Equipe','Nome'],['A, B','linha\ncom "aspas"']])
  assert.throws(()=>parseCsv('"incompleto'),/incompleta/)
})
test('live adapter refuses login HTML and source failures',async()=>{
  await assert.rejects(readSheet('id','DATA','A:I',async()=>new Response('<!doctype html>login')),/exige login/)
  await assert.rejects(readSheet('id','DATA','A:I',async()=>new Response('',{status:403})),/HTTP 403/)
})
test('live adapter loads four tabs and requests final points without grouping separators',async()=>{
  const requests=[]
  const fetcher=async url=>{
    const params=new URL(url).searchParams; requests.push(params)
    const sheet=params.get('sheet')
    return new Response(sheet==='DATA'?'"Carimbo de data/hora","Número"':sheet==='CALC'?'"Partida","Equipe","Faltas","Planetas na Área","Planetas Incorretos","Planetas Corretos","Artes","Método","","Pontuação"':'"Equipe"\n"A"')
  }
  const result=await loadSource('hybrid',fetcher)
  assert.equal(result.rosters.length,2)
  assert.equal(result.calculated[0][9],'Pontuação')
  assert.equal(requests.length,4)
  assert.equal(requests.find(x=>x.get('sheet')==='CALC').get('tq'),"select * format J '0.###############'")
  await assert.rejects(loadSource('hybrid',async()=>new Response('"Wrong"')),/Estrutura/)
})
test('endpoint rejects unknown source and non-read methods',async()=>{
  const response={headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}}
  await handler({method:'GET',query:{mode:'external-url'}},response)
  assert.equal(response.code,400)
  await handler({method:'POST',query:{mode:'hybrid'}},response)
  assert.equal(response.code,405)
  assert.equal(response.headers.Allow,'GET')
})

test('real Tele-Op sheet value counts 270 points without autonomous credit or a second adjustment',()=>{
  for(const method of ['Tele-Op','teleop','TELE OP','Teleoperado','Tele-operado']) {
    const match=h('1,2','A',270,4,method)
    match.data[8]='Tele-Op'
    const {categories,warnings}=rank('hybrid',[match])
    assert.deepEqual(warnings,[])
    assert.equal(categories[0][0].total,270)
    assert.equal(categories[0][0].matches,1)
    assert.equal(categories[0][0].autonomousMatches,0)
    assert.equal(categories[0][0].faults,4)
  }
})
test('method aliases do not hide a real autonomous versus teleop mismatch',()=>{
  const match=h('1,2','A',270,4,'Tele-Op');match.data[8]='Autonomo'
  const {categories,warnings}=rank('hybrid',[match])
  assert.equal(categories[0][0].matches,0)
  assert.match(warnings[0],/método de DATA e CALC/)
})
