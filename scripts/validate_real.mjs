import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import initSqlJs from 'sql.js'
import { computeHrvBaselinesFromRows, getLocalDateString } from '../src/lib/health/hrvBaseline.js'

async function validateRealDB() {
  const dbPath = 'C:\\Users\\Josh\\Downloads\\HealthConnect\\health_connect_export.db'
  if (!fs.existsSync(dbPath)) {
    console.error('Test skipped: Real database not found at', dbPath)
    return
  }

  const SQL = await initSqlJs()
  console.log('Reading real Health Connect database...')
  const filebuffer = fs.readFileSync(dbPath)
  const db = new SQL.Database(filebuffer)

  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
  const tables = tablesResult[0] ? tablesResult[0].values.map(r => r[0]) : []
  console.log(`\n--- VALIDATION RESULTS ---`)
  console.log(`Total Tables Found: ${tables.length}\n`)

  const hrvTable = tables.find(t => t.includes('heart_rate_variability') || t.includes('rmssd'))
  if (hrvTable) {
    console.log(`Found HRV Table: ${hrvTable}`)
    const count = db.exec(`SELECT COUNT(*) FROM "${hrvTable}"`)[0].values[0][0]
    console.log(`HRV Records: ${count}`)

    const tableInfo = db.exec(`PRAGMA table_info("${hrvTable}")`)[0].values
    const idCol = tableInfo.find(c => ['uuid', 'id', 'client_record_id'].includes(c[1].toLowerCase()))
    const timeCol = tableInfo.find(c => ['time', 'timestamp'].includes(c[1].toLowerCase()))
    const valCol = tableInfo.find(c => c[1].toLowerCase().includes('variability') || c[1].toLowerCase().includes('millis'))
    
    if (valCol) {
      let selectCols = []
      if (idCol) selectCols.push(`"${idCol[1]}" AS id`)
      else selectCols.push(`NULL AS id`)
      if (timeCol) selectCols.push(`"${timeCol[1]}" AS time`)
      else selectCols.push(`NULL AS time`)
      selectCols.push(`"${valCol[1]}" AS value`)
      
      const rows = db.exec(`SELECT ${selectCols.join(', ')} FROM "${hrvTable}" WHERE "${valCol[1]}" IS NOT NULL`)
      if (rows[0] && rows[0].values.length) {
        const formattedRows = rows[0].values.map(r => {
          let day = null
          if (typeof r[1] === 'number') {
            day = getLocalDateString(r[1])
          } else if (typeof r[1] === 'string') {
            day = getLocalDateString(new Date(r[1]).getTime())
          }
          return {
            id: r[0],
            time: r[1],
            day,
            value: r[2]
          }
        })
        
        const baselines = computeHrvBaselinesFromRows(formattedRows)
        console.log('\nCalculated Baselines:', baselines)
        console.log(`\nCoverage gaps: 28-day window has ${baselines?.validDays28}/28 valid days.`)
        console.log(`Recent comparisons reliable? ${baselines?.confidence === 'high' || baselines?.confidence === 'medium' ? 'Yes' : 'No'}`)
      }
    }
  }

  const hrTable = tables.find(t => t === 'heart_rate_record_table')
  if (hrTable) {
    const hrCount = db.exec(`SELECT COUNT(*) FROM "${hrTable}"`)[0].values[0][0]
    console.log(`\nFound Heart Rate Table: ${hrTable}`)
    console.log(`HR Records: ${hrCount}`)
  }

  const sleepTable = tables.find(t => t === 'sleep_session_record_table')
  if (sleepTable) {
    const sleepCount = db.exec(`SELECT COUNT(*) FROM "${sleepTable}"`)[0].values[0][0]
    console.log(`\nFound Sleep Table: ${sleepTable}`)
    console.log(`Sleep Records: ${sleepCount}`)
  }
}

validateRealDB().catch(console.error)
