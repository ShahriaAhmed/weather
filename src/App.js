import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";

// Register the required components from Chart.js
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

export default function WeatherDashboard() {
  const [data, setData] = useState([]);
  const [expandedCity, setExpandedCity] = useState(null);
  const [hourlyData, setHourlyData] = useState({});
  const [actualHourlyData, setActualHourlyData] = useState({});
  const [minuteData, setMinuteData] = useState({});
  const [loading, setLoading] = useState(true);

  const stations = [
    { id: "KNYC", name: "New York City" },
    { id: "KPHL", name: "Philadelphia" },
    { id: "KMDW", name: "Chicago Midway" },
    { id: "KDEN", name: "Denver" },
    { id: "KAUS", name: "Austin" },
    { id: "KLAX", name: "Los Angeles" },
    { id: "KMIA", name: "Miami" }
  ];

  useEffect(() => {
    async function fetchWeather() {
      setLoading(true);
      const results = await Promise.all(
        stations.map(async (station) => {
          try {
            // Fetch latest observation to get current temperature and coordinates
            const obsRes = await fetch(`https://api.weather.gov/stations/${station.id}/observations/latest`, {
              headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
            });
            const obsData = await obsRes.json();
            const temp = obsData.properties.temperature.value;
            const coords = obsData.geometry.coordinates;

            // Fetch historical observations for today's record high
            const obsHistoryRes = await fetch(`https://api.weather.gov/stations/${station.id}/observations?limit=100`, {
              headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
            });
            const obsHistoryData = await obsHistoryRes.json();

            const todayStr = new Date().toDateString();
            let recordHigh = null;
            obsHistoryData.features.forEach((obs) => {
              const obsTime = new Date(obs.properties.timestamp).toDateString();
              // Check if the observation is from today and has a valid temperature
              if (obsTime === todayStr && obs.properties.temperature.value !== null) {
                const obsF = (obs.properties.temperature.value * 9) / 5 + 32;
                recordHigh = Math.max(recordHigh || -Infinity, obsF);
              }
            });

            // Fetch forecast to get the expected high temperature for the day
            const pointRes = await fetch(`https://api.weather.gov/points/${coords[1]},${coords[0]}`, {
              headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
            });
            const pointData = await pointRes.json();

            const forecastRes = await fetch(pointData.properties.forecast, {
              headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
            });
            const forecastData = await forecastRes.json();

            let todayHigh = null;
            const today = new Date().toDateString();
            forecastData.properties.periods.forEach((period) => {
              if (period.isDaytime && new Date(period.startTime).toDateString() === today) {
                todayHigh = Math.max(todayHigh || -Infinity, period.temperature);
              }
            });

            return {
              id: station.id,
              name: station.name,
              coords: coords,
              currentTemp: temp !== null ? (temp * 9) / 5 + 32 : "N/A",
              expectedHigh: todayHigh !== null ? todayHigh : "N/A",
              recordHigh: recordHigh !== null ? recordHigh : "N/A",
            };
          } catch (e) {
            console.error(`Error fetching data for ${station.name}:`, e);
            return {
              id: station.id,
              name: station.name,
              currentTemp: "Error",
              expectedHigh: "Error",
              recordHigh: "Error"
            };
          }
        })
      );
      setData(results);
      setLoading(false);
    }
    fetchWeather();
  }, []);

  const toggleCity = async (cityId, coords) => {
    if (expandedCity === cityId) {
      setExpandedCity(null);
      return;
    }

    setExpandedCity(cityId);
    if (!coords) return;

    try {
      // Fetch data for the hourly forecast chart
      const pointRes = await fetch(`https://api.weather.gov/points/${coords[1]},${coords[0]}`, {
        headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
      });
      const pointData = await pointRes.json();
      const forecastHourlyRes = await fetch(pointData.properties.forecastHourly, {
        headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
      });
      const forecastHourlyData = await forecastHourlyRes.json();
      const hours = forecastHourlyData.properties.periods.slice(0, 12).map((p) => ({
        time: new Date(p.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        temp: p.temperature
      }));
      setHourlyData((prev) => ({ ...prev, [cityId]: hours }));


      // Fetch actual hourly observations for the chart comparison
      const actualObsRes = await fetch(`https://api.weather.gov/stations/${cityId}/observations?limit=24`, {
        headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
      });
      const actualObsData = await actualObsRes.json();
      const actualHours = actualObsData.features.map((obs) => ({
        time: new Date(obs.properties.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        temp: obs.properties.temperature.value !== null ? (obs.properties.temperature.value * 9) / 5 + 32 : null
      })).filter(obs => obs.temp !== null).reverse(); // Filter out nulls and reverse for chronological order
      setActualHourlyData((prev) => ({ ...prev, [cityId]: actualHours }));


      // Fetch the last 5 observations for the small table
      const minuteObsRes = await fetch(`https://api.weather.gov/stations/${cityId}/observations?limit=5`, {
        headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
      });
      const minuteObsData = await minuteObsRes.json();
      const minutes = minuteObsData.features.map((obs) => ({
        time: new Date(obs.properties.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        temp: obs.properties.temperature.value !== null ? (obs.properties.temperature.value * 9) / 5 + 32 : 'N/A'
      }));
      setMinuteData((prev) => ({ ...prev, [cityId]: minutes }));


    } catch (err) {
      console.error(`Error fetching data for ${cityId}:`, err);
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true, // Show the legend
        labels: {
          color: "white",
        },
      },
    },
    scales: {
      x: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } },
      y: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } }
    }
  };

  if (loading) return <div className="weather-container">Loading weather data...</div>;

  return (
    <>
      <style>
        {`
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen",
              "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue",
              sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          code {
            font-family: source-code-pro, Menlo, Monaco, Consolas, "Courier New",
              monospace;
          }

          .weather-container {
            padding: 20px;
            background-color: #1a202c;
            color: #fff;
            font-family: sans-serif;
            min-height: 100vh;
          }

          .dashboard-title {
            font-size: 1.5rem;
            font-weight: bold;
            margin-bottom: 24px;
            text-align: center;
          }

          .weather-card {
            background-color: #2d3748;
            border-radius: 0.75rem;
            padding: 1rem;
            margin-bottom: 1rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            transition: all 0.3s ease-in-out;
          }

          .card-summary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            flex-wrap: wrap; /* Allow summary text to wrap on smaller screens */
          }

          .city-title {
            font-weight: 600;
            font-size: 1.125rem;
            transition: color 0.3s;
            color: white;
            min-width: 150px;
          }

          .city-title.highlight {
            color: #f6e05e;
          }

          .summary-text {
            color: #a0aec0;
            font-size: 0.875rem;
            text-align: right;
          }

          .expanded-content {
            margin-top: 0.25rem;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }

          .forecast-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
          }

          .forecast-table thead {
            border-bottom: 2px solid #4a5568;
          }

          .table-header,
          .table-cell {
            text-align: left;
            padding: 0.5rem;
          }
          
          .table-cell.time {
            white-space: nowrap;
          }

          .forecast-table tbody tr {
            border-bottom: 1px solid #4a5568;
          }

          .forecast-table tbody tr:last-child {
            border-bottom: none;
          }

          .chart-and-observations-container {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }

          .chart-container {
            width: 100%;
          }

          .small-table {
            width: 100%;
            background-color: #4a5568;
            border-radius: 0.5rem;
            padding: 0.5rem;
            font-size: 0.75rem;
          }

          .small-table h3 {
            font-size: 0.875rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
          }

          .small-table table {
            width: 100%;
            border-collapse: collapse;
          }

          .small-table thead tr th {
            text-align: left;
            padding: 0.25rem 0.25rem;
            border-bottom: 1px solid #718096;
          }

          .small-table tbody tr {
            border-bottom: 1px solid #4a5568;
          }

          .small-table tbody tr:last-child {
            border-bottom: none;
          }

          .small-table td {
            padding: 0.25rem;
          }

          .record-high {
            color: #ef4444; /* A shade of red */
            font-weight: bold;
          }

          @media (min-width: 768px) {
            .expanded-content {
              flex-direction: row;
              align-items: flex-start;
              justify-content: space-between;
              gap: 0.5rem;
            }
            .forecast-table {
              width: calc(35% - 0.5rem);
            }
            .chart-and-observations-container {
              width: calc(65% - 0.5rem);
            }
          }
        `}
      </style>
      <div className="weather-container">
        <h1 className="dashboard-title">Weather Dashboard</h1>
        {data.map((item) => (
          <div key={item.id} className="weather-card">
            <div className="card-summary" onClick={() => toggleCity(item.id, item.coords)}>
              <h2 className={`city-title ${expandedCity === item.id ? 'highlight' : ''}`}>
                {item.name} ({item.id})
              </h2>
              <span className="summary-text">
                <strong>Current: {typeof item.currentTemp === "number" ? `${item.currentTemp.toFixed(1)}°F` : item.currentTemp} | High: {typeof item.expectedHigh === "number" ? `${item.expectedHigh.toFixed(1)}°F` : item.expectedHigh}</strong>
                {" | "}
                <strong className="record-high">
                  Record High: {typeof item.recordHigh === "number" ? `${item.recordHigh.toFixed(1)}°F` : item.recordHigh}
                </strong>
              </span>
            </div>

            {expandedCity === item.id && hourlyData[item.id] && actualHourlyData[item.id] && (
              <div className="expanded-content">
                <div className="forecast-table">
                  <table>
                    <thead>
                      <tr>
                        <th className="table-header">Time</th>
                        <th className="table-header">Forecast (°F)</th>
                        <th className="table-header">Actual (°F)</th>
                        <th className="table-header">Projected High (°F)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hourlyData[item.id].map((h, idx) => (
                        <tr key={idx}>
                          <td className="table-cell time">{h.time}</td>
                          <td className="table-cell">{h.temp}</td>
                          <td className="table-cell">
                            {/* Display the corresponding actual temp if available */}
                            {actualHourlyData[item.id].find(a => a.time === h.time)?.temp?.toFixed(1) || 'N/A'}
                          </td>
                          <td className="table-cell">
                            {typeof item.expectedHigh === "number" ? `${item.expectedHigh.toFixed(1)}` : item.expectedHigh}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="chart-and-observations-container">
                  <div className="chart-container" style={{ height: "400px" }}>
                    <Line
                      data={{
                        labels: hourlyData[item.id].map((h) => h.time).reverse(),
                        datasets: [
                          {
                            label: "Forecast Temperature (°F)",
                            data: hourlyData[item.id].map((h) => h.temp).reverse(),
                            borderColor: "rgba(255, 255, 0, 0.8)",
                            backgroundColor: "rgba(255, 255, 0, 0.1)",
                            tension: 0.1,
                            pointBackgroundColor: "white"
                          },
                          {
                            label: "Actual Temperature (°F)",
                            data: actualHourlyData[item.id].map((a) => a.temp).reverse(),
                            borderColor: "rgba(75,192,192,1)",
                            backgroundColor: "rgba(75,192,192,0.1)",
                            tension: 0.1,
                            pointBackgroundColor: "white"
                          }
                        ]
                      }}
                      options={chartOptions}
                    />
                  </div>

                  {minuteData[item.id] && (
                    <div className="small-table">
                      <h3>Last 5 Observations</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Temp (°F)</th>
                            <th>Projected High (°F)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {minuteData[item.id].map((m, idx) => (
                            <tr key={idx}>
                              <td>{m.time}</td>
                              <td>{typeof m.temp === 'number' ? m.temp.toFixed(1) : m.temp}</td>
                              <td>
                                {typeof item.expectedHigh === "number" ? `${item.expectedHigh.toFixed(1)}` : item.expectedHigh}
                              </td>
                          </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
