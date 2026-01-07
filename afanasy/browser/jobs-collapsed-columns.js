"use strict";

(function() {
	if ((typeof JobNode === 'undefined') || (typeof JobBlock === 'undefined'))
		return;

	var CompactBarWidth = 10;
	var CompactBarHeight = 16;

	var proto = JobBlock.prototype;
	if (proto.updateCompactProgress)
		return;

	var originalUpdate = proto.update;
	var originalSetSelected = proto.setSelected;
	var originalApplyOpenState = JobNode.prototype.applyOpenState;
	var originalJobUpdate = JobNode.prototype.update;

	JobNode.prototype.ensureCollapsedBlocksContainer = function() {
		if (this.elCollapsedBlocks)
			return this.elCollapsedBlocks;

		var doc = this.element ? this.element.ownerDocument : document;
		this.elCollapsedBlocks = doc.createElement('span');
		this.elCollapsedBlocks.classList.add('job_collapsed_blocks');

		if ((this.elResetPPA != null) && this.elResetPPA.parentNode)
			this.elResetPPA.parentNode.insertBefore(this.elCollapsedBlocks, this.elResetPPA.nextSibling);
		else if (this.element)
			this.element.appendChild(this.elCollapsedBlocks);

		return this.elCollapsedBlocks;
	};

	JobNode.prototype.scheduleCollapsedBlocksLayout = function() {
		if (this.m_collapsed_blocks_layout_pending)
			return;

		this.m_collapsed_blocks_layout_pending = true;
		var self = this;
		var schedule = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : null;
		if (schedule == null)
			schedule = function(cb) { return setTimeout(cb, 0); };

		schedule(function() {
			self.m_collapsed_blocks_layout_pending = false;
			self.updateCollapsedBlocksWidth();
		});
	};

	JobNode.refreshCollapsedLayouts = function() {
		var monitors = null;
		if ((typeof g_cur_monitor !== 'undefined') && g_cur_monitor && (g_cur_monitor.type == 'jobs'))
			monitors = [g_cur_monitor];
		else if ((typeof g_monitors !== 'undefined') && (g_monitors != null))
			monitors = g_monitors;

		if (monitors == null)
			return;

		for (var i = 0; i < monitors.length; i++)
		{
			var monitor = monitors[i];
			if ((monitor == null) || (monitor.type != 'jobs') || (monitor.items == null))
				continue;
			for (var j = 0; j < monitor.items.length; j++)
				if (monitor.items[j].scheduleCollapsedBlocksLayout)
					monitor.items[j].scheduleCollapsedBlocksLayout();
		}
	};

	JobNode.scheduleGlobalCollapsedRefresh = function() {
		if (JobNode.m_collapsed_refresh_pending)
			return;
		JobNode.m_collapsed_refresh_pending = true;
		var schedule = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : null;
		if (schedule == null)
			schedule = function(cb) { return setTimeout(cb, 0); };
		schedule(function() {
			JobNode.m_collapsed_refresh_pending = false;
			JobNode.refreshCollapsedLayouts();
		});
	};

	if (typeof window !== 'undefined')
	{
		window.addEventListener('resize', function() {
			JobNode.scheduleGlobalCollapsedRefresh();
		});
		window.addEventListener('cgru:monitor-panel-resize', function() {
			JobNode.scheduleGlobalCollapsedRefresh();
		});
	}

	JobNode.prototype.updateCollapsedBlocksWidth = function() {
		if (this.elCollapsedBlocks == null)
			return;
		if (false == this.element.classList.contains('collapsed'))
		{
			if (this.elNameWrap)
				this.elNameWrap.style.maxWidth = '';
			return;
		}

		var nameRect = this.elNameWrap ? this.elNameWrap.getBoundingClientRect() : null;
		var resetRect = this.elResetPPA ? this.elResetPPA.getBoundingClientRect() : null;
		var itemRect = this.element.getBoundingClientRect();
		var topEdge = nameRect ? nameRect.top : itemRect.top;
		var bottomEdge = nameRect ? nameRect.bottom : (topEdge + CompactBarHeight);
		var midEdge = itemRect.left + (itemRect.width * 0.5);
		var leftEdge = midEdge;
		var rightEdge = this.getCollapsedBlocksRightEdge(itemRect, topEdge, bottomEdge);
		if ((resetRect != null) && (resetRect.left < rightEdge))
			rightEdge = resetRect.left;

		leftEdge += 4;
		rightEdge -= 4;

		var available = rightEdge - leftEdge;
		if (available < 0)
			available = 0;

		var nameLeft = nameRect ? nameRect.left : itemRect.left;
		var nameMax = Math.floor(leftEdge - nameLeft - 8);
		if (nameMax < 40)
			nameMax = 40;
		if (this.elNameWrap)
			this.elNameWrap.style.maxWidth = nameMax + 'px';

		var height = CompactBarHeight;
		if ((nameRect != null) && (nameRect.height > 0))
			height = Math.min(CompactBarHeight, Math.floor(nameRect.height));
		if (height < 8)
			height = 8;

		var topOffset = topEdge - itemRect.top;
		if ((nameRect != null) && (nameRect.height > height))
			topOffset += Math.floor((nameRect.height - height) / 2);

		var width = Math.floor(available);
		if (this.elCollapsedBlocks.m_width == width)
		{
			this.elCollapsedBlocks.style.top = Math.floor(topOffset) + 'px';
			this.elCollapsedBlocks.style.left = Math.floor(leftEdge - itemRect.left) + 'px';
			this.elCollapsedBlocks.style.height = height + 'px';
			return;
		}

		this.elCollapsedBlocks.m_width = width;
		this.elCollapsedBlocks.style.width = width + 'px';
		this.elCollapsedBlocks.style.top = Math.floor(topOffset) + 'px';
		this.elCollapsedBlocks.style.left = Math.floor(leftEdge - itemRect.left) + 'px';
		this.elCollapsedBlocks.style.height = height + 'px';

		if (this.blocks)
			for (var b = 0; b < this.blocks.length; b++)
				if (this.blocks[b].updateCompactProgress)
					this.blocks[b].updateCompactProgress();
	};

	JobNode.prototype.getCollapsedBlocksRightEdge = function(i_itemRect, i_top, i_bottom) {
		var rightEdge = i_itemRect.right;
		var candidates = [
			this.elResetPPA,
			this.elUserName,
			this.elETA,
			this.elTime,
			this.elWork,
			this.elLifeTime,
			this.elPPApproval,
			this.elMaintenance,
			this.elIgnoreNimby,
			this.elIgnorePaused,
			this.elDependMask,
			this.elDependMaskGlobal,
			this.elNeedProperties,
			this.elNeedOS,
			this.elRunTime
		];

		for (var i = 0; i < candidates.length; i++)
		{
			var el = candidates[i];
			if ((el == null) || (el.offsetParent == null))
				continue;

			var rect = el.getBoundingClientRect();
			if ((rect.bottom <= i_top) || (rect.top >= i_bottom))
				continue;

			if (rect.left < rightEdge)
				rightEdge = rect.left;
		}

		return rightEdge;
	};
	var OriginalJobBlock = JobBlock;

	function progressCharToColor(i_char) {
		switch (i_char)
		{
			case 'r': return null;
			case 'D': return (typeof BarDONrgb !== 'undefined') ? BarDONrgb : '#363';
			case 'S': return (typeof BarSKPrgb !== 'undefined') ? BarSKPrgb : '#444';
			case 'G': return (typeof BarDWRrgb !== 'undefined') ? BarDWRrgb : '#2C2';
			case 'U': return (typeof BarSUSrgb !== 'undefined') ? BarSUSrgb : '#AA1';
			case 'W': return (typeof BarWDPrgb !== 'undefined') ? BarWDPrgb : '#A2A';
			case 'R': return (typeof BarRUNrgb !== 'undefined') ? BarRUNrgb : '#FF0';
			case 'N': return (typeof BarRWRrgb !== 'undefined') ? BarRWRrgb : '#FA0';
			case 'Y': return (typeof BarRERrgb !== 'undefined') ? BarRERrgb : '#F77';
			case 'E': return (typeof BarERRrgb !== 'undefined') ? BarERRrgb : '#F00';
			case 'C': return (typeof BarWRCrgb !== 'undefined') ? BarWRCrgb : '#4AC';
		}
		return null;
	}

	proto.ensureCompactBar = function() {
		var container = (this.job && this.job.ensureCollapsedBlocksContainer) ?
			this.job.ensureCollapsedBlocksContainer() : null;

		if (this.elCompact)
		{
			if (container && this.elCompact.parentNode !== container)
				container.appendChild(this.elCompact);
			return;
		}

		this.elCompact = document.createElement('div');
		this.elCompact.classList.add('jobblock_compact');
		this.elCompact.style.width = 'auto';
		this.elCompact.style.height = '100%';

		this.elCompactCanvas = document.createElement('canvas');
		this.elCompact.appendChild(this.elCompactCanvas);
		this.elCompactCanvas.style.width = '100%';
		this.elCompactCanvas.style.height = '100%';

		this.elCompactLabel = document.createElement('span');
		this.elCompactLabel.classList.add('jobblock_compact_label');
		this.elCompact.appendChild(this.elCompactLabel);
		if (typeof window !== 'undefined')
		{
			var style = window.getComputedStyle(this.elCompactLabel);
			if (style && style.font)
				this.elCompactLabelFont = style.font;
		}

		this.elCompactCtx = this.elCompactCanvas.getContext('2d');
		this.elCompactCtx.lineWidth = 1;
		this.elCompactCtx.lineCap = 'square';

		if (container)
			container.appendChild(this.elCompact);
		else
			this.elRoot.appendChild(this.elCompact);
	};

	proto.updateCompactProgress = function() {
		if ((this.elCompactCtx == null) || (this.elCompactCanvas == null))
			return;

		var progress = this.params ? this.params.p_progressbar : null;
		var width = (this.elCompact && this.elCompact.clientWidth) ? this.elCompact.clientWidth : CompactBarWidth;
		var height = (this.elCompact && this.elCompact.clientHeight) ? this.elCompact.clientHeight : CompactBarHeight;
		if (width <= 0)
			width = CompactBarWidth;
		if (height <= 0)
			height = CompactBarHeight;

		var dpr = window.devicePixelRatio || 1;
		var canvasWidth = Math.max(1, Math.round(width * dpr));
		var canvasHeight = Math.max(1, Math.round(height * dpr));
		if ((this.elCompactCanvas.width != canvasWidth) || (this.elCompactCanvas.height != canvasHeight))
		{
			this.elCompactCanvas.width = canvasWidth;
			this.elCompactCanvas.height = canvasHeight;
			this.elCompactCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
			this.elCompactCtx.lineWidth = 1;
			this.elCompactCtx.lineCap = 'square';
		}

		this.elCompactCtx.clearRect(0, 0, width, height);
		if ((progress == null) || (progress.length == 0))
		{
			if (this.elCompactLabel)
				this.elCompactLabel.textContent = '';
			return;
		}

		var len = progress.length;
		for (var y = 0; y < height; y++)
		{
			var idx = Math.floor((height - 1 - y) * len / height);
			var rgb = progressCharToColor(progress.charAt(idx));
			if (rgb == null)
				continue;
			this.elCompactCtx.strokeStyle = rgb;
			this.elCompactCtx.beginPath();
			this.elCompactCtx.moveTo(0, y + 0.5);
			this.elCompactCtx.lineTo(width, y + 0.5);
			this.elCompactCtx.stroke();
		}

		if (this.elCompactLabel)
		{
			var label = '';
			var name = (this.params && this.params.name) ? '' + this.params.name : '';
			var maxWidth = width - 2;
			if ((name.length > 0) && (maxWidth > 2))
			{
				if ((this.elCompactLabelFont == null) || (this.elCompactLabelFont.length == 0))
				{
					var style = window.getComputedStyle(this.elCompactLabel);
					this.elCompactLabelFont = style && style.font ? style.font : 'bold 9px Arial';
				}
				this.elCompactCtx.font = this.elCompactLabelFont;
				if (this.elCompactCtx.measureText(name).width <= maxWidth)
					label = name;
				else
				{
					var lo = 0;
					var hi = name.length;
					while (lo < hi)
					{
						var mid = Math.floor((lo + hi) / 2);
						var test = name.substring(mid);
						if (this.elCompactCtx.measureText(test).width <= maxWidth)
							hi = mid;
						else
							lo = mid + 1;
					}
					label = name.substring(lo);
				}
			}
			this.elCompactLabel.textContent = label;
		}

		if (this.params && this.params.name)
			this.elCompact.title = this.params.name;
	};

	proto.updateCompactFlex = function(i_isCurrent) {
		if (this.elCompact == null)
			return;
		this.elCompact.style.flexGrow = i_isCurrent ? 3 : 1;
		this.elCompact.style.flexShrink = '1';
		this.elCompact.style.flexBasis = '0px';
	};

	proto.update = function(i_displayFull) {
		originalUpdate.call(this, i_displayFull);
		this.ensureCompactBar();
		this.updateCompactProgress();
		this.updateCompactFlex(false);
		if (this.elCompact)
			this.elCompact.classList.toggle('selected', this.selected);
	};

	proto.setSelected = function(i_select) {
		originalSetSelected.call(this, i_select);
		if (this.elCompact)
			this.elCompact.classList.toggle('selected', this.selected);
	};

	JobNode.prototype.applyOpenState = function() {
		originalApplyOpenState.call(this);
		this.updateCompactCurrentBlock();
		this.scheduleCollapsedBlocksLayout();
	};

	JobNode.prototype.updateCompactCurrentBlock = function() {
		if ((this.blocks == null) || (this.blocks.length == 0))
			return;

		var current = null;
		var bestScore = -1;
		var bestMetric = -1;
		for (var b = 0; b < this.blocks.length; b++)
		{
			var block = this.blocks[b];
			var params = block.params || {};
			var running = params.running_tasks_counter ? params.running_tasks_counter : 0;
			var ready = params.p_tasks_ready ? params.p_tasks_ready : 0;
			var done = params.p_tasks_done ? params.p_tasks_done : 0;
			var total = block.tasks_num ? block.tasks_num : 0;

			var score = 0;
			var metric = 0;
			if (running > 0)
			{
				score = 3;
				metric = running;
			}
			else if (ready > 0)
			{
				score = 2;
				metric = ready;
			}
			else if ((total > 0) && (done < total))
			{
				score = 1;
			}

			if ((score > bestScore) || ((score == bestScore) && (metric > bestMetric)))
			{
				bestScore = score;
				bestMetric = metric;
				current = block;
			}
		}

		if (bestScore <= 0)
			current = null;

		for (var b = 0; b < this.blocks.length; b++)
			this.blocks[b].updateCompactFlex(this.blocks[b] === current);
	};

	JobNode.prototype.update = function(i_obj) {
		originalJobUpdate.call(this, i_obj);
		this.ensureCollapsedBlocksContainer();
		this.updateCompactCurrentBlock();
		this.scheduleCollapsedBlocksLayout();
	};

	function JobBlockWithCompact(i_elParent, i_block) {
		OriginalJobBlock.call(this, i_elParent, i_block);
		this.ensureCompactBar();
	}

	JobBlockWithCompact.prototype = proto;
	JobBlockWithCompact.prototype.constructor = JobBlockWithCompact;
	for (var prop in OriginalJobBlock)
		if (Object.prototype.hasOwnProperty.call(OriginalJobBlock, prop))
			JobBlockWithCompact[prop] = OriginalJobBlock[prop];

	JobBlock = JobBlockWithCompact;
})();
