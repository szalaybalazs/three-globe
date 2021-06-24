import * as THREE from "https://cdn.skypack.dev/three@0.129.0";

// DATA
const poiMap = {
  255: {
    label: "🇬🇧 Liverpool",
    description: "22 GBP for Coffee ☕️",
  },
  245: {
    label: "🇵🇪 Lima",
    description: "13 PEN for Pizza 🍕",
  },
  235: {
    label: "🇹🇭 Bangkok",
    description: "15 THB for Cashback 💸",
  },
  225: {
    label: "🇨🇼 Curacao",
    description: "50 ANG for Surf lesson 🏄",
  },
  215: {
    label: "🇦🇺 Sydney",
    description: "250 AUD for Car rental 🚗",
  },
};

const DOT_RADIUS = 580;
const DOT_COUNT = 45000;
const green = 0xc1fdc3;
const yellow = 0xf9c982;
const globeColor = 0x101c45;

const FAR_PLANE = 2000;
const NEAR_PLANE = 500;

let activeObject = null;
let meshes = [];

const {
  EventDispatcher,
  MOUSE,
  Quaternion,
  Spherical,
  TOUCH,
  Vector2,
  Vector3,
} = THREE;

// =================================================
// ORBIT controls
// =================================================

const OrbitControls = function (object, domElement) {
  if (domElement === undefined)
    console.warn(
      'THREE.OrbitControls: The second parameter "domElement" is now mandatory.'
    );
  if (domElement === document)
    console.error(
      'THREE.OrbitControls: "document" should not be used as the target "domElement". Please use "renderer.domElement" instead.'
    );

  this.object = object;
  this.domElement = domElement;

  // Set to false to disable this control
  this.enabled = true;

  // "target" sets the location of focus, where the object orbits around
  this.target = new Vector3();

  // How far you can dolly in and out ( PerspectiveCamera only )
  this.minDistance = 0;
  this.maxDistance = Infinity;

  // How far you can zoom in and out ( OrthographicCamera only )
  this.minZoom = 0;
  this.maxZoom = 0;

  // How far you can orbit vertically, upper and lower limits.
  // Range is 0 to Math.PI radians.
  this.minPolarAngle = 0; // radians
  this.maxPolarAngle = Math.PI; // radians

  // How far you can orbit horizontally, upper and lower limits.
  // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
  this.minAzimuthAngle = -Infinity; // radians
  this.maxAzimuthAngle = Infinity; // radians

  // Set to true to enable damping (inertia)
  // If damping is enabled, you must call controls.update() in your animation loop
  this.enableDamping = false;
  this.dampingFactor = 0.05;

  // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
  // Set to false to disable zooming
  this.enableZoom = false;
  this.zoomSpeed = 1.0;

  // Set to false to disable rotating
  this.enableRotate = true;
  this.rotateSpeed = 0.4;

  // Set to false to disable panning
  this.enablePan = false;
  this.panSpeed = 1.0;
  this.screenSpacePanning = false; // if true, pan in screen-space
  this.keyPanSpeed = 7.0; // pixels moved per arrow key push

  // Set to true to automatically rotate around the target
  // If auto-rotate is enabled, you must call controls.update() in your animation loop
  this.autoRotate = true;
  this.autoRotateSpeed = 1.0; // 30 seconds per round when fps is 60

  // Set to false to disable use of the keys
  this.enableKeys = true;

  // The four arrow keys
  this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

  // Mouse buttons
  this.mouseButtons = {
    LEFT: MOUSE.ROTATE,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.PAN,
  };

  // Touch fingers
  this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

  // for reset
  this.target0 = this.target.clone();
  this.position0 = this.object.position.clone();
  this.zoom0 = this.object.zoom;

  //
  // public methods
  //

  this.getPolarAngle = function () {
    return spherical.phi;
  };

  this.getAzimuthalAngle = function () {
    return spherical.theta;
  };

  this.saveState = function () {
    scope.target0.copy(scope.target);
    scope.position0.copy(scope.object.position);
    scope.zoom0 = scope.object.zoom;
  };

  this.reset = function () {
    scope.target.copy(scope.target0);
    scope.object.position.copy(scope.position0);
    scope.object.zoom = scope.zoom0;

    scope.object.updateProjectionMatrix();
    scope.dispatchEvent(changeEvent);

    scope.update();

    state = STATE.NONE;
  };

  // this method is exposed, but perhaps it would be better if we can make it private...
  this.update = (function () {
    var offset = new Vector3();

    // so camera.up is the orbit axis
    var quat = new Quaternion().setFromUnitVectors(
      object.up,
      new Vector3(0, 1, 0)
    );
    var quatInverse = quat.clone().inverse();

    var lastPosition = new Vector3();
    var lastQuaternion = new Quaternion();

    return function update() {
      var position = scope.object.position;

      offset.copy(position).sub(scope.target);

      // rotate offset to "y-axis-is-up" space
      offset.applyQuaternion(quat);

      // angle from z-axis around y-axis
      spherical.setFromVector3(offset);

      if (scope.autoRotate && state === STATE.NONE) {
        rotateLeft(getAutoRotationAngle());
      }

      if (scope.enableDamping) {
        spherical.theta += sphericalDelta.theta * scope.dampingFactor;
        spherical.phi += sphericalDelta.phi * scope.dampingFactor;
      } else {
        spherical.theta += sphericalDelta.theta;
        spherical.phi += sphericalDelta.phi;
      }

      // restrict theta to be between desired limits
      spherical.theta = Math.max(
        scope.minAzimuthAngle,
        Math.min(scope.maxAzimuthAngle, spherical.theta)
      );

      // restrict phi to be between desired limits
      spherical.phi = Math.max(
        scope.minPolarAngle,
        Math.min(scope.maxPolarAngle, spherical.phi)
      );

      spherical.makeSafe();

      spherical.radius *= scale;

      // restrict radius to be between desired limits
      spherical.radius = Math.max(
        scope.minDistance,
        Math.min(scope.maxDistance, spherical.radius)
      );

      // move target to panned location

      if (scope.enableDamping === true) {
        scope.target.addScaledVector(panOffset, scope.dampingFactor);
      } else {
        scope.target.add(panOffset);
      }

      offset.setFromSpherical(spherical);

      // rotate offset back to "camera-up-vector-is-up" space
      offset.applyQuaternion(quatInverse);

      position.copy(scope.target).add(offset);

      scope.object.lookAt(scope.target);

      if (scope.enableDamping === true) {
        sphericalDelta.theta *= 1 - scope.dampingFactor;
        sphericalDelta.phi *= 1 - scope.dampingFactor;

        panOffset.multiplyScalar(1 - scope.dampingFactor);
      } else {
        sphericalDelta.set(0, 0, 0);

        panOffset.set(0, 0, 0);
      }

      scale = 1;

      // update condition is:
      // min(camera displacement, camera rotation in radians)^2 > EPS
      // using small-angle approximation cos(x/2) = 1 - x^2 / 8

      if (
        zoomChanged ||
        lastPosition.distanceToSquared(scope.object.position) > EPS ||
        8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS
      ) {
        scope.dispatchEvent(changeEvent);

        lastPosition.copy(scope.object.position);
        lastQuaternion.copy(scope.object.quaternion);
        zoomChanged = false;

        return true;
      }

      return false;
    };
  })();

  this.dispose = function () {
    scope.domElement.removeEventListener("contextmenu", onContextMenu, false);
    scope.domElement.removeEventListener("mousedown", onMouseDown, false);
    scope.domElement.removeEventListener("wheel", onMouseWheel, false);

    scope.domElement.removeEventListener("touchstart", onTouchStart, false);
    scope.domElement.removeEventListener("touchend", onTouchEnd, false);
    scope.domElement.removeEventListener("touchmove", onTouchMove, false);

    document.removeEventListener("mousemove", onMouseMove, false);
    document.removeEventListener("mouseup", onMouseUp, false);

    scope.domElement.removeEventListener("keydown", onKeyDown, false);

    //scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?
  };

  //
  // internals
  //

  var scope = this;

  var changeEvent = { type: "change" };
  var startEvent = { type: "start" };
  var endEvent = { type: "end" };

  var STATE = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TOUCH_ROTATE: 3,
    TOUCH_PAN: 4,
    TOUCH_DOLLY_PAN: 5,
    TOUCH_DOLLY_ROTATE: 6,
  };

  var state = STATE.NONE;

  var EPS = 0.000001;

  // current position in spherical coordinates
  var spherical = new Spherical();
  var sphericalDelta = new Spherical();

  var scale = 1;
  var panOffset = new Vector3();
  var zoomChanged = false;

  var rotateStart = new Vector2();
  var rotateEnd = new Vector2();
  var rotateDelta = new Vector2();

  var panStart = new Vector2();
  var panEnd = new Vector2();
  var panDelta = new Vector2();

  var dollyStart = new Vector2();
  var dollyEnd = new Vector2();
  var dollyDelta = new Vector2();

  function getAutoRotationAngle() {
    return ((2 * Math.PI) / 60 / 60) * scope.autoRotateSpeed;
  }

  function getZoomScale() {
    return Math.pow(0.95, scope.zoomSpeed);
  }

  function rotateLeft(angle) {
    sphericalDelta.theta -= angle;
  }

  function rotateUp(angle) {
    sphericalDelta.phi -= angle;
  }

  var panLeft = (function () {
    var v = new Vector3();

    return function panLeft(distance, objectMatrix) {
      v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
      v.multiplyScalar(-distance);

      panOffset.add(v);
    };
  })();

  var panUp = (function () {
    var v = new Vector3();

    return function panUp(distance, objectMatrix) {
      if (scope.screenSpacePanning === true) {
        v.setFromMatrixColumn(objectMatrix, 1);
      } else {
        v.setFromMatrixColumn(objectMatrix, 0);
        v.crossVectors(scope.object.up, v);
      }

      v.multiplyScalar(distance);

      panOffset.add(v);
    };
  })();

  // deltaX and deltaY are in pixels; right and down are positive
  var pan = (function () {
    var offset = new Vector3();

    return function pan(deltaX, deltaY) {
      var element = scope.domElement;

      if (scope.object.isPerspectiveCamera) {
        // perspective
        var position = scope.object.position;
        offset.copy(position).sub(scope.target);
        var targetDistance = offset.length();

        // half of the fov is center to top of screen
        targetDistance *= Math.tan(((scope.object.fov / 2) * Math.PI) / 180.0);

        // we use only clientHeight here so aspect ratio does not distort speed
        panLeft(
          (2 * deltaX * targetDistance) / element.clientHeight,
          scope.object.matrix
        );
        panUp(
          (2 * deltaY * targetDistance) / element.clientHeight,
          scope.object.matrix
        );
      } else if (scope.object.isOrthographicCamera) {
        // orthographic
        panLeft(
          (deltaX * (scope.object.right - scope.object.left)) /
            scope.object.zoom /
            element.clientWidth,
          scope.object.matrix
        );
        panUp(
          (deltaY * (scope.object.top - scope.object.bottom)) /
            scope.object.zoom /
            element.clientHeight,
          scope.object.matrix
        );
      } else {
        // camera neither orthographic nor perspective
        console.warn(
          "WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."
        );
        scope.enablePan = false;
      }
    };
  })();

  function dollyOut(dollyScale) {
    if (scope.object.isPerspectiveCamera) {
      scale /= dollyScale;
    } else if (scope.object.isOrthographicCamera) {
      scope.object.zoom = Math.max(
        scope.minZoom,
        Math.min(scope.maxZoom, scope.object.zoom * dollyScale)
      );
      scope.object.updateProjectionMatrix();
      zoomChanged = true;
    } else {
      console.warn(
        "WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."
      );
      scope.enableZoom = false;
    }
  }

  function dollyIn(dollyScale) {
    if (scope.object.isPerspectiveCamera) {
      scale *= dollyScale;
    } else if (scope.object.isOrthographicCamera) {
      scope.object.zoom = Math.max(
        scope.minZoom,
        Math.min(scope.maxZoom, scope.object.zoom / dollyScale)
      );
      scope.object.updateProjectionMatrix();
      zoomChanged = true;
    } else {
      console.warn(
        "WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."
      );
      scope.enableZoom = false;
    }
  }

  //
  // event callbacks - update the object state
  //

  function handleMouseDownRotate(event) {
    rotateStart.set(event.clientX, event.clientY);
  }

  function handleMouseDownDolly(event) {
    dollyStart.set(event.clientX, event.clientY);
  }

  function handleMouseDownPan(event) {
    panStart.set(event.clientX, event.clientY);
  }

  function handleMouseMoveRotate(event) {
    rotateEnd.set(event.clientX, event.clientY);

    rotateDelta
      .subVectors(rotateEnd, rotateStart)
      .multiplyScalar(scope.rotateSpeed);

    var element = scope.domElement;

    rotateLeft((2 * Math.PI * rotateDelta.x) / element.clientHeight); // yes, height

    rotateUp((2 * Math.PI * rotateDelta.y) / element.clientHeight);

    rotateStart.copy(rotateEnd);

    scope.update();
  }

  function handleMouseMoveDolly(event) {
    dollyEnd.set(event.clientX, event.clientY);

    dollyDelta.subVectors(dollyEnd, dollyStart);

    if (dollyDelta.y > 0) {
      dollyOut(getZoomScale());
    } else if (dollyDelta.y < 0) {
      dollyIn(getZoomScale());
    }

    dollyStart.copy(dollyEnd);

    scope.update();
  }

  function handleMouseMovePan(event) {
    panEnd.set(event.clientX, event.clientY);

    panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

    pan(panDelta.x, panDelta.y);

    panStart.copy(panEnd);

    scope.update();
  }

  function handleMouseUp(/*event*/) {
    // no-op
  }

  function handleMouseWheel(event) {
    if (event.deltaY < 0) {
      dollyIn(getZoomScale());
    } else if (event.deltaY > 0) {
      dollyOut(getZoomScale());
    }

    scope.update();
  }

  function handleKeyDown(event) {
    var needsUpdate = false;

    switch (event.keyCode) {
      case scope.keys.UP:
        pan(0, scope.keyPanSpeed);
        needsUpdate = true;
        break;

      case scope.keys.BOTTOM:
        pan(0, -scope.keyPanSpeed);
        needsUpdate = true;
        break;

      case scope.keys.LEFT:
        pan(scope.keyPanSpeed, 0);
        needsUpdate = true;
        break;

      case scope.keys.RIGHT:
        pan(-scope.keyPanSpeed, 0);
        needsUpdate = true;
        break;
    }

    if (needsUpdate) {
      // prevent the browser from scrolling on cursor keys
      event.preventDefault();

      scope.update();
    }
  }

  function handleTouchStartRotate(event) {
    if (event.touches.length == 1) {
      rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

      rotateStart.set(x, y);
    }
  }

  function handleTouchStartPan(event) {
    if (event.touches.length == 1) {
      panStart.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

      panStart.set(x, y);
    }
  }

  function handleTouchStartDolly(event) {
    var dx = event.touches[0].pageX - event.touches[1].pageX;
    var dy = event.touches[0].pageY - event.touches[1].pageY;

    var distance = Math.sqrt(dx * dx + dy * dy);

    dollyStart.set(0, distance);
  }

  function handleTouchStartDollyPan(event) {
    if (scope.enableZoom) handleTouchStartDolly(event);

    if (scope.enablePan) handleTouchStartPan(event);
  }

  function handleTouchStartDollyRotate(event) {
    if (scope.enableZoom) handleTouchStartDolly(event);

    if (scope.enableRotate) handleTouchStartRotate(event);
  }

  function handleTouchMoveRotate(event) {
    if (event.touches.length == 1) {
      rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

      rotateEnd.set(x, y);
    }

    rotateDelta
      .subVectors(rotateEnd, rotateStart)
      .multiplyScalar(scope.rotateSpeed);

    var element = scope.domElement;

    rotateLeft((2 * Math.PI * rotateDelta.x) / element.clientHeight); // yes, height

    rotateUp((2 * Math.PI * rotateDelta.y) / element.clientHeight);

    rotateStart.copy(rotateEnd);
  }

  function handleTouchMovePan(event) {
    if (event.touches.length == 1) {
      panEnd.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

      panEnd.set(x, y);
    }

    panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

    pan(panDelta.x, panDelta.y);

    panStart.copy(panEnd);
  }

  function handleTouchMoveDolly(event) {
    var dx = event.touches[0].pageX - event.touches[1].pageX;
    var dy = event.touches[0].pageY - event.touches[1].pageY;

    var distance = Math.sqrt(dx * dx + dy * dy);

    dollyEnd.set(0, distance);

    dollyDelta.set(0, Math.pow(dollyEnd.y / dollyStart.y, scope.zoomSpeed));

    dollyOut(dollyDelta.y);

    dollyStart.copy(dollyEnd);
  }

  function handleTouchMoveDollyPan(event) {
    if (scope.enableZoom) handleTouchMoveDolly(event);

    if (scope.enablePan) handleTouchMovePan(event);
  }

  function handleTouchMoveDollyRotate(event) {
    if (scope.enableZoom) handleTouchMoveDolly(event);

    if (scope.enableRotate) handleTouchMoveRotate(event);
  }

  function handleTouchEnd(/*event*/) {
    // no-op
  }

  //
  // event handlers - FSM: listen for events and reset state
  //

  function onMouseDown(event) {
    if (scope.enabled === false) return;

    // Prevent the browser from scrolling.
    event.preventDefault();

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.

    scope.domElement.focus ? scope.domElement.focus() : window.focus();

    var mouseAction;

    switch (event.button) {
      case 0:
        mouseAction = scope.mouseButtons.LEFT;
        break;

      case 1:
        mouseAction = scope.mouseButtons.MIDDLE;
        break;

      case 2:
        mouseAction = scope.mouseButtons.RIGHT;
        break;

      default:
        mouseAction = -1;
    }

    switch (mouseAction) {
      case MOUSE.DOLLY:
        if (scope.enableZoom === false) return;

        handleMouseDownDolly(event);

        state = STATE.DOLLY;

        break;

      case MOUSE.ROTATE:
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          if (scope.enablePan === false) return;

          handleMouseDownPan(event);

          state = STATE.PAN;
        } else {
          if (scope.enableRotate === false) return;

          handleMouseDownRotate(event);

          state = STATE.ROTATE;
        }

        break;

      case MOUSE.PAN:
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          if (scope.enableRotate === false) return;

          handleMouseDownRotate(event);

          state = STATE.ROTATE;
        } else {
          if (scope.enablePan === false) return;

          handleMouseDownPan(event);

          state = STATE.PAN;
        }

        break;

      default:
        state = STATE.NONE;
    }

    if (state !== STATE.NONE) {
      document.addEventListener("mousemove", onMouseMove, false);
      document.addEventListener("mouseup", onMouseUp, false);

      scope.dispatchEvent(startEvent);
    }
  }

  function onMouseMove(event) {
    if (scope.enabled === false) return;

    event.preventDefault();

    switch (state) {
      case STATE.ROTATE:
        if (scope.enableRotate === false) return;

        handleMouseMoveRotate(event);

        break;

      case STATE.DOLLY:
        if (scope.enableZoom === false) return;

        handleMouseMoveDolly(event);

        break;

      case STATE.PAN:
        if (scope.enablePan === false) return;

        handleMouseMovePan(event);

        break;
    }
  }

  function onMouseUp(event) {
    if (scope.enabled === false) return;

    handleMouseUp(event);

    document.removeEventListener("mousemove", onMouseMove, false);
    document.removeEventListener("mouseup", onMouseUp, false);

    scope.dispatchEvent(endEvent);

    state = STATE.NONE;
  }

  function onMouseWheel(event) {
    if (
      scope.enabled === false ||
      scope.enableZoom === false ||
      (state !== STATE.NONE && state !== STATE.ROTATE)
    )
      return;

    event.preventDefault();
    event.stopPropagation();

    scope.dispatchEvent(startEvent);

    handleMouseWheel(event);

    scope.dispatchEvent(endEvent);
  }

  function onKeyDown(event) {
    if (
      scope.enabled === false ||
      scope.enableKeys === false ||
      scope.enablePan === false
    )
      return;

    handleKeyDown(event);
  }

  function onTouchStart(event) {
    if (scope.enabled === false) return;

    event.preventDefault(); // prevent scrolling

    switch (event.touches.length) {
      case 1:
        switch (scope.touches.ONE) {
          case TOUCH.ROTATE:
            if (scope.enableRotate === false) return;

            handleTouchStartRotate(event);

            state = STATE.TOUCH_ROTATE;

            break;

          case TOUCH.PAN:
            if (scope.enablePan === false) return;

            handleTouchStartPan(event);

            state = STATE.TOUCH_PAN;

            break;

          default:
            state = STATE.NONE;
        }

        break;

      case 2:
        switch (scope.touches.TWO) {
          case TOUCH.DOLLY_PAN:
            if (scope.enableZoom === false && scope.enablePan === false) return;

            handleTouchStartDollyPan(event);

            state = STATE.TOUCH_DOLLY_PAN;

            break;

          case TOUCH.DOLLY_ROTATE:
            if (scope.enableZoom === false && scope.enableRotate === false)
              return;

            handleTouchStartDollyRotate(event);

            state = STATE.TOUCH_DOLLY_ROTATE;

            break;

          default:
            state = STATE.NONE;
        }

        break;

      default:
        state = STATE.NONE;
    }

    if (state !== STATE.NONE) {
      scope.dispatchEvent(startEvent);
    }
  }

  function onTouchMove(event) {
    if (scope.enabled === false) return;

    event.preventDefault(); // prevent scrolling
    event.stopPropagation();

    switch (state) {
      case STATE.TOUCH_ROTATE:
        if (scope.enableRotate === false) return;

        handleTouchMoveRotate(event);

        scope.update();

        break;

      case STATE.TOUCH_PAN:
        if (scope.enablePan === false) return;

        handleTouchMovePan(event);

        scope.update();

        break;

      case STATE.TOUCH_DOLLY_PAN:
        if (scope.enableZoom === false && scope.enablePan === false) return;

        handleTouchMoveDollyPan(event);

        scope.update();

        break;

      case STATE.TOUCH_DOLLY_ROTATE:
        if (scope.enableZoom === false && scope.enableRotate === false) return;

        handleTouchMoveDollyRotate(event);

        scope.update();

        break;

      default:
        state = STATE.NONE;
    }
  }

  function onTouchEnd(event) {
    if (scope.enabled === false) return;

    handleTouchEnd(event);

    scope.dispatchEvent(endEvent);

    state = STATE.NONE;
  }

  function onContextMenu(event) {
    if (scope.enabled === false) return;

    event.preventDefault();
  }

  //

  scope.domElement.addEventListener("contextmenu", onContextMenu, false);

  scope.domElement.addEventListener("mousedown", onMouseDown, false);
  scope.domElement.addEventListener("wheel", onMouseWheel, false);

  scope.domElement.addEventListener("touchstart", onTouchStart, false);
  scope.domElement.addEventListener("touchend", onTouchEnd, false);
  scope.domElement.addEventListener("touchmove", onTouchMove, false);

  scope.domElement.addEventListener("keydown", onKeyDown, false);

  // make sure element can receive keys.

  if (scope.domElement.tabIndex === -1) {
    scope.domElement.tabIndex = 0;
  }

  // force an update at start

  this.update();
};

