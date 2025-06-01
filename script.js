document.addEventListener("DOMContentLoaded", () => {
  const apiKey = "0eede11e0c41e92d1b3613cbf7ca8d0c";

  const getWeatherBtn = document.getElementById("getWeatherBtn");
  const cityInput = document.getElementById("cityInput");
  const resultBox = document.getElementById("weatherResult");
  const loading = document.getElementById("loading");
  const unitToggle = document.getElementById("unitToggle");
  const unitLabel = document.getElementById("unitLabel");
  const forecastBox = document.getElementById("forecast");
  const darkModeToggle = document.getElementById("darkModeToggle");
  const alertsBox = document.getElementById("alerts");
  const autoRefreshInput = document.getElementById("autoRefreshInput");
  const downloadPdfBtn = document.getElementById("downloadPdfBtn");

  let useFahrenheit = false;
  let autoRefreshIntervalId = null;

  unitToggle.addEventListener("change", (e) => {
    useFahrenheit = e.target.checked;
    unitLabel.textContent = useFahrenheit ? "Show Celsius" : "Show Fahrenheit";
    const city = cityInput.value.trim();
    if (city) fetchWeather(city);
  });

  darkModeToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  });

  cityInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") getWeatherBtn.click();
  });

  getWeatherBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (!city) {
      showError("Please enter a city name ❗");
      return;
    }
    fetchWeather(city);
  });

  autoRefreshInput.addEventListener("change", () => {
    setupAutoRefresh();
  });

  downloadPdfBtn.addEventListener("click", () => {
    downloadPdfReport();
  });

  // Auto refresh logic
  function setupAutoRefresh() {
    if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);
    const mins = parseInt(autoRefreshInput.value);
    if (isNaN(mins) || mins < 1) {
      showError("Auto-refresh interval must be at least 1 minute.");
      return;
    }
    if (!cityInput.value.trim()) return; // no city, no refresh

    autoRefreshIntervalId = setInterval(() => {
      fetchWeather(cityInput.value.trim());
    }, mins * 60 * 1000);
  }

  function showError(message) {
    alertsBox.textContent = message;
    alertsBox.classList.remove("hidden");
    setTimeout(() => {
      alertsBox.classList.add("hidden");
    }, 6000);
  }

  function fetchWeather(city) {
    loading.classList.remove("hidden");
    alertsBox.classList.add("hidden");
    resultBox.innerHTML = "";
    forecastBox.innerHTML = "";

    const units = useFahrenheit ? "imperial" : "metric";
    const tempUnit = useFahrenheit ? "°F" : "°C";
    const speedUnit = useFahrenheit ? "mph" : "m/s";

    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=${units}`)
      .then(res => res.json())
      .then(data => {
        if (data.cod !== 200) throw new Error(data.message);
        loading.classList.add("hidden");

        const { name, main, weather, wind, sys, coord, timezone } = data;

        // Show alerts if any weather alerts are available (from One Call API)
        fetchWeatherAlerts(coord.lat, coord.lon);

        resultBox.innerHTML = `
          <h2>📍 ${name}, ${sys.country} <img src="https://flagcdn.com/24x18/${sys.country.toLowerCase()}.png" alt="Flag"/></h2>
          <p><strong>Temperature:</strong> ${main.temp} ${tempUnit}</p>
          <p><strong>Feels Like:</strong> ${main.feels_like} ${tempUnit}</p>
          <p><strong>Weather:</strong> ${weather[0].main} - ${weather[0].description}</p>
          <p><img src="https://openweathermap.org/img/wn/${weather[0].icon}@2x.png" alt="${weather[0].description}"/></p>
          <p><strong>Humidity:</strong> ${main.humidity}%</p>
          <p><strong>Wind Speed:</strong> ${wind.speed} ${speedUnit}</p>
          <p><strong>Sunrise:</strong> ${unixToTime(sys.sunrise, timezone)}</p>
          <p><strong>Sunset:</strong> ${unixToTime(sys.sunset, timezone)}</p>
        `;

        fetchForecast(coord.lat, coord.lon, units, tempUnit, speedUnit, timezone);
        setDynamicBackground(weather[0].main);
      })
      .catch(err => {
        loading.classList.add("hidden");
        showError(`Error: ${err.message}`);
      });
  }

  function fetchForecast(lat, lon, units, tempUnit, speedUnit, timezone) {
    // 5 day forecast, every 3 hours data from openweathermap 5-day API
    fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`)
      .then(res => res.json())
      .then(data => {
        if (data.cod !== "200") throw new Error(data.message);

        // Extract daily forecasts at roughly midday (12:00)
        const dailyForecasts = [];
        let lastDate = "";
        data.list.forEach(item => {
          const date = item.dt_txt.split(" ")[0];
          const hour = item.dt_txt.split(" ")[1];
          if (hour === "12:00:00" && date !== lastDate) {
            lastDate = date;
            dailyForecasts.push(item);
          }
        });

        // Show forecast heading
        forecastBox.innerHTML = `<h3>5-Day Forecast</h3>`;

        dailyForecasts.forEach(day => {
          const dateStr = new Date(day.dt * 1000).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric"
          });

          const iconUrl = `https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png`;

          const dayDiv = document.createElement("div");
          dayDiv.classList.add("forecast-day");
          dayDiv.innerHTML = `
            <p><strong>${dateStr}</strong></p>
            <p>${day.weather[0].main} - ${day.weather[0].description}</p>
            <p>Temp: ${day.main.temp} ${tempUnit}</p>
            <p>Humidity: ${day.main.humidity}%</p>
            <p>Wind: ${day.wind.speed} ${speedUnit}</p>
            <img src="${iconUrl}" alt="${day.weather[0].description}" />
          `;
          forecastBox.appendChild(dayDiv);
        });
      })
      .catch(err => {
        // No forecast available
        forecastBox.innerHTML = "";
        console.warn("Forecast error:", err);
      });
  }

  function setDynamicBackground(weatherMain) {
    // Change background gradient based on weather
    let gradient = "linear-gradient(to right, #6dd5fa, #2980b9)"; // default - clear sky

    const weatherToGradient = {
      Clear: "linear-gradient(to right, #56ccf2, #2f80ed)",
      Clouds: "linear-gradient(to right, #757f9a, #d7dde8)",
      Rain: "linear-gradient(to right, #00c6fb, #005bea)",
      Drizzle: "linear-gradient(to right, #89f7fe, #66a6ff)",
      Thunderstorm: "linear-gradient(to right, #373b44, #4286f4)",
      Snow: "linear-gradient(to right, #e6dada, #274046)",
      Mist: "linear-gradient(to right, #606c88, #3f4c6b)",
      Smoke: "linear-gradient(to right, #3e5151, #decba4)",
      Haze: "linear-gradient(to right, #667db6, #0082c8)",
      Dust: "linear-gradient(to right, #ba8b02, #181818)",
      Fog: "linear-gradient(to right, #3e5151, #decba4)",
      Sand: "linear-gradient(to right, #ba8b02, #181818)",
      Ash: "linear-gradient(to right, #434343, #000000)",
      Squall: "linear-gradient(to right, #373b44, #4286f4)",
      Tornado: "linear-gradient(to right, #0f0c29, #302b63)"
    };

    if (weatherToGradient[weatherMain]) {
      gradient = weatherToGradient[weatherMain];
    }

    document.body.style.background = gradient;
  }

  // Convert UNIX timestamp to readable time in HH:MM am/pm format, adjusted for timezone offset
  function unixToTime(unixTimestamp, timezone) {
    const date = new Date((unixTimestamp + timezone) * 1000);
    let hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12; // convert 0 to 12 for 12 AM
    return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  }

  // Fetch weather alerts using One Call API (free tier does not support alerts, but assume alerts)
  // We will check alerts and display if any
  function fetchWeatherAlerts(lat, lon) {
    fetch(`
      https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&exclude=current,minutely,hourly,daily`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.alerts && data.alerts.length > 0) {
          const alertMsgs = data.alerts
            .map(
              (alert) =>
                `<strong>${alert.event}:</strong> ${alert.description}`
            )
            .join("<br><br>");
          alertsBox.innerHTML = alertMsgs;
          alertsBox.classList.remove("hidden");
        } else {
          alertsBox.classList.add("hidden");
          alertsBox.innerHTML = "";
        }
      })
      .catch(() => {
        alertsBox.classList.add("hidden");
        alertsBox.innerHTML = "";
      });
  }

  // Geolocation auto-fetch weather on load
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        fetchCityFromCoords(latitude, longitude);
      },
      (err) => {
        console.warn("Geolocation error:", err);
      },
      { timeout: 10000 }
    );
  }

  function fetchCityFromCoords(lat, lon) {
    fetch(`
      https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data && data.name) {
          cityInput.value = data.name;
          fetchWeather(data.name);
        }
      });
  }

  // PDF generation using jsPDF
  function downloadPdfReport() {
    if (!cityInput.value.trim()) {
      showError("Please get weather data first to download report.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Weather Report", 14, 20);

    // Add city & date
    doc.setFontSize(12);
    const nowStr = new Date().toLocaleString();
    doc.text(`City: ${cityInput.value.trim()}`, 14, 30);
    doc.text(`Date: ${nowStr}`, 14, 38);

    // Weather Result content
    const weatherLines = resultBox.innerText.split("\n");
    let y = 50;
    doc.setFontSize(11);
    weatherLines.forEach(line => {
      if (line.trim()) {
        doc.text(line, 14, y);
        y += 8;
      }
    });

    // Forecast heading
    if (forecastBox.children.length > 0) {
      y += 8;
      doc.setFontSize(14);
      doc.text("5-Day Forecast", 14, y);
      y += 10;

      // Each forecast-day
      const forecastDays = forecastBox.querySelectorAll(".forecast-day");
      forecastDays.forEach(dayDiv => {
        const text = dayDiv.innerText.split("\n").filter(l => l.trim());
        text.forEach(line => {
          doc.setFontSize(11);
          doc.text(line, 14, y);
          y += 7;
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
        });
        y += 6;
      });
    }

    doc.save(`Weather_Report_${cityInput.value.trim().replace(/\s/g, "_")}.pdf`);
  }
});
