import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

function App() {
  const canvasRef = useRef(null);

  useEffect(() => {
    // === Core Three.js Variables ===
    const canvas = canvasRef.current;
    let camera, scene, renderer, reticle;
    let lineMesh = null;
    let hitTestSource = null;
    let hitTestSourceRequested = false;
    let arButton;

    const points = [];

    // UI Elements
    const placePointButton = document.getElementById('place-point-button');
    const resetButton = document.getElementById('reset-button');
    const pointsCountEl = document.getElementById('points-count');
    const areaDisplayEl = document.getElementById('area-display');
    const volumeDisplayEl = document.getElementById('volume-display');

    // We use the X and Z coordinates, assuming the points are on a flat plane.
    function calculatePolygonArea(polygonPoints) {
      let area = 0;
      const n = polygonPoints.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += polygonPoints[i].x * polygonPoints[j].z;
        area -= polygonPoints[j].x * polygonPoints[i].z;
      }
      return Math.abs(area / 2);
    }

    function init() {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: canvas });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true;

      const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
      light.position.set(0.5, 1, 0.25);
      scene.add(light);

      arButton = ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.querySelector('.app-container') }
      });
      arButton.style.backgroundColor = 'rgba(0, 94, 255, 1)';
      document.body.appendChild(arButton);

      reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.045, 0.05, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);
      
      placePointButton.addEventListener('click', placePoint);
      resetButton.addEventListener('click', resetScene);
      window.addEventListener('resize', onWindowResize);
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function render(timestamp, frame) {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();
        if (!hitTestSourceRequested) {
          session.requestReferenceSpace('viewer').then((refSpace) => {
            session.requestHitTestSource({ space: refSpace }).then((source) => {
              hitTestSource = source;
            });
          });
          session.addEventListener('end', () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
          });
          hitTestSourceRequested = true;
        }
        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length) {
            const hit = hitTestResults[0];
            reticle.visible = true;
            reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
          } else {
            reticle.visible = false;
          }
        }
      }
      renderer.render(scene, camera);
    }

    function placePoint() {
      if (reticle.visible) {
        const newPointPos = new THREE.Vector3();
        reticle.getWorldPosition(newPointPos);
        points.push(newPointPos);

        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.025),
          new THREE.MeshBasicMaterial({ color: 0xff00ff })
        );
        marker.name = "measurement_marker";
        marker.position.copy(newPointPos);
        scene.add(marker);
        
        updateMeasurementVisuals();
      }
    }
    
    function resetScene() {
      points.length = 0;
      const objectsToRemove = [];
      scene.children.forEach(child => {
        if (child.name === "measurement_marker" || child === lineMesh) {
          objectsToRemove.push(child);
        }
      });
      objectsToRemove.forEach(obj => {
          if(obj.geometry) obj.geometry.dispose();
          if(obj.material) obj.material.dispose();
          scene.remove(obj);
      });
      lineMesh = null;
      updateMeasurementVisuals();
    }

    function updateMeasurementVisuals() {
      if (pointsCountEl) {
        pointsCountEl.textContent = points.length;
      }
      if (areaDisplayEl) {
        areaDisplayEl.textContent = '';
      }
      // This element is no longer in the JSX, but the check is good practice
      if (volumeDisplayEl) {
        volumeDisplayEl.textContent = ''; 
      }

      if (lineMesh) {
        scene.remove(lineMesh);
        lineMesh.geometry.dispose();
        lineMesh.material.dispose();
        lineMesh = null;
      }

      if (points.length < 2) return;

      // Draw a line connecting all points, including one to close the shape
      const pointsToDraw = [...points, points[0]];
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(pointsToDraw);
      lineMesh = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 }));
      scene.add(lineMesh);
      
      if (points.length >= 3) {
        const area = calculatePolygonArea(points);
        // ADDED: Check if the element exists before updating
        if (areaDisplayEl) {
          areaDisplayEl.textContent = `Polygon Area: ${area.toFixed(3)} m²`;
        }
      }
    }

    init();
    renderer.setAnimationLoop(render);

    return () => {
      renderer.setAnimationLoop(null);
      if (arButton) document.body.removeChild(arButton);
      placePointButton.removeEventListener('click', placePoint);
      resetButton.removeEventListener('click', resetScene);
      window.removeEventListener('resize', onWindowResize);
      resetScene();
    };
  }, []);

  return (
    <div className="app-container">
      <canvas ref={canvasRef}></canvas>
      <div id="ui-container">
        <button id="place-point-button">Place Point</button>
        <button id="reset-button">Reset</button>
      </div>
      <div id="measurement-container">
        <h3>Measurements</h3>
        <p>Points Placed: <span id="points-count">0</span></p>
        <p id="area-display"></p>
        <small>Place 3 or more points to measure Area.</small>
      </div>
    </div>
  );
}

export default App;