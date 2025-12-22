"use strict";

function MeshPreview(i_parent, i_message_parent)
{
	this.parent = i_parent;
	this.messageParent = i_message_parent ? i_message_parent : i_parent;
	this.currentSources = null;
	this.sources = null;
	this.sourcesKey = null;
	this.sourcesSelected = null;

	// Used to keep the user-chosen mesh orientation when switching between mesh sources.
	this.preservedMeshQuaternion = null;
	this.preservedMeshJobId = null;
	this.lastJobIdLoaded = null;

	// Current mesh folder and optional backup folder selection (provided by jobs.js).
	this.m_baseFolder = null;
	this.m_viewingBackup = false;
	this.m_versionOptionsKey = null;
	this.m_version_select_focused = false;
	this.onVersionChanged = null;

	this.renderMode = 'textured'; // textured | flat | wireframe
	this.flatMaterial = null;
	this.wireframeMaterial = null;
	this.mesh = null;
	this.textureLoader = null;
	this.headLight = null;
	this.resizeObserver = null;
	this.isDraggingResize = false;
	this.internalHeightAdjust = false;
	this.aspectRatio = null;
	this.lastWidth = null;
	this.isRotatingMesh = false;
	this.rotatePointerX = 0;
	this.rotatePointerY = 0;
	this.loadId = 0;

	this.elCanvas = document.createElement('div');
	this.elCanvas.classList.add('mesh_preview_canvas');
	this.parent.appendChild(this.elCanvas);

	this.elResizeHandle = document.createElement('div');
	this.elResizeHandle.classList.add('mesh_preview_resizer');
	this.elResizeHandle.title = 'Drag to resize mesh preview.';
	this.parent.appendChild(this.elResizeHandle);

	this.elVersionSelect = document.createElement('select');
	this.elVersionSelect.classList.add('mesh_preview_versions');
	this.elVersionSelect.title = 'Mesh version (current or backups).';
	this.elVersionSelect.style.display = 'none';
	this.parent.appendChild(this.elVersionSelect);

	this.elToolbar = document.createElement('div');
	this.elToolbar.classList.add('mesh_preview_toolbar');
	this.parent.appendChild(this.elToolbar);

	this.btnRenderTextured = document.createElement('button');
	this.btnRenderTextured.type = 'button';
	this.btnRenderTextured.classList.add('mesh_preview_toolbtn');
	this.btnRenderTextured.textContent = 'T';
	this.btnRenderTextured.title = 'Textured';
	this.elToolbar.appendChild(this.btnRenderTextured);

	this.btnRenderFlat = document.createElement('button');
	this.btnRenderFlat.type = 'button';
	this.btnRenderFlat.classList.add('mesh_preview_toolbtn');
	this.btnRenderFlat.textContent = 'F';
	this.btnRenderFlat.title = 'No texture';
	this.elToolbar.appendChild(this.btnRenderFlat);

	this.btnRenderWire = document.createElement('button');
	this.btnRenderWire.type = 'button';
	this.btnRenderWire.classList.add('mesh_preview_toolbtn');
	this.btnRenderWire.textContent = 'W';
	this.btnRenderWire.title = 'Wireframe';
	this.elToolbar.appendChild(this.btnRenderWire);

	this.elMessage = document.createElement('div');
	this.elMessage.classList.add('mesh_preview_message');
	this.messageParent.appendChild(this.elMessage);

	this.elSources = document.createElement('div');
	this.elSources.classList.add('mesh_preview_sources');
	this.messageParent.appendChild(this.elSources);

	this.animate = this.animate.bind(this);

	this.loadSizeFromStorage();
	this.loadRenderModeFromStorage();
	this.updateRenderModeButtons();
	this.attachResizeHandle();

	var stopBtnEvent = function(e)
	{
		if (e && e.stopPropagation) e.stopPropagation();
		if (e && e.preventDefault) e.preventDefault();
		return false;
	};
	this.btnRenderTextured.onmousedown = stopBtnEvent;
	this.btnRenderFlat.onmousedown = stopBtnEvent;
	this.btnRenderWire.onmousedown = stopBtnEvent;

	this.btnRenderTextured.onclick = function(e) { stopBtnEvent(e); return this.m_preview.setRenderMode('textured'); };
	this.btnRenderFlat.onclick = function(e) { stopBtnEvent(e); return this.m_preview.setRenderMode('flat'); };
	this.btnRenderWire.onclick = function(e) { stopBtnEvent(e); return this.m_preview.setRenderMode('wireframe'); };
	this.btnRenderTextured.m_preview = this;
	this.btnRenderFlat.m_preview = this;
	this.btnRenderWire.m_preview = this;

	var self = this;
	this.elVersionSelect.onfocus = function() { self.m_version_select_focused = true; };
	this.elVersionSelect.onblur = function() { self.m_version_select_focused = false; };
	this.elVersionSelect.onmousedown = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
	this.elVersionSelect.onchange = function(e) {
		if ((self.onVersionChanged != null) && (e != null) && (e.currentTarget != null))
			self.onVersionChanged(e.currentTarget.value);
	};

	this.initRenderer();
	this.attachResizeHandler();
	this.setMessage('Select a job to view its mesh preview.');
}

