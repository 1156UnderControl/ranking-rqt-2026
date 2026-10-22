import {loadSource} from '../server/sheets.js'
import {buildRankings} from '../src/ranking.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({error: 'Método não permitido'}) }
  const mode = req.query.mode
  if (!['hybrid', 'teleop'].includes(mode)) return res.status(400).json({error: 'Modalidade inválida'})
  try {
    const rankings = buildRankings(await loadSource(mode))
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10, must-revalidate')
    return res.status(200).json({...rankings, updatedAt: new Date().toISOString()})
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(502).json({error: error.message})
  }
}
