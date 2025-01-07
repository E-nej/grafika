import * as THREE from './node_modules/three/build/three.module.js';
import { OBJLoader } from './node_modules/three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
import mqtt from 'mqtt';
import { Sky } from 'three/addons/objects/Sky.js';

const client = mqtt.connect("ws://192.168.0.106:9001");

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

let perspectiveCount= 0; // Flag to enable/disable perspective view

// materials
const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0x0000FF });
const redMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const modra = new THREE.MeshBasicMaterial({ color: 0x0000FF });

// Track right mouse button state
let isRightMouseDown = false;

// ===== Create Scene, Camera, and Renderer =====
const scene = new THREE.Scene();
//scene.background = new THREE.Color(0x87CEEB);  // Sky blue color

const sky = new Sky();
sky.scale.setScalar(450000); // Adjust size of sky dome

const phi = THREE.MathUtils.degToRad( 90 );
const theta = THREE.MathUtils.degToRad( 180 );
const sunPosition = new THREE.Vector3().setFromSphericalCoords( 1, phi/2, theta/2 );

sky.material.uniforms.sunPosition.value = sunPosition;

scene.add( sky );

// Add ambient light for overall illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 1); // Soft white light
scene.add(ambientLight);

// Add a directional light to simulate the sun or another strong light source
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10); // Position the light above and to the side
directionalLight.castShadow = true; // Enable shadows for this light
directionalLight.shadow.mapSize.width = 2048; // Shadow quality (higher is better, but slower)
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;

scene.add(directionalLight);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
});

// Set up renderer
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Add this to enable shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: Use soft shadows

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
  // add texture
  const grassTexture = new THREE.TextureLoader().load('./textures/grass-texture.jpg');
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(10, 10); // Adjust this to repeat the texture
  const grassMaterial = new THREE.MeshBasicMaterial({
    map: grassTexture,
  });

  grassPlane = new THREE.Mesh(planeGeometry, grassMaterial); // Assign to global variable

  grassPlane.receiveShadow = true; // Grass will display shadows cast by other objects

  grassPlane.rotation.x = -Math.PI / 2;
  grassPlane.position.set(0, 0, 0);

  scene.add(grassPlane);
  return grassPlane;
}

grassPlane = addGrassPlane();

// get positions for MQTT message
function getPositions() {
  const roundToTwoDecimals = (value) => parseFloat(value.toFixed(2));

  const positions = {};

  if (car) {
    positions.car = {
      x: roundToTwoDecimals(car.position.x),
      y: roundToTwoDecimals(car.position.y),
      z: roundToTwoDecimals(car.position.z),
    };
  }

  if (cyclist) {
    positions.cyclist = {
      x: roundToTwoDecimals(cyclist.position.x),
      y: roundToTwoDecimals(cyclist.position.y),
      z: roundToTwoDecimals(cyclist.position.z),
    };
  }

  if (motorist) {
    positions.motorist = {
      x: roundToTwoDecimals(motorist.position.x),
      y: roundToTwoDecimals(motorist.position.y),
      z: roundToTwoDecimals(motorist.position.z),
    };
  }

  return positions;
}
function sendPositions() {
  const positions = getPositions();

  if (Object.keys(positions).length > 0) {
    const message = JSON.stringify(positions);

    client.publish("scene/positions", message, (err) => {
      if (err) {
        console.error("Failed to send positions:", err);
      } else {
        console.log("Positions sent:", message);
      }
    });
  }
}

setInterval(sendPositions, 2000); // Send positions every second

// ===== Menu Toggle and Start Button =====
const menu = document.getElementById('menu');
const startButton = document.getElementById('start');
const sceneSelect = document.getElementById('scene');
const distanceInput = document.getElementById('distance');

function toggleHelp() {
  const helpBox = document.getElementById('help-box');
  const helpText = document.getElementById('help-prompt');
  
  // Get current display state of the helpBox
  const helpBoxDisplay = window.getComputedStyle(helpBox).display;

  // Toggle visibility
  if (helpBoxDisplay === 'block') {
    helpBox.style.display = 'none'; // Hide the help box if it's visible
    helpText.style.display = 'block'; // Show the help text
  } else {
    helpBox.style.display = 'block'; // Show the help box if it's hidden
    helpText.style.display = 'none'; // Hide the help text
  }
}

// Add event listener for 'H' key
document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'h') {
    toggleHelp();
  }
});

