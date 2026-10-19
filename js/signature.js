/**
 * Digital Signature Canvas Handler
 */

class SignaturePadManager {
  constructor(canvasId, onChangeCallback) {
    this.canvas = document.getElementById(canvasId);
    // No canvas -> operate in a safe disabled mode (never throw, render nothing).
    if (!this.canvas) {
      this.disabled = true;
      this.hasDrawn = false;
      this.onChange = onChangeCallback || (() => {});
      return;
    }
    this.disabled = false;

    this.ctx = this.canvas.getContext('2d');
    this.onChange = onChangeCallback || (() => {});
    this.isDrawing = false;
    this.hasDrawn = false;
    this.lastX = 0;
    this.lastY = 0;

    this.initCanvas();
    this.attachEvents();
  }

  initCanvas() {
    // Set actual canvas resolution vs display size; measure the backing store now.
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 300;
    const h = rect.height || 120;
    this.canvas.width = w * 2;
    this.canvas.height = h * 2;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(2, 2);

    this.ctx.strokeStyle = '#1e293b';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  attachEvents() {
    // Mouse Events
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    window.addEventListener('mouseup', () => this.stopDrawing());

    // Touch Events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.startDrawing(touch);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.draw(touch);
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => this.stopDrawing());
  }

  getCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  startDrawing(e) {
    if (this.disabled) return;
    const rect = this.canvas.getBoundingClientRect();
    // Re-measure the backing store whenever the display size has changed.
    if (rect.width > 0 && Math.abs(this.canvas.width - rect.width * 2) > 10) {
      this.initCanvas();
    }
    this.isDrawing = true;
    const { x, y } = this.getCoordinates(e);
    this.lastX = x;
    this.lastY = y;
  }

  draw(e) {
    if (this.disabled || !this.isDrawing) return;
    const { x, y } = this.getCoordinates(e);

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    this.lastX = x;
    this.lastY = y;
    this.hasDrawn = true;
  }

  stopDrawing() {
    if (this.isDrawing) {
      this.isDrawing = false;
      if (this.hasDrawn) {
        this.onChange(this.getDataUrl());
      }
    }
  }

  clear() {
    if (this.disabled) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasDrawn = false;
    // clear() is a pure canvas reset — it must NOT fire onChange. Callers that need
    // to persist the empty state do so explicitly (keeps drawing-side effects separate).
  }

  getDataUrl() {
    if (this.disabled) return null;
    if (!this.hasDrawn) return null;
    return this.canvas.toDataURL('image/png');
  }

  loadFromDataUrl(dataUrl) {
    if (this.disabled) return;
    if (!dataUrl) {
      this.clear();
      return;
    }
    const img = new Image();
    img.onload = () => {
      this.clear();
      this.ctx.drawImage(img, 0, 0, this.canvas.width / 2, this.canvas.height / 2);
      this.hasDrawn = true;
      this.onChange(dataUrl);
    };
    img.src = dataUrl;
  }
}
