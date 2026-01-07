"use strict";

(function() {
	if (typeof Monitor === 'undefined')
		return;

	var OriginalMonitor = Monitor;

	var Monitor_RightPanelStorageKey = 'monitor_panel_right_width';
	var Monitor_RightPanelDefault = 400;
	var Monitor_RightPanelMin = 220;
	var Monitor_ViewMin = 260;

	var proto = OriginalMonitor.prototype;
	if (proto.initResizablePanel)
		return;

	var originalDestroy = proto.destroy;

	proto.initResizablePanel = function() {
		this.rightPanelWidth = this.loadRightPanelWidth();
		this.resizingPanel = false;
		this.panelBorderWidth = null;
		this.panelResizerHalfWidth = null;
		this.panelResizeMove = this.onPanelResize.bind(this);
		this.panelResizeStop = this.stopPanelResize.bind(this);
		this.onWindowResizeBound = this.onWindowResize.bind(this);

		this.elPanelResizer = this.document.createElement('div');
		this.elPanelResizer.classList.add('panel_resizer');
		this.elPanelResizer.monitor = this;
		this.elPanelResizer.onmousedown = function(e) {
			return e.currentTarget.monitor.startPanelResize(e);
		};
		this.elMonitor.appendChild(this.elPanelResizer);

		this.applyRightPanelWidth();

		this.window.addEventListener('resize', this.onWindowResizeBound);
	};

	proto.getPanelResizerHalfWidth = function() {
		if (this.panelResizerHalfWidth != null)
			return this.panelResizerHalfWidth;

		var half = 4;
		if (this.elPanelResizer)
		{
			try
			{
				var w = parseInt(this.document.defaultView.getComputedStyle(this.elPanelResizer).width);
				if (false == isNaN(w))
					half = Math.max(1, Math.round(w / 2));
			}
			catch (err)
			{
			}
		}

		this.panelResizerHalfWidth = half;
		return half;
	};

	proto.loadRightPanelWidth = function() {
		var width = parseInt(localStorage[Monitor_RightPanelStorageKey]);
		if (isNaN(width) || (width <= 0))
			width = Monitor_RightPanelDefault;
		return width;
	};

	proto.getRightPanelBorderWidth = function() {
		if (this.panelBorderWidth != null)
			return this.panelBorderWidth;

		var borderWidth = parseInt(this.document.defaultView.getComputedStyle(this.elPanelR).borderLeftWidth);
		if (isNaN(borderWidth))
			borderWidth = 0;

		this.panelBorderWidth = borderWidth;
		return this.panelBorderWidth;
	};

	proto.clampRightPanelWidth = function(i_width) {
		var monitorWidth = this.elMonitor.clientWidth;
		if (monitorWidth <= 0)
			return Math.max(Monitor_RightPanelMin, i_width);

		var leftWidth = this.elPanelL ? this.elPanelL.getBoundingClientRect().width : 0;
		var available = monitorWidth - leftWidth;
		if (available < 0)
			available = 0;

		var maxWidth = available - Monitor_ViewMin;
		if (maxWidth < 0)
			maxWidth = available;

		var minWidth = Monitor_RightPanelMin;
		if (maxWidth < minWidth)
			minWidth = maxWidth;

		var width = i_width;
		if (isNaN(width))
			width = Monitor_RightPanelDefault;
		if (width < minWidth)
			width = minWidth;
		if (width > maxWidth)
			width = maxWidth;

		if (width < 0)
			width = 0;

		return width;
	};

	proto.applyRightPanelWidth = function(i_width) {
		if (i_width != null)
			this.rightPanelWidth = i_width;

		var borderWidth = this.getRightPanelBorderWidth();
		this.rightPanelWidth = this.clampRightPanelWidth(this.rightPanelWidth);

		var panelWidth = this.rightPanelWidth - borderWidth;
		if (panelWidth < 0)
			panelWidth = 0;

		this.elPanelR.style.width = panelWidth + 'px';
		this.elView.style.right = this.rightPanelWidth + 'px';
		if (this.elPanelResizer)
		{
			// Center the resizer on the actual panel border (otherwise it sits inside the view and steals clicks).
			var half = this.getPanelResizerHalfWidth();
			this.elPanelResizer.style.right = (this.rightPanelWidth - half) + 'px';
		}

		this.schedulePanelResizeEvent();
	};

	proto.schedulePanelResizeEvent = function() {
		if (this.panelResizeQueued)
			return;
		this.panelResizeQueued = true;
		var self = this;
		var schedule = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : null;
		if (schedule == null)
			schedule = function(cb) { return setTimeout(cb, 0); };
		schedule(function() {
			self.panelResizeQueued = false;
			if (typeof window !== 'undefined')
				window.dispatchEvent(new Event('cgru:monitor-panel-resize'));
		});
	};

	proto.startPanelResize = function(i_evt) {
		i_evt.stopPropagation();
		i_evt.preventDefault();
		this.resizingPanel = true;
		this.document.addEventListener('mousemove', this.panelResizeMove);
		this.document.addEventListener('mouseup', this.panelResizeStop);
		if (this.elPanelResizer)
			this.elPanelResizer.classList.add('active');
		return false;
	};

	proto.onPanelResize = function(i_evt) {
		if (false == this.resizingPanel)
			return;

		var rect = this.elMonitor.getBoundingClientRect();
		var width = rect.right - i_evt.clientX;

		this.applyRightPanelWidth(width);
	};

	proto.stopPanelResize = function() {
		this.document.removeEventListener('mousemove', this.panelResizeMove);
		this.document.removeEventListener('mouseup', this.panelResizeStop);

		if (false == this.resizingPanel)
			return;

		this.resizingPanel = false;
		if (this.elPanelResizer)
			this.elPanelResizer.classList.remove('active');
		localStorage[Monitor_RightPanelStorageKey] = this.rightPanelWidth;
	};

	proto.onWindowResize = function() {
		this.applyRightPanelWidth();
	};

	proto.destroy = function() {
		if (this.stopPanelResize)
			this.stopPanelResize();
		if (this.onWindowResizeBound)
			this.window.removeEventListener('resize', this.onWindowResizeBound);
		return originalDestroy.apply(this, arguments);
	};

	function MonitorWithResize(i_args) {
		OriginalMonitor.call(this, i_args);
		this.initResizablePanel();
	}

	MonitorWithResize.prototype = proto;
	MonitorWithResize.prototype.constructor = MonitorWithResize;

	for (var prop in OriginalMonitor)
		if (Object.prototype.hasOwnProperty.call(OriginalMonitor, prop))
			MonitorWithResize[prop] = OriginalMonitor[prop];

	Monitor = MonitorWithResize;
})();
