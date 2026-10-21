import { useEffect, useState } from 'react'
import { api } from '../../api.ts'
import { useAuth } from '../../auth/AuthContext.ts'
import type { HistoryEntry } from '../../types.ts'

type SortKey = 'serviceName' | 'date' | 'outcome'
type SortConfig = { key: SortKey; direction: 'ascending' | 'descending' }

export default function History() {
  const { user } = useAuth()
  // Remount on account changes so another user's rows/page/error cannot linger.
  return <HistoryList key={user?.id ?? 'guest'} />
}

function HistoryList() {
  const itemsPerPage = 25
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'descending' })

  useEffect(() => {
    let active = true
    api<HistoryEntry[]>('/me/history')
      .then(data => { if (active) setHistory(data) })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load history.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  function retry() {
    setLoading(true)
    setError('')
    setCurrentPage(1)
    setReload(value => value + 1)
  }

  const pageCount = Math.max(1, Math.ceil(history.length / itemsPerPage))
  const page = Math.min(currentPage, pageCount)
  const indexOfFirstItem = (page - 1) * itemsPerPage
  const sortedHistory = [...history].sort((a, b) => {
    const { key, direction } = sortConfig
    if (a[key] < b[key]) return direction === 'ascending' ? -1 : 1
    if (a[key] > b[key]) return direction === 'ascending' ? 1 : -1
    return 0
  })

  const currentHistory = sortedHistory.slice(indexOfFirstItem, indexOfFirstItem + itemsPerPage)
  function handleSort(key: SortKey) {
    setSortConfig(previous => ({
      key,
      direction: previous.key === key && previous.direction === 'ascending' ? 'descending' : 'ascending',
    }))
    setCurrentPage(1)
  }

  if (loading) return <div className="page"><h1>History</h1><p role="status">Loading history…</p></div>
  if (error) return <div className="page"><h1>History</h1><p role="alert">{error}</p><button type="button" onClick={retry}>Retry</button></div>
  if (history.length === 0) return <div className="page"><h1>History</h1><p>No queue history yet.</p></div>

  return (
    <div className="page">
      <h1>History</h1>
      <table>
        <thead>
          <tr>
          <th className="sortable" aria-sort={sortConfig.key === 'serviceName' ? sortConfig.direction : 'none'} onClick={() => handleSort('serviceName')}>
            Service {sortConfig.key === 'serviceName' ? (sortConfig.direction === 'ascending' ? '↑' : '↓'):'↕'}
          </th>
          <th className="sortable" aria-sort={sortConfig.key === 'date' ? sortConfig.direction : 'none'} onClick={() => handleSort('date')}>
            Date {sortConfig.key === 'date' ? (sortConfig.direction === 'ascending' ? '↑' : '↓'):'↕'}
          </th>
          <th className="sortable" aria-sort={sortConfig.key === 'outcome' ? sortConfig.direction : 'none'} onClick={() => handleSort('outcome')}>
            Outcome {sortConfig.key === 'outcome' ? (sortConfig.direction === 'ascending' ? '↑' : '↓'):'↕'}
          </th>
          </tr>
        </thead>
        <tbody>
          {currentHistory.map((val) => {
            return(
              <tr key = {val.id}>
                <td>{val.serviceName}</td>
                <td>{val.date}</td>
                <td>{val.outcome}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="pager">
        <button
          type="button"
          onClick={() => setCurrentPage(page - 1)}
          disabled={page === 1}
        >
          Previous
        </button> Page {page} of {pageCount} <button
          type="button"
          onClick={() => setCurrentPage(page + 1)}
          disabled={page === pageCount}
        >
          Next
        </button>
      </div>
    </div>
  )
}