MeshPreview.prototype.setVersionOptions = function(i_options, i_selected_value, i_base_folder)
{
	if (this.elVersionSelect == null)
		return;

	if (i_base_folder != null)
		this.m_baseFolder = i_base_folder;

	if (this.m_version_select_focused)
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
		this.m_versionOptionsKey = null;
		this.elVersionSelect.style.display = 'none';
		this.elVersionSelect.disabled = true;
		while (this.elVersionSelect.firstChild)
			this.elVersionSelect.removeChild(this.elVersionSelect.firstChild);
		return;
	}

	// Keep the current selection if possible.
	var selected = (i_selected_value != null) ? ('' + i_selected_value) : ('' + this.elVersionSelect.value);
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

	if ((this.m_versionOptionsKey == key) && (this.elVersionSelect.value == selected))
		return;

	this.m_versionOptionsKey = key;

	while (this.elVersionSelect.firstChild)
		this.elVersionSelect.removeChild(this.elVersionSelect.firstChild);

	for (var i = 0; i < i_options.length; i++)
	{
		var opt = i_options[i];
		if ((opt == null) || (opt.value == null))
			continue;

		var elOpt = document.createElement('option');
		elOpt.value = '' + opt.value;
		elOpt.textContent = opt.label ? ('' + opt.label) : ('' + opt.value);
		this.elVersionSelect.appendChild(elOpt);
	}

	this.elVersionSelect.disabled = false;
	this.elVersionSelect.style.display = 'block';
	this.elVersionSelect.value = selected;

	if ((this.m_baseFolder != null) && (selected == this.m_baseFolder))
		this.m_viewingBackup = false;
	else if ((this.m_baseFolder != null) && (selected != this.m_baseFolder))
		this.m_viewingBackup = true;
};

MeshPreview.prototype.preserveMeshOrientation = function()
{
	if (this.mesh == null)
		return;

	this.preservedMeshQuaternion = this.mesh.quaternion.clone();
	this.preservedMeshJobId = (this.m_jobId != null) ? this.m_jobId : null;
};

MeshPreview.prototype.loadRenderModeFromStorage = function()
{
	var mode = localStorage['mesh_preview_render_mode'];
	if ((mode == 'textured') || (mode == 'flat') || (mode == 'wireframe'))
		this.renderMode = mode;
};

MeshPreview.prototype.saveRenderModeToStorage = function()
{
	try { localStorage['mesh_preview_render_mode'] = this.renderMode; } catch (err) {}
};

MeshPreview.prototype.updateRenderModeButtons = function()
{
	if (this.btnRenderTextured == null)
		return;

	this.btnRenderTextured.classList.toggle('active', this.renderMode == 'textured');
	this.btnRenderFlat.classList.toggle('active', this.renderMode == 'flat');
	this.btnRenderWire.classList.toggle('active', this.renderMode == 'wireframe');
};

