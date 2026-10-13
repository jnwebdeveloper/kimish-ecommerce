import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
export function passwordHash(password) { const salt=randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}` }
export function passwordValid(password, hash) { const [salt,key]=hash.split(':'); const derived=scryptSync(password,salt,64); const stored=Buffer.from(key,'hex'); return derived.length===stored.length && timingSafeEqual(derived,stored) }
