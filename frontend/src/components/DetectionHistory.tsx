import React, { useState, useEffect } from 'react';
import { Search, Download, Filter, TrendingUp, MapPin, Clock } from 'lucide-react';

interface Detection {
  _id: string;
  plate_number: string;
  location: string;
  timestamp: string;
  confidence: number;
  is_matched: boolean;
  vehicle_id?: string;
  image_url?: string;
}

interface DetectionHistoryProps {
  token: string;
}

export const DetectionHistory: React.FC<DetectionHistoryProps> = ({ token }) => {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [filteredDetections, setFilteredDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Filters
  const [searchPlate, setSearchPlate] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [matchStatus, setMatchStatus] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'confidence'>('date');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchDetections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detections, searchPlate, searchLocation, fromDate, toDate, matchStatus, sortBy]);

  const fetchDetections = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/admin/detections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDetections(data.detections || []);
        setError('');
      }
    } catch {
      // Error fetching detection history - state will remain unchanged
      setError('Failed to fetch detection history');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...detections];

    // Filter by plate number
    if (searchPlate) {
      filtered = filtered.filter(d => 
        d.plate_number.toUpperCase().includes(searchPlate.toUpperCase())
      );
    }

    // Filter by location
    if (searchLocation) {
      filtered = filtered.filter(d =>
        d.location.toLowerCase().includes(searchLocation.toLowerCase())
      );
    }

    // Filter by date range
    if (fromDate) {
      const from = new Date(fromDate).getTime();
      filtered = filtered.filter(d => new Date(d.timestamp).getTime() >= from);
    }
    if (toDate) {
      const to = new Date(toDate).getTime();
      filtered = filtered.filter(d => new Date(d.timestamp).getTime() <= to);
    }

    // Filter by match status
    if (matchStatus === 'matched') {
      filtered = filtered.filter(d => d.is_matched);
    } else if (matchStatus === 'unmatched') {
      filtered = filtered.filter(d => !d.is_matched);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      } else if (sortBy === 'confidence') {
        return b.confidence - a.confidence;
      }
      return 0;
    });

    setFilteredDetections(filtered);
    setCurrentPage(1);
  };

  const downloadCSV = () => {
    if (filteredDetections.length === 0) {
      alert('No detections to export');
      return;
    }

    const headers = ['Plate Number', 'Location', 'Timestamp', 'Confidence', 'Matched', 'Vehicle ID'];
    const csv = [
      headers.join(','),
      ...filteredDetections.map(d =>
        [
          `"${d.plate_number}"`,
          `"${d.location}"`,
          new Date(d.timestamp).toLocaleString(),
          d.confidence.toFixed(2),
          d.is_matched ? 'Yes' : 'No',
          d.vehicle_id || 'N/A'
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detections_${new Date().getTime()}.csv`;
    a.click();
  };

  const paginatedDetections = filteredDetections.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(filteredDetections.length / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Detection History</h2>
          <p className="text-slate-400">View and analyze all vehicle detections</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchDetections}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={downloadCSV}
            disabled={filteredDetections.length === 0}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-blue-700/30 bg-blue-950/20 p-4">
          <div className="flex items-center gap-2 text-blue-300 mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs uppercase">Total Detections</span>
          </div>
          <p className="text-3xl font-bold text-blue-400">{detections.length}</p>
        </div>
        <div className="rounded-lg border border-emerald-700/30 bg-emerald-950/20 p-4">
          <div className="flex items-center gap-2 text-emerald-300 mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs uppercase">Matched</span>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{detections.filter(d => d.is_matched).length}</p>
        </div>
        <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
          <div className="flex items-center gap-2 text-amber-300 mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs uppercase">Match Rate</span>
          </div>
          <p className="text-3xl font-bold text-amber-400">
            {detections.length > 0 
              ? ((detections.filter(d => d.is_matched).length / detections.length) * 100).toFixed(1)
              : 0}%
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-700/50 bg-red-950/50 p-4 text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-950 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-slate-400" />
          <h3 className="font-bold text-white">Filters</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search Plate */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Plate Number</label>
            <input
              type="text"
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              placeholder="Search plate..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Search Location */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Location</label>
            <input
              type="text"
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              placeholder="Search location..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* From Date */}
          <div className="space-y-2">
            <label htmlFor="fromDate" className="text-sm text-slate-300">From Date</label>
            <input
              id="fromDate"
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* To Date */}
          <div className="space-y-2">
            <label htmlFor="toDate" className="text-sm text-slate-300">To Date</label>
            <input
              id="toDate"
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Match Status */}
          <div className="space-y-2">
            <label htmlFor="matchStatus" className="text-sm text-slate-300">Status</label>
            <select
              id="matchStatus"
              value={matchStatus}
              onChange={(e) => setMatchStatus(e.target.value as 'all' | 'matched' | 'unmatched')}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Detections</option>
              <option value="matched">Matched Only</option>
              <option value="unmatched">Unmatched Only</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="space-y-2">
            <label htmlFor="sortBy" className="text-sm text-slate-300">Sort By</label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'confidence')}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="date">Latest First</option>
              <option value="confidence">Highest Confidence</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">&nbsp;</label>
            <button
              onClick={() => {
                setSearchPlate('');
                setSearchLocation('');
                setFromDate('');
                setToDate('');
                setMatchStatus('all');
                setSortBy('date');
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white hover:bg-slate-700"
            >
              Clear Filters
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-400 mt-4">
          Showing {filteredDetections.length} of {detections.length} detections
        </p>
      </div>

      {/* Detections Table */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-950 overflow-hidden">
        <div className="sticky top-0 border-b border-slate-800 bg-slate-950 px-6 py-4">
          <h3 className="font-bold text-white">Detections ({paginatedDetections.length})</h3>
        </div>

        {paginatedDetections.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Search className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>{filteredDetections.length === 0 ? 'No detections found' : 'No results for this page'}</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/30">
                    <th className="px-6 py-3 text-left font-semibold text-slate-300">Plate</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-300">Location</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-300">Time</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-300">Confidence</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-300">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {paginatedDetections.map((detection) => (
                    <tr key={detection._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3">
                        <span className="inline-block rounded bg-blue-900/30 px-2 py-1 font-mono font-bold text-blue-300 border border-blue-700/50">
                          {detection.plate_number}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-white flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-500" />
                        {detection.location}
                      </td>
                      <td className="px-6 py-3 text-slate-300 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-500" />
                        {new Date(detection.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-3">
                        <div className="space-y-1">
                          <div className="text-white font-semibold">{(detection.confidence * 100).toFixed(1)}%</div>
                          <div className="h-1.5 w-16 rounded-full bg-slate-700 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                detection.confidence > 0.8 ? 'bg-emerald-500' :
                                detection.confidence > 0.6 ? 'bg-amber-500' :
                                'bg-red-500'
                              }`}
                              role="progressbar"
                              aria-label={`Confidence: ${(detection.confidence * 100).toFixed(1)}%`}
                              aria-valuenow={Math.round(detection.confidence * 100)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              style={{ width: `${Math.round(detection.confidence * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {detection.is_matched ? (
                          <span className="inline-block rounded-full bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-700/50">
                            ✓ Matched
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-slate-900/30 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-700/50">
                            - Not Matched
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-4 p-6">
              {paginatedDetections.map((detection) => (
                <div key={detection._id} className="rounded-lg border border-slate-700 bg-slate-900/30 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="inline-block rounded bg-blue-900/30 px-2 py-1 font-mono font-bold text-blue-300 text-sm border border-blue-700/50">
                      {detection.plate_number}
                    </span>
                    {detection.is_matched ? (
                      <span className="text-xs font-semibold text-emerald-300">✓ Matched</span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-300">Not Matched</span>
                    )}
                  </div>
                  <div className="text-sm text-slate-300 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {detection.location}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {new Date(detection.timestamp).toLocaleString()}
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-white">Confidence: {(detection.confidence * 100).toFixed(1)}%</div>
                    <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          detection.confidence > 0.8 ? 'bg-emerald-500' :
                          detection.confidence > 0.6 ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                        role="progressbar"
                        aria-label={`Confidence: ${(detection.confidence * 100).toFixed(1)}%`}
                        aria-valuenow={Math.round(detection.confidence * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        style={{ width: `${Math.round(detection.confidence * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Previous
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`rounded-lg px-3 py-2 font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default DetectionHistory;
