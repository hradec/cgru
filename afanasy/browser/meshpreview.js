"use strict";

function MeshPreview(i_parent, i_message_parent)
{
	this.parent = i_parent;
	this.messageParent = i_message_parent ? i_message_parent : i_parent;
	this.currentSources = null;
	this.mesh = null;
	this.textureLoader = null;
	this.resizeObserver = null;

	this.elCanvas = document.createElement('div');
	this.elCanvas.classList.add('mesh_preview_canvas');
	this.parent.appendChild(this.elCanvas);

	this.elMessage = document.createElement('div');
	this.elMessage.classList.add('mesh_preview_message');
	this.messageParent.appendChild(this.elMessage);

	this.animate = this.animate.bind(this);

	this.initRenderer();
	this.attachResizeHandler();
	this.setMessage('Select a job to view its mesh preview.');
}

MeshPreview.prototype.initRenderer = function()
{
	if ((typeof THREE === 'undefined') ||
		(typeof THREE.OBJLoader === 'undefined') ||
		this.renderer)
		return;

	this.scene = new THREE.Scene();
	this.scene.background = new THREE.Color(0x2A2A2A);

	this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
	this.camera.position.set(0, 0, 4);
	this.raycaster = new THREE.Raycaster();
	this.pointer = new THREE.Vector2();

	this.renderer = new THREE.WebGLRenderer({"antialias": true, "alpha": true});
	this.renderer.setPixelRatio(window.devicePixelRatio || 1);
	this.elCanvas.appendChild(this.renderer.domElement);
	this.renderer.domElement.addEventListener('dblclick', this.onDoubleClick.bind(this));

	this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
	this.controls.enableDamping = true;
	this.controls.dampingFactor = 0.05;
	this.controls.enablePan = false;

	this.textureLoader = new THREE.TextureLoader();

	this.resize();
	this.start();
};

MeshPreview.prototype.attachResizeHandler = function()
{
	if (this.resizeObserver || !window.ResizeObserver)
	{
		window.addEventListener('resize', this.resize.bind(this));
		return;
	}

	this.resizeObserver = new ResizeObserver(this.resize.bind(this));
	this.resizeObserver.observe(this.parent);
};

MeshPreview.prototype.resize = function()
{
	if ((this.renderer == null) || (this.camera == null))
		return;

	var width = this.elCanvas.clientWidth;
	var height = this.elCanvas.clientHeight;
	if ((width <= 0) || (height <= 0))
	{
		var bounds = this.parent.getBoundingClientRect();
		width = bounds.width;
		height = bounds.height;
	}
	if (height <= 0)
		height = 200;

	this.renderer.setSize(width, height);
	this.camera.aspect = width / height;
	this.camera.updateProjectionMatrix();
};

MeshPreview.prototype.start = function()
{
	if (this.isAnimating)
		return;

	this.isAnimating = true;
	requestAnimationFrame(this.animate);
};

MeshPreview.prototype.animate = function()
{
	if (false == this.isAnimating)
		return;

	if (this.controls)
		this.controls.update();

	if (this.renderer && this.scene && this.camera)
		this.renderer.render(this.scene, this.camera);

	requestAnimationFrame(this.animate);
};

MeshPreview.prototype.clearMesh = function()
{
	if ((this.mesh == null) || (this.scene == null))
		return;

	this.scene.remove(this.mesh);
	this.mesh.traverse(function(child) {
		if (child.isMesh && child.geometry)
			child.geometry.dispose();
		if (child.material)
		{
			if (Array.isArray(child.material))
				child.material.forEach(function(mat) { mat.dispose(); });
			else
				child.material.dispose();
		}
	});
	this.mesh = null;
};

MeshPreview.prototype.setMessage = function(i_text)
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

MeshPreview.prototype.load = function(i_sources)
{
	if ((i_sources == null) || (i_sources.obj == null))
	{
		this.currentSources = null;
		this.clearMesh();
		this.setMessage('Mesh preview not available.');
		return;
	}

	if ((this.currentSources != null) &&
		(this.currentSources.obj == i_sources.obj) &&
		(this.currentSources.texture == i_sources.texture))
		return;

	this.initRenderer();

	if (this.renderer == null)
	{
		this.setMessage('Mesh preview requires WebGL.');
		return;
	}

	this.currentSources = {
		"obj": i_sources.obj,
		"texture": i_sources.texture
	};

	this.setMessage('Loading mesh preview…');
	this.clearMesh();

	var self = this;
	var loader = new THREE.OBJLoader();

	loader.load(
		i_sources.obj,
		function(object) { self.onMeshLoaded(object, i_sources.texture); },
		null,
		function() { self.onMeshFailed(); }
	);
};

