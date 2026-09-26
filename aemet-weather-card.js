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

  getWeatherIcon(state) {
    const icons = {
      'sunny': 'mdi:weather-sunny',
      'clear-night': 'mdi:weather-night',
      'partlycloudy': 'mdi:weather-partly-cloudy',
      'cloudy': 'mdi:weather-cloudy',
      'fog': 'mdi:weather-fog',
      'rainy': 'mdi:weather-rainy',
      'pouring': 'mdi:weather-pouring',
      'lightning-rainy': 'mdi:weather-lightning-rainy',
      'snowy': 'mdi:weather-snowy',
      'windy': 'mdi:weather-windy'
    };
    return icons[state] || 'mdi:weather-cloudy';
  }

  getWindRotation(bearing) {
    if (typeof bearing === 'number') return bearing;
    const directions = { 'N': 0, 'NE': 45, 'E': 90, 'SE': 135, 'S': 180, 'SW': 225, 'W': 270, 'NW': 315 };
    return directions[bearing] || 0;
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

    // Combinar previsión diaria con fallback por horas para rellenar si faltan días
    const fallbackDaily = this._getFallbackDaily();
    const combinedDailyMap = {};

    // Primero insertamos el fallback
    fallbackDaily.forEach(item => {
      const dateStr = item.datetime.split('T')[0];
      combinedDailyMap[dateStr] = item;
    });

    // Luego sobrescribimos con los datos diarios reales (tienen mayor precisión)
    this._dailyForecast.forEach(item => {
      if (item.datetime) {
        const dateStr = item.datetime.split('T')[0];
        combinedDailyMap[dateStr] = item;
      }
    });

    const rawDailyList = Object.values(combinedDailyMap);

    // Excluir el día de hoy y tomar los 7 días posteriores
    const todayStr = new Date().toISOString().split('T')[0];
    const dailyList = rawDailyList
      .filter(item => item.datetime && !item.datetime.startsWith(todayStr))
      .slice(0, 7);

    const temps = hourlyList.map(i => i.temperature ?? 0);
    const minTemp = temps.length ? Math.min(...temps) : 0;
    const maxTemp = temps.length ? Math.max(...temps) : 30;
    const tempRange = (maxTemp - minTemp) || 1;

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

                  const offsetY = 70 - (((temp - minTemp) / tempRange) * 50);

                  return html`
                    <div class="hour-column">
                      <div class="col-header">${hourStr}</div>

                      <div class="temp-plot-area">
                        <div class="temp-point" style="transform: translateY(${offsetY}px);">
                          <ha-icon icon="${this.getWeatherIcon(item.condition)}"></ha-icon>
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
                    </div>
                  `;
                })}
              </div>
            </div>
          ` : html`<div class="no-data">Cargando horas...</div>`}

          <div class="divider"></div>

          <!-- SECCIÓN PREVISIÓN 7 DÍAS POSTERIORES -->
          <div class="header-title">Previsión Próximos 7 Días</div>
          ${dailyList.length > 0 ? html`
            <div class="daily-grid">
              ${dailyList.map((item) => {
                const date = new Date(item.datetime);
                const dayName = !isNaN(date.getTime()) ? date.toLocaleDateString('es-ES', { weekday: 'short' }) : '---';

                return html`
                  <div class="day-card">
                    <span class="day-name">${dayName}</span>
                    <ha-icon icon="${this.getWeatherIcon(item.condition)}"></ha-icon>
                    <div class="temp-range">
                      <span class="max">${Math.round(item.temperature ?? 0)}°</span>
                      <span class="min">${Math.round(item.templow ?? item.temperature_low ?? 0)}°</span>
                    </div>
                  </div>
                `;
              })}
            </div>
          ` : html`<div class="no-data">Cargando previsión de 7 días...</div>`}

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
      .temp-point ha-icon {
        --mdc-icon-size: 26px;
        color: #f59e0b;
      }
      .temp-val {
        font-weight: 600;
        font-size: 0.95rem;
        margin-top: 2px;
        color: var(--primary-text-color);
      }

      .info-row {
        border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
        padding: 8px 2px;
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

      .daily-grid {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        overflow-x: auto;
      }
      .day-card {
        flex: 1;
        min-width: 48px;
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
      .day-card ha-icon {
        --mdc-icon-size: 24px;
        margin: 6px 0;
        color: #f59e0b;
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