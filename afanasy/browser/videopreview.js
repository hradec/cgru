"use strict";

function VideoPreview(i_parent, i_message_parent)
{
	this.parent = i_parent;
	this.messageParent = i_message_parent ? i_message_parent : i_parent;
	this.currentSource = null;
	this.sources = null;
	this.resizeObserver = null;
	this.isDraggingResize = false;
	this.internalHeightAdjust = false;
	this.aspectRatio = null;
	this.lastWidth = null;

	this.elVideo = document.createElement('video');
	this.elVideo.classList.add('video_preview_video');
	this.elVideo.controls = true;
	this.elVideo.preload = 'metadata';
	this.elVideo.playsInline = true;
	this.parent.appendChild(this.elVideo);

	this.elResizeHandle = document.createElement('div');
	this.elResizeHandle.classList.add('video_preview_resizer');
	this.elResizeHandle.title = 'Drag to resize video preview.';
	this.parent.appendChild(this.elResizeHandle);

	var self = this;
	this.elVideo.addEventListener('error', function() {
		var src = self.elVideo.currentSrc ? self.elVideo.currentSrc : self.elVideo.src;
		console.warn('VideoPreview: video element error for:', src, self.elVideo.error);
		self.setMessage('Video failed to load.');
	});

	this.elMessage = document.createElement('div');
	this.elMessage.classList.add('video_preview_message');
	this.messageParent.appendChild(this.elMessage);

	this.elSources = document.createElement('div');
	this.elSources.classList.add('video_preview_sources');
	this.messageParent.appendChild(this.elSources);

	this.loadSizeFromStorage();
	this.attachResizeHandle();
	this.attachResizeHandler();
	this.resize();

	this.setMessage('Select a job to view its video preview.');
}

VideoPreview.prototype.loadSizeFromStorage = function()
{
	var h = parseInt(localStorage['video_preview_height']);
	if (isFinite(h) && h > 0)
		this.parent.style.height = h + 'px';

	var r = parseFloat(localStorage['video_preview_aspect']);
	if (isFinite(r) && r > 0.05)
		this.aspectRatio = r;
};

VideoPreview.prototype.saveSizeToStorage = function()
{
	var height = this.parent.clientHeight;
	if (height > 0)
		localStorage['video_preview_height'] = height;
	if (this.aspectRatio && this.aspectRatio > 0.05)
		localStorage['video_preview_aspect'] = this.aspectRatio;
};

VideoPreview.prototype.attachResizeHandle = function()
{
	var self = this;
	this.elResizeHandle.onmousedown = function(e)
	{
		e.stopPropagation();
		e.preventDefault();

		self.isDraggingResize = true;
		var startY = e.clientY;
		var startHeight = self.parent.clientHeight;

		var onMove = function(me)
		{
			if (false == self.isDraggingResize)
				return;

			var delta = me.clientY - startY;
			var height = Math.round(startHeight + delta);
			height = Math.max(120, Math.min(900, height));

			self.parent.style.height = height + 'px';
			var width = self.parent.clientWidth;
			if (width > 0 && height > 0)
				self.aspectRatio = width / height;
		};

		var onUp = function()
		{
			self.isDraggingResize = false;
			window.removeEventListener('mousemove', onMove, true);
			window.removeEventListener('mouseup', onUp, true);
			self.saveSizeToStorage();
		};

		window.addEventListener('mousemove', onMove, true);
		window.addEventListener('mouseup', onUp, true);

		return false;
	};
};

VideoPreview.prototype.attachResizeHandler = function()
{
	if (this.resizeObserver || !window.ResizeObserver)
	{
		window.addEventListener('resize', this.resize.bind(this));
		return;
	}

	this.resizeObserver = new ResizeObserver(this.resize.bind(this));
	this.resizeObserver.observe(this.parent);
};