function toggleMenu() {
  // Get the current display state of the menu
  const menuDisplay = window.getComputedStyle(menu).display;

  // Toggle the visibility of the menu
  if (menuDisplay === 'none') {
    menu.style.display = 'block'; // Show the menu
  } else {
    menu.style.display = 'none'; // Hide the menu
  }
}

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
      perspectiveCount += 1; // Toggle perspective view
      console.log(`Perspective view is now ${perspectiveFlag ? 'enabled' : 'disabled'}`);
      break;
    case 'm': 
      toggleMenu(); // Call the toggleMenu function when "M" is pressed
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
  toggleMenu();
  // Start animation logic
  startAnimation(selectedScene, distance);
  isAnimating = true; // Enable animation
});

// ===== Load and Place the Road Sections =====
function createStraightRoad(roadLength) {
  const objLoader = new OBJLoader();
  //const roadMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 }); // Gray material for the road
  const roadTexture = new THREE.TextureLoader().load('./textures/road-texture.jpg');
  roadTexture.wrapS = THREE.RepeatWrapping;
  roadTexture.wrapT = THREE.RepeatWrapping;
  roadTexture.repeat.set(10, 10);  // Adjust the number of repetitions
  const roadMaterial = new THREE.MeshBasicMaterial({ map: roadTexture });

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
      modelsToClear.push(object); // Add road section to the list of models to
    });
  }
}

// Generate trees
const worldSize = 100; // Define the size of the world
const roadWidth = 10;  // Width of the road
const roadLength = 50; // Length of the road
const numTrees = 50;  // Number of trees to generate
const numBuildings = 10;

function createSkyscraper(width, height, depth, position = { x: 0, y: 0, z: 0 }) {
  const buildingGroup = new THREE.Group();

  // Base building
  const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x555555, // Gray for the building
    roughness: 0.8, // A rougher surface
    metalness: 0.3, // Slight metallic look
  });
  const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
  buildingMesh.position.set(position.x, position.y + height / 2, position.z);
  buildingGroup.add(buildingMesh);

  // Windows
  const windowRows = Math.min(Math.floor(height / 4), 20); // Limit rows
  const windowCols = Math.min(Math.floor(width / 4), 10);  // Limit columns
  const windowSpacing = 4; // Spacing between windows
  const windowGeometry = new THREE.PlaneGeometry(1.2, 1.2);
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0xeeeeee, // Light gray for windows
    emissive: 0x111111, // Slight glow effect to make windows stand out even without light
    roughness: 0.1, // Smooth surface
    metalness: 0.5, // Reflective look
  });

  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      const xOffset = col * windowSpacing - (windowCols * windowSpacing) / 2 + windowSpacing / 2;
      const yOffset = row * windowSpacing - (windowRows * windowSpacing) / 2 + windowSpacing / 2;

      // Front face
      const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
      frontWindow.position.set(xOffset, yOffset, depth / 2 + 0.01);
      buildingGroup.add(frontWindow);

      // Back face
      const backWindow = new THREE.Mesh(windowGeometry, windowMaterial);
      backWindow.position.set(xOffset, yOffset, -depth / 2 - 0.01);
      backWindow.rotation.y = Math.PI; // Flip to face outward
      buildingGroup.add(backWindow);
    }
  }

  // Add skyscraper to the scene
  return buildingGroup;
}

function createTree() {
  const geometry = new THREE.CylinderGeometry(0.5, 1, 5, 8); // Trunk
  const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(geometry, material);

  const foliageGeometry = new THREE.SphereGeometry(2, 8, 8); // Foliage
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
  const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);

  foliage.position.y = 4; // Position foliage above the trunk
  trunk.add(foliage); // Attach foliage to the trunk

  return trunk;
}

function generateTrees(scene, numTrees, roadWidth, roadLength, worldSize) {
  for (let i = 0; i < numTrees; i++) {
    const x = Math.random() * worldSize - worldSize / 2;
    const z = Math.random() * worldSize - worldSize / 2;

    // Skip positions within the road boundaries
    if (Math.abs(x) < roadWidth && Math.abs(z) < roadLength) {
      i--; // Retry this iteration
      continue;
    }

    const tree = createTree();
    tree.position.set(x, 0, z);
    tree.castShadow = true; // Allow the tree to cast shadows
    scene.add(tree);

    modelsToClear.push(tree); // Add tree to the list of trees to clear
  }
}

