import * as THREE from './node_modules/three/build/three.module.js';
import { OBJLoader } from './node_modules/three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';


// Movement speed for the camera
const cameraSpeed = 1; // Adjust this value for faster/slower movement

// Track key states to allow smooth movement
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
};



// ===== Create Scene, Camera, and Renderer =====
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
});

// Set up renderer
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
camera.position.set(10, 10, 20); // Set initial camera position
camera.lookAt(0, 0, 0); // Make the camera look at the center of the scene

// ===== Set Up OrbitControls =====
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 50;

// ===== Add Helpers for Debugging =====
const gridHelper = new THREE.GridHelper(100, 100);
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

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

// Add event listeners for key presses
document.addEventListener('keydown', (event) => {
  switch (event.key.toLowerCase()) {
    case 'w':
      keys.w = true;
      break;
    case 'a':
      keys.a = true;
      break;
    case 's':
      keys.s = true;
      break;
    case 'd':
      keys.d = true;
      break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.key.toLowerCase()) {
    case 'w':
      keys.w = false;
      break;
    case 'a':
      keys.a = false;
      break;
    case 's':
      keys.s = false;
      break;
    case 'd':
      keys.d = false;
      break;
  }
});
function updateCameraMovement() {
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  camera.getWorldDirection(forward); // Get the forward vector
  forward.y = 0; // Lock vertical movement
  forward.normalize();

  right.crossVectors(camera.up, forward).normalize(); // Calculate the right vector

  // Update camera position based on key states
  if (keys.w) camera.position.add(forward.clone().multiplyScalar(cameraSpeed)); // Move forward
  if (keys.s) camera.position.add(forward.clone().multiplyScalar(-cameraSpeed)); // Move backward
  if (keys.a) camera.position.add(right.clone().multiplyScalar(-cameraSpeed)); // Move left
  if (keys.d) camera.position.add(right.clone().multiplyScalar(cameraSpeed)); // Move right
}

// Handle the "Start Animation" button
startButton.addEventListener('click', () => {
  const selectedScene = sceneSelect.value;
  const distance = parseFloat(distanceInput.value);

  console.log(`Starting animation: Scene ${selectedScene}, Distance: ${distance}`);

  // Hide the menu
  menu.classList.add('hidden');

  // Start animation logic based on scene and distance
  startAnimation(selectedScene, distance);
});

// ===== Load and Place the Road Sections =====
function createStraightRoad(roadLength) {
  const objLoader = new OBJLoader();
  const roadMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 }); // Gray material for the road

  for (let i = -roadLength; i <= roadLength; i++) {
    objLoader.load('./models/cesta.obj', (object) => {
      if (!object) {
        console.error('Failed to load the cesta.obj file.');
        return;
      }

      // Center and scale each road section
      centerAndScaleObject(object, 0.5); // Adjust the scale factor as needed
      object.traverse((child) => {
        if (child.isMesh) {
          child.material = roadMaterial; // Apply the road material
        }
      });

      // Apply rotation to align correctly (around the y-axis or another axis as needed)
      //object.rotation.x = -Math.PI / 2; // Lay flat on the ground
      object.rotation.y = Math.PI / 2;  // Rotate 90° around the Y-axis (example)
      // object.rotation.z = Math.PI / 4; // Optional: rotate around Z-axis if needed

      // Position the road section to connect with the previous one
      object.position.set(0, 0, i * 5); // Position along the Z-axis (adjust increment as needed)

      // Add the road section to the scene
      scene.add(object);

      console.log(`Road section ${i} added at position:`, object.position);
    });
  }
}





// ===== Handle Animation Logic =====
function startAnimation(sceneId, distance) {
  // Clear previous models
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];
    if (obj !== camera && !(obj instanceof THREE.GridHelper || obj instanceof THREE.AxesHelper)) {
      scene.remove(obj);
    }
  }

  // Create the road
  createStraightRoad(5); // Create a road with 20 sections

  const objLoader = new OBJLoader();

  const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

  if (sceneId === '1') {
    // Load motorist.obj for Scene 1
    objLoader.load('./models/motorist.obj', (object) => {
      centerAndScaleObject(object, 0.1); // Center and scale the model
      object.traverse((child) => {
        if (child.isMesh) {
          child.material = whiteMaterial; // Apply the white material
        }
      });
      object.position.set(0, 1, 10); // Place motorist on the road
      scene.add(object);
    });
  } else if (sceneId === '2') {
    // Load avto.obj for Scene 2
    objLoader.load('./models/avto.obj', (object) => {
      centerAndScaleObject(object, 0.1); // Center and scale the model
      object.traverse((child) => {
        if (child.isMesh) {
          child.material = whiteMaterial; // Apply the white material
        }
      });
      object.position.set(0, 1, -10); // Place car on the road
      scene.add(object);
    });
  } else {
    console.log(`Unknown scene ID: ${sceneId}`);
  }
}

// ===== Utility Function to Center and Scale Objects =====
function centerAndScaleObject(object, scaleFactor) {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  box.getCenter(center);
  object.position.sub(center); // Center the object

  object.scale.set(scaleFactor, scaleFactor, scaleFactor); // Scale down
}


// ===== Animation Loop =====
function animate() {
  requestAnimationFrame(animate);

  // Update OrbitControls
  controls.update();

  // Update camera movement
  updateCameraMovement();

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