OrbitControls.prototype = Object.create(EventDispatcher.prototype);
OrbitControls.prototype.constructor = OrbitControls;

var MapControls = function (object, domElement) {
  OrbitControls.call(this, object, domElement);

  this.mouseButtons.LEFT = MOUSE.PAN;
  this.mouseButtons.RIGHT = MOUSE.ROTATE;

  this.touches.ONE = TOUCH.PAN;
  this.touches.TWO = TOUCH.DOLLY_ROTATE;
};

MapControls.prototype = Object.create(EventDispatcher.prototype);
MapControls.prototype.constructor = MapControls;

export { OrbitControls, MapControls };

// =================================================
// World map generator
// =================================================
class WorldMap {
  constructor(url) {
    this.heatmap = {};
    this.loadImage = () => {
      return new Promise((res) => {
        this.image.onload = () =>
          setTimeout(() => {
            const context = this.canvas.getContext("2d");
            if (context) context.drawImage(this.image, 0, 0);
            res(true);
          }, 100);
        this.image.crossOrigin = "Anonymous";
        this.image.src = this.url;
      });
    };
    this.load = async () => {
      await Promise.all([this.loadImage()]);
      return this;
    };

    this.getColor = (x, y) => {
      const context = this.canvas.getContext("2d");
      if (!context) return 0;
      const { data } = context.getImageData(
        Math.min(1, Math.max(0, x)) * 2754,
        Math.min(1, Math.max(0, y)) * 1397,
        1,
        1
      );
      return (data === null || data === void 0 ? void 0 : data) || [0, 0, 0, 0];
    };
    this.url = url;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 3840;
    this.canvas.height = 2160;
    this.image = new Image();
  }
}

