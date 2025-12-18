/**
 * Minimal MTLLoader compatible with THREE r128 (enough for map_Kd).
 * Based on three.js examples/jsm/loaders/MTLLoader.js (MIT).
 */
"use strict";

(function() {
	if (typeof THREE === 'undefined')
		return;

	THREE.MTLLoader = function(manager)
	{
		this.manager = (manager !== undefined) ? manager : THREE.DefaultLoadingManager;
		this.materialOptions = {};
		this.path = '';
		this.resourcePath = '';
	};

	THREE.MTLLoader.prototype = {
		constructor: THREE.MTLLoader,

		setPath: function(path)
		{
			this.path = path || '';
			return this;
		},

		setResourcePath: function(path)
		{
			this.resourcePath = path || '';
			return this;
		},

		setMaterialOptions: function(value)
		{
			this.materialOptions = value || {};
			return this;
		},

		load: function(url, onLoad, onProgress, onError)
		{
			var scope = this;
			var loader = new THREE.FileLoader(this.manager);
			loader.setPath(this.path);
			loader.load(url, function(text) {
				try
				{
					onLoad(scope.parse(text, scope.resourcePath || scope.path));
				}
				catch (err)
				{
					if (onError) onError(err);
				}
			}, onProgress, onError);
		},

		parse: function(text, path)
		{
			var lines = text.split('\n');
			var info = {};
			var delimiterPattern = /\s+/;
			var materialsInfo = {};

			for (var i = 0; i < lines.length; i++)
			{
				var line = lines[i].trim();
				if (line.length === 0 || line.charAt(0) === '#')
					continue;

				var pos = line.indexOf(' ');
				var key = (pos >= 0) ? line.substring(0, pos) : line;
				key = key.toLowerCase();
				var value = (pos >= 0) ? line.substring(pos + 1).trim() : '';

				if (key === 'newmtl')
				{
					info = {"name": value};
					materialsInfo[value] = info;
				}
				else if (info)
				{
					if (key === 'kd' || key === 'ka' || key === 'ks')
						info[key] = value.split(delimiterPattern, 3);
					else
						info[key] = value;
				}
			}

			var creator = new THREE.MTLLoader.MaterialCreator(path || '');
			creator.setMaterialOptions(this.materialOptions);
			creator.setMaterialsInfo(materialsInfo);
			return creator;
		}
	};

	THREE.MTLLoader.MaterialCreator = function(baseUrl)
	{
		this.baseUrl = baseUrl || '';
		this.options = {};
		this.materialsInfo = {};
		this.materials = {};
		this.materialsArray = [];
		this.nameLookup = {};
		this.side = THREE.FrontSide;
		this.wrap = THREE.RepeatWrapping;
		this.crossOrigin = 'anonymous';
	};

	THREE.MTLLoader.MaterialCreator.prototype = {
		constructor: THREE.MTLLoader.MaterialCreator,

		setCrossOrigin: function(value)
		{
			this.crossOrigin = value;
			return this;
		},

		setMaterialOptions: function(value)
		{
			this.options = value || {};
			return this;
		},

		setMaterialsInfo: function(materialsInfo)
		{
			this.materialsInfo = materialsInfo || {};
			return this;
		},

		preload: function()
		{
			for (var name in this.materialsInfo)
				this.create(name);
		},

		getAsArray: function()
		{
			var index = 0;
			this.materialsArray = [];
			this.nameLookup = {};

			for (var name in this.materialsInfo)
			{
				this.materialsArray.push(this.create(name));
				this.nameLookup[name] = index;
				index++;
			}

			return this.materialsArray;
		},

		create: function(materialName)
		{
			if (this.materials[materialName] !== undefined)
				return this.materials[materialName];

			var mat = this.createMaterial_(materialName);
			this.materials[materialName] = mat;
			return mat;
		},

		createMaterial_: function(materialName)
		{
			var scope = this;
			var matInfo = this.materialsInfo[materialName];
			var params = {
				"name": materialName,
				"side": THREE.DoubleSide,
				"color": 0xffffff
			};

			if (matInfo)
			{
				// Use diffuse color only when there is no texture map.
				if ((false == matInfo.map_kd) && matInfo.kd)
					params.color = new THREE.Color().fromArray(matInfo.kd.map(parseFloat));
				if (matInfo.d !== undefined)
				{
					var d = parseFloat(matInfo.d);
					if (d < 1.0)
					{
						params.opacity = d;
						params.transparent = true;
					}
				}
				if (matInfo.tr !== undefined)
				{
					var tr = parseFloat(matInfo.tr);
					if (tr > 0.0)
					{
						params.opacity = 1.0 - tr;
						params.transparent = true;
					}
				}
			}

			// Unlit material (texture should display as-is).
			var material = new THREE.MeshBasicMaterial(params);

			// Diffuse map:
			if (matInfo && matInfo.map_kd)
			{
				var mapPath = matInfo.map_kd ? ('' + matInfo.map_kd).trim() : '';
				var mapFile = '';

				// If it contains a quoted filename (common for spaces), use it.
				var q0 = mapPath.indexOf('\"');
				var q1 = mapPath.lastIndexOf('\"');
				if ((q0 != -1) && (q1 > q0))
				{
					mapFile = mapPath.substring(q0 + 1, q1);
				}
				else
				{
					// Otherwise take the last token (handles most option-prefixed forms).
					var tokens = mapPath.split(/\s+/);
					mapFile = tokens[tokens.length - 1];
				}

				mapFile = mapFile.replace(/^\"|\"$/g, '');

				var full = mapFile;
				if (mapFile && (mapFile.charAt(0) == '/' || mapFile.charAt(0) == '\\' || /^[a-zA-Z]:/.test(mapFile)))
				{
					// Absolute path on disk:
					if (typeof cgru_ProjectServerLink === 'function')
						full = cgru_ProjectServerLink(mapFile);
				}
				else if (scope.baseUrl)
				{
					var encoded = encodeURIComponent(mapFile).replace(/%2F/gi, '/');
					full = scope.baseUrl + encoded;
				}

				var texLoader = new THREE.TextureLoader();
				texLoader.setCrossOrigin(scope.crossOrigin);
				var tex = texLoader.load(full, function(loaded) {
					loaded.wrapS = scope.wrap;
					loaded.wrapT = scope.wrap;
					loaded.needsUpdate = true;
					material.needsUpdate = true;
				}, null, function(err) {
					console.warn('MTLLoader: texture load failed:', full, err);
				});
				tex.wrapS = scope.wrap;
				tex.wrapT = scope.wrap;
				material.map = tex;
				material.needsUpdate = true;
			}

			return material;
		}
	};
})();
