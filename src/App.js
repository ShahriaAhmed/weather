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
            const obsRes = await fetch(`https://api.weather.gov/stations/${station.id}/observations/latest`, {
              headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
            });
            const obsData = await obsRes.json();
            const temp = obsData.properties.temperature.value;
            const coords = obsData.geometry.coordinates;

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
              expectedHigh: todayHigh !== null ? todayHigh : "N/A"
            };
          } catch (e) {
            console.error(`Error fetching data for ${station.name}:`, e);
            return {
              id: station.id,
              name: station.name,
              currentTemp: "Error",
              expectedHigh: "Error"
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
      const pointRes = await fetch(`https://api.weather.gov/points/${coords[1]},${coords[0]}`, {
        headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
      });
      const pointData = await pointRes.json();

      const hourlyRes = await fetch(pointData.properties.forecastHourly, {
        headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
      });
      const hourly = await hourlyRes.json();

      const hours = hourly.properties.periods.slice(0, 12).map((p) => ({
        time: new Date(p.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        temp: p.temperature
      }));

      const minuteObsRes = await fetch(`https://api.weather.gov/stations/${cityId}/observations?limit=5`, {
        headers: { "User-Agent": "MyWeatherApp (myemail@example.com)" }
      });
      const minuteObsData = await minuteObsRes.json();
      const minutes = minuteObsData.features.map((obs) => ({
        time: new Date(obs.properties.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        temp: obs.properties.temperature.value !== null ? (obs.properties.temperature.value * 9) / 5 + 32 : 'N/A'
      }));

      setHourlyData((prev) => ({ ...prev, [cityId]: hours }));
      setMinuteData((prev) => ({ ...prev, [cityId]: minutes }));
    } catch (err) {
      console.error(`Error fetching hourly data for ${cityId}:`, err);
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
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
          }

          .city-title {
            font-weight: 600;
            font-size: 1.125rem;
            transition: color 0.3s;
            color: white;
          }

          .city-title.highlight {
            color: #f6e05e;
          }

          .summary-text {
            color: #a0aec0;
            font-size: 0.875rem;
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
              </span>
            </div>

            {expandedCity === item.id && hourlyData[item.id] && (
              <div className="expanded-content">
                <div className="forecast-table">
                  <table>
                    <thead>
                      <tr>
                        <th className="table-header">Time</th>
                        <th className="table-header">Temp (°F)</th>
                        <th className="table-header">Projected High (°F)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hourlyData[item.id].map((h, idx) => (
                        <tr key={idx}>
                          <td className="table-cell time">{h.time}</td>
                          <td className="table-cell">{h.temp}</td>
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
                            label: "Temperature (°F)",
                            data: hourlyData[item.id].map((h) => h.temp).reverse(),
                            borderColor: "rgba(75,192,192,1)",
                            tension: 0.1,
                            pointBackgroundColor: "white"
                          },
                          {
                            label: "Daily High",
                            data: Array(hourlyData[item.id].length).fill(item.expectedHigh).reverse(),
                            borderColor: "rgba(255, 255, 0, 0.8)",
                            borderDash: [5, 5],
                            pointRadius: 0
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