VideoPreview.prototype.resize = function()
{
	var width = this.parent.clientWidth;
	var height = this.parent.clientHeight;
	if ((width <= 0) || (height <= 0))
	{
		var bounds = this.parent.getBoundingClientRect();
		width = bounds.width;
		height = bounds.height;
	}
	if (height <= 0)
		height = 200;

	if ((false == this.isDraggingResize) && (false == this.internalHeightAdjust))
	{
		if (this.aspectRatio == null)
			this.aspectRatio = width / height;

		if ((this.lastWidth != null) && (width > 0) && (this.aspectRatio != null))
		{
			if (Math.abs(width - this.lastWidth) > 1)
			{
				var desired = Math.round(width / this.aspectRatio);
				desired = Math.max(120, Math.min(900, desired));
				if (Math.abs(desired - height) > 1)
				{
					this.internalHeightAdjust = true;
					this.parent.style.height = desired + 'px';
					var self = this;
					setTimeout(function() { self.internalHeightAdjust = false; }, 0);
				}
			}
		}
	}

	this.lastWidth = width;
};

VideoPreview.prototype.setMessage = function(i_text)
{
	if (i_text)
	{
		this.elMessage.textContent = i_text;
		this.elMessage.style.display = 'block';
	}
	else
	{
		this.elMessage.textContent = '';
		this.elMessage.style.display = 'none';
	}
};

VideoPreview.prototype.load = function(i_source)
{
	if ((i_source != null) && Array.isArray(i_source.items))
	{
		this.setSources(i_source.items, i_source.selected);
		var selected = 0;
		if (isFinite(i_source.selected) && (i_source.selected >= 0) && (i_source.selected < i_source.items.length))
			selected = i_source.selected;
		return this.load(i_source.items[selected]);
	}

	if ((i_source == null) || (i_source.src == null) || (i_source.src == ''))
	{
		this.currentSource = null;
		this.setSources(null);
		this.elVideo.removeAttribute('src');
		try { this.elVideo.load(); } catch (err) {}
		this.elVideo.style.display = 'none';
		this.setMessage('Video preview not available.');
		return;
	}

	if ((this.currentSource != null) && (this.currentSource.src == i_source.src))
		return;

	this.currentSource = {"src": i_source.src};

	this.elVideo.style.display = 'block';
	this.elVideo.src = i_source.src;
	try { this.elVideo.load(); } catch (err) {}
	this.setMessage('');
	this.resize();
};

VideoPreview.prototype.setSources = function(i_sources, i_selected)
{
	this.sources = (Array.isArray(i_sources) && i_sources.length) ? i_sources.slice(0) : null;

	var key = null;
	if (this.sources && this.sources.length)
	{
		key = '';
		for (var i = 0; i < this.sources.length; i++)
		{
			var s = this.sources[i];
			if ((s == null) || (s.src == null))
				continue;
			key += (s.src + '|' + (s.label ? s.label : '') + ';');
		}
	}

	var selected = 0;
	if (isFinite(i_selected) && (i_selected >= 0) && (this.sources != null) && (i_selected < this.sources.length))
		selected = i_selected;

	if ((key != null) && (key == this.sourcesKey) && (selected == this.sourcesSelected))
		return;

	this.sourcesKey = key;
	this.sourcesSelected = selected;

	while (this.elSources.firstChild)
		this.elSources.removeChild(this.elSources.firstChild);

	if ((this.sources == null) || (this.sources.length <= 1))
	{
		this.elSources.style.display = 'none';
		return;
	}

	var self = this;
	for (var i = 0; i < this.sources.length; i++)
	{
		var s = this.sources[i];
		if ((s == null) || (s.src == null) || (s.src == ''))
			continue;

		var btn = document.createElement('button');
		btn.type = 'button';
		btn.classList.add('video_preview_source_btn');
		if (i == selected)
			btn.classList.add('selected');
		btn.textContent = s.label ? s.label : ('Video ' + (i + 1));
		btn.onclick = function(e) {
			e.stopPropagation();
			e.preventDefault();
			var idx = parseInt(e.currentTarget.dataset.idx);
			if (false == isFinite(idx))
				return;
			self.load(self.sources[idx]);
			self.setSources(self.sources, idx);
		};
		btn.dataset.idx = i;
		this.elSources.appendChild(btn);
	}

	this.elSources.style.display = 'block';
};

VideoPreview.prototype.stop = function()
{
	try { this.elVideo.pause(); } catch (err) {}
};
