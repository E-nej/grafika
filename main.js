import * as THREE from './node_modules/three/build/three.module.js';
import { OBJLoader } from './node_modules/three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
import mqtt from 'mqtt';
import { Sky } from 'three/addons/objects/Sky.js';

const client = mqtt.connect("ws://192.168.56.1:9001");

client.on("connect", () => {
  client.subscribe("presence", (err) => {
    if (!err) {
      client.publish("presence", "Hello mqtt");
    }
  });
});

client.on("message", (topic, message) => {
  // message is Buffer
  console.log(message.toString());
  client.end();
});

const cameraSpeed = 0.2;
const MAX_BOUNDARY_Z = 50; 
const MIN_BOUNDARY_Z = -50; 

// Track key states to allow smooth movement
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
};

// Constants for animation
const stoppingPoint = 0; 
const carDeceleration = 0.005;
const motorbikeDeceleration = 0.006;
const motoristMaxSpeed = 0.09; 
const carMaxSpeed = 0.05; 
const acceleration = 0.0005;
const cyclistDeceleration = 0.0035;
const cyclistMaxSpeed = 0.05; 

let perspectiveFlag = false; // Flag to enable/disable perspective view

// materials
const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const redMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
// Track right mouse button state
let isRightMouseDown = false;

// ===== Create Scene, Camera, and Renderer =====
const scene = new THREE.Scene();
//scene.background = new THREE.Color(0x87CEEB);  // Sky blue color

const sky = new Sky();
sky.scale.setScalar(450000); // Adjust size of sky dome

const phi = THREE.MathUtils.degToRad( 90 );
const theta = THREE.MathUtils.degToRad( 180 );
const sunPosition = new THREE.Vector3().setFromSphericalCoords( 1, phi, theta );

sky.material.uniforms.sunPosition.value = sunPosition;

scene.add( sky );

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
});

// Set up renderer
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
camera.position.set(10, 10, 10); // Set initial camera position
//camera.lookAt(0, 0, 0); // Make the camera look at the center of the scene

// ===== Set Up OrbitControls =====
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 50;

// ===== Add Helpers for Debugging =====
//const gridHelper = new THREE.GridHelper(100, 100);
//scene.add(gridHelper);

//const axesHelper = new THREE.AxesHelper(5);
//scene.add(axesHelper);

let grassPlane;

function addGrassPlane() {
  const planeGeometry = new THREE.PlaneGeometry(100, 100);
  const grassMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    side: THREE.DoubleSide,
  });

  grassPlane = new THREE.Mesh(planeGeometry, grassMaterial); // Assign to global variable

  grassPlane.rotation.x = -Math.PI / 2;
  grassPlane.position.set(0, 0, 0);

  scene.add(grassPlane);
  return grassPlane;
}

grassPlane = addGrassPlane();

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

// Function to display help information
function showHelp() {
  alert(`
Key Bindings:
- W: Move camera forward
- S: Move camera backward
- A: Move camera left
- D: Move camera right
- Space: Start/Stop animation
- M: Toggle the menu
- R: Reload the page
- P: Toggle perspective view (third-person/follow car)
- Right Mouse Button: Move motorist or cyclist laterally
- H: Display this help information
`);
}

// Add event listener for 'H' key
document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'h') {
    showHelp();
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
    case 'p': // P key toggles perspective view
      perspectiveFlag = !perspectiveFlag; // Toggle perspective view
      console.log(`Perspective view is now ${perspectiveFlag ? 'enabled' : 'disabled'}`);
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
  if (keys.a) camera.position.add(right.clone().multiplyScalar(cameraSpeed)); // Move left
  if (keys.d) camera.position.add(right.clone().multiplyScalar(-cameraSpeed)); // Move right
}

