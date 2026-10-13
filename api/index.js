import { createApi } from '../server/api.js'
import { createAuthHandler } from '../server/auth.js'
// Vercel serverless entry: the same Express API that server/start.js serves locally
const {api,pool}=createApi(process.env)
api.use(createAuthHandler({env:process.env,pool}))
api.use((_req,res)=>res.status(404).json({message:'Not found'}))
export default api
