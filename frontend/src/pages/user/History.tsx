import { useState } from "react";
import { history } from "../../mock/data"
import type { HistoryEntry } from "../../types";

export default function History() {
  const itemsPerPage = 25;
  const [currentPage, setCurrentPage] = useState(1);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  const handlePageChange = (page : number) => {
    setCurrentPage(page);
  };
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'ascending' });
  const sortedHistory = [...history].sort((a, b) => {
    if (sortConfig !== null){
      const { key, direction } = sortConfig;
      if (a[key as keyof HistoryEntry] < b[key as keyof HistoryEntry]){
        return direction === 'ascending' ? -1 : 1
      }
      if (a[key as keyof HistoryEntry] > b[key as keyof HistoryEntry]){
        return direction === 'ascending' ? 1 : -1
      }
    }
    return 0;
  });

  const currentHistory = sortedHistory.slice(indexOfFirstItem, indexOfLastItem);
  const handleSort = (key : string) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === direction){
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div>
      <h1>History</h1>
      <table border= {1} style={{width: '50%', textAlign: 'left'}}>
        <thead>
          <th onClick={() => handleSort('id')} style={{ cursor: 'pointer' }}>
            ID {sortConfig.key === 'id' ? (sortConfig.direction === 'ascending' ? '↑' : '↓'):'↕'}
          </th>
          <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>
            Date {sortConfig.key === 'date' ? (sortConfig.direction === 'ascending' ? '↑' : '↓'):'↕'}
          </th>
          <th onClick={() => handleSort('serviceName')} style={{ cursor: 'pointer' }}>
            Service {sortConfig.key === 'serviceName' ? (sortConfig.direction === 'ascending' ? '↑' : '↓'):'↕'}
          </th>
          <th onClick={() => handleSort('outcome')} style={{ cursor: 'pointer' }}>
            Outcome {sortConfig.key === 'outcome' ? (sortConfig.direction === 'ascending' ? '↑' : '↓'):'↕'}
          </th>
        </thead>
        <tbody>
          {currentHistory.map((val, key) => {
            return(
              <tr key = {key}>
                <td>{val.id}</td>
                <td>{val.date}</td>
                <td>{val.serviceName}</td>
                <td>{val.outcome}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-700 disabled:opacity-50"
        >
          Previous
        </button> Page {currentPage} of {Math.ceil(history.length / itemsPerPage)} <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === Math.ceil(history.length / itemsPerPage)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
