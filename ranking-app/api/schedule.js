import {loadSchedule} from '../server/schedule.js'
export default async function handler(req,res) {
  if(req.method !== 'GET') {res.setHeader('Allow','GET');return res.status(405).json({error:'Método não permitido'})}
  try {
    const schedule=await loadSchedule()
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=10, must-revalidate')
    return res.status(200).json({...schedule,updatedAt:new Date().toISOString()})
  } catch(error) {res.setHeader('Cache-Control','no-store');return res.status(502).json({error:error.message})}
}