function generateBuildings(scene, numBuildings, roadWidth, roadLength) {
  const spacing = roadLength / numBuildings;
  const backwardsOffset = 50;

  for (let i = 0; i < numBuildings; i++) {
    const xOffset = roadWidth / 2 + 2; // Offset to place the buildings beside the road
    const zOffset = -i * spacing * 2 + backwardsOffset; // Space buildings along the road

    // Left side of the road
    const leftSkyscraper = createSkyscraper(
      Math.random() * 2 + 2, // Random width
      Math.random() * 8 + 5, // Random height
      Math.random() * 2 + 2, // Random depth
      { x: -xOffset, y: 0, z: zOffset } // Position
    );
    scene.add(leftSkyscraper);

    // Right side of the road
    const rightSkyscraper = createSkyscraper(
      Math.random() * 2 + 2, // Random width
      Math.random() * 8 + 5, // Random height
      Math.random() * 2 + 2, // Random depth
      { x: xOffset, y: 0, z: zOffset } // Position
    );
    scene.add(rightSkyscraper);
    modelsToClear.push(leftSkyscraper, rightSkyscraper); // Add buildings to the list of models to clear
  }
}

let modelsToClear = [];
let roadSections = []; // Store the road sections for later removal

let lastZPosition = 0;  // Keep track of the last Z position where we generated the road and objects
let roadThreshold = 10; // Threshold to generate new roads (ahead of the car)
let objectThreshold = 50; // Threshold to generate new objects (ahead of the car)

let carPosition; // Keep track of the car's position