const addFog = (scene) => {
  const color = globeColor;
  const near = NEAR_PLANE;
  const far = FAR_PLANE;
  scene.fog = new THREE.Fog(color, near, far);
};

const getDistance = (camera, mesh) => {
  const vector = new THREE.Vector3(
    mesh.position.x,
    mesh.position.y,
    mesh.position.z
  );
  mesh.getWorldPosition(vector);

  return vector.distanceTo(camera.position);
};

const getClosest = (camera) => {
  return meshes
    .map((mesh) => [mesh, getDistance(camera, mesh)])
    .sort((a, b) => a[1] - b[1])[0][0];
};

const addLight = (scene) => {
  const skyColor = green;
  const groundColor = yellow;
  const intensity = 1.8;
  const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
  scene.add(light);
};
const addGlobe = (scene) => {
  const globeGeometry = new THREE.SphereGeometry(DOT_RADIUS - 20, 250, 250);
  const globeMaterial = new THREE.MeshStandardMaterial({
    color: globeColor,
    opacity: 0.6,
    transparent: true,
  });

  const globe = new THREE.Mesh(globeGeometry, globeMaterial);
  globe.renderOrder = 1.0;
  scene.add(globe);
};

const setupRenderer = (wrapper) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    FAR_PLANE
  );
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
  });
  renderer.setSize(800 * 4, 800 * 4 * (window.innerHeight / window.innerWidth));
  wrapper.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);

  camera.position.z = 1200;
  camera.position.y = 600;
  return { scene, camera, renderer, controls };
};

