import { useMemo } from 'react'

export default function Dashboard({ parsedFiles = [] }) {
  const stats = useMemo(() => {
    const report = parsedFiles.find(f => f.content?.includes('DATA PACK: STRUCTURED HEALTH INVENTORY'))
    if (!report) return null

    const lines = report.content.split('\n')
    const metrics = {}
    let currentMetric = null

    lines.forEach(line => {
      if (line.startsWith('=== METRIC:')) {
        currentMetric = line.replace('=== METRIC: ', '').replace(' ===', '').toLowerCase()
        metrics[currentMetric] = { count: 0, range: null, status: 'empty' }
      } else if (currentMetric && line.startsWith('- Table:')) {
        const rows = parseInt(line.split('Rows: ')[1]?.split(' ')[0]?.replace(/,/g, '') || '0')
        metrics[currentMetric].count += rows
        if (rows > 0) metrics[currentMetric].status = 'present'
      } else if (currentMetric && line.includes('Range:')) {
        const range = line.split('Range: ')[1]
        if (!metrics[currentMetric].range) metrics[currentMetric].range = range
      }
    })

    return metrics
  }, [parsedFiles])

  const hrv = useMemo(() => {
    const file = parsedFiles.find(f => f.structuredData?.hrvBaselines)
    return file ? file.structuredData.hrvBaselines : null
  }, [parsedFiles])

  if (!stats && !hrv) return null

  const metricCards = [
    { id: 'steps', name: 'Steps', icon: '🏃' },
    { id: 'sleep', name: 'Sleep', icon: '😴' },
    { id: 'heartrate', name: 'Heart Rate', icon: '❤️' },
    { id: 'hrv', name: 'HRV', icon: '💓' },
    { id: 'weight', name: 'Weight', icon: '⚖️' },
    { id: 'exercise', name: 'Exercise', icon: '💪' },
  ]

  return (
    <>
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-slide-up">
        {metricCards.map(m => {
          const data = stats[m.id] || stats[m.id.replace('rate', 'Rate')] || { count: 0, status: 'empty' }
          return (
            <div key={m.id} className="bg-ink-soft border border-slate-border rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xl">{m.icon}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  data.status === 'present' ? 'bg-jade/10 text-jade border border-jade/20' : 'bg-slate-ui/10 text-slate-ui/40 border border-slate-border/50'
                }`}>
                  {data.status.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-ui font-medium uppercase tracking-wider">{m.name}</p>
                <p className="text-xl font-display font-bold text-white">
                  {data.count > 0 ? data.count.toLocaleString() : '--'}
                  <span className="text-[10px] font-normal text-slate-ui/60 ml-1">records</span>
                </p>
              </div>
              {data.range && (
                <p className="text-[10px] text-slate-ui/40 font-mono truncate">
                  {data.range.split(' to ')[0]}...
                </p>
              )}
            </div>
          )
        })}
      </div>
      )}

      {hrv && (
        <div className="bg-ink-soft border border-slate-border rounded-2xl p-6 mt-8 animate-slide-up space-y-6">
          <div className="border-b border-slate-border pb-4">
            <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <span className="text-jade">💓</span> Heart Rate Variability (HRV) Analysis
            </h3>
            <p className="text-slate-ui text-sm mt-1">
              Locally calculated from your Health Connect database.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-ink border border-slate-border/50 rounded-xl p-4 flex flex-col h-full justify-between">
              <div>
                <p className="text-xs text-slate-ui font-medium">Latest Daily Median</p>
                <p className="text-2xl font-bold text-white mt-1">{Math.round(hrv.latestMedian)} <span className="text-sm font-normal text-slate-ui/60">ms</span></p>
                <p className="text-[10px] text-slate-ui/60 mt-1">{hrv.latestSampleCount} samples on {hrv.latestDay}</p>
              </div>
              
              {/* Compact Daily Trend Chart */}
              {hrv.past7DaysData && hrv.past7DaysData.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-border/50">
                  <p className="text-[9px] text-slate-ui/60 mb-2 uppercase tracking-wider">7-Day Trend</p>
                  <div className="flex items-end gap-1 h-8" aria-label="7-Day Trend Chart">
                    {(() => {
                      const maxMedian = Math.max(...hrv.past7DaysData.map(d => d.median), 50);
                      // Fill in missing days
                      const days = [];
                      const endTs = new Date(hrv.recentWindowEnd).getTime();
                      for (let i = 6; i >= 0; i--) {
                        const d = new Date(endTs - i * 86400000).toISOString().slice(0, 10);
                        const match = hrv.past7DaysData.find(x => x.day === d);
                        days.push(match || { day: d, missing: true });
                      }
                      return days.map(d => (
                        <div 
                          key={d.day} 
                          className={`flex-1 rounded-t-sm ${d.missing ? 'bg-slate-ui/10 border-b border-dashed border-slate-ui/30' : 'bg-jade/60 hover:bg-jade'}`} 
                          style={{ height: d.missing ? '2px' : `${Math.max(10, (d.median / maxMedian) * 100)}%` }} 
                          title={d.missing ? `${d.day}: No data` : `${d.day}: ${Math.round(d.median)}ms`}
                        ></div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-ink border border-slate-border/50 rounded-xl p-4">
              <p className="text-xs text-slate-ui font-medium">7-Day Rolling Median</p>
              <p className="text-2xl font-bold text-white mt-1">{Math.round(hrv.median7)} <span className="text-sm font-normal text-slate-ui/60">ms</span></p>
              <p className="text-[10px] text-slate-ui/60 mt-1">{hrv.validDays7}/7 valid days</p>
              <p className="text-[9px] text-slate-ui/40 mt-1 font-mono tracking-tighter truncate" title={`${hrv.recentWindowStart} to ${hrv.recentWindowEnd}`}>{hrv.recentWindowStart} to {hrv.recentWindowEnd}</p>
            </div>

            <div className="bg-ink border border-slate-border/50 rounded-xl p-4">
              <p className="text-xs text-slate-ui font-medium">28-Day Baseline</p>
              {hrv.median28 ? (
                <>
                  <p className="text-2xl font-bold text-white mt-1">{Math.round(hrv.median28)} <span className="text-sm font-normal text-slate-ui/60">ms</span></p>
                  <p className="text-[10px] text-slate-ui/60 mt-1">{hrv.validDays28}/28 valid days</p>
                  <p className="text-[9px] text-slate-ui/40 mt-1 font-mono tracking-tighter truncate" title={`${hrv.baselineWindowStart} to ${hrv.baselineWindowEnd}`}>{hrv.baselineWindowStart} to {hrv.baselineWindowEnd}</p>
                </>
              ) : (
                <p className="text-sm text-slate-ui/60 mt-2 italic">Insufficient Data</p>
              )}
            </div>

            <div className="bg-ink border border-slate-border/50 rounded-xl p-4">
              <p className="text-xs text-slate-ui font-medium">Baseline Difference</p>
              {hrv.pctDiff !== null ? (
                <>
                  <p className={`text-2xl font-bold mt-1 ${hrv.pctDiff > 5 ? 'text-blue-400' : hrv.pctDiff < -5 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {hrv.pctDiff > 0 ? '+' : ''}{Math.round(hrv.pctDiff)}%
                  </p>
                  <p className="text-[10px] text-slate-ui/60 mt-1 capitalize">{hrv.label}</p>
                </>
              ) : (
                <p className="text-sm text-slate-ui/60 mt-2 italic">N/A</p>
              )}
            </div>
          </div>

          <div className="bg-slate-ui/5 border border-slate-border/30 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-200">Statistical Confidence & Variation</h4>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-slate-ui mb-1">Coefficient of Variation (CV): <strong>{hrv.cv7 ? (hrv.cv7 * 100).toFixed(1) + '%' : 'N/A'}</strong></p>
                <p className="text-[11px] text-slate-ui/70">
                  CV measures how much your HRV bounces around day-to-day. A lower CV means your nervous system is stable. A higher CV means your body is adapting to acute stressors or recovery.
                </p>
              </div>
              
              <div>
                <p className="text-xs text-slate-ui mb-1">Data Confidence: <strong className="capitalize">{hrv.confidence}</strong></p>
                <p className="text-[11px] text-slate-ui/70">
                  {hrv.confidence === 'high' ? 'You have excellent coverage across both the recent and historical windows, making this comparison highly reliable.' : 
                   hrv.confidence === 'medium' ? 'You have moderate coverage. The baseline comparison is useful but may be influenced by missing days.' :
                   'There are significant gaps in your historical or recent data. This comparison should be treated cautiously.'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
            <span className="text-amber-500 text-lg">ℹ️</span>
            <div className="text-xs text-slate-ui/90 space-y-1">
              <p><strong>Your recent median is {hrv.label}.</strong></p>
              <p>This is one signal and does not establish illness, stress, fitness, or readiness.</p>
              <p>Look at the pattern alongside sleep, resting heart rate, symptoms, and how you feel.</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-ink-soft border border-slate-border rounded-2xl p-6 text-sm space-y-4 mt-8 animate-slide-up">
        <h4 className="text-jade font-mono uppercase tracking-widest text-xs">Security & Privacy Diagnostic</h4>
        <ul className="list-disc pl-4 text-slate-ui space-y-1">
          <li><strong>Raw Database:</strong> Processed entirely in browser memory. No health data leaves your device during parsing.</li>
          <li><strong>Local Storage:</strong> No personal records are sent to external databases.</li>
          <li><strong>AI Payload:</strong> Only the summarised aggregate metrics (shown above) will be sent to the AI provider.</li>
          <li><strong>Network Activity:</strong> No AI request occurs until you explicitly click the analyse button. Optional integrations (Strava/Supabase) are disabled.</li>
        </ul>
      </div>
    </>
  )
}