MeshPreview.prototype.onMeshLoaded = function(i_object, i_texture)
{
	var self = this;

	var getPreviewUrl = function(image)
	{
		if (image == null)
			return null;

		try
		{
			if (image.src && image.src.length)
				return image.src;
			if (image.toDataURL)
				return image.toDataURL('image/png');
			if ((typeof ImageBitmap !== 'undefined') && image instanceof ImageBitmap)
			{
				var canvas = document.createElement('canvas');
				canvas.width = image.width;
				canvas.height = image.height;
				var ctx = canvas.getContext('2d');
				ctx.drawImage(image, 0, 0);
				return canvas.toDataURL('image/png');
			}
		}
		catch (err)
		{
			console.warn('MeshPreview: texture preview conversion failed', err);
		}

		return null;
	};

	var ensureGeometryNormals = function(child)
	{
		if ((child == null) || (child.geometry == null))
			return;

		var geometry = child.geometry;
		var hasNormals = false;
		if (geometry.getAttribute)
			hasNormals = geometry.getAttribute('normal') != null;
		else if (geometry.attributes)
			hasNormals = geometry.attributes.normal != null;

		if (false == hasNormals)
		{
			if (geometry.computeVertexNormals)
				geometry.computeVertexNormals();
		}
	};

	var configureTexture = function(map)
	{
		if ((map == null) || (map.image == null))
			return map;

		var maxTexture = (self.renderer && self.renderer.capabilities) ?
			self.renderer.capabilities.maxTextureSize : 4096;
		var width = map.image.width || 0;
		var height = map.image.height || 0;

		if ((width > maxTexture) || (height > maxTexture))
		{
			var scale = Math.min(maxTexture / Math.max(1, width), maxTexture / Math.max(1, height));
			var canvas = document.createElement('canvas');
			canvas.width = Math.max(1, Math.floor(width * scale));
			canvas.height = Math.max(1, Math.floor(height * scale));
			var ctx = canvas.getContext('2d');
			ctx.drawImage(map.image, 0, 0, canvas.width, canvas.height);
			map.image = canvas;
			width = canvas.width;
			height = canvas.height;
		}

		var isPowerOfTwo = function(value)
		{
			return (value > 0) && ((value & (value - 1)) === 0);
		};

		if ((false == isPowerOfTwo(width)) || (false == isPowerOfTwo(height)))
		{
			map.wrapS = THREE.ClampToEdgeWrapping;
			map.wrapT = THREE.ClampToEdgeWrapping;
			map.generateMipmaps = false;
			map.minFilter = THREE.LinearFilter;
			map.magFilter = THREE.LinearFilter;
		}

			map.needsUpdate = true;

			console.log('MeshPreview: texture info',
				width + 'x' + height,
				'max', maxTexture,
				'minFilter', map.minFilter,
				'wrap', map.wrapS + '/' + map.wrapT,
				'mipmaps', map.generateMipmaps);

			try
			{
				if (width > 0 && height > 0)
				{
					var sampleCanvas = document.createElement('canvas');
					sampleCanvas.width = 1;
					sampleCanvas.height = 1;
					var sampleCtx = sampleCanvas.getContext('2d');
					var sx = Math.max(0, Math.min(width - 1, Math.floor(width * 0.5)));
					var sy = Math.max(0, Math.min(height - 1, Math.floor(height * 0.5)));
					sampleCtx.drawImage(map.image, sx, sy, 1, 1, 0, 0, 1, 1);
					var sample = sampleCtx.getImageData(0, 0, 1, 1).data;
					console.log('MeshPreview: texture sample RGBA', sample[0], sample[1], sample[2], sample[3]);
				}
			}
			catch (err)
			{
				console.warn('MeshPreview: texture sample failed', err);
			}

			return map;
		};

	var applyMaterial = function(map)
	{
		var mapSource = (map && map.image && map.image.src) ? map.image.src : null;
		if (map)
			map = configureTexture(map);
		if (map)
			console.log('MeshPreview: using texture', self.currentSources ? mapSource : null);
		else
			console.log('MeshPreview: no texture fallback for', self.currentSources ? self.currentSources.obj : null);

		var material;
		var addWireframe = false;
		if (map)
		{
				var previewUrl = getPreviewUrl(map.image);
				if (previewUrl)
					self.elCanvas.style.backgroundImage = 'url(' + previewUrl + ')';
				else
					self.elCanvas.style.backgroundImage = '';
					material = new THREE.ShaderMaterial({
						uniforms: {
							uMap: { value: map },
							// xy = scale, zw = offset
							uUvTransform: { value: new THREE.Vector4(1, 1, 0, 0) },
							// 0.0 = no flip, 1.0 = flip
							uFlipU: { value: 0.0 },
						uFlipV: { value: 0.0 }
					},
					vertexShader: `
						varying vec2 vUv;
						void main() {
						  vUv = uv;
						  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
						}
					`,
					fragmentShader: `
						uniform sampler2D uMap;
						uniform vec4 uUvTransform;
						uniform float uFlipU;
						uniform float uFlipV;
						varying vec2 vUv;
						void main() {
						  vec2 uv = vUv * uUvTransform.xy + uUvTransform.zw;
						  if (uFlipU > 0.5) uv.x = 1.0 - uv.x;
						  if (uFlipV > 0.5) uv.y = 1.0 - uv.y;

						  // If UVs are outside 0..1 (very common), wrap them in shader.
						  // This also works around WebGL1 NPOT limitations (texture wrap must be ClampToEdge).
						  uv = fract(uv);

						  vec4 tex = texture2D(uMap, uv);
						  gl_FragColor = vec4(tex.r, tex.g, tex.b, 1.0);
						//   gl_FragColor = vec4(vUv.r,vUv.g,0.0, 1.0);
						}
					`,
					side: THREE.DoubleSide
				});
		}
		else
		{
			self.elCanvas.style.backgroundImage = '';
			material = new THREE.ShaderMaterial({
					"uniforms": {},
					"vertexShader":
						"varying vec2 vUv;" +
						"void main() {" +
						"  vUv = uv;" +
						"  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);" +
						"}",
					"fragmentShader":
						"varying vec2 vUv;" +
						"void main() {" +
						"  vec3 color = vec3(vUv, 0.5);" +
						"  gl_FragColor = vec4(color, 1.0);" +
						"}",
					"side": THREE.DoubleSide
			});
			addWireframe = true;
		}

		i_object.traverse(function(child) {
			if (child.isMesh)
			{
					ensureGeometryNormals(child);
					var mat = material.clone();
					if (map && mat.uniforms && mat.uniforms.uMap)
						mat.uniforms.uMap.value = map;
					child.material = mat;
					child.castShadow = false;
					child.receiveShadow = false;

					if (child.geometry && child.geometry.attributes && child.geometry.attributes.uv &&
						child.geometry.attributes.uv.array && (child.__meshpreviewLoggedUv !== true))
					{
						// try
						{
							var uvs = child.geometry.attributes.uv.array;
						var minU = 1e20, minV = 1e20, maxU = -1e20, maxV = -1e20;
						for (var i = 0; i < uvs.length; i += 2)
						{
							var u = uvs[i];
							var v = uvs[i + 1];
							if (u < minU) minU = u;
							if (v < minV) minV = v;
							if (u > maxU) maxU = u;
							if (v > maxV) maxV = v;
							}
							console.log('MeshPreview: UV range', minU, minV, '->', maxU, maxV);
							child.__meshpreviewLoggedUv = true;
						}
					// catch (err)
					// {
					// 	console.warn('MeshPreview: UV range calc failed', err);
					// }
				}

				if (addWireframe)
				{
					try
					{
						var edges = new THREE.EdgesGeometry(child.geometry, 25);
						var line = new THREE.LineSegments(
							edges,
							new THREE.LineBasicMaterial({"color": 0xffffff, "linewidth": 1})
						);
						line.name = 'meshpreview_wireframe';
						child.add(line);
					}
					catch (err)
					{
						console.warn('MeshPreview: wireframe failed', err);
					}
				}
			}
		});

		self.finalizeMesh(i_object);
	};
	if (i_texture && this.textureLoader)
	{
		this.textureLoader.load(
			i_texture,
			function(texture) { applyMaterial(texture); },
			null,
			function () {console.log('applyMaterial(null)'); }
		);
	}
	else
	{
		console.log('failed to load texture');
		applyMaterial(null);
	}
};