MeshPreview.prototype.setRenderMode = function(i_mode)
{
	if ((i_mode != 'textured') && (i_mode != 'flat') && (i_mode != 'wireframe'))
		return;

	this.renderMode = i_mode;
	this.saveRenderModeToStorage();
	this.updateRenderModeButtons();
	this.applyRenderModeToMesh();
};

MeshPreview.prototype.applyRenderModeToMesh = function()
{
	if ((this.mesh == null) || (typeof THREE === 'undefined'))
		return;

	var self = this;

	var ensurePreviewMaterials = function()
	{
		if (self.wireframeMaterial == null)
			self.wireframeMaterial = new THREE.MeshBasicMaterial({
				'color': 0xDDDDDD,
				'wireframe': true,
				'side': THREE.DoubleSide
			});

		if (self.flatMaterial == null)
		{
			// "No texture" mode uses a lit material + a point light at the camera position.
			// This approximates a facing-ratio shader (dot(normal, viewDir)) without custom GLSL.
			self.flatMaterial = new THREE.MeshLambertMaterial({
				'color': 0xD0D0D0,
				'side': THREE.DoubleSide
			});
		}
	};

	ensurePreviewMaterials();

	var mode = this.renderMode;
	this.mesh.traverse(function(child) {
		if (!child.isMesh)
			return;

		if (child.userData == null)
			child.userData = {};

		if (child.userData.meshPreviewOriginalMaterial == null)
			child.userData.meshPreviewOriginalMaterial = child.material;

		if (mode == 'wireframe')
		{
			child.material = self.wireframeMaterial;
			return;
		}

		if (mode == 'flat')
		{
			// Flat shading needs normals.
			if (child.geometry && child.geometry.computeVertexNormals)
			{
				var geom = child.geometry;
				var hasNormals = false;
				if (geom.getAttribute)
					hasNormals = geom.getAttribute('normal') != null;
				else if (geom.attributes)
					hasNormals = geom.attributes.normal != null;
				if (false == hasNormals)
					geom.computeVertexNormals();
			}
			child.material = self.flatMaterial;
			return;
		}

		child.material = child.userData.meshPreviewOriginalMaterial;
	});
};

MeshPreview.prototype.loadSizeFromStorage = function()
{
	var h = parseInt(localStorage['mesh_preview_height']);
	if (isFinite(h) && h > 0)
		this.parent.style.height = h + 'px';

	var r = parseFloat(localStorage['mesh_preview_aspect']);
	if (isFinite(r) && r > 0.05)
		this.aspectRatio = r;
};

MeshPreview.prototype.saveSizeToStorage = function()
{
	var height = this.parent.clientHeight;
	if (height > 0)
		localStorage['mesh_preview_height'] = height;
	if (this.aspectRatio && this.aspectRatio > 0.05)
		localStorage['mesh_preview_aspect'] = this.aspectRatio;
};

MeshPreview.prototype.attachResizeHandle = function()
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
			self.resize();
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

MeshPreview.prototype.initRenderer = function()
{
	if ((typeof THREE === 'undefined') ||
		(typeof THREE.OBJLoader === 'undefined') ||
		this.renderer)
		return;

	this.scene = new THREE.Scene();
	this.scene.background = new THREE.Color(0x2A2A2A);

	// Lighting is used for "No texture" mode shading (camera-facing ratio).
	// Textured and wireframe modes use unlit materials.
	this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

	this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
	this.camera.position.set(0, 0, 4);
	this.headLight = new THREE.PointLight(0xffffff, 0.6);
	this.camera.add(this.headLight);
	this.scene.add(this.camera);
	this.raycaster = new THREE.Raycaster();
	this.pointer = new THREE.Vector2();

	this.renderer = new THREE.WebGLRenderer({"antialias": true, "alpha": true});
	this.renderer.setPixelRatio(window.devicePixelRatio || 1);
	this.elCanvas.appendChild(this.renderer.domElement);
	this.renderer.domElement.style.touchAction = 'none';
	this.renderer.domElement.addEventListener('dblclick', this.onDoubleClick.bind(this));

	this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
	this.controls.enableDamping = true;
	this.controls.dampingFactor = 0.05;
	this.controls.enablePan = false;
	// Use custom camera orbit to avoid OrbitControls polar flips.
	this.controls.enableRotate = false;
	this.controls.update();

	this.textureLoader = new THREE.TextureLoader();

	this.attachMeshRotateHandler();
	this.attachCameraOrbitHandler();

	this.resize();
	this.start();
};

