import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ===== Create Scene, Camera, and Renderer =====
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
camera.position.z = 10;

// ===== Add Camera Controls =====
const controls = new OrbitControls(camera, renderer.domElement);

// Enable damping (smooth movement)
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Set min and max zoom distances
controls.minDistance = 5; // Minimum zoom distance
controls.maxDistance = 50; // Maximum zoom distance

// Allow vertical and horizontal rotation
controls.enablePan = false; // Disable panning
controls.enableRotate = true; // Enable rotation

// ===== Menu Toggle and Start Button =====
const menu = document.getElementById('menu');
const startButton = document.getElementById('start');
const sceneSelect = document.getElementById('scene');
const distanceInput = document.getElementById('distance');

// Toggle menu visibility with the "M" key
document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'm') {
    menu.classList.toggle('hidden');
  }
});

// ===== Load and Display Models =====
const objLoader = new OBJLoader();
let currentModel = null; // Keep track of the current model

function loadModel(modelPath, position) {
  if (currentModel) {
    scene.remove(currentModel); // Remove the existing model
  }

  objLoader.load(
    modelPath,
    (object) => {
      currentModel = object;

      // Center and scale the model
      const box = new THREE.Box3().setFromObject(object);
      const center = new THREE.Vector3();
      box.getCenter(center);
      object.position.sub(center); // Center the model
      object.scale.set(0.5, 0.5, 0.5); // Scale the model
      object.position.set(position.x, position.y, position.z); // Set position

      scene.add(object); // Add the model to the scene
      console.log(`${modelPath} loaded successfully.`);
    },
    undefined,
    (error) => {
      console.error(`Error loading ${modelPath}:`, error);
    }
  );
}

// ===== Handle Start Button =====
startButton.addEventListener('click', () => {
  const selectedScene = sceneSelect.value;
  const distance = parseFloat(distanceInput.value);

  console.log(`Starting animation: Scene ${selectedScene}, Distance: ${distance}`);

  // Hide the menu
  menu.classList.add('hidden');

  // Load the appropriate model based on the selected scene
  if (selectedScene === '1') {
    loadModel('./models/avto.obj', { x: distance / 10, y: 0, z: 0 }); // Load car
  } else if (selectedScene === '2') {
    loadModel('./models/motorist.obj', { x: -distance / 10, y: 0, z: 0 }); // Load motorcyclist
  }
});

// ===== Animation Loop =====
function animate() {
  requestAnimationFrame(animate);

  // Update OrbitControls
  controls.update();

  // Render the scene
  renderer.render(scene, camera);
}
animate();

// ===== Handle Window Resize =====
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