// Objects and animation flag
let motorist;
let cyclist;
let car; 
let isAnimating = false; // Flag to start/stop the animation
var activeScene = 0; // Track the active scene

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
      centerAndScaleObject(object, 1); // Adjust the scale factor as needed
      object.traverse((child) => {
        if (child.isMesh) {
          child.material = roadMaterial; // Apply the road material
        }
      });

      // Correct rotation to ensure road is flat
      object.rotation.y = -Math.PI / 2; // Lay flat on the ground
      object.position.set(0, 0.01, i * 5); // Position along the Z-axis

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
    if (obj !== camera && !(obj instanceof THREE.GridHelper || obj instanceof THREE.AxesHelper || obj === sky || obj === grassPlane)) { 
      scene.remove(obj);
      console.log('Removed object:', obj);
    }
  }

  // Create the road
  createStraightRoad(9);

  const objLoader = new OBJLoader();


  // Load avto.obj
  objLoader.load('./models/avto.obj', (object) => {
    centerAndScaleObject(object, 0.3); // Scale and center the model
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = whiteMaterial; // Apply white material
      }
    });
    object.rotation.y = Math.PI / 2; // Rotate to align with road
    object.position.set(0, 0.5, 35); // Position the car slightly above the road
    scene.add(object);

    car = object; // Save reference to car
  
  });

  if (sceneId % 2 === 0) {
    // Load bikered.obj
    objLoader.load('./models/bikered.obj', (object) => {
    centerAndScaleObject(object, 0.3); // Scale up the cyclist
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = redMaterial; 
      }
    });
    object.rotation.y = Math.PI / 1000; // Rotate to align with road
    object.position.set(distance, 0.4, 20); 
    scene.add(object);

    cyclist = object; // Save reference to cyclist
  });
  } else {
    // Load motorist.obj
    objLoader.load('./models/motorist.obj', (object) => {
    centerAndScaleObject(object, 0.3); // Scale up the motorist
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = redMaterial; 
      }
    });
    object.rotation.y = Math.PI / 2; // Rotate to align with road
    object.position.set(distance, 0.4, 50); // Position the motorist slightly above the road
    scene.add(object);

    motorist = object; // Save reference to motorist
  });
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

  // Update camera movement (if necessary)
  updateCameraMovement();

  // Early return if not animating
  if (!isAnimating) {
    renderer.render(scene, camera);
    return;
  }

  // Utility function: Constrain object position within boundaries
  function gridBoundary(object, minZ, maxZ) {
    if (object.position.z > maxZ) object.position.z = maxZ;
    if (object.position.z < minZ) object.position.z = minZ;
  }

  // Utility function: Handle stop-and-go behavior
  function handleStopAndGo(object, maxSpeed, deceleration, stoppingPoint, acceleration) {
    if (object.currentSpeed === undefined) object.currentSpeed = 0;
    if (object.takeOffCounter === undefined) object.takeOffCounter = 0;

    if (!object.stopped) {
      // Slow down to the stopping point
      if (object.position.z > stoppingPoint) {
        object.position.z -= Math.max(0.02, (object.position.z - stoppingPoint) * deceleration);
      } else {
        object.position.z = stoppingPoint;
        object.stopped = true;
      }
    } else {
      // Increment counter and start speeding up after stopping
      object.takeOffCounter++;
      if (object.takeOffCounter > 120) { // ~2 seconds at 60 FPS
        if (object.currentSpeed < maxSpeed) {
          object.currentSpeed += acceleration;
        }
        object.position.z -= object.currentSpeed;
      }
    }
    gridBoundary(object, MIN_BOUNDARY_Z, MAX_BOUNDARY_Z);
  }

  // Scene-specific animations
  switch (activeScene) {
    case 1: // Scene 1: Motorist and car
      if (motorist && car) {
        motorist.position.z -= 0.09;
        car.position.z -= 0.05;
        gridBoundary(motorist, MIN_BOUNDARY_Z, MAX_BOUNDARY_Z);
        gridBoundary(car, MIN_BOUNDARY_Z, MAX_BOUNDARY_Z);
      } else {
        console.log('Motorist or car not found.');
      }
      break;

    case 2: // Scene 2: Cyclist and car
      if (cyclist && car) {
        cyclist.position.z -= 0.05;
        car.position.z -= 0.08;
        gridBoundary(cyclist, MIN_BOUNDARY_Z, MAX_BOUNDARY_Z);
        gridBoundary(car, MIN_BOUNDARY_Z, MAX_BOUNDARY_Z);
      } else {
        console.log('Cyclist or car not found.');
      }
      break;

    case 3: // Scene 3: Stop-and-go behavior for motorist and car
      if (motorist && car) {
        handleStopAndGo(motorist, motoristMaxSpeed, motorbikeDeceleration, stoppingPoint, acceleration);
        handleStopAndGo(car, carMaxSpeed, carDeceleration, stoppingPoint, acceleration);
      } else {
        console.log('Motorist or car not found.');
      }
      break;

    case 4: // Scene 4: Stop-and-go behavior for cyclist and car
      if (cyclist && car) {
        handleStopAndGo(cyclist, cyclistMaxSpeed, cyclistDeceleration, stoppingPoint, acceleration);
        handleStopAndGo(car, carMaxSpeed, carDeceleration, stoppingPoint, acceleration);
      } else {
        console.log('Cyclist or car not found.');
      }
      break;

    default:
      console.log('Invalid scene selected.');
      break;
  }

  // Handle lateral movement (e.g., mouse-driven adjustments)
  let roadWidth = 1.5;
  if (isRightMouseDown && motorist) {
    motorist.position.x = (motorist.position.x + 0.02) % roadWidth;
  }
  if (isRightMouseDown && cyclist) {
    cyclist.position.x = (cyclist.position.x + 0.02) % roadWidth;
  }

  // Camera behavior: anchor to the car and make it look at the car
  if (car) {
    // Adjust camera position relative to the car
    if(perspectiveFlag) {
      const offset = new THREE.Vector3(0, 5, 5); // Adjust this vector to set your preferred distance
      camera.position.copy(car.position).add(offset); // Set camera position at fixed offset from the car

      //Make the camera look at the car
      camera.lookAt(car.position);
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

// ===== Handle Start Button Click =====
document.getElementById("start").addEventListener("click", () => {
  const sceneId = parseInt(document.getElementById("scene").value, 10);
  const distance = parseFloat(document.getElementById("distance").value);

  activeScene = sceneId;
});