MeshPreview.prototype.attachCameraOrbitHandler = function()
{
	var self = this;
	var el = this.renderer ? this.renderer.domElement : null;
	if (el == null)
		return;

	var orbitPointerId = null;
	var yawQuat = new THREE.Quaternion();
	var pitchQuat = new THREE.Quaternion();
	var quat = new THREE.Quaternion();
	var offset = new THREE.Vector3();
	var axisWorldUp = new THREE.Vector3(0, 1, 0);
	var axisFallbackX = new THREE.Vector3(1, 0, 0);
	var direction = new THREE.Vector3();
	var axisRight = new THREE.Vector3();
	var baseCameraPosition = new THREE.Vector3();
	var baseCameraQuaternion = new THREE.Quaternion();
	var baseCameraUp = new THREE.Vector3();
	var baseCameraMatrixWorld = new THREE.Matrix4();
	var currentCameraMatrixWorld = new THREE.Matrix4();
	var bakeDelta = new THREE.Matrix4();
	var lastX = 0;
	var lastY = 0;

	el.addEventListener('pointerdown', function(e) {
		// Left drag orbits the camera (Alt+Left is reserved for mesh rotation).
		if (e.button != 0)
			return;
		if (e.altKey)
			return;

		e.preventDefault();
		e.stopImmediatePropagation();
		e.stopPropagation();

		if (self.camera)
		{
			self.camera.updateMatrixWorld(true);
			baseCameraPosition.copy(self.camera.position);
			baseCameraQuaternion.copy(self.camera.quaternion);
			baseCameraUp.copy(self.camera.up);
			baseCameraMatrixWorld.copy(self.camera.matrixWorld);
		}

		orbitPointerId = e.pointerId;
		lastX = e.clientX;
		lastY = e.clientY;
		try { el.setPointerCapture(e.pointerId); } catch (err) {}
	}, true);

	// Track pointer moves even when the cursor leaves the canvas:
	window.addEventListener('pointermove', function(e) {
		if (orbitPointerId != e.pointerId)
			return;
		if ((self.camera == null) || (self.controls == null))
			return;

		e.preventDefault();
		e.stopPropagation();

		var dx = e.clientX - lastX;
		var dy = e.clientY - lastY;
		lastX = e.clientX;
		lastY = e.clientY;

		if ((dx == 0) && (dy == 0))
			return;

		var rect = el.getBoundingClientRect();
		var size = Math.min(rect.width, rect.height);
		if (size <= 0)
			size = 1;

		// Make rotation speed independent of element size:
		var rotSpeed = (2 * Math.PI) / size;
		var yawAngle = -dx * rotSpeed;
		var pitchAngle = -dy * rotSpeed;

		yawQuat.setFromAxisAngle(axisWorldUp, yawAngle);

		offset.copy(self.camera.position).sub(self.controls.target);

		// Yaw around world up:
		offset.applyQuaternion(yawQuat);
		self.camera.up.applyQuaternion(yawQuat);

		// Pitch around camera right axis:
		direction.copy(offset).normalize();
		axisRight.crossVectors(self.camera.up, direction);
		if (axisRight.lengthSq() <= 0.00000001)
			axisRight.crossVectors(axisWorldUp, direction);
		if (axisRight.lengthSq() <= 0.00000001)
			axisRight.crossVectors(axisFallbackX, direction);
		if (axisRight.lengthSq() > 0.00000001)
		{
			axisRight.normalize();
			pitchQuat.setFromAxisAngle(axisRight, pitchAngle);
			offset.applyQuaternion(pitchQuat);
			self.camera.up.applyQuaternion(pitchQuat);
		}
		else
		{
			pitchQuat.identity();
		}

		self.camera.position.copy(self.controls.target).add(offset);
		self.camera.up.normalize();

		self.camera.lookAt(self.controls.target);
		self.controls.update();
	}, true);

	var stopOrbit = function(e) {
		if (orbitPointerId != e.pointerId)
			return;

		if ((self.controls != null) && (self.camera != null))
		{
			// Keep the current view, but reset the camera transform by baking camera delta into the mesh.
			// We want: (C0^-1) * M' == (C1^-1) * M  =>  M' = C0 * (C1^-1) * M
			self.camera.updateMatrixWorld(true);
			currentCameraMatrixWorld.copy(self.camera.matrixWorld);
			bakeDelta.copy(baseCameraMatrixWorld).multiply(currentCameraMatrixWorld.clone().invert());

			if (self.mesh != null)
			{
				self.mesh.applyMatrix4(bakeDelta);
				self.mesh.updateMatrixWorld(true);
			}

			self.camera.position.copy(baseCameraPosition);
			self.camera.quaternion.copy(baseCameraQuaternion);
			self.camera.up.copy(baseCameraUp);
			self.camera.updateMatrixWorld(true);
			self.controls.update();
		}

		orbitPointerId = null;
		try { el.releasePointerCapture(e.pointerId); } catch (err) {}
	};

	window.addEventListener('pointerup', stopOrbit, true);
	window.addEventListener('pointercancel', stopOrbit, true);
	el.addEventListener('lostpointercapture', function() {
		orbitPointerId = null;
	}, true);
};

