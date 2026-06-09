import { useState, useEffect } from 'react'
import { deleteAnalysis, getAnalysisHistory } from '../lib/db.js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function HistoryView() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    getAnalysisHistory().then(data => {
      setHistory(data)
      setLoading(false)
    })
  }, [])

  const downloadHistory = () => {
    const blob = new Blob([JSON.stringify({
      app: 'HealthLens',
      exportedAt: new Date().toISOString(),
      analyses: history,
    }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `healthlens-analysis-history-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setStatus('Analysis history downloaded.')
  }

  const removeAnalysis = async (item) => {
    if (!window.confirm('Delete this saved analysis from this browser?')) return
    await deleteAnalysis(item.id)
    setHistory((current) => current.filter((entry) => entry.id !== item.id))
    setExpandedId((current) => current === item.id ? null : current)
    setStatus('Saved analysis deleted.')
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-ui animate-pulse">Loading history...</div>
  }

  if (history.length === 0) {
    return (
      <div className="bg-ink-soft border border-slate-border rounded-2xl p-12 text-center space-y-4">
        <div className="text-4xl">📜</div>
        <h3 className="text-white font-semibold">No analysis history yet</h3>
        <p className="text-slate-ui text-sm max-w-xs mx-auto">
          Analyses you perform will be saved locally in your browser.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-white font-display font-semibold">Saved Analyses</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-ui font-mono">{history.length} total</span>
          <button
            type="button"
            onClick={downloadHistory}
            className="rounded-lg border border-jade/30 px-3 py-1.5 text-xs font-semibold text-jade transition hover:bg-jade/10"
          >
            Download history
          </button>
        </div>
      </div>

      {status && <p role="status" className="px-2 text-xs text-jade">{status}</p>}

      <div className="space-y-3">
        {history.map((item) => {
          const isExpanded = expandedId === item.id
          return (
            <div 
              key={item.id} 
              className={`bg-ink-soft border rounded-2xl overflow-hidden transition-all ${isExpanded ? 'border-jade/40 ring-1 ring-jade/20' : 'border-slate-border'}`}
            >
              <button 
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full p-5 flex items-start justify-between text-left hover:bg-white/5 transition-colors"
              >
                <div className="space-y-1">
                  <p className="text-xs text-jade font-mono uppercase tracking-wider">
                    {new Date(item.date).toLocaleDateString()} · {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <h4 className="text-white font-medium leading-tight">
                    {item.modes.length > 0 ? item.modes.join(', ') : 'Custom Question'}
                  </h4>
                  {item.question && (
                    <p className="text-slate-ui text-xs italic line-clamp-1 mt-1">
                      "{item.question}"
                    </p>
                  )}
                  <p className="text-[10px] text-slate-ui/60 font-mono mt-1">
                    Model: {item.model}
                  </p>
                </div>
                <span className={`text-slate-ui transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-border/50">
                  <div className="prose-health prose-sm max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {item.result}
                    </ReactMarkdown>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAnalysis(item)}
                    className="mt-4 rounded-lg border border-crimson-health/40 px-3 py-2 text-xs font-semibold text-crimson-health transition hover:bg-crimson-health/10"
                  >
                    Delete saved analysis
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
