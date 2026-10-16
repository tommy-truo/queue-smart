import {queueEntries, services, history} from "../../mock/data"
import type { HistoryEntry, QueueEntry, Service} from '../../types.ts'
import { useState, type SetStateAction } from "react";
import { useAuth } from "../../auth/AuthContext"
import type { SessionUser } from "../../auth/AuthContext.ts";
import { formatWait } from "./UserDashboard.tsx";
import ConfirmModal from "../../components/ConfirmModal";

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

export default function JoinQueue() {
  const [service, setService] = useState("Select");
  const user = useAuth().user
  const [entries, setEntries] = useState<QueueEntry[]>(initEntries)
  const [leaving, setLeaving] = useState<{ id: string; service: string | undefined } | null>(null)

  function handleChangeService(event: { target: { value: SetStateAction<string>; }; }){
    setService(event.target.value)
  }

  function inQueue(serviceId: string, userId: string|undefined){
    for (let e of entries) {
      if((e.serviceId === serviceId) && (e.userId === userId) && (isInQueue(e))) return true
    }
    return false
  }

  function handleLeave(id: string, service: string|undefined) {
    setLeaving({ id, service })
  }

  function confirmLeave() {
    if (!leaving) return
    const { id, service } = leaving
    setLeaving(null)
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
      prev.map((e) => (((e.serviceId === id) && (e.userId === user?.id)) ? { ...e, outcome: 'left' } : e)),
    )

    for(let e of queueEntries){
      if((e.serviceId === id) && (e.userId === user?.id)) e.outcome = 'left'
    }
  }
  
  function handleJoin(service: Service | undefined, user: SessionUser | null) {
    let now = new Date().toISOString()
    if ((service !== undefined) && (user !== null)){
      let e: QueueEntry = {
        id: '',
        serviceId: service.id,
        userId: user.id,
        userName: user.fullName,
        status: 'waiting',
        joinedAt: now
      }
      queueEntries.push(e)
    }
    setEntries(initEntries)
  }
  function dur(exDur: number | undefined){
    if(exDur !== undefined) return exDur
    return 0
  }
  const waitList: QueueEntry[]= queueEntries.filter((e) => {
    if((e.serviceId === service) && (isInQueue(e))) return true
    return false
  })

  let wTime = 0
  for (let entry of waitList) {
    if (entry.userId === user?.id) break
    let s = findAtSID(entry.serviceId)
    if (findAtSID(entry.serviceId) === undefined) continue
    if (entry.outcome) continue
    if (entry.serviceId === service){
      wTime+= dur(s?.expectedDuration)
    }
  }

  const selected = findAtSID(service)

  return (
    <div className="page">
      <h1>Join Queue</h1>
      <label className="field">
        Service
        <select value={service} onChange={handleChangeService}>
          <option value="Select">Select a service</option>
          {services.map((val) => (
            <option key={val.id} value={val.id}>{val.name}</option>
          ))}
        </select>
      </label>
      {selected && (
        <div className="card">
          <h2>{selected.name}</h2>
          <p>{selected.description}</p>
          <p>Expected duration: {selected.expectedDuration} min</p>
          {selected.open === false ? (
            <>
              <p>Estimated wait: N/A</p>
              <button type="button" disabled>Join</button>
              <span className="note">Queue not open. Try again later.</span>
            </>
          ) : inQueue(service, user?.id) ? (
            <>
              <p>Estimated wait: {formatWait(wTime)}</p>
              <button type="button" onClick={() => handleLeave(service, selected.name)}>Leave</button>
              <span className="note">You are already in this queue.</span>
            </>
          ) : (
            <>
              <p>Estimated wait: {formatWait(waitList.length * dur(selected.expectedDuration))}</p>
              <button type="button" className="primary" onClick={() => handleJoin(selected, user)}>Join</button>
            </>
          )}
        </div>
      )}
      <ConfirmModal
        open={leaving !== null}
        title="Leave queue?"
        message={`Leave the queue for ${leaving?.service}?`}
        confirmLabel="Leave"
        onConfirm={confirmLeave}
        onCancel={() => setLeaving(null)}
      />
    </div>
  )
}