MeshPreview.prototype.attachMeshRotateHandler = function()
{
	var self = this;
	var el = this.renderer ? this.renderer.domElement : null;
	if (el == null)
		return;

	el.oncontextmenu = function(e) { e.preventDefault(); return false; };

	el.addEventListener('pointerdown', function(e) {
		// Right drag (or Alt+Left) rotates the mesh itself.
		if (self.mesh == null)
			return;

		var rotateMesh = (e.button == 2) || ((e.button == 0) && e.altKey);
		if (false == rotateMesh)
			return;

		e.preventDefault();
		e.stopImmediatePropagation();
		e.stopPropagation();

		self.isRotatingMesh = true;
		self.rotatePointerId = e.pointerId;
		self.rotatePointerX = e.clientX;
		self.rotatePointerY = e.clientY;
		try { el.setPointerCapture(e.pointerId); } catch (err) {}
	}, true);

	// Track pointer moves even when the cursor leaves the canvas:
	window.addEventListener('pointermove', function(e) {
		if ((false == self.isRotatingMesh) || (self.rotatePointerId != e.pointerId))
			return;
		if (self.mesh == null)
			return;

		e.preventDefault();
		e.stopPropagation();

		var dx = e.clientX - self.rotatePointerX;
		var dy = e.clientY - self.rotatePointerY;
		self.rotatePointerX = e.clientX;
		self.rotatePointerY = e.clientY;

		var speed = 0.01;
		self.mesh.rotation.y -= dx * speed;
		self.mesh.rotation.x -= dy * speed;

		// Shift+drag adds roll.
		if (e.shiftKey)
			self.mesh.rotation.z -= dx * speed;
	}, true);

	var stopMeshRotate = function(e) {
		if (self.rotatePointerId != e.pointerId)
			return;
		self.isRotatingMesh = false;
		self.rotatePointerId = null;
		try { el.releasePointerCapture(e.pointerId); } catch (err) {}
	};

	window.addEventListener('pointerup', stopMeshRotate, true);
	window.addEventListener('pointercancel', stopMeshRotate, true);
	el.addEventListener('lostpointercapture', function() {
		self.isRotatingMesh = false;
		self.rotatePointerId = null;
	}, true);
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
					height = desired;
					var self = this;
					setTimeout(function() { self.internalHeightAdjust = false; }, 0);
				}
			}
		}
	}

	this.lastWidth = width;

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
	{
		this.renderer.render(this.scene, this.camera);
	}

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
	// Do not carry preserved mesh rotation between different jobs.
	if ((this.m_jobId != null) && (this.lastJobIdLoaded != this.m_jobId))
	{
		this.preservedMeshQuaternion = null;
		this.preservedMeshJobId = null;
	}
	this.lastJobIdLoaded = (this.m_jobId != null) ? this.m_jobId : null;

	if ((i_sources != null) && Array.isArray(i_sources.items))
	{
		this.setSources(i_sources.items, i_sources.selected);
		var selected = 0;
		if (isFinite(i_sources.selected) && (i_sources.selected >= 0) && (i_sources.selected < i_sources.items.length))
			selected = i_sources.selected;
		return this.load(i_sources.items[selected]);
	}

	if ((i_sources == null) || (i_sources.obj == null))
	{
		// Cancel any in-flight loaders:
		this.loadId++;
		this.currentSources = null;
		this.setSources(null);
		this.clearMesh();
		this.setMessage('Mesh preview not available.');
		return;
	}

	if ((this.currentSources != null) &&
		(this.currentSources.obj == i_sources.obj) &&
		(this.currentSources.mtl == i_sources.mtl) &&
		(this.currentSources.texture == i_sources.texture))
		return;

	// Cancel previous load and create a new token:
	this.loadId++;
	var loadId = this.loadId;

	this.initRenderer();

	if (this.renderer == null)
	{
		this.setMessage('Mesh preview requires WebGL.');
		return;
	}

	this.currentSources = {
		"obj": i_sources.obj,
		"mtl": i_sources.mtl,
		"texture": i_sources.texture
	};

	this.setMessage('Loading mesh preview…');
	this.clearMesh();
	this.elCanvas.style.backgroundImage = '';

	var self = this;

	if (i_sources.mtl && (typeof THREE.MTLLoader !== 'undefined'))
	{
		this.loadWithMtl(loadId, i_sources.obj, i_sources.mtl);
		return;
	}

	var loader = new THREE.OBJLoader();
	loader.load(
		i_sources.obj,
		function(object) {
			if (self.loadId != loadId)
				return;
			self.onMeshLoaded(object, i_sources.texture);
		},
		null,
		function() {
			if (self.loadId != loadId)
				return;
			self.onMeshFailed();
		}
	);
};

