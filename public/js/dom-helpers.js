/**
 * DOM Helper Utilities
 * Provides safe template-based DOM manipulation to prevent HTML injection
 */

/**
 * Template engine for safe DOM element creation
 */
class TemplateEngine {
  /**
   * @param {string} templateId - ID of the template element
   */
  constructor(templateId) {
    this.template = document.getElementById(templateId);
    if (!this.template) {
      throw new Error(`Template not found: ${templateId}`);
    }
  }

  /**
   * Creates a new element from the template
   * @param {Object} data - Data to bind to the template
   * @param {Object} bindings - Selector to value/function mappings
   * @returns {DocumentFragment} Cloned template with data bound
   */
  create(data, bindings) {
    const clone = this.template.content.cloneNode(true);

    Object.entries(bindings).forEach(([selector, handler]) => {
      const elements = clone.querySelectorAll(selector);
      if (elements.length === 0) return;

      elements.forEach(element => {
        if (typeof handler === 'function') {
          handler(element, data);
        } else if (typeof handler === 'string') {
          // Simple text content binding
          element.textContent = data[handler];
        } else if (typeof handler === 'object') {
          // Multiple property bindings
          Object.entries(handler).forEach(([prop, value]) => {
            if (prop === 'textContent' || prop === 'innerHTML') {
              element[prop] = typeof value === 'function' ? value(data) : data[value];
            } else if (prop === 'attribute') {
              Object.entries(value).forEach(([attr, attrValue]) => {
                element.setAttribute(attr, typeof attrValue === 'function' ? attrValue(data) : data[attrValue]);
              });
            } else if (prop === 'event') {
              Object.entries(value).forEach(([eventName, eventHandler]) => {
                element.addEventListener(eventName, (e) => eventHandler(e, data));
              });
            }
          });
        }
      });
    });

    return clone;
  }
}

/**
 * Creates a text node safely
 * @param {string} text - Text content
 * @returns {Text} Text node
 */
function createTextNode(text) {
  return document.createTextNode(String(text));
}

/**
 * Creates an element with properties safely
 * @param {string} tagName - HTML tag name
 * @param {Object} props - Properties to set
 * @param {Array|string} children - Child elements or text
 * @returns {HTMLElement} Created element
 */
function createElement(tagName, props = {}, children = []) {
  const element = document.createElement(tagName);

  // Set properties
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'textContent') {
      element.textContent = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.entries(value).forEach(([styleKey, styleValue]) => {
        element.style[styleKey] = styleValue;
      });
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.substring(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else {
      element.setAttribute(key, value);
    }
  });

  // Add children
  const childArray = Array.isArray(children) ? children : [children];
  childArray.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  });

  return element;
}

/**
 * Escapes HTML to prevent injection (defensive fallback)
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Replaces all children of a container with new children
 * @param {HTMLElement} container - Container element
 * @param {...Node} children - New children
 */
function replaceChildren(container, ...children) {
  container.replaceChildren(...children);
}

/**
 * Shows an empty state message
 * @param {HTMLElement} container - Container element
 * @param {string} message - Message to display
 */
function showEmptyState(container, message) {
  const p = createElement('p', { className: 'empty-state' }, message);
  replaceChildren(container, p);
}

/**
 * Shows an error state message
 * @param {HTMLElement} container - Container element
 * @param {string} message - Error message to display
 */
function showErrorState(container, message) {
  const p = createElement('p', { className: 'error-state' }, message);
  replaceChildren(container, p);
}

/**
 * Shows a loading state message
 * @param {HTMLElement} container - Container element
 * @param {string} message - Loading message to display
 */
function showLoadingState(container, message = 'Loading...') {
  const div = createElement('div', { className: 'loading' }, message);
  replaceChildren(container, div);
}
