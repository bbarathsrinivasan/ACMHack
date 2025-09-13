#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'
import url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dataDir = path.join(root, 'data')
const seedsDir = path.join(root, 'data', 'seeds')

async function main() {
  try {
    const files = ['assignments.json','courses.json','events.json','milestones.json','planblocks.json','resources.json']
    for (const f of files) {
      const src = path.join(seedsDir, f)
      const dst = path.join(dataDir, f)
      const content = await fs.readFile(src, 'utf8')
      await fs.writeFile(dst, content, 'utf8')
      console.log(`Restored ${f}`)
    }
    console.log('Seed restore complete.')
  } catch (e) {
    console.error('Seed restore failed:', e?.message || e)
    process.exit(1)
  }
}

main()