// ===== Handle Animation Logic =====
function startAnimation(sceneId, distance) {
  // Clear previous models
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];
    if ( modelsToClear.includes(obj) ) { 
      scene.remove(obj);
      console.log('Removed object:', obj);
    }
  }

  roadThreshold = 10; // Reset the road threshold

  // Create the road
  createStraightRoad(7);

  const objLoader = new OBJLoader();
  const carTexture = new THREE.TextureLoader().load('./textures/car-texture.jpg');
  const motoristTexture = new THREE.TextureLoader().load('./textures/test-mesh2.jpg');

  // Load avto.obj
  objLoader.load('./models/avto.obj', (object) => {
    centerAndScaleObject(object, 0.3); // Scale and center the model
    object.traverse((child) => {
      if (child.isMesh) {
        //child.material = whiteMaterial; // Apply white material
        child.material = new THREE.MeshBasicMaterial({
          map: carTexture, // Use the loaded texture
        });
      }
    });
    object.rotation.y = Math.PI / 2; // Rotate to align with road
    object.position.set(0, 0.5, 35); // Position the car slightly above the road
    scene.add(object);

    car = object; // Save reference to car
    carPosition = car.position;
    modelsToClear.push(car); // Add car to the list of models to clear
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
    modelsToClear.push(cyclist); // Add cyclist to the list of models to clear
  });
  } else {
    // Load motorist.obj
    objLoader.load('./models/motorist.obj', (object) => {
    centerAndScaleObject(object, 0.3); // Scale up the motorist
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = modra;
      }
    });
    object.rotation.y = Math.PI / 2; // Rotate to align with road
    object.position.set(distance, 0.4, 50); // Position the motorist slightly above the road
    scene.add(object);

    motorist = object; // Save reference to motorist
    modelsToClear.push(motorist); // Add motorist to the list of models to clear
  });
  }

  const mapsElement = document.getElementById('map');
  const selectedMap = mapsElement.value;

  switch (selectedMap) {
    case '1': 
      generateBuildings(scene, numBuildings, roadWidth, roadLength);
      break;
    case '2':
      generateTrees(scene, numTrees, roadWidth, roadLength, worldSize);
      break;
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

// ===== Road Generation Function =====
function createRoadAhead() {
  // Create a new road section ahead of the car
  console.log('Generating new road section...');
  const road = createStraightRoad(roadLength);
  road.position.z = lastZPosition - roadThreshold; // Position the new road section in front of the car
  scene.add(road);
  roadSections.push(road); // Store the road section for later removal

  // Update the last Z position after creating the road
  lastZPosition = road.position.z + roadLength;

  // Remove road sections that are too far behind the car
  removeOldRoadSections();
}

// ===== Utility Function to Remove Old Road Sections =====
function removeOldRoadSections() {
  // Remove road sections that are behind the car
  roadSections.forEach((road, index) => {
    if (road.position.z + roadLength < car.position.z) {
      scene.remove(road); // Remove the road section from the scene
      roadSections.splice(index, 1); // Remove it from the array
    }
  });
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

  // Check if road generation is needed
  if (car.position.z < roadThreshold) {
    roadThreshold -= 35; // Move the threshold backward to generate new road sections
    console.log('Generating new road sections...');
    createRoadAhead(); // Generate a new section of the road
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

  function handleFalling(object, boundary, isMaxBoundary) {
    if (!object.falling) {
      // Check if the object is at the boundary
      if ((isMaxBoundary && object.position.z >= boundary) || (!isMaxBoundary && object.position.z <= boundary)) {
        object.falling = true; // Mark as falling
        object.fallCounter = 0; // Initialize fall counter
      }
    } else {
      // Falling animation logic
      object.fallCounter++;
      object.rotation.x += 0.1; // Rotate for a tumbling effect
      object.position.y -= 0.2; // Move downward
      object.position.z += isMaxBoundary ? 0.1 : -0.1; // Slight z-axis adjustment for realism
  
      // Remove object if it falls too far
      if (object.position.y < -20) {
        scene.remove(object); // Remove the object from the scene
      }
    }
  }  

  // Scene-specific animations
  switch (activeScene) {
    case 1: // Scene 1: Motorist and car
    if (motorist && car) {
    // Motorist movement or falling
    if (motorist.position.z > MAX_BOUNDARY_Z || motorist.position.z < MIN_BOUNDARY_Z) {
      handleFalling(motorist, motorist.position.z > MAX_BOUNDARY_Z ? MAX_BOUNDARY_Z : MIN_BOUNDARY_Z, motorist.position.z > MAX_BOUNDARY_Z);
    } else {
      motorist.position.z -= 0.09;
    }

    // Car movement or falling
    if (car.position.z > MAX_BOUNDARY_Z || car.position.z < MIN_BOUNDARY_Z) {
      handleFalling(car, car.position.z > MAX_BOUNDARY_Z ? MAX_BOUNDARY_Z : MIN_BOUNDARY_Z, car.position.z > MAX_BOUNDARY_Z);
    } else {
      car.position.z -= 0.05;
    }
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
        handleStopAndGo(motorist, motoristMaxSpeed, motorbikeDeceleration, stoppingPoint, 0.005); // Motorist accelerates slower
        handleStopAndGo(car, carMaxSpeed, carDeceleration, stoppingPoint, 0.010); // Car accelerates slower
      } else {
        console.log('Motorist or car not found.');
      }
      break;

    case 4: // Scene 4: Stop-and-go behavior for cyclist and car
      if (cyclist && car) {
        handleStopAndGo(cyclist, cyclistMaxSpeed, cyclistDeceleration, stoppingPoint, 0.001); // Cyclist accelerates faster
        handleStopAndGo(car, carMaxSpeed, carDeceleration, stoppingPoint, 0.1000); // Car accelerates slower
      } else {
        console.log('Cyclist or car not found.');
      }
      break;

    default:
      console.log('Invalid scene selected.');
      break;
  }

  // Handle lateral movement (e.g., mouse-driven adjustments)
  let roadWidth = 4.5;
  if (isRightMouseDown && motorist) {
    motorist.position.x = (motorist.position.x + 0.02) % roadWidth;
  }
  if (isRightMouseDown && cyclist) {
    cyclist.position.x = (cyclist.position.x + 0.02) % roadWidth;
  }

  // Camera behavior: anchor to the car and make it look at the car
  if (car) {
    // Adjust camera position relative to the car
    if(perspectiveCount % 3 === 0) {
      const offset = new THREE.Vector3(0, 5, 5); // Adjust this vector to set your preferred distance
      camera.position.copy(car.position).add(offset); // Set camera position at fixed offset from the car

      //Make the camera look at the car
      camera.lookAt(car.position);
    } else if (perspectiveCount % 3 === 1) {  // Normal camera behavior
      const offset = new THREE.Vector3(0, 5, 5); // Adjust for desired camera offset
  
      // Update only the z-axis and maintain the offset
      camera.position.set(
      camera.position.x,           // Keep current x-position
      camera.position.y,           // Keep current y-position
      car.position.z + offset.z    // Follow car along z-axis
      );

      controls.enableDamping = true; // Enable damping for smooth camera movement
      controls.dampingFactor = 0.25; // Adjust damping factor as needed
      controls.minDistance = 2; // Set minimum distance for zooming
      controls.maxDistance = 40; // Set maximum distance for zooming
      camera.lookAt(car.position);
    } else {

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

  activeScene = sceneId;
});
