import {
  LitElement,
  html,
  css
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AemetWeatherCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {},
      _hourlyForecast: { type: Array },
      _dailyForecast: { type: Array }
    };
  }

  constructor() {
    super();
    this._hourlyForecast = [];
    this._dailyForecast = [];
    this._subscribedHourly = false;
    this._subscribedDaily = false;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Debes definir la entidad 'entity' (ej. weather.forecast_casa)");
    }
    this.config = config;
  }

  connectedCallback() {
    super.connectedCallback();
    this._subscribeForecasts();
  }

  updated(changedProperties) {
    if (changedProperties.has('hass') && this.hass && this.config) {
      this._subscribeForecasts();
    }
  }

  async _subscribeForecasts() {
    if (!this.hass || !this.config.entity) return;

    if (!this._subscribedHourly) {
      this._subscribedHourly = true;
      try {
        this.hass.connection.subscribeMessage(
          (msg) => {
            if (msg && msg.forecast && msg.forecast.length > 0) {
              this._hourlyForecast = msg.forecast;
              this.requestUpdate();
            }
          },
          {
            type: 'weather/subscribe_forecast',
            entity_id: this.config.entity,
            forecast_type: 'hourly'
          }
        );
      } catch (e) {
        console.warn("AEMET Card: Error en suscripción horaria", e);
      }
    }

    if (!this._subscribedDaily) {
      this._subscribedDaily = true;
      let dailyEntity = this.config.entity;
      if (dailyEntity.includes('hourly')) {
        dailyEntity = dailyEntity.replace('hourly', 'daily');
      } else if (!dailyEntity.includes('daily') && this.hass.states[`${dailyEntity}_daily`]) {
        dailyEntity = `${dailyEntity}_daily`;
      }

      try {
        this.hass.connection.subscribeMessage(
          (msg) => {
            if (msg && msg.forecast && msg.forecast.length > 0) {
              this._dailyForecast = msg.forecast;
              this.requestUpdate();
            }
          },
          {
            type: 'weather/subscribe_forecast',
            entity_id: dailyEntity,
            forecast_type: 'daily'
          }
        );
      } catch (e) {
        console.warn("AEMET Card: Error en suscripción diaria", e);
      }
    }
  }

  renderWeatherIcon(state, size = 32) {
    const s = state ? state.toLowerCase() : 'cloudy';

    if (s.includes('sunny') || s.includes('clear')) {
      return html`
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="14" fill="#FFB300"/>
          <circle cx="32" cy="32" r="18" fill="#FFC107" fill-opacity="0.3"/>
          <path d="M32 4V10M32 54V60M4 32H10M54 32H60M12.2 12.2L16.4 16.4M47.6 47.6L51.8 51.8M12.2 51.8L16.4 47.6M47.6 16.4L51.8 12.2" stroke="#FF9800" stroke-width="4" stroke-linecap="round"/>
        </svg>
      `;
    }

    if (s.includes('partly')) {
      return html`
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
          <circle cx="24" cy="22" r="11" fill="#FFC107"/>
          <path d="M46 48H22C16.5 48 12 43.5 12 38C12 33 15.8 28.8 20.7 28.1C22.3 22.3 27.6 18 34 18C41.7 18 48 24.3 48 32C51.3 32.5 54 35.5 54 39C54 44 50 48 46 48Z" fill="#90CAF9"/>
          <path d="M42 48H22C17.6 48 14 44.4 14 40C14 36 17 32.7 21 32C22.5 27 27 23 32.5 23C38.8 23 44 28.2 44 34.5C47 35 49 37.5 49 40.5C49 44.5 46 48 42 48Z" fill="#E3F2FD"/>
        </svg>
      `;
    }

    if (s.includes('rain') || s.includes('pouring')) {
      return html`
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
          <path d="M46 38H20C15.6 38 12 34.4 12 30C12 26 15 22.7 19 22C20.5 17 25 13 30.5 13 C36.8 13 42 18.2 42 24.5C45 25 47 27.5 47 30.5C47 34.5 44 38 46 38Z" fill="#78909C"/>
          <path d="M22 44L18 52M32 44L28 52M42 44L38 52" stroke="#29B6F6" stroke-width="3.5" stroke-linecap="round"/>
        </svg>
      `;
    }

    if (s.includes('lightning')) {
      return html`
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
          <path d="M44 34H20C16 34 13 30.5 13 26.5C13 22.8 15.8 19.7 19.5 19.1C21 14.5 25.2 11 30.5 11C36.8 11 42 16.2 42 22.5C45 23 47 25.5 47 28.5C47 31.5 44 34 44 34Z" fill="#546E7A"/>
          <path d="M30 32L22 44H30L26 56L38 40H30L34 32H30Z" fill="#FFD54F" stroke="#FFB300" stroke-width="1"/>
        </svg>
      `;
    }

    if (s.includes('snow')) {
      return html`
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
          <path d="M46 36H20C15.6 36 12 32.4 12 28C12 24 15 20.7 19 20C20.5 15 25 11 30.5 11C36.8 11 42 16.2 42 22.5C45 23 47 25.5 47 28.5C47 32.5 44 36 46 36Z" fill="#B0BEC5"/>
          <circle cx="20" cy="46" r="2.5" fill="#E0F7FA"/>
          <circle cx="32" cy="48" r="3" fill="#E0F7FA"/>
          <circle cx="44" cy="45" r="2.5" fill="#E0F7FA"/>
        </svg>
      `;
    }

    return html`
      <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
        <path d="M46 42H20C15.6 42 12 38.4 12 34C12 30 15 26.7 19 26C20.5 21 25 17 30.5 17C36.8 17 42 22.2 42 28.5C45 29 47 31.5 47 34.5C47 38.5 44 42 46 42Z" fill="#90A4AE"/>
        <path d="M42 44H24C20.1 44 17 40.9 17 37C17 33.5 19.6 30.6 23.1 30C24.4 25.6 28.4 22 33.3 22C38.8 22 43.4 26.6 43.4 32.1C46 32.6 48 34.8 48 37.5C48 41.1 45.3 44 42 44Z" fill="#CFD8DC"/>
      </svg>
    `;
  }

  getWindRotation(bearing) {
    if (typeof bearing === 'number') return bearing;
    const directions = { 'N': 0, 'NE': 45, 'E': 90, 'SE': 135, 'S': 180, 'SW': 225, 'W': 270, 'NW': 315 };
    return directions[bearing] || 0;
  }

  getUvColorClass(uvVal) {
    if (uvVal >= 11) return 'uv-extreme';
    if (uvVal >= 8) return 'uv-very-high';
    if (uvVal >= 6) return 'uv-high';
    if (uvVal >= 3) return 'uv-moderate';
    return 'uv-low';
  }

  _getFallbackDaily() {
    if (!this._hourlyForecast || this._hourlyForecast.length === 0) return [];
    
    const daysMap = {};
    this._hourlyForecast.forEach(item => {
      const dateStr = item.datetime.split('T')[0];
      if (!daysMap[dateStr]) {
        daysMap[dateStr] = {
          datetime: item.datetime,
          condition: item.condition,
          temperatures: [],
        };
      }
      if (item.temperature !== undefined) {
        daysMap[dateStr].temperatures.push(item.temperature);
      }
    });

    return Object.values(daysMap).map(d => ({
      datetime: d.datetime,
      condition: d.condition,
      temperature: Math.max(...d.temperatures),
      templow: Math.min(...d.temperatures)
    }));
  }

  render() {
    if (!this.hass || !this.config) return html``;

    const stateObj = this.hass.states[this.config.entity];
    if (!stateObj) {
      return html`<ha-card><div class="error">Entidad no encontrada: ${this.config.entity}</div></ha-card>`;
    }

    const hourlyList = this._hourlyForecast.length > 0 
      ? this._hourlyForecast 
      : (stateObj.attributes?.forecast || []);

    const fallbackDaily = this._getFallbackDaily();
    const combinedDailyMap = {};

    fallbackDaily.forEach(item => {
      const dateStr = item.datetime.split('T')[0];
      combinedDailyMap[dateStr] = item;
    });

    this._dailyForecast.forEach(item => {
      if (item.datetime) {
        const dateStr = item.datetime.split('T')[0];
        combinedDailyMap[dateStr] = item;
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const dailyList = Object.values(combinedDailyMap)
      .filter(item => item.datetime && !item.datetime.startsWith(todayStr));

    const temps = hourlyList.map(i => i.temperature ?? 0);
    const minTemp = temps.length ? Math.min(...temps) : 0;
    const maxTemp = temps.length ? Math.max(...temps) : 30;
    const tempRange = (maxTemp - minTemp) || 1;

    // Comprobación de parámetro de configuración (por defecto true si no se especifica)
    const showDaily = this.config.show_daily !== false;

    return html`
      <ha-card>
        <div class="card-content">
          <div class="header-title">Previsión por Horas</div>

          ${hourlyList.length > 0 ? html`
            <div class="scroll-wrapper">
              <div class="eltiempo-container">
                ${hourlyList.map((item) => {
                  const date = new Date(item.datetime);
                  const hourStr = !isNaN(date.getTime()) ? `${date.getHours().toString().padStart(2, '0')}:00` : '--:--';
                  const temp = Math.round(item.temperature ?? 0);
                  const rainMm = item.precipitation ?? 0;
                  const rainProb = item.precipitation_probability ?? 0;
                  const windSpeed = Math.round(item.wind_speed ?? 0);
                  const windBearing = this.getWindRotation(item.wind_bearing);
                  const uvVal = item.uv_index !== undefined ? Math.round(item.uv_index) : 0;

                  const offsetY = 70 - (((temp - minTemp) / tempRange) * 50);

                  return html`
                    <div class="hour-column">
                      <div class="col-header">${hourStr}</div>

                      <div class="temp-plot-area">
                        <div class="temp-point" style="transform: translateY(${offsetY}px);">
                          ${this.renderWeatherIcon(item.condition, 28)}
                          <span class="temp-val">${temp}°</span>
                        </div>
                      </div>

                      <div class="info-row rain-row">
                        <span>${rainMm} mm</span>
                        <span class="sub-percent">${rainProb}%</span>
                      </div>

                      <div class="info-row wind-row">
                        <ha-icon 
                          icon="mdi:arrow-down" 
                          style="transform: rotate(${windBearing}deg);"
                          class="wind-arrow"
                        ></ha-icon>
                        <span>${windSpeed} km/h</span>
                      </div>

                      <div class="info-row uv-row">
                        <span class="uv-badge ${this.getUvColorClass(uvVal)}">UV ${uvVal}</span>
                      </div>
                    </div>
                  `;
                })}
              </div>
            </div>
          ` : html`<div class="no-data">Cargando horas...</div>`}

          ${showDaily ? html`
            <div class="divider"></div>
            <div class="header-title">Previsión Próximos Días</div>
            ${dailyList.length > 0 ? html`
              <div class="daily-grid">
                ${dailyList.map((item) => {
                  const date = new Date(item.datetime);
                  const dayName = !isNaN(date.getTime()) ? date.toLocaleDateString('es-ES', { weekday: 'short' }) : '---';

                  return html`
                    <div class="day-card">
                      <span class="day-name">${dayName}</span>
                      <div class="icon-container">
                        ${this.renderWeatherIcon(item.condition, 34)}
                      </div>
                      <div class="temp-range">
                        <span class="max">${Math.round(item.temperature ?? 0)}°</span>
                        <span class="min">${Math.round(item.templow ?? item.temperature_low ?? 0)}°</span>
                      </div>
                    </div>
                  `;
                })}
              </div>
            ` : html`<div class="no-data">Cargando previsión diaria...</div>`}
          ` : html``}

        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }
      ha-card {
        background: var(--card-background-color, #ffffff);
        border-radius: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        overflow: hidden;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }
      .card-content {
        padding: 16px;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }
      .header-title {
        font-size: 1.05rem;
        font-weight: 700;
        margin-bottom: 12px;
        color: var(--primary-text-color);
      }
      .divider {
        height: 1px;
        background: var(--divider-color, rgba(0, 0, 0, 0.08));
        margin: 20px 0 16px 0;
      }

      .scroll-wrapper {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        display: block;
        position: relative;
      }

      .eltiempo-container {
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
        width: 100%;
        max-width: 100%;
        padding-bottom: 8px;
        scrollbar-width: thin;
        scrollbar-color: #0d6efd rgba(0, 0, 0, 0.05);
        -webkit-overflow-scrolling: touch;
      }

      .eltiempo-container::-webkit-scrollbar {
        height: 6px;
      }
      .eltiempo-container::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 3px;
      }
      .eltiempo-container::-webkit-scrollbar-thumb {
        background: #0d6efd;
        border-radius: 3px;
      }

      .hour-column {
        flex: 0 0 68px;
        min-width: 68px;
        max-width: 68px;
        display: flex;
        flex-direction: column;
        border-right: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
        text-align: center;
        box-sizing: border-box;
      }
      .hour-column:last-child {
        border-right: none;
      }

      .col-header {
        font-size: 0.85rem;
        color: var(--secondary-text-color);
        padding-bottom: 8px;
      }

      .temp-plot-area {
        height: 130px;
        position: relative;
      }
      .temp-point {
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: transform 0.3s ease;
      }
      .temp-val {
        font-weight: 600;
        font-size: 0.95rem;
        margin-top: 2px;
        color: var(--primary-text-color);
      }

      .info-row {
        border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
        padding: 6px 2px;
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 0.78rem;
        color: var(--primary-text-color);
        min-height: 36px;
        justify-content: center;
      }
      .sub-percent {
        color: var(--secondary-text-color);
        font-size: 0.72rem;
      }
      .wind-arrow {
        --mdc-icon-size: 16px;
        margin-bottom: 2px;
      }

      .uv-row {
        min-height: 28px;
      }
      .uv-badge {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 5px;
        border-radius: 6px;
        color: #ffffff;
      }
      .uv-low { background-color: #4CAF50; }
      .uv-moderate { background-color: #FBC02D; color: #000; }
      .uv-high { background-color: #FB8C00; }
      .uv-very-high { background-color: #E53935; }
      .uv-extreme { background-color: #8E24AA; }

      .daily-grid {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        overflow-x: auto;
      }
      .day-card {
        flex: 1;
        min-width: 52px;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 4px;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 10px;
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.05));
      }
      .day-name {
        font-size: 0.82rem;
        font-weight: 600;
        text-transform: capitalize;
        color: var(--secondary-text-color);
      }
      .icon-container {
        margin: 6px 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .temp-range {
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 0.82rem;
      }
      .max {
        font-weight: 600;
        color: var(--primary-text-color);
      }
      .min {
        color: var(--secondary-text-color);
        font-size: 0.76rem;
      }
      .error {
        padding: 16px;
        color: var(--error-color);
      }
      .no-data {
        color: var(--secondary-text-color);
        font-size: 0.85rem;
        padding: 8px 0;
      }
    `;
  }
}

customElements.define("aemet-weather-card", AemetWeatherCard);