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
            if (msg && msg.forecast) {
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
        console.warn("Error cargando predicción horaria", e);
      }
    }

    if (!this._subscribedDaily) {
      this._subscribedDaily = true;
      let dailyEntity = this.config.entity;
      if (!this.hass.states[dailyEntity]?.attributes?.forecast) {
        const potentialDaily = dailyEntity.replace('hourly', 'daily').replace('_casa', '_casa_daily');
        if (this.hass.states[potentialDaily]) dailyEntity = potentialDaily;
      }

      try {
        this.hass.connection.subscribeMessage(
          (msg) => {
            if (msg && msg.forecast) {
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
        console.warn("Error cargando predicción diaria", e);
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

  // Convierte rumbo en grados o cardinal a rotación de flecha
  getWindRotation(bearing) {
    if (typeof bearing === 'number') return bearing;
    const directions = { 'N': 0, 'NE': 45, 'E': 90, 'SE': 135, 'S': 180, 'SW': 225, 'W': 270, 'NW': 315 };
    return directions[bearing] || 0;
  }

  render() {
    if (!this.hass || !this.config) return html``;

    const stateObj = this.hass.states[this.config.entity];
    if (!stateObj) {
      return html`<ha-card><div class="error">Entidad no encontrada: ${this.config.entity}</div></ha-card>`;
    }

    const hourly12 = this._hourlyForecast.slice(0, 14);

    // Cálculo para desplazar verticalmente la temperatura simulando la gráfica
    const temps = hourly12.map(i => i.temperature ?? 0);
    const minTemp = Math.min(...(temps.length ? temps : [0]));
    const maxTemp = Math.max(...(temps.length ? temps : [30]));
    const tempRange = (maxTemp - minTemp) || 1;

    return html`
      <ha-card>
        <div class="card-content">
          <div class="header-title">Hoy</div>

          <div class="eltiempo-container">
            ${hourly12.map((item) => {
              const date = new Date(item.datetime);
              const hourStr = !isNaN(date.getTime()) ? `${date.getHours().toString().padStart(2, '0')}:00` : '--:--';
              const temp = Math.round(item.temperature ?? 0);
              const rainMm = item.precipitation ?? 0;
              const rainProb = item.precipitation_probability ?? 0;
              const windSpeed = Math.round(item.wind_speed ?? 0);
              const windBearing = this.getWindRotation(item.wind_bearing);

              // Porcentaje de altura entre 10px y 70px para hacer el efecto de curva
              const offsetY = 70 - (((temp - minTemp) / tempRange) * 50);

              return html`
                <div class="hour-column">
                  <!-- 1. HORA -->
                  <div class="col-header">${hourStr}</div>

                  <!-- 2. ICONO + TEMPERATURA CON ALTURA DINÁMICA -->
                  <div class="temp-plot-area">
                    <div class="temp-point" style="transform: translateY(${offsetY}px);">
                      <ha-icon icon="${this.getWeatherIcon(item.condition)}"></ha-icon>
                      <span class="temp-val">${temp} °</span>
                    </div>
                  </div>

                  <!-- 3. LLUVIA (mm y %) -->
                  <div class="info-row rain-row">
                    <span>${rainMm} mm</span>
                    <span class="sub-percent">${rainProb}%</span>
                  </div>

                  <!-- 4. VIENTO (Flecha + km/h) -->
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
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      ha-card {
        background: var(--card-background-color, #ffffff);
        border-radius: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        overflow: hidden;
      }
      .card-content {
        padding: 16px;
      }
      .header-title {
        font-size: 1.1rem;
        font-weight: 700;
        margin-bottom: 12px;
        color: var(--primary-text-color);
      }

      /* CONTENEDOR HORIZONTAL SCROLL */
      .eltiempo-container {
        display: flex;
        overflow-x: auto;
        padding-bottom: 6px;
        scrollbar-width: thin;
        scrollbar-color: #0d6efd rgba(0, 0, 0, 0.05);
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

      /* COLUMNA INDIVIDUAL POR HORA */
      .hour-column {
        flex: 0 0 68px;
        display: flex;
        flex-direction: column;
        border-right: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
        text-align: center;
      }
      .hour-column:last-child {
        border-right: none;
      }

      .col-header {
        font-size: 0.85rem;
        color: var(--secondary-text-color);
        padding-bottom: 8px;
      }

      /* ÁREA DE GRÁFICO TÉRMICO VERTICAL */
      .temp-plot-area {
        height: 140px;
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

      /* FILAS DE INFORMACIÓN (LLUVIA Y VIENTO) */
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
        transition: transform 0.3s ease;
      }
      .error {
        padding: 16px;
        color: var(--error-color);
      }
    `;
  }
}

customElements.define("aemet-weather-card", AemetWeatherCard);