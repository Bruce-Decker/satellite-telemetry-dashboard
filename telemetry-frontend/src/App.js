import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import DatePicker from 'react-datepicker';
import { useTable, useFilters, useSortBy, usePagination } from 'react-table';
import { ToastContainer, toast } from 'react-toastify';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSatellite,
  faTemperatureHalf,
  faBatteryThreeQuarters,
  faLocationArrow,
  faWifi,
  faCheckCircle,
  faRotate,
  faMoon,
  faSun,
  faCircleXmark,
  faChartLine,
  faGear,
  faDownload,
  faFilter,
  faClock,
  faChartColumn,
  faEye,
  faTriangleExclamation,
  faCircleCheck,
  faCircleInfo
} from '@fortawesome/free-solid-svg-icons';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
};

const useWebSocket = (url, onMessage) => {
  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    return () => {
      ws.close();
    };
  }, [url, onMessage]);
};


const useRealTimeData = (fetchFunction, interval = 5000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchFunction();
      setData(result);
    } catch (err) {
      setError(err.message);
      toast.error(`Failed to fetch data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, interval);
    return () => clearInterval(intervalId);
  }, [fetchData, interval]);

  return { data, loading, error, refetch: fetchData };
};


const TelemetryTable = ({ data, columns }) => {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    prepareRow,
    state: { pageIndex, pageSize },
    nextPage,
    previousPage,
    canNextPage,
    canPreviousPage,
    pageOptions,
    gotoPage,
    pageCount,
    setPageSize,
  } = useTable(
    {
      columns,
      data,
      initialState: { pageIndex: 0, pageSize: 10 },
    },
    useFilters,
    useSortBy,
    usePagination
  );

  return (
    <div className="table-container">
      <table {...getTableProps()} className="telemetry-table">
        <thead>
          {headerGroups.map(headerGroup => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                  {column.render('Header')}
                  <span>
                    {column.isSorted ? (column.isSortedDesc ? ' ↓' : ' ↑') : ''}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {page.map(row => {
            prepareRow(row);
            return (
              <tr {...row.getRowProps()}>
                {row.cells.map(cell => (
                  <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      
      <div className="pagination">
        <button onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
          {'<<'}
        </button>
        <button onClick={() => previousPage()} disabled={!canPreviousPage}>
          {'<'}
        </button>
        <button onClick={() => nextPage()} disabled={!canNextPage}>
          {'>'}
        </button>
        <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
          {'>>'}
        </button>
        <span>
          Page{' '}
          <strong>
            {pageIndex + 1} of {pageOptions.length}
          </strong>
        </span>
        <span>
          | Go to page:
          <input
            type="number"
            defaultValue={pageIndex + 1}
            onChange={e => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0;
              gotoPage(page);
            }}
            style={{ width: '50px' }}
          />
        </span>
        <select
          value={pageSize}
          onChange={e => {
            setPageSize(Number(e.target.value));
          }}
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

function App() {
  const { theme, toggleTheme } = useTheme();
  const [currentStatus, setCurrentStatus] = useState(null);
  const [telemetryData, setTelemetryData] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [aggregations, setAggregations] = useState([]);
  const [minAggregations, setMinAggregations] = useState([]);
  const [maxAggregations, setMaxAggregations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnomalyType, setSelectedAnomalyType] = useState('');
  const [showTable, setShowTable] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [bucketSize, setBucketSize] = useState('1 hour');


  const fetchCurrentStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/telemetry/current`);
      return response.data;
    } catch (err) {
      throw new Error('Failed to fetch current status');
    }
  }, []);

  const fetchTelemetryData = useCallback(async () => {
    try {
      const params = {
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        limit: 1000,
      };
      const response = await axios.get(`${API_BASE_URL}/api/v1/telemetry`, { params });
      return response.data;
    } catch (err) {
      throw new Error('Failed to fetch telemetry data');
    }
  }, [startDate, endDate]);

  const fetchAnomalies = useCallback(async () => {
    try {
      const params = {
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        limit: 100,
      };
      const response = await axios.get(`${API_BASE_URL}/api/v1/telemetry/anomalies`, { params });
      return response.data;
    } catch (err) {
      throw new Error('Failed to fetch anomalies');
    }
  }, [startDate, endDate]);

  const fetchAggregations = useCallback(async () => {
    try {
      const params = {
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        bucket_size: bucketSize,
      };
      const response = await axios.get(`${API_BASE_URL}/api/v1/telemetry/aggregations`, { params });
      return response.data;
    } catch (err) {
      throw new Error('Failed to fetch aggregations');
    }
  }, [startDate, endDate, bucketSize]);

  const fetchMinAggregations = useCallback(async () => {
    try {
      const params = {
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        bucket_size: bucketSize,
      };
      const response = await axios.get(`${API_BASE_URL}/api/v1/telemetry/aggregations/min`, { params });
      return response.data;
    } catch (err) {
      throw new Error('Failed to fetch min aggregations');
    }
  }, [startDate, endDate, bucketSize]);

  const fetchMaxAggregations = useCallback(async () => {
    try {
      const params = {
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        bucket_size: bucketSize,
      };
      const response = await axios.get(`${API_BASE_URL}/api/v1/telemetry/aggregations/max`, { params });
      return response.data;
    } catch (err) {
      throw new Error('Failed to fetch max aggregations');
    }
  }, [startDate, endDate, bucketSize]);

 
  const { data: realTimeStatus, refetch: refetchStatus } = useRealTimeData(
    fetchCurrentStatus,
    autoRefresh ? 5000 : null
  );


  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [status, telemetry, anomaliesData, aggregationsData, minAggData, maxAggData] = await Promise.all([
          fetchCurrentStatus(),
          fetchTelemetryData(),
          fetchAnomalies(),
          fetchAggregations(),
          fetchMinAggregations(),
          fetchMaxAggregations(),
        ]);
        
        setCurrentStatus(status);
        setTelemetryData(Array.isArray(telemetry) ? telemetry : []);
        setAnomalies(Array.isArray(anomaliesData) ? anomaliesData : []);
        setAggregations(Array.isArray(aggregationsData) ? aggregationsData : []);
        setMinAggregations(Array.isArray(minAggData) ? minAggData : []);
        setMaxAggregations(Array.isArray(maxAggData) ? maxAggData : []);
      } catch (err) {
        setError(err.message);
        toast.error(err.message);
        setTelemetryData([]);
        setAnomalies([]);
        setAggregations([]);
        setMinAggregations([]);
        setMaxAggregations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [startDate, endDate, bucketSize, fetchCurrentStatus, fetchTelemetryData, fetchAnomalies, fetchAggregations, fetchMinAggregations, fetchMaxAggregations]);


  useEffect(() => {
    if (realTimeStatus) {
      setCurrentStatus(realTimeStatus);
    }
  }, [realTimeStatus]);


  useEffect(() => {
    if (Array.isArray(anomalies) && anomalies.length > 0) {
      const newAnomalies = anomalies.filter(anomaly => 
        anomaly && anomaly.timestamp && 
        new Date(anomaly.timestamp) > new Date(Date.now() - 60000) 
      );
      
      newAnomalies.forEach(anomaly => {
        if (anomaly.anomaly_type && anomaly.parameter_name && 
            typeof anomaly.parameter_value === 'number' && 
            typeof anomaly.threshold_value === 'number') {
          
          const notification = {
            id: Date.now() + Math.random(),
            type: 'anomaly',
            title: `Anomaly Detected: ${anomaly.anomaly_type}`,
            message: `${anomaly.parameter_name}: ${anomaly.parameter_value.toFixed(2)} (Threshold: ${anomaly.threshold_value.toFixed(2)})`,
            timestamp: new Date(),
          };
          
          setNotifications(prev => [...prev, notification]);
          toast.error(notification.message, {
            duration: 5000,
            icon: '🚨',
          });
        }
      });
    }
  }, [anomalies]);


  const filteredTelemetryData = useMemo(() => {
    if (!Array.isArray(telemetryData)) {
      console.warn('Telemetry data is not an array:', telemetryData);
      return [];
    }
    
    return telemetryData.filter(item => {
      if (!item) return false;
      
      const matchesSearch = searchTerm === '' || 
        (item.packet_id && item.packet_id.toString().includes(searchTerm)) ||
        (item.subsystem_id && item.subsystem_id.toString().includes(searchTerm));
      
      return matchesSearch;
    });
  }, [telemetryData, searchTerm]);

  const filteredAnomalies = useMemo(() => {
    if (!Array.isArray(anomalies)) {
      console.warn('Anomalies data is not an array:', anomalies);
      return [];
    }
    
    return anomalies.filter(anomaly => {
      if (!anomaly) return false;
      
      const matchesType = selectedAnomalyType === '' || anomaly.anomaly_type === selectedAnomalyType;
      return matchesType;
    });
  }, [anomalies, selectedAnomalyType]);


  const columns = useMemo(() => [
    {
      Header: 'Timestamp',
      accessor: 'timestamp',
      Cell: ({ value }) => format(new Date(value), 'yyyy-MM-dd HH:mm:ss'),
    },
    {
      Header: 'Packet ID',
      accessor: 'packet_id',
    },
    {
      Header: 'Temperature (°C)',
      accessor: 'temperature',
      Cell: ({ value }) => value.toFixed(2),
    },
    {
      Header: 'Battery (%)',
      accessor: 'battery',
      Cell: ({ value }) => value.toFixed(1),
    },
    {
      Header: 'Altitude (km)',
      accessor: 'altitude',
      Cell: ({ value }) => value.toFixed(1),
    },
    {
      Header: 'Signal (dB)',
      accessor: 'signal_strength',
      Cell: ({ value }) => value.toFixed(1),
    },
    {
      Header: 'Anomaly',
      accessor: 'is_anomaly',
      Cell: ({ value }) => value ? '🚨 Yes' : '✅ No',
    },
  ], []);


  const formatTelemetryData = (data) => {
    if (!Array.isArray(data)) return [];
    
    return data.map(item => {
      if (!item || !item.timestamp) return null;
      
      try {
        return {
          ...item,
          timestamp: format(new Date(item.timestamp), 'HH:mm:ss'),
        };
      } catch (error) {
        console.warn('Error formatting telemetry data item:', error, item);
        return null;
      }
    }).filter(Boolean); 
  };

  const formatAggregationData = (data) => {
    if (!Array.isArray(data)) return [];
    
    return data.map(item => {
      if (!item || !item.bucket) return null;
      
      try {
        return {
          ...item,
          bucket: format(new Date(item.bucket), 'MM/dd HH:mm'),
        };
      } catch (error) {
        console.warn('Error formatting aggregation data item:', error, item);
        return null;
      }
    }).filter(Boolean); 
  };


  const getStatusClass = (status) => {
    switch (status) {
      case 'NORMAL':
        return 'status-normal';
      case 'WARNING':
        return 'status-warning';
      case 'ANOMALY':
        return 'status-anomaly';
      default:
        return '';
    }
  };

  const getMetricClass = (value, min, max) => {
    if (value < min || value > max) return 'alert';
    if (value < min * 1.1 || value > max * 0.9) return 'warning';
    return 'success';
  };


  const exportData = (data, filename) => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      Object.keys(data[0]).join(",") + "\n" +
      data.map(row => Object.values(row).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Data exported to ${filename}`);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <FontAwesomeIcon icon={faRotate} className="pulse" />
          Loading telemetry dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
      
      <div className="header">
        <h1>
          <FontAwesomeIcon icon={faSatellite} size="2x" style={{ marginRight: '12px' }} />
          Satellite Telemetry Dashboard
        </h1>
        <div className="header-controls">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? <FontAwesomeIcon icon={faMoon} /> : <FontAwesomeIcon icon={faSun} />}
          </button>
          <button className="btn btn-secondary" onClick={() => {
            refetchStatus();
            toast.success('Data refreshed', {
              icon: <FontAwesomeIcon icon={faCheckCircle} style={{ color: 'var(--success-color)' }} />
            });
          }}>
            <FontAwesomeIcon icon={faRotate} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error">
          <FontAwesomeIcon icon={faCircleXmark} />
          {error}
        </div>
      )}


      {currentStatus && currentStatus.latest_telemetry && (
        <div className="dashboard-grid">
          <div className="card fade-in">
            <h3>
              <FontAwesomeIcon icon={faChartLine} />
              Current Status
            </h3>
            <div className={`metric ${getStatusClass(currentStatus.status)}`}>
              <span className="metric-label">Status:</span>
              <span className="metric-value">{currentStatus.status || 'Unknown'}</span>
            </div>
            <div className="metric">
              <span className="metric-label">
                <FontAwesomeIcon icon={faTemperatureHalf} />
                Temperature:
              </span>
              <span className={`metric-value ${getMetricClass(currentStatus.latest_telemetry.temperature || 0, 20, 35)}`}>
                {(currentStatus.latest_telemetry.temperature || 0).toFixed(2)}°C
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">
                <FontAwesomeIcon icon={faBatteryThreeQuarters} />
                Battery:
              </span>
              <span className={`metric-value ${getMetricClass(currentStatus.latest_telemetry.battery || 0, 40, 100)}`}>
                {(currentStatus.latest_telemetry.battery || 0).toFixed(1)}%
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">
                <FontAwesomeIcon icon={faLocationArrow} />
                Altitude:
              </span>
              <span className={`metric-value ${getMetricClass(currentStatus.latest_telemetry.altitude || 0, 400, 1000)}`}>
                {(currentStatus.latest_telemetry.altitude || 0).toFixed(1)} km
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">
                <FontAwesomeIcon icon={faWifi} />
                Signal Strength:
              </span>
              <span className={`metric-value ${getMetricClass(currentStatus.latest_telemetry.signal_strength || 0, -80, -20)}`}>
                {(currentStatus.latest_telemetry.signal_strength || 0).toFixed(1)} dB
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Anomalies (24h):</span>
              <span className="metric-value">{currentStatus.anomaly_count || 0}</span>
            </div>
            <div className="metric">
              <span className="metric-label">
                <FontAwesomeIcon icon={faClock} />
                Last Update:
              </span>
              <span className="metric-value">
                {currentStatus.last_update ? format(new Date(currentStatus.last_update), 'HH:mm:ss') : 'Unknown'}
              </span>
            </div>
          </div>

          <div className="card fade-in">
            <h3>
              <FontAwesomeIcon icon={faGear} />
              Controls
            </h3>
            <div className="controls">
              <div className="control-group">
                <label>Auto Refresh:</label>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              </div>
              <div className="control-group">
                <label>Show Table:</label>
                <input
                  type="checkbox"
                  checked={showTable}
                  onChange={(e) => setShowTable(e.target.checked)}
                />
              </div>
              <button className="btn" onClick={() => {
                refetchStatus();
                toast.success('Data refreshed', {
                  icon: <FontAwesomeIcon icon={faCheckCircle} style={{ color: 'var(--success-color)' }} />
                });
              }}>
                <FontAwesomeIcon icon={faRotate} />
                Refresh Now
              </button>
              <button className="btn btn-secondary" onClick={() => exportData(telemetryData, 'telemetry_data.csv')}>
                <FontAwesomeIcon icon={faDownload} />
                Export Data
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="filters fade-in">
        <h3>
          <FontAwesomeIcon icon={faFilter} />
          Data Filters
        </h3>
        <div className="filter-row">
          <div className="filter-group">
            <label>Start Date:</label>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              showTimeSelect
              dateFormat="yyyy-MM-dd HH:mm"
              placeholderText="Select start date"
            />
          </div>
          <div className="filter-group">
            <label>End Date:</label>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              showTimeSelect
              dateFormat="yyyy-MM-dd HH:mm"
              placeholderText="Select end date"
            />
          </div>
          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search by packet ID or subsystem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Anomaly Type:</label>
            <select
              value={selectedAnomalyType}
              onChange={(e) => setSelectedAnomalyType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="HIGH_TEMPERATURE">High Temperature</option>
              <option value="LOW_TEMPERATURE">Low Temperature</option>
              <option value="LOW_BATTERY">Low Battery</option>
              <option value="LOW_ALTITUDE">Low Altitude</option>
              <option value="WEAK_SIGNAL">Weak Signal</option>
            </select>
          </div>
          <button className="btn" onClick={() => {
            setStartDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
            setEndDate(new Date());
            setSearchTerm('');
            setSelectedAnomalyType('');
          }}>
            <FontAwesomeIcon icon={faClock} />
            Last 24 Hours
          </button>
        </div>
      </div>

 
      {telemetryData.length > 0 && (
        <div className="chart-container fade-in">
          <h3>
            <FontAwesomeIcon icon={faChartLine} />
            Telemetry Over Time
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={formatTelemetryData(telemetryData.slice(0, 50))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="temperature" stroke="#8884d8" name="Temperature (°C)" />
              <Line type="monotone" dataKey="battery" stroke="#82ca9d" name="Battery (%)" />
              <Line type="monotone" dataKey="altitude" stroke="#ffc658" name="Altitude (km)" />
              <Line type="monotone" dataKey="signal_strength" stroke="#ff7300" name="Signal (dB)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

  
      <div style={{ margin: '1em 0' }}>
        <label htmlFor="bucket-size" style={{ marginRight: '0.5em' }}>Aggregation Interval:</label>
        <select
          id="bucket-size"
          value={bucketSize}
          onChange={e => setBucketSize(e.target.value)}
        >
          <option value="1 hour">1 hour</option>
          <option value="10 minutes">10 minutes</option>
          <option value="5 minutes">5 minutes</option>
          <option value="1 minute">1 minute</option>
        </select>
      </div>

      {aggregations.length > 0 && (
        <div className="chart-container fade-in">
          <h3>
            <FontAwesomeIcon icon={faChartColumn} />
            Hourly Aggregations (Average)
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={formatAggregationData(aggregations.slice(0, 24))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avg_temperature" fill="#8884d8" name="Avg Temperature (°C)" />
              <Bar dataKey="avg_battery" fill="#82ca9d" name="Avg Battery (%)" />
              <Bar dataKey="avg_altitude" fill="#ffc658" name="Avg Altitude (km)" />
              <Bar dataKey="avg_signal_strength" fill="#ff7300" name="Avg Signal (dB)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {minAggregations.length > 0 && (
        <div className="chart-container fade-in">
          <h3>
            <FontAwesomeIcon icon={faChartColumn} />
            Hourly Aggregations (Minimum)
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={formatAggregationData(minAggregations.slice(0, 24))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="min_temperature" fill="#8884d8" name="Min Temperature (°C)" />
              <Bar dataKey="min_battery" fill="#82ca9d" name="Min Battery (%)" />
              <Bar dataKey="min_altitude" fill="#ffc658" name="Min Altitude (km)" />
              <Bar dataKey="min_signal_strength" fill="#ff7300" name="Min Signal (dB)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {maxAggregations.length > 0 && (
        <div className="chart-container fade-in">
          <h3>
            <FontAwesomeIcon icon={faChartColumn} />
            Hourly Aggregations (Maximum)
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={formatAggregationData(maxAggregations.slice(0, 24))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="max_temperature" fill="#8884d8" name="Max Temperature (°C)" />
              <Bar dataKey="max_battery" fill="#82ca9d" name="Max Battery (%)" />
              <Bar dataKey="max_altitude" fill="#ffc658" name="Max Altitude (km)" />
              <Bar dataKey="max_signal_strength" fill="#ff7300" name="Max Signal (dB)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}


      {showTable && filteredTelemetryData.length > 0 && (
        <div className="chart-container fade-in">
          <h3>
            <FontAwesomeIcon icon={faEye} />
            Telemetry Data Table
          </h3>
          <TelemetryTable data={filteredTelemetryData} columns={columns} />
        </div>
      )}


      {filteredAnomalies.length > 0 && (
        <div className="chart-container fade-in">
          <h3>
            <FontAwesomeIcon icon={faTriangleExclamation} />
            Recent Anomalies ({filteredAnomalies.length})
          </h3>
          <div className="anomaly-list">
            {filteredAnomalies.slice(0, 10).map((anomaly) => (
              <div key={anomaly.id} className="anomaly-item">
                <h4>
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  {anomaly.anomaly_type}
                </h4>
                <div className="anomaly-details">
                  <div>
                    <strong>Parameter:</strong> {anomaly.parameter_name}
                  </div>
                  <div>
                    <strong>Value:</strong> {anomaly.parameter_value.toFixed(2)}
                  </div>
                  <div>
                    <strong>Threshold:</strong> {anomaly.threshold_value.toFixed(2)}
                  </div>
                  <div>
                    <strong>Time:</strong> {format(new Date(anomaly.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </div>
                  <div>
                    <strong>Severity:</strong> {anomaly.severity || 'Medium'}
                  </div>
                  <div>
                    <strong>Acknowledged:</strong> {anomaly.acknowledged ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredAnomalies.length === 0 && (
        <div className="chart-container fade-in">
          <h3>
            <FontAwesomeIcon icon={faCircleCheck} />
            Recent Anomalies
          </h3>
          <div className="loading">
            <FontAwesomeIcon icon={faCircleInfo} />
            No anomalies found in the selected time range.
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 