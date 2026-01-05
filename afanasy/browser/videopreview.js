"use strict";

function VideoPreview(i_parent, i_message_parent)
{
	this.parent = i_parent;
	this.messageParent = i_message_parent ? i_message_parent : i_parent;
	this.currentSource = null;
	this.sources = null;
	this.lastJobIdLoaded = null;
	this.resizeObserver = null;
	this.isDraggingResize = false;
	this.internalHeightAdjust = false;
	this.aspectRatio = null;
	this.lastWidth = null;

	// Mode dropdown: "video" or a steps folder path.
	this.m_modeOptionsKey = null;
	this.m_mode_select_focused = false;
	this.onModeChanged = null;
	this.m_viewingSteps = false;
	this.m_mode = 'video';

	// Steps viewer state:
	this.stepFolder = null;
	this.stepImages = null; // [{name,url},...]
	this.stepIndex = 0;
	this.stepPlaying = false;
	this.stepPlayTimer = null;
	this.stepImageXhr = null;
	this.stepImageBlobUrl = null;
	this.stepImageLoading = false;

	this.elVideo = document.createElement('video');
	this.elVideo.classList.add('video_preview_video');
	this.elVideo.controls = true;
	this.elVideo.preload = 'metadata';
	this.elVideo.playsInline = true;
	this.parent.appendChild(this.elVideo);

	this.elPlaceholder = document.createElement('div');
	this.elPlaceholder.classList.add('video_preview_placeholder');
	this.elPlaceholder.textContent = 'Video not available.';
	this.elPlaceholder.style.display = 'none';
	this.parent.appendChild(this.elPlaceholder);

	this.elResizeHandle = document.createElement('div');
	this.elResizeHandle.classList.add('video_preview_resizer');
	this.elResizeHandle.title = 'Drag to resize video preview.';
	this.parent.appendChild(this.elResizeHandle);

	this.elModeSelect = document.createElement('select');
	this.elModeSelect.classList.add('video_preview_mode_select');
	this.elModeSelect.title = 'Preview mode: video or image steps.';
	this.elModeSelect.style.display = 'none';
	this.elModeSelect.disabled = true;
	this.parent.appendChild(this.elModeSelect);

	this.elSteps = document.createElement('div');
	this.elSteps.classList.add('video_preview_steps');
	this.elSteps.style.display = 'none';
	this.parent.appendChild(this.elSteps);

	this.elStepImage = document.createElement('img');
	this.elStepImage.classList.add('video_preview_step_img');
	this.elStepImage.draggable = false;
	this.elSteps.appendChild(this.elStepImage);

	this.elStepPrev = document.createElement('button');
	this.elStepPrev.type = 'button';
	this.elStepPrev.classList.add('video_preview_step_btn');
	this.elStepPrev.classList.add('prev');
	this.elStepPrev.textContent = '◀';
	this.elSteps.appendChild(this.elStepPrev);

	this.elStepNext = document.createElement('button');
	this.elStepNext.type = 'button';
	this.elStepNext.classList.add('video_preview_step_btn');
	this.elStepNext.classList.add('next');
	this.elStepNext.textContent = '▶';
	this.elSteps.appendChild(this.elStepNext);

	this.elStepPlay = document.createElement('button');
	this.elStepPlay.type = 'button';
	this.elStepPlay.classList.add('video_preview_step_btn');
	this.elStepPlay.classList.add('play');
	this.elStepPlay.textContent = '►';
	this.elStepPlay.style.opacity = '0';
	this.elSteps.appendChild(this.elStepPlay);

	this.elStepLabel = document.createElement('div');
	this.elStepLabel.classList.add('video_preview_step_label');
	this.elStepLabel.style.display = 'none';
	this.parent.appendChild(this.elStepLabel);

	this.elStepsScanProgress = document.createElement('div');
	this.elStepsScanProgress.classList.add('video_preview_steps_progress');
	this.elStepsScanProgress.style.display = 'none';
	this.parent.appendChild(this.elStepsScanProgress);
	this.elStepsScanProgressFill = document.createElement('div');
	this.elStepsScanProgressFill.classList.add('video_preview_steps_progress_fill');
	this.elStepsScanProgress.appendChild(this.elStepsScanProgressFill);
	this.stepsScanHideTimer = null;

	this.elStepLoadProgress = document.createElement('div');
	this.elStepLoadProgress.classList.add('video_preview_step_load_progress');
	this.elStepLoadProgress.style.display = 'none';
	this.parent.appendChild(this.elStepLoadProgress);
	this.elStepLoadProgressFill = document.createElement('div');
	this.elStepLoadProgressFill.classList.add('video_preview_step_load_progress_fill');
	this.elStepLoadProgress.appendChild(this.elStepLoadProgressFill);
	this.stepLoadHideTimer = null;

	var self = this;
	this.elVideo.addEventListener('error', function() {
		var src = self.elVideo.currentSrc ? self.elVideo.currentSrc : self.elVideo.src;
		var dbg = 'VideoPreview: video element error for: ' + src;
		console.warn(dbg, self.elVideo.error);
		self.showPlaceholder(true, dbg);
		self.setMessage('Video failed to load.');
	});

	this.elModeSelect.onfocus = function() { self.m_mode_select_focused = true; };
	this.elModeSelect.onblur = function() { self.m_mode_select_focused = false; };
	this.elModeSelect.onmousedown = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
	this.elModeSelect.onclick = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
	this.elModeSelect.onchange = function(e) {
		if (e && e.stopPropagation) e.stopPropagation();
		if (self.onModeChanged != null)
			self.onModeChanged(self.elModeSelect.value);
	};

	var stopBtnEvent = function(e)
	{
		if (e && e.stopPropagation) e.stopPropagation();
		if (e && e.preventDefault) e.preventDefault();
		return false;
	};

	this.elStepPrev.onmousedown = stopBtnEvent;
	this.elStepNext.onmousedown = stopBtnEvent;
	this.elStepPlay.onmousedown = stopBtnEvent;

	this.elStepPrev.onclick = function(e) { stopBtnEvent(e); self.stepPrev(true); };
	this.elStepNext.onclick = function(e) { stopBtnEvent(e); self.stepNext(true); };
	this.elStepPlay.onclick = function(e) { stopBtnEvent(e); self.toggleStepPlay(); };

	this.elSteps.addEventListener('mouseleave', function() {
		if (self.stepPlaying)
			return;
		self.elStepPlay.style.opacity = '0';
	});
	this.elSteps.addEventListener('mousemove', function(e) {
		if (self.m_viewingSteps == false)
			return;
		if (self.stepPlaying)
		{
			self.elStepPlay.style.opacity = '1';
			return;
		}

		var rect = self.elSteps.getBoundingClientRect();
		var cx = rect.left + rect.width * 0.5;
		var cy = rect.top + rect.height * 0.5;
		var dx = Math.abs(e.clientX - cx);
		var dy = Math.abs(e.clientY - cy);
		var rx = Math.max(30, rect.width * 0.22);
		var ry = Math.max(30, rect.height * 0.22);
		self.elStepPlay.style.opacity = ((dx < rx) && (dy < ry)) ? '1' : '0';
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

VideoPreview.prototype.showPlaceholder = function(i_show, i_text)
{
	if (this.elPlaceholder == null)
		return;
	if (i_text != null)
		this.elPlaceholder.textContent = i_text;
	this.elPlaceholder.style.display = i_show ? 'flex' : 'none';
};

VideoPreview.prototype.abortStepImageRequest = function(i_keep_current_image)
{
	if (this.stepImageXhr)
	{
		try { this.stepImageXhr.abort(); } catch (err) {}
		this.stepImageXhr = null;
	}
	this.stepImageLoading = false;

	if ((false == i_keep_current_image) && this.stepImageBlobUrl)
	{
		try { URL.revokeObjectURL(this.stepImageBlobUrl); } catch (err) {}
		this.stepImageBlobUrl = null;
	}
};

VideoPreview.prototype.hideStepLoadProgress = function()
{
	if (this.stepLoadHideTimer)
	{
		clearTimeout(this.stepLoadHideTimer);
		this.stepLoadHideTimer = null;
	}
	if (this.elStepLoadProgress)
		this.elStepLoadProgress.style.display = 'none';
	if (this.elStepLoadProgressFill)
		this.elStepLoadProgressFill.style.width = '0%';
};

VideoPreview.prototype.showStepLoadProgress = function()
{
	if (this.elStepLoadProgress == null)
		return;

	if (this.stepLoadHideTimer)
	{
		clearTimeout(this.stepLoadHideTimer);
		this.stepLoadHideTimer = null;
	}

	this.elStepLoadProgress.style.display = 'block';
	if (this.elStepLoadProgressFill)
		this.elStepLoadProgressFill.style.width = '0%';
};

VideoPreview.prototype.updateStepLoadProgress = function(i_loaded, i_total)
{
	if ((this.elStepLoadProgress == null) || (this.elStepLoadProgressFill == null))
		return;

	if ((false == isFinite(i_loaded)) || (false == isFinite(i_total)) || (i_total <= 0))
	{
		this.elStepLoadProgress.style.display = 'none';
		return;
	}

	this.elStepLoadProgress.style.display = 'block';

	var ratio = i_loaded / i_total;
	ratio = Math.max(0, Math.min(1, ratio));
	this.elStepLoadProgressFill.style.width = Math.round(ratio * 100) + '%';

	if (ratio >= 1)
	{
		var self = this;
		if (this.stepLoadHideTimer == null)
		{
			this.stepLoadHideTimer = setTimeout(function() {
				self.stepLoadHideTimer = null;
				if (self.elStepLoadProgress)
					self.elStepLoadProgress.style.display = 'none';
			}, 250);
		}
	}
};

VideoPreview.prototype.hideStepsScanProgress = function()
{
	if (this.stepsScanHideTimer)
	{
		clearTimeout(this.stepsScanHideTimer);
		this.stepsScanHideTimer = null;
	}
	if (this.elStepsScanProgress)
		this.elStepsScanProgress.style.display = 'none';
	if (this.elStepsScanProgressFill)
		this.elStepsScanProgressFill.style.width = '0%';
};

VideoPreview.prototype.showStepsScanProgress = function()
{
	if (this.elStepsScanProgress == null)
		return;

	if (this.stepsScanHideTimer)
	{
		clearTimeout(this.stepsScanHideTimer);
		this.stepsScanHideTimer = null;
	}

	this.elStepsScanProgress.style.display = 'block';
	if (this.elStepsScanProgressFill)
		this.elStepsScanProgressFill.style.width = '0%';
};

VideoPreview.prototype.updateStepsScanProgress = function(i_done, i_total)
{
	if ((this.elStepsScanProgress == null) || (this.elStepsScanProgressFill == null))
		return;

	if ((false == isFinite(i_done)) || (false == isFinite(i_total)) || (i_total <= 0))
	{
		this.elStepsScanProgress.style.display = 'none';
		return;
	}

	this.elStepsScanProgress.style.display = 'block';

	var ratio = i_done / i_total;
	ratio = Math.max(0, Math.min(1, ratio));
	this.elStepsScanProgressFill.style.width = Math.round(ratio * 100) + '%';

	if (ratio >= 1)
	{
		var self = this;
		if (this.stepsScanHideTimer == null)
		{
			this.stepsScanHideTimer = setTimeout(function() {
				self.stepsScanHideTimer = null;
				if (self.elStepsScanProgress)
					self.elStepsScanProgress.style.display = 'none';
			}, 350);
		}
	}
};

VideoPreview.prototype.setModeOptions = function(i_options, i_selected_value)
{
	if (this.elModeSelect == null)
		return;

	if (this.m_mode_select_focused)
		return;

	if (false == Array.isArray(i_options))
		i_options = null;

	var key = '';
	if (i_options && i_options.length)
	{
		for (var i = 0; i < i_options.length; i++)
		{
			var opt = i_options[i];
			if ((opt == null) || (opt.value == null))
				continue;
			key += ('' + opt.value) + '|' + (opt.label ? ('' + opt.label) : '') + ';';
		}
	}

	if ((key.length == 0) || (i_options == null) || (i_options.length <= 1))
	{
		this.m_modeOptionsKey = null;
		this.elModeSelect.style.display = 'none';
		this.elModeSelect.disabled = true;
		while (this.elModeSelect.firstChild)
			this.elModeSelect.removeChild(this.elModeSelect.firstChild);
		return;
	}

	var selected = (i_selected_value != null) ? ('' + i_selected_value) : ('' + this.elModeSelect.value);
	var found = false;
	for (var i = 0; i < i_options.length; i++)
	{
		if (i_options[i] && (i_options[i].value == selected))
		{
			found = true;
			break;
		}
	}
	if (false == found)
		selected = (i_options[0] && i_options[0].value != null) ? ('' + i_options[0].value) : '';

	if ((this.m_modeOptionsKey == key) && (this.elModeSelect.value == selected))
		return;

	this.m_modeOptionsKey = key;

	while (this.elModeSelect.firstChild)
		this.elModeSelect.removeChild(this.elModeSelect.firstChild);

	for (var i = 0; i < i_options.length; i++)
	{
		var opt = i_options[i];
		if ((opt == null) || (opt.value == null))
			continue;

		var elOpt = document.createElement('option');
		elOpt.value = '' + opt.value;
		elOpt.textContent = opt.label ? ('' + opt.label) : ('' + opt.value);
		this.elModeSelect.appendChild(elOpt);
	}

	this.elModeSelect.disabled = false;
	this.elModeSelect.style.display = 'block';
	this.elModeSelect.value = selected;
};

VideoPreview.prototype.stopStepPlay = function()
{
	this.stepPlaying = false;
	if (this.stepPlayTimer)
	{
		clearInterval(this.stepPlayTimer);
		this.stepPlayTimer = null;
	}
	if (this.elStepPlay)
		this.elStepPlay.textContent = '►';
};

VideoPreview.prototype.setStepImages = function(i_folder, i_images)
{
	this.stopStepPlay();
	this.hideStepsScanProgress();
	this.hideStepLoadProgress();
	this.abortStepImageRequest();
	this.stepFolder = i_folder;
	this.stepImages = (Array.isArray(i_images) && i_images.length) ? i_images.slice(0) : null;
	this.stepIndex = 0;
	this.showStepAt(0);
};

VideoPreview.prototype.loadStepImage = function(i_url)
{
	this.hideStepLoadProgress();
	this.abortStepImageRequest();

	if ((i_url == null) || (i_url.length == 0))
	{
		if (this.elStepImage)
			this.elStepImage.removeAttribute('src');
		return;
	}

	if (this.elStepImage)
		this.elStepImage.removeAttribute('src');

	this.showStepLoadProgress();
	this.stepImageLoading = true;

	var self = this;
	var xhr = new XMLHttpRequest();
	this.stepImageXhr = xhr;
	xhr.open('GET', i_url, true);
	xhr.responseType = 'blob';
	xhr.onprogress = function(e) {
		if (self.stepImageXhr != xhr)
			return;
		if (e && e.lengthComputable && e.total > 0)
			self.updateStepLoadProgress(e.loaded, e.total);
	};
	xhr.onload = function() {
		if (self.stepImageXhr != xhr)
			return;
		self.stepImageXhr = null;
		self.stepImageLoading = false;

		if ((xhr.status >= 200) && (xhr.status < 300) && xhr.response)
		{
			try
			{
				self.stepImageBlobUrl = URL.createObjectURL(xhr.response);
				if (self.elStepImage && self.stepImageBlobUrl)
					self.elStepImage.src = self.stepImageBlobUrl;
			}
			catch (err) {}
			self.updateStepLoadProgress(1, 1);
		}
		else
		{
			self.hideStepLoadProgress();
		}
	};
	xhr.onerror = function() {
		if (self.stepImageXhr != xhr)
			return;
		self.stepImageXhr = null;
		self.stepImageLoading = false;
		self.hideStepLoadProgress();
	};
	xhr.onabort = function() {
		if (self.stepImageXhr != xhr)
			return;
		self.stepImageXhr = null;
		self.stepImageLoading = false;
		self.hideStepLoadProgress();
	};

	try { xhr.send(); } catch (err) { this.hideStepLoadProgress(); this.stepImageLoading = false; }
};

VideoPreview.prototype.showStepAt = function(i_index)
{
	if ((this.stepImages == null) || (this.stepImages.length == 0))
	{
		this.hideStepLoadProgress();
		this.abortStepImageRequest();
		if (this.elStepImage)
			this.elStepImage.removeAttribute('src');
		if (this.elStepLabel)
		{
			this.elStepLabel.textContent = '';
			this.elStepLabel.style.display = 'none';
		}
		if (this.elStepPrev) this.elStepPrev.disabled = true;
		if (this.elStepNext) this.elStepNext.disabled = true;
		if (this.elStepPlay) this.elStepPlay.disabled = true;
		return;
	}

	var idx = parseInt(i_index);
	if (false == isFinite(idx))
		idx = 0;
	idx = Math.max(0, Math.min(this.stepImages.length - 1, idx));
	this.stepIndex = idx;

	var img = this.stepImages[idx];
	this.loadStepImage((img && img.url) ? img.url : null);

	if (this.elStepLabel)
	{
		this.elStepLabel.textContent = (img && img.name) ? ('' + img.name) : '';
		this.elStepLabel.style.display = 'block';
	}

	if (this.elStepPrev) this.elStepPrev.disabled = (idx <= 0);
	if (this.elStepNext) this.elStepNext.disabled = (idx >= this.stepImages.length - 1);
	if (this.elStepPlay) this.elStepPlay.disabled = false;
};

VideoPreview.prototype.stepPrev = function(i_force)
{
	if ((this.stepImages == null) || (this.stepImages.length == 0))
		return;
	if ((false == i_force) && this.stepImageLoading)
		return;
	this.showStepAt(this.stepIndex - 1);
};

VideoPreview.prototype.stepNext = function(i_force)
{
	if ((this.stepImages == null) || (this.stepImages.length == 0))
		return;
	if ((false == i_force) && this.stepImageLoading)
		return;
	if (this.stepIndex >= this.stepImages.length - 1)
	{
		this.stopStepPlay();
		return;
	}
	this.showStepAt(this.stepIndex + 1);
};

VideoPreview.prototype.toggleStepPlay = function()
{
	if ((this.stepImages == null) || (this.stepImages.length == 0))
		return;

	if (this.stepPlaying)
	{
		this.stopStepPlay();
		return;
	}

	this.stepPlaying = true;
	if (this.elStepPlay)
		this.elStepPlay.textContent = '❚❚';

	var self = this;
	this.stepPlayTimer = setInterval(function() {
		if (self.stepPlaying == false)
			return;
		if ((self.stepImages == null) || (self.stepImages.length == 0))
		{
			self.stopStepPlay();
			return;
		}
		if (self.stepIndex >= self.stepImages.length - 1)
		{
			self.stopStepPlay();
			return;
		}
		self.stepNext(false);
	}, 250);
};

VideoPreview.prototype.showVideoMode = function()
{
	this.m_viewingSteps = false;
	this.stopStepPlay();
	this.hideStepLoadProgress();
	this.abortStepImageRequest();

	this.hideStepsScanProgress();
	if (this.elSteps)
		this.elSteps.style.display = 'none';
	if (this.elStepLabel)
		this.elStepLabel.style.display = 'none';
	if (this.elSources)
		this.elSources.style.display = (this.sources && this.sources.length > 1) ? 'block' : 'none';

	if (this.currentSource && this.currentSource.src)
	{
		this.showPlaceholder(false);
		this.elVideo.style.display = 'block';
	}
	else
	{
		this.elVideo.style.display = 'none';
		this.showPlaceholder(true, 'Video not available.');
	}
};

VideoPreview.prototype.showStepsMode = function()
{
	this.m_viewingSteps = true;
	try { this.elVideo.pause(); } catch (err) {}
	this.elVideo.style.display = 'none';
	this.showPlaceholder(false);
	if (this.elSources)
		this.elSources.style.display = 'none';
	if (this.elSteps)
		this.elSteps.style.display = 'block';
};

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

VideoPreview.prototype.clearPreview = function()
{
	this.stopStepPlay();
	this.abortStepImageRequest();
	this.hideStepsScanProgress();
	this.hideStepLoadProgress();
	this.currentSource = null;
	this.setSources(null);
	if (this.elVideo)
	{
		this.elVideo.removeAttribute('src');
		try { this.elVideo.load(); } catch (err) {}
		this.elVideo.style.display = 'none';
	}
	if (this.elSteps)
		this.elSteps.style.display = 'none';
	if (this.elStepLabel)
		this.elStepLabel.style.display = 'none';
	if (this.elSources)
		this.elSources.style.display = 'none';
	this.showPlaceholder(false);
	this.setMessage('');
};

VideoPreview.prototype.load = function(i_source)
{
	// Reset mode when switching jobs.
	if ((this.m_jobId != null) && (this.lastJobIdLoaded != this.m_jobId))
	{
		this.m_mode = 'video';
		this.m_viewingSteps = false;
		this.stopStepPlay();
		if (this.elModeSelect)
			this.elModeSelect.value = 'video';
	}
	this.lastJobIdLoaded = (this.m_jobId != null) ? this.m_jobId : null;

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
		this.showPlaceholder(true, 'Video not available.');
		this.showVideoMode();
		this.setMessage('Video preview not available.');
		return;
	}

	if ((this.currentSource != null) && (this.currentSource.src == i_source.src))
		return;

	this.currentSource = {"src": i_source.src};

	this.elVideo.style.display = 'block';
	this.showPlaceholder(false);
	this.elVideo.src = i_source.src;
	try { this.elVideo.load(); } catch (err) {}
	this.setMessage('');
	this.resize();
	this.showVideoMode();
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
		if (this.m_viewingSteps == false)
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

	if (this.m_viewingSteps == false)
		this.elSources.style.display = 'block';
};

VideoPreview.prototype.stop = function()
{
	try { this.elVideo.pause(); } catch (err) {}
};