let prevActive;
function updateScreenPosition(renderer, camera, popup) {
  activeObject = getClosest(camera);
  if (!prevActive || activeObject.id !== prevActive.id) {
    const meta = activeObject.meta;
    document.querySelector("#popup-title").innerText = meta.label;
    document.querySelector("#popup-description").innerText = meta.description;
    prevActive = activeObject;
  }
  if (!activeObject) return (popup.style.opacity = 0);
  const vector = new THREE.Vector3(
    activeObject.position.x,
    activeObject.position.y,
    activeObject.position.z
  );
  activeObject.getWorldPosition(vector);
  const canvas = renderer.domElement;
  const { width, height } = canvas.getBoundingClientRect();

  const spriteBehindObject = false;
  vector.project(camera);

  vector.x = Math.round((0.5 + vector.x / 2) * width);
  vector.y = Math.round((0.5 - vector.y / 2) * height);

  popup.style.opacity = 1;
  popup.style.top = `${vector.y}px`;
  popup.style.left = `${vector.x}px`;
  popup.style.opacity = spriteBehindObject ? 0.1 : 0.8;
}

// Load scene
const _handleLoad = async (wrapper) => {
  // Load map texture to heatmap
  const map = new WorldMap("./map.png");
  await map.load();

  // Create scene
  const { scene, camera, renderer, controls } = setupRenderer(wrapper);
  addFog(scene);

  // Create mesh group
  const group = new THREE.Group();
  const controller = new THREE.Group();

  // A hexagon with a radius of 2 pixels looks like a circle
  const dotGeometry = new THREE.CircleGeometry(2, 5);

  // Active mesh with bigger radius
  const activeGeometry = new THREE.CircleGeometry(4, 25);
  const activeMaterial = new THREE.LineBasicMaterial({
    color: 0xb800c8,
    side: THREE.DoubleSide,
    opacity: 1,
  });

  const vector = new THREE.Vector3(0, 0, 0);
  const singleGeometry = new THREE.BufferGeometry();

  const vertexShader = `
    varying vec3 vUv; 
    varying vec3 vPos; 

    void main() {
      vUv = position; 

      vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
      vPos = vec3(modelMatrix[1]);
      gl_Position = projectionMatrix * modelViewPosition; 
    }
  `;

  let uniforms = {
    u_time: { value: 0 },
    yellow: { type: "vec3", value: new THREE.Color(0xffff00) },
    colorA: { type: "vec3", value: new THREE.Color(0x74ebd5) },
    fogColor: { type: "c", value: scene.fog.color },
    fogNear: { type: "f", value: scene.fog.near },
    fogFar: { type: "f", value: scene.fog.near },
  };
  const fragmentShader = `
      uniform vec3 yellow; 
      uniform float u_time; 
      uniform vec3 colorB; 
      varying vec3 vUv;
      varying vec3 vPos;

      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;

      void main() {
        gl_FragColor = vec4(yellow, (sin((u_time / 1000.0) + (vPos.x + vPos.y + vPos.z) * 100.0) / 4.0) + 0.25 + .1);
      #ifdef USE_FOG
       
        float depth = gl_FragCoord.z / gl_FragCoord.w;
        float fogFactor = smoothstep( fogNear, fogFar, depth );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor / 1.2);
      #endif
    }
  `;

  let shaderMaterial = new THREE.ShaderMaterial({
    uniforms: uniforms,
    fragmentShader: fragmentShader,
    vertexShader: vertexShader,
    fog: true,
    transparent: true,
  });
  shaderMaterial.side = THREE.DoubleSide;
  for (let i = DOT_COUNT; i >= 0; i--) {
    const phi = Math.acos(-1 + (2 * i) / DOT_COUNT);
    const theta = Math.sqrt(DOT_COUNT * Math.PI) * phi;

    const x = (theta % (Math.PI * 2)) / (Math.PI * 2);
    const y = phi / Math.PI;
    const [id, g, b, val] = map.getColor(x, y);
    if (val > 0) {
      vector.setFromSphericalCoords(DOT_RADIUS, phi, theta);

      let dotMesh;
      let scale = Math.random() + 0.5;
      if (
        val > 120 &&
        poiMap[String(id)] &&
        !meshes.find((mesh) => mesh.meta_id === String(id))
      ) {
        scale = 2.4;

        dotMesh = new THREE.Mesh(activeGeometry, activeMaterial);
        dotMesh.meta = poiMap[String(id)];
        dotMesh.meta_id = String(id);
        meshes.push(dotMesh);
      } else {
        scale = Math.random() * 1.3 + 0.6;
        dotMesh = new THREE.Mesh(dotGeometry, shaderMaterial);
      }
      dotMesh.scale.x = scale;
      dotMesh.scale.y = scale;
      dotMesh.scale.z = scale;
      dotMesh.position.x = vector.x;
      dotMesh.position.y = vector.y;
      dotMesh.position.z = vector.z;
      dotMesh.lookAt(new THREE.Vector3(0, 0, 0));
      scene.add(dotMesh);
    }
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0xff00ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: Math.random() / 2 + 0.25,
  });

  const mesh = new THREE.Mesh(singleGeometry, material);
  scene.add(mesh);

  group.rotation.y = -1;

  scene.add(group);
  addLight(scene);
  addGlobe(scene);

  const popup = document.querySelector("#popup-wrapper");
  const animate = (time) => {
    requestAnimationFrame(animate);
    shaderMaterial.uniforms.u_time.value = time;
    controls.update();
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);

    updateScreenPosition(renderer, camera, popup);
  };
  animate(0);
};
_handleLoad(document.querySelector("#wrapper"));
