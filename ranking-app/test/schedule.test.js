import test from 'node:test'
import assert from 'node:assert/strict'
import {parseSchedule,loadSchedule} from '../server/schedule.js'
const rows=[['Cronograma Geral'],['9:50','# partida híbrida 1','Mesa 1','Mesa 2','Mesa 3','Mesa 4','Mesa 5','Mesa 6'],['','','A','B','C','D','E','F'],['13:15','# partida teleoperada 1','1 + 2','3 + 99'],['DESAFIO PESQUISA','','','','Número','Escola','Categoria'],['13:15','Equipe A','Equipe B','','1','Escola A','1'],['','','','','2','Escola B','2'],['','','','','3','Escola C','1']]
test('schedule keeps the hybrid continuation row and all six tables',()=>{const data=parseSchedule(rows);assert.equal(data.events.length,2);assert.deepEqual(data.events[0].tables.map(t=>t.assignment),['A','B','C','D','E','F'])})
test('teleop resolves alliance numbers only from this sheet and flags unknown numbers',()=>{const data=parseSchedule(rows);assert.deepEqual(data.events[1].tables[0].teams.map(t=>t.name),['Escola A','Escola B']);assert.equal(data.events[1].tables[1].teams[1].number,'99');assert.equal(data.events[1].tables[1].teams[1].name,'Equipe não identificada na planilha')})
test('research rows and roster side by side do not become general events',()=>{const data=parseSchedule(rows);assert.equal(data.research.length,1);assert.equal(data.teams.length,3);assert.deepEqual(data.research[0].teams,['Equipe A','Equipe B'])})
test('schedule rejects a changed structure rather than silently publishing an empty schedule',()=>assert.throws(()=>parseSchedule([['Other']]),/estrutura/))
test('schedule refuses login pages',async()=>{await assert.rejects(()=>loadSchedule(async()=>new Response('<!doctype html><html>Login</html>')),/login/)})
