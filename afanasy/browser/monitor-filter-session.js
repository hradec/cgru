"use strict";

(function() {
	if (typeof Monitor === 'undefined')
		return;

	var OriginalMonitor = Monitor;
	var proto = OriginalMonitor.prototype;
	if (proto.initFilterSessionPersist)
		return;

	var FilterStoragePrefix = 'monitor_filter_text_';

	proto.getFilterStorageKey = function() {
		var key = FilterStoragePrefix + this.type;
		if (this.type === 'tasks' && this.job_id != null)
			key += '_' + this.job_id;
		if (this.nodeConstructor && this.nodeConstructor.filterVisor && typeof g_VISOR === 'function' && g_VISOR())
			key += '_visor';
		return key;
	};

	proto.applyFilterFromText = function(i_text, i_opts) {
		var silent = i_opts && i_opts.silent;
		this.filterExpr = null;
		if (i_text && i_text.length)
		{
			if (!silent)
				this.info('Filter: ' + i_text);
			try
			{
				this.filterExpr = new RegExp(i_text, 'i');
			}
			catch (err)
			{
				this.filterExpr = null;
				if (!silent)
					this.error(err.message);
			}
		}
		this.filterItems();
	};

	proto.persistFilterText = function() {
		var key = this.getFilterStorageKey();
		try
		{
			sessionStorage[key] = this.elCtrlFilterInput.textContent;
		}
		catch (err)
		{
		}
	};

	proto.initFilterSessionPersist = function() {
		var key = this.getFilterStorageKey();
		var saved = null;
		try
		{
			saved = sessionStorage[key];
		}
		catch (err)
		{
			saved = null;
		}
		if (saved == null)
			return;
		this.elCtrlFilterInput.textContent = saved;
		this.applyFilterFromText(saved, {silent: true});
	};

	proto.filterKeyUp = function(i_evt) {
		if (i_evt && (i_evt.keyCode == 13 || i_evt.keyCode == 27))
		{
			i_evt.currentTarget.blur();
			i_evt.stopPropagation();
		}
		var expr = this.elCtrlFilterInput.textContent;
		this.applyFilterFromText(expr);
		this.persistFilterText();
	};

	function MonitorWithFilterPersist(i_args) {
		OriginalMonitor.call(this, i_args);
		if (this.initFilterSessionPersist)
			this.initFilterSessionPersist();
	}

	MonitorWithFilterPersist.prototype = proto;
	MonitorWithFilterPersist.prototype.constructor = MonitorWithFilterPersist;

	for (var prop in OriginalMonitor)
		if (Object.prototype.hasOwnProperty.call(OriginalMonitor, prop))
			MonitorWithFilterPersist[prop] = OriginalMonitor[prop];

	Monitor = MonitorWithFilterPersist;
})();
