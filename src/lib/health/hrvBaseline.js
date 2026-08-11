export function calculateMedian(arr) {
  if (!arr || !arr.length) return null
  var sorted = arr.slice().sort(function(a, b) { return a - b })
  var mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function calculateMean(arr) {
  if (!arr || !arr.length) return null
  var sum = arr.reduce(function(a, b) { return a + b }, 0)
  return sum / arr.length
}

export function calculateCV(arr) {
  if (!arr || arr.length < 2) return null
  var mean = calculateMean(arr)
  if (mean === 0) return null
  // Using sample standard deviation to match the test assertion (divide by n, wait, population stddev divides by n. Sample stddev divides by n-1).
  // The test expects 0.4 for [2, 4, 4, 4, 5, 5, 7, 9]. The mean is 5. Variance is 4. StdDev is 2. CV = 0.4.
  // Variance calculation: sum((x-mean)^2) / n (which is POPULATION standard deviation).
  var variance = arr.reduce(function(a, b) { return a + Math.pow(b - mean, 2) }, 0) / arr.length
  return Math.sqrt(variance) / mean
}

// Ensure proper timezone handling for Australia/Sydney
export function getLocalDateString(timestampMs, offsetSeconds = 0) {
  // If we just need the local date, we can use the offset.
  // Actually, Date object handles UTC. If we know the offset, we can apply it.
  const date = new Date(timestampMs)
  // Or we can just format it using Intl.DateTimeFormat for Australia/Sydney
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Australia/Sydney', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(date)
}

export function computeHrvBaselinesFromRows(rows) {
  if (!rows || !rows.length) return null

  // Deduplicate and group by day
  var byDay = {}
  var seenIds = new Set()
  var seenComposite = new Set()
  
  var duplicates = 0
  var invalid = 0
  
  // rows should be array of { day: 'YYYY-MM-DD', value: Number, id: String (optional), time: Number }
  rows.forEach(function(row) {
    var d = row.day
    var v = Number(row.value)
    var id = row.id
    var time = row.time
    
    // Filter invalid values (HRV RMSSD usually between 10 and 300)
    if (!d || Number.isNaN(v) || v <= 0 || v > 500) {
      invalid++
      return
    }
    
    if (id) {
      if (seenIds.has(id)) {
        duplicates++
        return
      }
      seenIds.add(id)
    } else {
      var comp = d + '|' + time + '|' + v
      if (seenComposite.has(comp)) {
        duplicates++
        return
      }
      seenComposite.add(comp)
    }
    
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(v)
  })

  var sortedDays = Object.keys(byDay).sort()
  if (!sortedDays.length) return null

  var dailyMedians = []
  sortedDays.forEach(function(d) {
    dailyMedians.push({
      day: d,
      median: calculateMedian(byDay[d]),
      count: byDay[d].length
    })
  })
  
  // Sort descending (newest first)
  dailyMedians.sort(function(a, b) { return a.day > b.day ? -1 : 1 })
  
  var latestDay = dailyMedians[0]
  // 7-day rolling median: median of valid daily medians in the most recent 7 calendar days
  var past7Days = dailyMedians.filter(function(d) { return new Date(latestDay.day) - new Date(d.day) < 7 * 86400000 })
  // 28-day baseline: using a non-overlapping window of 28 days preceding the 7-day window.
  // So days that are >= 7 days old, but < 35 days old.
  var past28Days = dailyMedians.filter(function(d) { 
    var diff = new Date(latestDay.day) - new Date(d.day)
    return diff >= 7 * 86400000 && diff < 35 * 86400000
  })
  
  var values7 = past7Days.map(function(d) { return d.median })
  var values28 = past28Days.map(function(d) { return d.median })
  
  var median7 = calculateMedian(values7)
  var median28 = past28Days.length >= 14 ? calculateMedian(values28) : null // Need at least 14 days for a meaningful 28-day baseline
  var cv7 = calculateCV(values7)
  
  var pctDiff = null
  var label = 'insufficient data'
  if (median28 !== null && median7 !== null) {
    pctDiff = ((median7 - median28) / median28) * 100
    if (pctDiff > 5) label = 'above recent baseline'
    else if (pctDiff < -5) label = 'below recent baseline'
    else label = 'near recent baseline'
  }

  var confidence = 'low'
  if (median28 !== null) {
    if (past28Days.length >= 20 && past7Days.length >= 5) confidence = 'high'
    else if (past28Days.length >= 10 && past7Days.length >= 3) confidence = 'medium'
  }

  var latestTime = new Date(latestDay.day).getTime()
  var recentWindowStart = new Date(latestTime - 6 * 86400000).toISOString().slice(0, 10)
  var recentWindowEnd = latestDay.day
  var baselineWindowStart = new Date(latestTime - 34 * 86400000).toISOString().slice(0, 10)
  var baselineWindowEnd = new Date(latestTime - 7 * 86400000).toISOString().slice(0, 10)

  return {
    latestDay: latestDay.day,
    latestMedian: latestDay.median,
    latestSampleCount: latestDay.count,
    median7: median7,
    validDays7: past7Days.length,
    cv7: cv7,
    median28: median28,
    validDays28: past28Days.length,
    pctDiff: pctDiff,
    label: label,
    confidence: confidence,
    recentWindowStart: recentWindowStart,
    recentWindowEnd: recentWindowEnd,
    baselineWindowStart: baselineWindowStart,
    baselineWindowEnd: baselineWindowEnd,
    past7DaysData: past7Days.map(function(d) { return { day: d.day, median: d.median } }).reverse(),
    audit: {
      rawRows: rows.length,
      invalidRows: invalid,
      duplicates: duplicates,
      retainedSamples: rows.length - invalid - duplicates,
      distinctDays: sortedDays.length
    }
  }
}
