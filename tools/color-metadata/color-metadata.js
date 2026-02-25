/* eslint-disable import/no-absolute-path */
/* eslint-disable import/no-unresolved */

// Import SDK for Document Authoring
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

const COLOR_API_BASE = 'https://behr-color-worker-production.behr-enterprise-account.workers.dev/api/colors';
const COLOR_DETAIL_PATH_PATTERN = /^\/colors\/color-detail\/([^/]+)$/;

/**
 * Shows a message in the feedback container with optional error styling
 * @param {string} text - Message text to display
 * @param {boolean} [isError=false] - Whether to style as error message
 */
function showMessage(text, isError = false) {
  const message = document.querySelector('.feedback-message');
  const msgContainer = document.querySelector('.message-wrapper');
  message.textContent = text;
  message.classList.toggle('error', isError);
  msgContainer.classList.remove('hidden');
}

/**
 * Toggles the loading state visibility
 * @param {boolean} visible - Whether to show the loading state
 */
function showLoading(visible) {
  document.querySelector('.loading-state').classList.toggle('hidden', !visible);
}

/**
 * Normalizes API response fields to a consistent shape,
 * accommodating multiple possible field name conventions.
 * @param {Object} data - Raw API response object
 * @returns {Object} Normalized color data
 */
function normalizeColorData(data) {
  return {
    name: data.colorName || '',
    code: data.colorCode || '',
    hex: data.rgbHex || '',
    rgb: data.rgb || data.rgbValue || (data.r != null ? `${data.r}, ${data.g}, ${data.b}` : ''),
    lrv: data.lrv || '',
    family: data.colorFamily || '',
    collection: data.collection || data.colorCollection || '',
  };
}

/**
 * Builds the HTML string for a metadata block table to be inserted at cursor
 * @param {Object} colorData - Normalized color data
 * @returns {string} HTML string for the metadata table
 */
function buildMetadataTableHTML(colorData) {
  const fields = [
    ['Color Name', colorData.name],
    ['Color Code', colorData.code],
    ['Hex', colorData.hex],
    ['RGB', colorData.rgb],
    ['LRV', colorData.lrv],
    ['Color Family', colorData.family],
    ['Collection', colorData.collection],
  ];

  const rows = fields
    .filter(([, value]) => value)
    .map(([label, value]) => `<tr><td><p>${label}</p></td><td><p>${value}</p></td></tr>`)
    .join('');

  return `<div class="tableWrapper"><table style="min-width: 25px;"><colgroup><col><col></colgroup><tbody><tr><td colspan="2"><p>metadata</p></td></tr>${rows}</tbody></table></div>`;
}

/**
 * Fetches color data from the Color Database API for a given color code
 * @param {string} colorCode - The color code extracted from the page path
 * @returns {Promise<Object>} Raw API response JSON
 */
async function fetchColorData(colorCode) {
  const response = await fetch(COLOR_API_BASE);
  if (!response.ok) {
    throw new Error(`Failed to fetch colors (HTTP ${response.status})`);
  }
  const colors = await response.json();
  const color = colors.find((c) => c.colorCode === colorCode);
  if (!color) {
    throw new Error(`Color not found: ${colorCode}`);
  }
  return color;
}

/**
 * Renders the color preview card with swatch, name, code, and hex
 * @param {Object} colorData - Normalized color data
 */
function renderColorPreview(colorData) {
  const preview = document.querySelector('.color-preview');
  const swatch = document.querySelector('.color-swatch');
  const nameEl = document.querySelector('.color-name');
  const codeEl = document.querySelector('.color-code-display');
  const hexEl = document.querySelector('.color-hex-display');

  if (colorData.hex) {
    swatch.style.backgroundColor = colorData.hex;
    swatch.setAttribute('aria-label', `Color swatch: ${colorData.hex}`);
  }

  nameEl.textContent = colorData.name || 'Unknown Color';
  codeEl.textContent = colorData.code ? `Code: ${colorData.code}` : '';
  hexEl.textContent = colorData.hex ? `Hex: ${colorData.hex}` : '';

  preview.classList.remove('hidden');
}

/**
 * Initializes the Color Metadata Assistant plugin
 */
(async function init() {
  const { context, actions } = await DA_SDK;

  // Validate that the current path is a color detail page
  const match = context.path?.match(COLOR_DETAIL_PATH_PATTERN);

  if (!match) {
    showMessage('Navigate to a color detail page to use this tool');
    return;
  }

  const [, colorCode] = match;

  showLoading(true);

  try {
    const rawData = await fetchColorData(colorCode);
    const colorData = normalizeColorData(rawData);

    showLoading(false);
    renderColorPreview(colorData);

    const insertBtn = document.querySelector('#insert-btn');
    insertBtn.classList.remove('hidden');

    insertBtn.addEventListener('click', () => {
      if (!actions?.sendHTML) {
        showMessage('Cannot insert block: editor connection unavailable', true);
        return;
      }
      actions.sendHTML(buildMetadataTableHTML(colorData));
      showMessage('Color metadata block inserted successfully.');
    });
  } catch (error) {
    showLoading(false);
    showMessage(`Failed to fetch color data: ${error.message}`, true);
  }
}());
