import {queueEntries, services, history} from "../../mock/data"
import type { QueueStatus, QueueEntry, HistoryEntry} from "../../types"
import { useAuth } from "../../auth/AuthContext"
import { useNavigate } from 'react-router'
import { formatWaitDuration } from "../employee/formatWait"
import { useState } from "react"

type Stats = {
  id: string
  serviceName: string
  status: QueueStatus
  position: number
  wait: number
}

function findAtSID(id: string){
  for (let s of services){
    if (s.id === id) return s
  }
}

function findAtQID(id: string){
  for (let e of queueEntries){
    if (e.id === id) return e
  }
}

function isInQueue(entry: QueueEntry): boolean {
  return !entry.outcome
}

function initEntries(): QueueEntry[] {
  return queueEntries
    .filter((e) => isInQueue(e))
    .map((e) => ({ ...e }))
}

export default function QueueStatus() {
  const queueStats: Stats[] = []
  const user = useAuth().user
  const navigate = useNavigate()
  const [entries, setEntries] = useState<QueueEntry[]>(initEntries)
  let pos = 0
  let wTime = 0
  for (let entry of entries) {
    let s = findAtSID(entry.serviceId)
    if (s === undefined) continue
    if (entry.outcome) continue
    if (entry.userId === user?.id){
      queueStats.push({
        id: entry.id,
        serviceName: s.name,
        status: entry.status,
        position: pos,
        wait: wTime // Wait-Time Estimation & Position Logic needs to be updated later
      })
    }
    wTime += s.expectedDuration
    pos++
  }

  function handleLeave(id: string, service: string|undefined) {
    const ok = window.confirm(`Leave the queue for ${service}?`)
    if (!ok) return
    let f = findAtQID(id) 
    if(f !== undefined && service !== undefined){
      let e: HistoryEntry = {
        id: "",
        date: f.joinedAt.substring(0, 10),
        serviceName: service,
        outcome: 'left'
      }
      history.push(e)
    }
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, outcome: 'left' } : e)),
    )

    for(let e of queueEntries){
      if(e.serviceId === id) e.outcome = 'left'
    }
  }

  return (
    <div>
      <h1>Queue Status</h1>
      {queueStats.length === 0 ? 
      (<div>
        You are not currently in a queue 
        <div>
          <button type="button" onClick={() => navigate('/join')}>Join a Queue</button>
        </div>
      </div>)
      :
      (<div>
        <table border= {1} style={{width: '50%', textAlign: 'left'}}>
          <thead>
            <th> Service </th>
            <th> Estimated Wait Time </th>
            <th> Position </th>
            <th> Status </th>
            <th> </th>
          </thead>
          <tbody>
            {queueStats.map((val) => {
              return(
                <tr key = {val.id}>
                  <td>{val.serviceName}</td>
                  <td>{formatWaitDuration((val.wait * 60000))}</td>
                  <td>{val.position}</td>
                  <td>{val.status}</td>
                  <td><button type="button" onClick={() => handleLeave(val.id, val.serviceName)}>Leave</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>)
      }
    </div>
  )
}
