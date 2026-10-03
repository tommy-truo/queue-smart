import {queueEntries, services, history} from "../../mock/data"
import type { HistoryEntry, QueueEntry, Service} from '../../types.ts'
import { useState, type SetStateAction } from "react";
import { useAuth } from "../../auth/AuthContext"
import type { SessionUser } from "../../auth/accounts.ts";

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

  return (
    <div>
      <h1>Join Queue</h1>
      <div style={{ width: '300px', marginLeft: 'auto' }}>
        <b><i>Choose a service:</i></b> {" "}
        <label>
          <select value={service} onChange={handleChangeService}>
            <option value="Select">Select a Service</option>
            {services.map((val) => {
              return (
                <option value={val.id}>{val.name}</option>
              )
            })}
          </select>
        </label>
      </div>
      {(findAtSID(service) === undefined) ? "": 
        <div>
          <dl>
            <dt><h3>{findAtSID(service)?.name} </h3></dt>
            <dd>{findAtSID(service)?.description}</dd>
          </dl>
          <p> 
            <div>Expected Duration: {" "} {findAtSID(service)?.expectedDuration}</div>
            {findAtSID(service)?.open === false ? 
              (<div>
                <div>Current Estimated Wait Time: N/A</div>
                <button type="button" disabled={findAtSID(service)?.open}><del>Join</del></button> *Queue not open. Try again later
              </div>)
              :
              (<div>
                {inQueue(service, user?.id) ? 
                  (<div>
                    <div>Current Estimated Wait Time: {" "} {wTime}</div>
                    <button type="button" onClick={() => handleLeave(service, findAtSID(service)?.name)}>Leave</button> *Already in queue
                  </div>)
                  :
                  (<div>
                    <div>Current Estimated Wait Time: {" "} {(waitList.length*dur(findAtSID(service)?.expectedDuration))}</div>
                    <button type="button" onClick={() => handleJoin(findAtSID(service), user)}>Join</button>
                  </div>)
                }
              </div>)
            }  
          </p>
        </div>
      }
    </div>
  )
}