MeshPreview.prototype.loadWithMtl = function(i_loadId, i_obj_url, i_mtl_url)
{
	if ((this.renderer == null) || (this.scene == null))
	{
		this.setMessage('Mesh preview requires WebGL.');
		return;
	}

	var self = this;

	var getDir = function(url)
	{
		var idx = url.lastIndexOf('/');
		if (idx == -1)
			return '';
		return url.substring(0, idx + 1);
	};

	var dir = getDir(i_mtl_url);
	var mtlLoader = new THREE.MTLLoader();
	if (mtlLoader.setResourcePath)
		mtlLoader.setResourcePath(dir);
	if (mtlLoader.setPath)
		mtlLoader.setPath('');

	mtlLoader.load(
		i_mtl_url,
		function(materialCreator) {
			if (self.loadId != i_loadId)
				return;
			try { materialCreator.preload(); } catch (err) {}
			var objLoader = new THREE.OBJLoader();
			if (objLoader.setMaterials)
				objLoader.setMaterials(materialCreator);

			objLoader.load(
				i_obj_url,
				function(object) {
					if (self.loadId != i_loadId)
						return;
					self.onMeshLoadedFromMtl(object);
				},
				null,
				function() {
					if (self.loadId != i_loadId)
						return;
					self.onMeshFailed();
				}
			);
		},
		null,
		function() {
			if (self.loadId != i_loadId)
				return;
			// Fallback: no materials from MTL.
			var objLoader = new THREE.OBJLoader();
			objLoader.load(
				i_obj_url,
				function(object) {
					if (self.loadId != i_loadId)
						return;
					self.onMeshLoaded(object, null);
				},
				null,
				function() {
					if (self.loadId != i_loadId)
						return;
					self.onMeshFailed();
				}
			);
		}
	);
};

