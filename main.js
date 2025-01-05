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

const sceneOptions = {
  MOTOR_PREHITI: 1,
  PREHITIMO_KOLESARJA: 2,
  SRECANJE_Z_MOTORISTOM: 3,
  SRECANJE_S_KOLESARJEM: 4,
}

// Track right mouse button state
let isRightMouseDown = false;

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
    case ' ': // Space key toggles animation
      isAnimating = !isAnimating; // Toggle animation state
      console.log(`Animation is now ${isAnimating ? 'running' : 'paused'}`);
      break;
    case 'r': // R key reloads the page
      console.log('Reloading the page...');
      location.reload(); // Reload the page
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

// Add mouse event listeners
document.addEventListener('mousedown', (event) => {
  if (event.button === 2) { // Right mouse button
    isRightMouseDown = true;
    console.log('Right mouse button pressed');
  }
});

document.addEventListener('mouseup', (event) => {
  if (event.button === 2) { // Right mouse button
    isRightMouseDown = false;
    console.log('Right mouse button released');
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

// Objects and animation flag
let motorist;
let cyclist;
let car; 
let isAnimating = false; // Flag to start/stop the animation

// Handle the "Start Animation" button
startButton.addEventListener('click', () => {
  const selectedScene = sceneSelect.value;
  const distance = parseFloat(distanceInput.value);

  console.log(`Starting animation: Scene ${selectedScene}, Distance: ${distance}`);

  // Hide the menu
  menu.classList.add('hidden');

  // Start animation logic
  startAnimation(selectedScene, distance);
  isAnimating = true; // Enable animation
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

      // Correct rotation to ensure road is flat
      object.rotation.y = -Math.PI / 2; // Lay flat on the ground
      object.position.set(0, 0, i * 5); // Position along the Z-axis

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
  createStraightRoad(6); // Create a road with 10 sections

  const objLoader = new OBJLoader();
  const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // Load motorist.obj
  objLoader.load('./models/motorist.obj', (object) => {
    centerAndScaleObject(object, 0.15); // Scale up the motorist
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = whiteMaterial; // Apply white material
      }
    });
    object.rotation.y = Math.PI / 2; // Rotate to align with road
    object.position.set(0, 0.2, 10); // Position the motorist slightly above the road
    scene.add(object);

    motorist = object; // Save reference to motorist
  });

  // Load avto.obj
  objLoader.load('./models/avto.obj', (object) => {
    centerAndScaleObject(object, 0.1); // Scale and center the model
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = whiteMaterial; // Apply white material
      }
    });
    object.rotation.y = Math.PI / 2; // Rotate to align with road
    object.position.set(0, 0.2, -10); // Position the car slightly above the road
    scene.add(object);

    car = object; // Save reference to car
  });
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

  let activeScene = 1;
  if (isAnimating) {
    if (activeScene === 1) {
      if (motorist) {
        motorist.position.z -= 0.09;
      }
      if (car) {
        car.position.z -= 0.05;
      }
    } else if (activeScene === 2) {
      
    } else if (activeScene === 3) {
      
    } else {
      
    }    
  }

  // Move motorist when right mouse button is held
  let roadWidth = 1.5;
  if (isRightMouseDown && motorist || cyclist) {
    if (motorist.position.x < roadWidth) {
      motorist.position.x += 0.02; // Gradually move motorist away from the center
      //cyclist.position.x += 0.02; --> trenutno zakomentirano, ker brez kolesarja ne dela ok
    } else {
      motorist.position.x = -roadWidth;
      //cyclist.position.x = -roadWidth;
    }  
  }

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

function sceneSelector(distance, sceneId) {
  activeScene = sceneId;
  startAnimation(sceneId, distance);
  console.log("Scene " + sceneId + " started.");
}

document.getElementById("start").addEventListener("click", () => {
  const sceneId = parseInt(document.getElementById("scene").value, 10);
  const distance = parseFloat(document.getElementById("distance").value);

  switch (sceneId) {
    case "1":
      sceneSelector(distance, sceneOptions.MOTOR_PREHITI);
      break;
    case "2":
      sceneSelector(distance, sceneOptions.PREHITIMO_KOLESARJA);
      break;
    case "3":
      sceneSelector(distance, sceneOptions.SRECANJE_Z_MOTORISTOM);
      break;
    case "4":
      sceneSelector(distance, sceneOptions.SRECANJE_S_KOLESARJEM);
      break;
    default:
      console.log("Invalid scene selected.");
  }
});
