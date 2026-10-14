import {readFileSync,readdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createPool} from './db.js'
// Applies every migration in name order; each file must be safe to re-run.
const dir=fileURLToPath(new URL('./migrations/',import.meta.url));const pool=createPool(process.env)
try{for(const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()){await pool.query(readFileSync(dir+file,'utf8'));console.log('Applied',file)}}finally{await pool.end()}