MeshPreview.prototype.onMeshLoadedFromMtl = function(i_object)
{
	var self = this;

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
		}

		map.needsUpdate = true;
		return map;
	};

	// Ensure DoubleSide and apply our texture constraints.
	i_object.traverse(function(child) {
		if (child.isMesh && child.material)
		{
			var mats = Array.isArray(child.material) ? child.material : [child.material];
			for (var i = 0; i < mats.length; i++)
			{
				var m = mats[i];
				if (m)
				{
					m.side = THREE.DoubleSide;
					if (m.map)
						m.map = configureTexture(m.map);
					m.needsUpdate = true;
				}
			}
		}
	});

	this.finalizeMesh(i_object);
};

MeshPreview.prototype.setSources = function(i_sources, i_selected)
{
	this.sources = (Array.isArray(i_sources) && i_sources.length) ? i_sources.slice(0) : null;

	var tailLabel = function(label, maxLen)
	{
		if (label == null)
			return '';
		label = '' + label;
		if ((maxLen == null) || (maxLen < 8))
			maxLen = 22;
		if (label.length <= maxLen)
			return label;
		return '…' + label.substr(label.length - maxLen);
	};

	var key = null;
	if (this.sources && this.sources.length)
	{
		key = '';
		for (var i = 0; i < this.sources.length; i++)
		{
			var s = this.sources[i];
			if ((s == null) || (s.obj == null))
				continue;
			key += (s.obj + '|' + (s.mtl ? s.mtl : '') + '|' + (s.texture ? s.texture : '') + '|' + (s.label ? s.label : '') + ';');
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
		if ((s == null) || (s.obj == null) || (s.obj == ''))
			continue;

		var btn = document.createElement('button');
		btn.type = 'button';
		btn.classList.add('mesh_preview_source_btn');
		if (i == selected)
			btn.classList.add('selected');
		var fullLabel = s.label ? s.label : ('Mesh ' + (i + 1));
		btn.textContent = tailLabel(fullLabel, 22);
		btn.title = fullLabel;
			btn.onclick = function(e) {
				e.stopPropagation();
				e.preventDefault();
				var idx = parseInt(e.currentTarget.dataset.idx);
				if (false == isFinite(idx))
					return;
				// Preserve the current mesh orientation when switching between source meshes.
				self.preserveMeshOrientation();
				self.load(self.sources[idx]);
				self.setSources(self.sources, idx);
			};
		btn.dataset.idx = i;
		this.elSources.appendChild(btn);
	}

	this.elSources.style.display = 'block';
};

MeshPreview.prototype.onMeshLoaded = function(i_object, i_texture)
{
	var self = this;
	var loadId = this.loadId;

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
		if (self.loadId != loadId)
			return;

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
		// Clear any previous texture preview immediately when switching meshes.
		self.elCanvas.style.backgroundImage = '';
		this.textureLoader.load(
			i_texture,
			function(texture) {
				if (self.loadId != loadId)
					return;
				applyMaterial(texture);
			},
			null,
			function () {
				if (self.loadId != loadId)
					return;
				applyMaterial(null);
			}
		);
	}
	else
	{
		// No explicit texture found. Show mesh with fallback material.
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

	// When switching between meshes of the same job, keep the current orientation.
	if ((this.preservedMeshQuaternion != null) && (this.preservedMeshJobId != null) &&
		(this.m_jobId != null) && (this.preservedMeshJobId == this.m_jobId))
	{
		this.mesh.quaternion.copy(this.preservedMeshQuaternion);
		this.mesh.quaternion.normalize();
		this.mesh.updateMatrixWorld(true);
	}

	this.applyRenderModeToMesh();

	this.camera.position.set(0, 0, 4);
	this.camera.up.set(0, 1, 0);
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
