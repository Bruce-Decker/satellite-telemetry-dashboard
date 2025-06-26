import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { format } from "date-fns";
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
} from "recharts";
import DatePicker from "react-datepicker";
import {
  useTable,
  useFilters,
  useSortBy,
  usePagination,
} from "react-table";
import { ToastContainer, toast } from "react-toastify";
import "react-datepicker/dist/react-datepicker.css";
import "react-toastify/dist/ReactToastify.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";


const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8080";

const useTheme = () => {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () =>
      setTheme((prev) => (prev === "light" ? "dark" : "light")),
  };
};

const useRealTimeData = (fetchFn, interval = 5000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const getData = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      setData(await fetchFn());
    } catch (e) {
      setErr(e.message);
      toast.error(`Failed to fetch data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    getData();
    if (interval == null) return;              
    const id = setInterval(getData, interval);
    return () => clearInterval(id);
  }, [getData, interval]);

  return { data, loading, err, refetch: getData };
};


const getStatusClass = (s) =>
  ({ NORMAL: "status-normal", WARNING: "status-warning", ANOMALY: "status-anomaly" }[s] || "");

const getMetricClass = (v, min, max) =>
  v < min || v > max
    ? "alert"
    : v < min * 1.1 || v > max * 0.9
    ? "warning"
    : "success";

const formatTelemetryData = (arr) =>
  Array.isArray(arr)
    ? arr
        .map((d) =>
          d && d.timestamp
            ? { ...d, timestamp: format(new Date(d.timestamp), "HH:mm:ss") }
            : null
        )
        .filter(Boolean)
    : [];

const formatAggregationData = (arr) =>
  Array.isArray(arr)
    ? arr
        .map((d) =>
          d && d.bucket
            ? { ...d, bucket: format(new Date(d.bucket), "MM/dd HH:mm") }
            : null
        )
        .filter(Boolean)
    : [];

const exportCsv = (rows, file) => {
  if (!rows?.length) return;
  const csv =
    "data:text/csv;charset=utf-8," +
    Object.keys(rows[0]).join(",") +
    "\n" +
    rows.map((r) => Object.values(r).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: encodeURI(csv),
    download: file,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast.success(`Data exported to ${file}`);
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
    { columns, data, initialState: { pageIndex: 0, pageSize: 10 } },
    useFilters,
    useSortBy,
    usePagination
  );

  return (
    <div className="table-container">
      <table {...getTableProps()} className="telemetry-table">
        <thead>
          {headerGroups.map((hg) => (
            <tr {...hg.getHeaderGroupProps()}>
              {hg.headers.map((col) => (
                <th {...col.getHeaderProps(col.getSortByToggleProps())}>
                  {col.render("Header")}
                  {col.isSorted ? (col.isSortedDesc ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {page.map((row) => {
            prepareRow(row);
            return (
              <tr {...row.getRowProps()}>
                {row.cells.map((c) => (
                  <td {...c.getCellProps()}>{c.render("Cell")}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="pagination">
        <button onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
          {"<<"}
        </button>
        <button onClick={previousPage} disabled={!canPreviousPage}>
          {"<"}
        </button>
        <button onClick={nextPage} disabled={!canNextPage}>
          {">"}
        </button>
        <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
          {">>"}
        </button>
        <span>
          Page <strong>{pageIndex + 1} of {pageOptions.length}</strong>
        </span>
        <span>
          | Go to page:{" "}
          <input
            type="number"
            defaultValue={pageIndex + 1}
            onChange={(e) =>
              gotoPage(e.target.value ? Number(e.target.value) - 1 : 0)
            }
            style={{ width: 50 }}
          />
        </span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          {[10, 20, 30, 40, 50].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>
    </div>
  );
};



export default function App() {

  const { theme, toggleTheme } = useTheme();
  const [startDate, setStartDate] = useState(
    () => new Date(Date.now() - 24 * 60 * 60 * 1_000)
  );
  const [endDate, setEndDate] = useState(() => new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [bucketSize, setBucketSize] = useState("1 hour");
  const [selectedAnomalyType, setSelectedAnomalyType] = useState("");
  const [showTable, setShowTable] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const anomaliesPerPage = 10;
  const [anomalyPage, setAnomalyPage] = useState(0);


  const [currentStatus, setCurrentStatus] = useState(null);
  const [telemetryData, setTelemetryData] = useState([]);
  const [aggregations, setAggregations] = useState([]);
  const [minAggregations, setMinAggregations] = useState([]);
  const [maxAggregations, setMaxAggregations] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  const filteredTelemetryData = useMemo(() => {
    if (!Array.isArray(telemetryData)) return [];
    return telemetryData.filter((d) => {
      if (!d) return false;
      if (!searchTerm) return true;
      return (
        (d.packet_id && d.packet_id.toString().includes(searchTerm)) ||
        (d.subsystem_id && d.subsystem_id.toString().includes(searchTerm))
      );
    });
  }, [telemetryData, searchTerm]);

  const columns = useMemo(
    () => [
      {
        Header: "Timestamp",
        accessor: "timestamp",
        Cell: ({ value }) =>
          format(new Date(value), "yyyy-MM-dd HH:mm:ss"),
      },
      { Header: "Packet ID", accessor: "packet_id" },
      {
        Header: "Temperature (°C)",
        accessor: "temperature",
        Cell: ({ value }) => value.toFixed(2),
      },
      {
        Header: "Battery (%)",
        accessor: "battery",
        Cell: ({ value }) => value.toFixed(1),
      },
      {
        Header: "Altitude (km)",
        accessor: "altitude",
        Cell: ({ value }) => value.toFixed(1),
      },
      {
        Header: "Signal (dB)",
        accessor: "signal_strength",
        Cell: ({ value }) => value.toFixed(1),
      },
      {
        Header: "Anomaly",
        accessor: "is_anomaly",
        Cell: ({ value }) => (value ? "🚨 Yes" : "✅ No"),
      },
    ],
    []
  );

  const filteredAnomalies = useMemo(() => {
    if (!Array.isArray(anomalies)) return [];
    return anomalies.filter(
      a =>
        a &&
        (selectedAnomalyType === "" || a.anomaly_type === selectedAnomalyType)
    );
  }, [anomalies, selectedAnomalyType]);

  const totalAnomalyPages = useMemo(
    () => Math.ceil(filteredAnomalies.length / anomaliesPerPage),
    [filteredAnomalies, anomaliesPerPage]
  );


  const fetchCurrentStatus = useCallback(async () => {
    const { data } = await axios.get(
      `${API_BASE_URL}/api/v1/telemetry/current`
    );
    return data;
  }, []);

  const fetchTelemetryData = useCallback(async () => {
    const { data } = await axios.get(`${API_BASE_URL}/api/v1/telemetry`, {
      params: {
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        limit: 1_000,
      },
    });
    return data;
  }, [startDate, endDate]);

  const fetchAggregations = useCallback(async (suffix = "") => {
    const { data } = await axios.get(
      `${API_BASE_URL}/api/v1/telemetry/aggregations${suffix}`,
      {
        params: {
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          bucket_size: bucketSize,
        },
      }
    );
    return data;
  }, [startDate, endDate, bucketSize]);

  const fetchAnomalies = useCallback(async () => {
    const { data } = await axios.get(
      `${API_BASE_URL}/api/v1/telemetry/anomalies`,
      {
        params: {
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          limit: 100,
        },
      }
    );
    return data;
  }, [startDate, endDate]);


  const { data: liveStatus, refetch: refetchStatus } = useRealTimeData(
    fetchCurrentStatus,
    autoRefresh ? 5_000 : null
  );


  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          status,
          telemetry,
          aggs,
          mins,
          maxs,
          anomalyList,
        ] = await Promise.all([
          fetchCurrentStatus(),
          fetchTelemetryData(),
          fetchAggregations(""),
          fetchAggregations("/min"),
          fetchAggregations("/max"),
          fetchAnomalies(),
        ]);

        setCurrentStatus(status);
        setTelemetryData(Array.isArray(telemetry) ? telemetry : []);
        setAggregations(Array.isArray(aggs) ? aggs : []);
        setMinAggregations(Array.isArray(mins) ? mins : []);
        setMaxAggregations(Array.isArray(maxs) ? maxs : []);
        setAnomalies(Array.isArray(anomalyList) ? anomalyList : []);
      } catch (e) {
        setError(e.message);
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [
    startDate,
    endDate,
    bucketSize,
    fetchCurrentStatus,
    fetchTelemetryData,
    fetchAggregations,
    fetchAnomalies,
  ]);


  useEffect(() => {
    if (liveStatus) setCurrentStatus(liveStatus);
  }, [liveStatus]);


  useEffect(() => {
    const fresh = anomalies.filter(
      (a) =>
        a &&
        a.timestamp &&
        new Date(a.timestamp) > new Date(Date.now() - 60_000)
    );

    fresh.forEach((a) => {
      const note = {
        id: Date.now() + Math.random(),
        title: `Anomaly: ${a.anomaly_type}`,
        msg: `${a.parameter_name}: ${a.parameter_value.toFixed(
          2
        )} (Thr: ${a.threshold_value.toFixed(2)})`,
      };
      setNotifications((p) => [...p, note]);
      toast.error(note.msg, { icon: "🚨", duration: 5_000 });
    });
  }, [anomalies]);

 
  useEffect(() => setAnomalyPage(0), [filteredAnomalies]);



  if (loading)
    return (
      <div className="container">
        <div className="loading">
          <FontAwesomeIcon icon={faRotate} className="pulse" />
          Loading telemetry dashboard…
        </div>
      </div>
    );

  const BAR_COLORS = {
    temperature: "#8884d8",       // purple
    battery: "#82ca9d",           // green
    altitude: "#ffc658",          // amber
    signal_strength: "#ff7300",   // orange
  };

  return (
    <div className="container">
      <ToastContainer position="top-right" autoClose={3_000} />


      <header className="header">
        <h1>
          <FontAwesomeIcon icon={faSatellite} size="2x" /> Satellite Telemetry
          Dashboard
        </h1>
        <div className="header-controls">
          <button className="theme-toggle" onClick={toggleTheme}>
            <FontAwesomeIcon icon={theme === "light" ? faMoon : faSun} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              refetchStatus();
              toast.success("Data refreshed", {
                icon: (
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    style={{ color: "var(--success-color)" }}
                  />
                ),
              });
            }}
          >
            <FontAwesomeIcon icon={faRotate} /> Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="error">
          <FontAwesomeIcon icon={faCircleXmark} /> {error}
        </div>
      )}


      {currentStatus?.latest_telemetry && (
        <div className="dashboard-grid">

          <div className="card fade-in">
            <h3>
              <FontAwesomeIcon icon={faChartLine} /> Current Status
            </h3>

            <div className={`metric ${getStatusClass(currentStatus.status)}`}>
              <span className="metric-label">Status:</span>
              <span className="metric-value">
                {currentStatus.status ?? "Unknown"}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">
                <FontAwesomeIcon icon={faTemperatureHalf} /> Temperature:
              </span>
              <span
                className={`metric-value ${getMetricClass(
                  currentStatus.latest_telemetry.temperature ?? 0,
                  20,
                  35
                )}`}
              >
                {(currentStatus.latest_telemetry.temperature ?? 0).toFixed(2)}°
                C
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">
                <FontAwesomeIcon icon={faBatteryThreeQuarters} /> Battery:
              </span>
              <span
                className={`metric-value ${getMetricClass(
                  currentStatus.latest_telemetry.battery ?? 0,
                  40,
                  100
                )}`}
              >
                {(currentStatus.latest_telemetry.battery ?? 0).toFixed(1)}%
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">
                <FontAwesomeIcon icon={faLocationArrow} /> Altitude:
              </span>
              <span
                className={`metric-value ${getMetricClass(
                  currentStatus.latest_telemetry.altitude ?? 0,
                  400,
                  1000
                )}`}
              >
                {(currentStatus.latest_telemetry.altitude ?? 0).toFixed(1)} km
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">
                <FontAwesomeIcon icon={faWifi} /> Signal:
              </span>
              <span
                className={`metric-value ${getMetricClass(
                  currentStatus.latest_telemetry.signal_strength ?? 0,
                  -80,
                  -20
                )}`}
              >
                {(currentStatus.latest_telemetry.signal_strength ?? 0).toFixed(
                  1
                )}{" "}
                dB
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">Anomalies (24h):</span>
              <span className="metric-value">
                {currentStatus.anomaly_count ?? 0}
              </span>
            </div>

            <div className="metric">
              <span className="metric-label">
                <FontAwesomeIcon icon={faClock} /> Last Update:
              </span>
              <span className="metric-value">
                {currentStatus.last_update
                  ? format(new Date(currentStatus.last_update), "HH:mm:ss")
                  : "Unknown"}
              </span>
            </div>
          </div>

    
          <div className="card fade-in">
            <h3>
              <FontAwesomeIcon icon={faGear} /> Controls
            </h3>

            <div className="controls">
              <label>
                Auto Refresh:
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              </label>

              <label>
                Show Table:
                <input
                  type="checkbox"
                  checked={showTable}
                  onChange={(e) => setShowTable(e.target.checked)}
                />
              </label>

              <button
                className="btn"
                onClick={() => {
                  refetchStatus();
                  toast.success("Data refreshed", {
                    icon: (
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        style={{ color: "var(--success-color)" }}
                      />
                    ),
                  });
                }}
              >
                <FontAwesomeIcon icon={faRotate} /> Refresh Now
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => exportCsv(telemetryData, "telemetry_data.csv")}
              >
                <FontAwesomeIcon icon={faDownload} /> Export
              </button>
            </div>
          </div>
        </div>
      )}

   
      <section className="filters fade-in">
        <h3>
          <FontAwesomeIcon icon={faFilter} /> Data Filters
        </h3>

        <div className="filter-row">
          <label>
            Start Date:
            <DatePicker
              selected={startDate}
              onChange={setStartDate}
              showTimeSelect
              dateFormat="yyyy-MM-dd HH:mm"
            />
          </label>

          <label>
            End Date:
            <DatePicker
              selected={endDate}
              onChange={setEndDate}
              showTimeSelect
              dateFormat="yyyy-MM-dd HH:mm"
            />
          </label>

          <label>
            Search:
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="packet ID or subsystem…"
            />
          </label>

          <label>
            Anomaly Type:
            <select
              value={selectedAnomalyType}
              onChange={(e) => setSelectedAnomalyType(e.target.value)}
            >
              <option value="">All</option>
              <option value="HIGH_TEMPERATURE">High Temp</option>
              <option value="LOW_TEMPERATURE">Low Temp</option>
              <option value="LOW_BATTERY">Low Battery</option>
              <option value="LOW_ALTITUDE">Low Altitude</option>
              <option value="WEAK_SIGNAL">Weak Signal</option>
            </select>
          </label>

          <button
            className="btn"
            onClick={() => {
              setStartDate(new Date(Date.now() - 24 * 60 * 60 * 1_000));
              setEndDate(new Date());
              setSearchTerm("");
              setSelectedAnomalyType("");
            }}
          >
            <FontAwesomeIcon icon={faClock} /> Last 24 Hours
          </button>
        </div>
      </section>

  
      {!!telemetryData.length && (
        <section className="chart-container fade-in">
          <h3>
            <FontAwesomeIcon icon={faChartLine} /> Telemetry Over Time
          </h3>

          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={formatTelemetryData(telemetryData.slice(0, 50))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />

              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#8884d8"
                name="Temperature (°C)"
              />
              <Line
                type="monotone"
                dataKey="battery"
                stroke="#82ca9d"
                name="Battery (%)"
              />
              <Line
                type="monotone"
                dataKey="altitude"
                stroke="#ffc658"
                name="Altitude (km)"
              />
              <Line
                type="monotone"
                dataKey="signal_strength"
                stroke="#ff7300"
                name="Signal (dB)"
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}


      <div style={{ margin: "1em 0" }}>
        <label htmlFor="bucket-size">Aggregation Interval: </label>
        <select
          id="bucket-size"
          value={bucketSize}
          onChange={(e) => setBucketSize(e.target.value)}
        >
          {["1 hour", "10 minutes", "5 minutes", "1 minute"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>

    
      {[
        { title: "Hourly Avg", prefix: "avg", data: aggregations },
        { title: "Hourly Min", prefix: "min", data: minAggregations },
        { title: "Hourly Max", prefix: "max", data: maxAggregations },
      ].map(
        ({ title, prefix, data }) =>
          !!data.length && (
            <section key={title} className="chart-container fade-in">
              <h3>
                <FontAwesomeIcon icon={faChartColumn} /> {title}
              </h3>

              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={formatAggregationData(data.slice(0, 24))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {[
                    "temperature",
                    "battery",
                    "altitude",
                    "signal_strength",
                  ].map((k) => (
                    <Bar
                      key={k}
                      dataKey={`${prefix}_${k}`}
                      name={`${k.replace("_", " ")} ${k === "altitude" ? "(km)" :
                        k === "signal_strength" ? "(dB)" :
                        k === "battery" ? "(%)" : "(°C)"}`}
                      fill={BAR_COLORS[k]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </section>
          )
      )}


      {showTable && !!filteredTelemetryData.length && (
        <section className="chart-container fade-in">
          <h3>
            <FontAwesomeIcon icon={faEye} /> Telemetry Data Table
          </h3>
          <TelemetryTable data={filteredTelemetryData} columns={columns} />
        </section>
      )}


      <section className="chart-container fade-in">
        <h3>
          {filteredAnomalies.length ? (
            <>
              <FontAwesomeIcon icon={faTriangleExclamation} /> Recent Anomalies
              ({filteredAnomalies.length})
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faCircleCheck} /> Recent Anomalies
            </>
          )}
        </h3>

        {filteredAnomalies.length ? (
          <>
            <div className="anomaly-list">
              {filteredAnomalies
                .slice(
                  anomalyPage * anomaliesPerPage,
                  (anomalyPage + 1) * anomaliesPerPage
                )
                .map((a) => (
                  <div key={a.id} className="anomaly-item">
                    <h4>
                      <FontAwesomeIcon icon={faTriangleExclamation} />{" "}
                      {a.anomaly_type}
                    </h4>
                    <div className="anomaly-details">
                      <div>
                        <strong>Parameter:</strong> {a.parameter_name}
                      </div>
                      <div>
                        <strong>Value:</strong>{" "}
                        {a.parameter_value.toFixed(2)}
                      </div>
                      <div>
                        <strong>Threshold:</strong>{" "}
                        {a.threshold_value.toFixed(2)}
                      </div>
                      <div>
                        <strong>Time:</strong>{" "}
                        {format(new Date(a.timestamp), "yyyy-MM-dd HH:mm:ss")}
                      </div>
                      <div>
                        <strong>Severity:</strong> {a.severity ?? "Medium"}
                      </div>
                      <div>
                        <strong>Acknowledged:</strong>{" "}
                        {a.acknowledged ? "Yes" : "No"}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div
              className="pagination"
              style={{
                marginTop: "1em",
                display: "flex",
                justifyContent: "center",
                gap: "1em",
              }}
            >
              <button
                className="btn"
                onClick={() =>
                  setAnomalyPage((p) => Math.max(0, p - 1))
                }
                disabled={anomalyPage === 0}
              >
                Previous
              </button>
              <span>
                Page {anomalyPage + 1} of {totalAnomalyPages}
              </span>
              <button
                className="btn"
                onClick={() =>
                  setAnomalyPage((p) =>
                    Math.min(totalAnomalyPages - 1, p + 1)
                  )
                }
                disabled={anomalyPage >= totalAnomalyPages - 1}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="loading">
            <FontAwesomeIcon icon={faCircleInfo} /> No anomalies in the
            selected range.
          </div>
        )}
      </section>
    </div>
  );
}