MeshPreview.prototype.finalizeMesh = function(i_object)
{
	var ensureCentered = function(object)
	{
		object.updateMatrixWorld(true);
		var box = new THREE.Box3().setFromObject(object);
		var center = box.getCenter(new THREE.Vector3());
		if (isFinite(center.x) && isFinite(center.y) && isFinite(center.z))
			object.position.sub(center);
		return box;
	};

	var box = ensureCentered(i_object);
	var size = box.getSize(new THREE.Vector3());
	var maxSize = Math.max(size.x, size.y, size.z);
	if (maxSize > 0)
	{
		var scale = 2.0 / maxSize;
		i_object.scale.set(scale, scale, scale);
	}

	i_object.rotation.z = Math.PI * -0.5;
	i_object.rotation.y = Math.PI;

	box = ensureCentered(i_object);

	this.scene.add(i_object);
	this.mesh = i_object;

	this.camera.position.set(0, 0, 4);
	if (this.controls)
	{
		this.controls.target.set(0, 0, 0);
		this.controls.update();
	}

	this.setMessage('');
};

MeshPreview.prototype.onMeshFailed = function()
{
	this.currentSources = null;
	this.clearMesh();
	this.setMessage('Unable to load mesh preview.');
};

MeshPreview.prototype.onDoubleClick = function(i_event)
{
	if ((this.renderer == null) || (this.camera == null) || (this.controls == null) || (this.mesh == null))
		return;

	if (i_event && i_event.preventDefault)
		i_event.preventDefault();

	var rect = this.renderer.domElement.getBoundingClientRect();
	var x = ((i_event.clientX - rect.left) / rect.width) * 2 - 1;
	var y = -((i_event.clientY - rect.top) / rect.height) * 2 + 1;

	this.pointer.set(x, y);
	this.raycaster.setFromCamera(this.pointer, this.camera);
	var intersects = this.raycaster.intersectObject(this.mesh, true);
	if ((intersects == null) || (intersects.length == 0))
		return;

	var point = intersects[0].point.clone();
	var offset = new THREE.Vector3();
	offset.copy(this.camera.position).sub(this.controls.target);

	this.controls.target.copy(point);
	this.camera.position.copy(point.clone().add(offset));
	this.controls.update();
};
