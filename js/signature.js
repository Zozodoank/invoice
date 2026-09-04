/**
 * Digital Signature Canvas Handler
 */

class SignaturePadManager {
  constructor(canvasId, onChangeCallback) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
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
    // Set actual canvas resolution vs display size
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * 2 || 600;
    this.canvas.height = rect.height * 2 || 240;
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
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && Math.abs(this.canvas.width - rect.width * 2) > 10 && !this.hasDrawn) {
      this.initCanvas();
    }
    this.isDrawing = true;
    const { x, y } = this.getCoordinates(e);
    this.lastX = x;
    this.lastY = y;
  }

  draw(e) {
    if (!this.isDrawing) return;
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
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasDrawn = false;
    this.onChange('');
  }

  getDataUrl() {
    if (!this.hasDrawn) return '';
    return this.canvas.toDataURL('image/png');
  }

  loadFromDataUrl(dataUrl) {
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
