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
    };
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Debes definir la entidad 'entity' (ej. weather.forecast_casa)");
    }
    this.config = config;
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

    // Buscamos la previsión en atributos directos o en la entidad diaria de AEMET
    let forecastHourly = stateObj.attributes.forecast || stateObj.attributes.forecast_hourly || [];
    let forecastDaily = stateObj.attributes.forecast_daily || [];

    // Si la entidad principal no tiene la previsión diaria, intentamos leer la entidad diaria de AEMET
    if (forecastDaily.length === 0) {
      const dailyEntityId = this.config.entity.replace('_hourly', '').replace('forecast_', 'forecast_daily_');
      const dailyObj = this.hass.states[dailyEntityId] || this.hass.states['weather.forecast_casa_daily'] || this.hass.states['weather.aemet_daily'];
      if (dailyObj && dailyObj.attributes) {
        forecastDaily = dailyObj.attributes.forecast || dailyObj.attributes.forecast_daily || [];
      }
    }

    // Si la previsión horaria sigue vacía, usamos la lista disponible
    if (forecastHourly.length === 0 && forecastDaily.length > 0) {
      forecastHourly = forecastDaily;
    }

    const hourly12 = forecastHourly.slice(0, 12);
    const daily7 = forecastDaily.length > 0 ? forecastDaily.slice(0, 7) : forecastHourly.slice(0, 7);

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
            }) : html`<div class="no-data">Cargando datos horarios...</div>`}
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
                    <span class="min">${Math.round(item.templow ?? item.temperature_low ?? item.templow_day ?? 0)}°</span>
                  </div>
                </div>
              `;
            }) : html`<div class="no-data">Cargando datos diarios...</div>`}
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