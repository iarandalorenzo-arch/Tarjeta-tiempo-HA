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
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Debes definir la entidad 'entity' (ej. weather.forecast_casa)");
    }
    this.config = config;
  }

  // Se ejecuta automáticamente al cargar o actualizar la tarjeta en Home Assistant
  updated(changedProperties) {
    if (changedProperties.has('hass') && this.hass && this.config) {
      const oldHass = changedProperties.get('hass');
      if (!oldHass || oldHass.states[this.config.entity] !== this.hass.states[this.config.entity]) {
        this._fetchForecasts();
      }
    }
  }

  // Llamada moderna a la API de previsión de Home Assistant (AEMET)
  async _fetchForecasts() {
    if (!this.hass || !this.config.entity) return;

    try {
      // Intentamos pedir la previsión horaria mediante el servicio moderno
      const resHourly = await this.hass.callWS({
        type: 'weather/subscribe_forecast',
        entity_id: this.config.entity,
        forecast_type: 'hourly'
      });
      if (resHourly && resHourly.forecast) {
        this._hourlyForecast = resHourly.forecast;
      }
    } catch (e) {
      // Si falla la suscripción WS, leemos los atributos tradicionales por fallback
      const stateObj = this.hass.states[this.config.entity];
      if (stateObj && stateObj.attributes && stateObj.attributes.forecast) {
        this._hourlyForecast = stateObj.attributes.forecast;
      }
    }

    try {
      // Intentamos pedir la previsión diaria
      const resDaily = await this.hass.callWS({
        type: 'weather/subscribe_forecast',
        entity_id: this.config.entity,
        forecast_type: 'daily'
      });
      if (resDaily && resDaily.forecast) {
        this._dailyForecast = resDaily.forecast;
      }
    } catch (e) {
      const dailyEntityId = this.config.entity.replace('hourly', 'daily');
      const dailyObj = this.hass.states[dailyEntityId] || this.hass.states['weather.forecast_casa_daily'];
      if (dailyObj && dailyObj.attributes && dailyObj.attributes.forecast) {
        this._dailyForecast = dailyObj.attributes.forecast;
      }
    }
  }

  getUvColor(uv) {
    if (uv === undefined || uv === null) return "var(--primary-text-color)";
    const val = Math.min(Math.max(uv, 0), 11);
    const hue = 210 - (val * 19);
    return `hsl(${hue}, 90%, 50%)`;
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

  render() {
    if (!this.hass || !this.config) return html``;

    const stateObj = this.hass.states[this.config.entity];
    if (!stateObj) {
      return html`<ha-card><div class="error">Entidad no encontrada: ${this.config.entity}</div></ha-card>`;
    }

    const hourly12 = this._hourlyForecast.slice(0, 12);
    const daily7 = this._dailyForecast.slice(0, 7);

    return html`
      <ha-card>
        <div class="card-content">
          
          <!-- SECCIÓN 1: PREDICCIÓN HORARIA (12 HORAS SCROLL) -->
          <div class="section-title">Previsión 12 horas</div>
          <div class="hourly-carousel">
            ${hourly12.length > 0 ? hourly12.map((item) => {
              const date = new Date(item.datetime);
              const hourStr = !isNaN(date.getTime()) ? `${date.getHours().toString().padStart(2, '0')}:00` : '--:--';
              const uvVal = item.uv_index ?? item.uv ?? 0;
              const rainVal = item.precipitation ?? item.precipitation_probability ?? 0;
              const uvColor = this.getUvColor(uvVal);

              return html`
                <div class="hour-card">
                  <span class="hour-time">${hourStr}</span>
                  <ha-icon icon="${this.getWeatherIcon(item.condition || stateObj.state)}"></ha-icon>
                  <span class="temp">${Math.round(item.temperature ?? 0)}°C</span>
                  
                  <div class="sub-info rain">
                    <ha-icon icon="mdi:water-outline"></ha-icon>
                    <span>${rainVal}${item.precipitation !== undefined ? 'mm' : '%'}</span>
                  </div>

                  <div class="sub-info uv" style="color: ${uvColor}">
                    <ha-icon icon="mdi:white-balance-sunny" style="color: ${uvColor}"></ha-icon>
                    <span>${Math.round(uvVal)}</span>
                  </div>
                </div>
              `;
            }) : html`<div class="no-data">Obteniendo previsión horaria de AEMET...</div>`}
          </div>

          <div class="divider"></div>

          <!-- SECCIÓN 2: PREDICCIÓN 7 DÍAS (HORIZONTAL) -->
          <div class="section-title">Previsión 7 días</div>
          <div class="daily-grid">
            ${daily7.length > 0 ? daily7.map((item) => {
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
            }) : html`<div class="no-data">Obteniendo previsión diaria de AEMET...</div>`}
          </div>

        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      ha-card {
        background: rgba(255, 255, 255, 0.04);
        border-radius: 16px;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      }
      .card-content {
        padding: 16px;
      }
      .section-title {
        font-size: 0.9rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--secondary-text-color);
        margin-bottom: 12px;
      }
      .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.08);
        margin: 16px 0;
      }

      /* CARRUSEL HORARIO */
      .hourly-carousel {
        display: flex;
        overflow-x: auto;
        gap: 12px;
        padding-bottom: 8px;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
      }
      .hourly-carousel::-webkit-scrollbar {
        height: 4px;
      }
      .hourly-carousel::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
      .hour-card {
        flex: 0 0 auto;
        width: 65px;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: rgba(255, 255, 255, 0.03);
        padding: 10px 6px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.04);
      }
      .hour-time {
        font-size: 0.8rem;
        color: var(--secondary-text-color);
        margin-bottom: 4px;
      }
      .hour-card ha-icon {
        --mdc-icon-size: 24px;
        margin: 4px 0;
      }
      .temp {
        font-weight: 600;
        font-size: 0.95rem;
        margin-bottom: 6px;
      }
      .sub-info {
        display: flex;
        align-items: center;
        gap: 2px;
        font-size: 0.75rem;
      }
      .sub-info ha-icon {
        --mdc-icon-size: 12px;
      }
      .rain {
        color: #64b5f6;
      }

      /* PREDICCIÓN DIARIA */
      .daily-grid {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        overflow-x: auto;
      }
      .day-card {
        flex: 1;
        min-width: 45px;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 4px;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 10px;
      }
      .day-name {
        font-size: 0.8rem;
        text-transform: capitalize;
        color: var(--secondary-text-color);
      }
      .day-card ha-icon {
        --mdc-icon-size: 22px;
        margin: 6px 0;
      }
      .temp-range {
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 0.8rem;
      }
      .max {
        font-weight: 600;
      }
      .min {
        color: var(--secondary-text-color);
        font-size: 0.75rem;
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