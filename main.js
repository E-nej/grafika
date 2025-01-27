import * as THREE from './node_modules/three/build/three.module.js';
import { OBJLoader } from './node_modules/three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
import mqtt from 'mqtt';
import { Sky } from 'three/addons/objects/Sky.js';

const client = mqtt.connect('ws://192.168.0.106:9001', {
  clientId: `threejs-client-${Math.random().toString(16).substr(2, 8)}`,
  clean: true,
});

const posTopic = 'threejs/detections'; 

let subscribed = false;

client.on('connect', () => {
  if (!subscribed) {
    client.subscribe(posTopic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to topic ${posTopic}:`, err);
      } else {
        console.log(`Subscribed to topic ${posTopic}`);
        subscribed = true;
      }
    });
  }
});

client.on('message', (topic, message) => {
  if (topic === posTopic) {
    // Parse the incoming message, which contains the timestamp and sphereState
    const { timestamp, sphereState } = JSON.parse(message.toString());
    console.log('Received timestamp and sphereState:', timestamp, sphereState);

    // Find the corresponding sphere based on the timestamp
    const queueItem = screenshotQueue.find(item => item.timestamp === timestamp);

    if (queueItem) {
      // Update the sphere color based on the received sphereState
      queueItem.sphere.material.color.set(sphereState); // `sphereState` should be a valid color (like "red", "blue", etc.)
      console.log(`Updated sphere with timestamp ${timestamp} to color ${sphereState}`);
    } else {
      console.log(`No sphere found for timestamp ${timestamp}`);
    }
  }
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

//vairables for drwaing car tracks
let carTrackLine; // Line representing the car's track
let trackPoints = []; // Array to hold track points
const trackColor = 0xff0000; // Red color for the track

// Constants for animation
const stoppingPoint = 0; 
const carDeceleration = 0.005;
const motorbikeDeceleration = 0.006;
const motoristMaxSpeed = 0.09; 
const carMaxSpeed = 0.05; 
const acceleration = 0.0005;
const cyclistDeceleration = 0.0035;
const cyclistMaxSpeed = 0.05; 

let perspectiveCount= 0; // Track perspective view
let numPerspectiv = 6;

// materials
const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0x0000FF });
const redMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const modra = new THREE.MeshStandardMaterial({ color: 0x0000FF });

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

scene.add(sky);

// Add ambient light for overall illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 1); // Soft white light
scene.add(ambientLight);

// Add a directional light to simulate the sun or another strong light source
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(10, 20, 10); // Position the light above and to the side
directionalLight.castShadow = true; // Enable shadows for this light
directionalLight.shadow.mapSize.width = 2048; // Shadow quality (higher is better, but slower)
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -100; // Extend to cover the grass plane
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;

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

// ===== Add Helpers for Debugging =====
//const gridHelper = new THREE.GridHelper(100, 100);
//scene.add(gridHelper);

//const axesHelper = new THREE.AxesHelper(5);
//scene.add(axesHelper);

let sideCamera; // To hold the side camera
let sideViewRenderTarget; // (Optional) To hold the render target for off-screen rendering
let sideCameraHelperCube; // Declare the variable

function initializeSideCamera() {
 // Create the side camera
 sideCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
 sideCamera.position.set(20, 0, 0); // Set side view position
 sideCamera.lookAt(0, 0, 0); // Look at the scene center

 const sideViewSize = 512; // Render target size
 sideViewRenderTarget = new THREE.WebGLRenderTarget(sideViewSize, sideViewSize);

 // Add a cube to represent the side camera

 sideCameraHelperCube = sideCameraHelperCube = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2), // Larger size
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);

 // Match cube position with the side camera
 sideCameraHelperCube.position.copy(sideCamera.position);

 // Add the cube to the scene
 scene.add(sideCameraHelperCube);
 console.log('Cube position:', sideCameraHelperCube.position); // Add this log here
}

function updateSideCamera() {
  if (car) {
    const carDirection = new THREE.Vector3();
      car.getWorldDirection(carDirection); // Get the car's forward direction

      // Compute the "left" vector for the car (invert the "right" vector)
      const carLeft = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), carDirection).normalize(); // Get the left vector

      // Position the side camera relative to the car (adjust these offsets as needed)
    const sideCameraPosition = car.position.clone()
        .add(carLeft.multiplyScalar(1)) // 5 units to the left of the car
        .add(new THREE.Vector3(0, 0.5, 0)) // 2 units upward
        .add(carDirection.multiplyScalar(1)); // Move slightly forward (2 units)
      sideCamera.position.copy(sideCameraPosition);

    // Make the side camera look ahead of the car
    sideCamera.lookAt(car.position.clone().add(carDirection.multiplyScalar(20))); // Look forward

        // Use the camera for rendering
    renderer.render(scene, sideCamera);

    // Position the camera to the side of the car
    //sideCamera.position.copy(car.position);
    //sideCamera.position.x += 20; // Move it to the right of the car
    //sideCamera.lookAt(car.position); // Ensure it looks at the car

    
    //console.log('Updated Cube position:', sideCameraHelperCube.position);
  }
}

initializeSideCamera();

const screenshotTopic = 'threejs/screenshot';

function resizeAndSendScreenshot(data) {
  const dataURL = data.screenshot
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const desiredWidth = 800;
  const desiredHeight = 600;

  const img = new Image();
  img.src = dataURL;

  img.onload = function() {
                // Set canvas size to desired resolution
                canvas.width = desiredWidth;
                canvas.height = desiredHeight;

                // Draw the resized image onto the canvas
                ctx.drawImage(img, 0, 0, desiredWidth, desiredHeight);

                // Convert the resized canvas to Base64 (smaller image)
                const resizedDataURL = canvas.toDataURL('image/png');

                data.screenshot = resizedDataURL;

                // Publish the resized Base64 image to MQTT
                client.publish(screenshotTopic, JSON.stringify(data), { qos: 1, retain: false }, (err) => {
                    if (err) {
                        console.error('Failed to send screenshot:', err);
                    } else {
                        console.log('Resized screenshot sent successfully');
                    }
                });
            };
}

function captureScreenshot(camera, timestamp) {
  renderer.render(scene, camera); // Render the scene from the specified camera

  const data = {
    screenshot: renderer.domElement.toDataURL("image/png"),
    timestamp: timestamp,
  }

  resizeAndSendScreenshot(data);
}

let grassPlanes = [];

function addGrassPlane(zPosition = 0) {
  const planeGeometry = new THREE.PlaneGeometry(100, 100);
  
  // Add texture
  const grassTexture = new THREE.TextureLoader().load('./textures/grass-texture.jpg');
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(10, 10); // Adjust this to repeat the texture
  
  const grassMaterial = new THREE.MeshStandardMaterial({
    map: grassTexture,
    receiveShadow: true,
  });

  const grassPlane = new THREE.Mesh(planeGeometry, grassMaterial); // Create a new grass plane
  
  grassPlane.receiveShadow = true; // Grass will display shadows cast by other objects
  
  grassPlane.rotation.x = -Math.PI / 2;
  grassPlane.position.set(0, 0, zPosition); // Position the grass plane at the specified Z position
  
  scene.add(grassPlane);

  return grassPlane;
}

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

//setInterval(sendPositions, 2000); // Send positions every second

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

let toggleObject;
let isObjectVisible = true;
const nalagalnik = new OBJLoader(); 

function LoadDisplay(){
  
  if (!toggleObject) {
    // Load the object only once
   // Load the object only once
   const startTime = performance.now(); // Record start time
    nalagalnik.load('./models/infotainment.obj', (object) => {
      const endTime = performance.now(); // Record end time after loading
        const loadTime = endTime - startTime; // Calculate the load time
        //console.log(`Object loaded in ${loadTime.toFixed(2)} ms`);
    // Adjust the position to the right of the screen
    object.position.set(4, 0, -5); // 5 units to the right, and 5 units in front of the camera
    object.scale.set(10, 10, 10); // Adjust the scale as needed

    // Rotate the object to face the camera
    object.rotation.set(0, THREE.MathUtils.degToRad(175), 0); // Rotate 90 degrees to face the camera
    
    // Parent the object to the camera so it moves with it
    camera.add(object);
    scene.add(camera); // Ensure the camera is added to the scene

    toggleObject = object;
    console.log('Object loaded and added to the camera.');
  });
  } else {
    // Toggle visibility of the already-loaded object
    isObjectVisible = !isObjectVisible;
    toggleObject.visible = isObjectVisible;
    console.log(`Object visibility toggled: ${isObjectVisible}`);
  }
}

// MQTT topic for infotainment color
const infotainmentColorTopic = 'car/infotainment/color';


  
function updateInfotainmentColor() {
  if (!toggleObject) return; // Ensure the infotainment object is loaded

  let color = 0xffffff; // Default color (white)

  const proximityThreshold = 5; // Threshold distance for proximity checks
  const sideProximityThreshold = 1.5; // Threshold for side proximity checks

  // Calculate motorist distance
  if (motorist) {
    const motoristDistance = car.position.distanceTo(motorist.position);
    console.log("Motorist Distance:", motoristDistance);

    if (motoristDistance < proximityThreshold) {
      color = 0x0000ff; // Blue if motorist is too close
    }
  }

  // Calculate cyclist distances
  if (cyclist) {
    // Forward/Backward Proximity Check
    const bikeredDistance = car.position.distanceTo(cyclist.position);
    console.log("Cyclist Forward/Backward Distance:", bikeredDistance);

    if (bikeredDistance < proximityThreshold) {
      color = 0xff0000; // Red if cyclist is too close in the front/back
    }

    // Side Distance Check
    const carDirection = new THREE.Vector3();
    car.getWorldDirection(carDirection); // Get the car's forward direction

    const bikeredToCar = cyclist.position.clone().sub(car.position); // Vector from car to cyclist

    // Calculate side distance (perpendicular distance)
    const sideDistanceVector = bikeredToCar.clone().sub(carDirection.multiplyScalar(bikeredToCar.dot(carDirection)));
    const bikeredSideDistance = sideDistanceVector.length();

    // Check if cyclist is to the side (not significantly forward or backward)
    const forwardDot = bikeredToCar.dot(carDirection);
    const isToSide = Math.abs(forwardDot) < proximityThreshold; // Adjust threshold for side checking

    console.log("Cyclist Side Distance:", bikeredSideDistance);
    console.log("Cyclist Forward Dot:", forwardDot);
    console.log("Cyclist Is To Side:", isToSide);

    if (isToSide && bikeredSideDistance < sideProximityThreshold) {
      color = 0xffa500; // Orange if cyclist is too close on the side
    }
  }

  // Ensure the object resets to white if no conditions are met
  if (
    (motorist && car.position.distanceTo(motorist.position) >= proximityThreshold) &&
    (cyclist && car.position.distanceTo(cyclist.position) >= proximityThreshold) &&
    (!cyclist || (Math.abs(car.position.clone().sub(cyclist.position).dot(new THREE.Vector3(1, 0, 0))) > sideProximityThreshold))
  ) {
    color = 0xffffff; // Reset to white
  }

  let colorName = 'white';
  if (color === 0x0000ff) colorName = 'blue';
  else if (color === 0xff0000) colorName = 'red';
  else if (color === 0xffa500) colorName = 'orange';

  mqttClient.publish(infotainmentColorTopic, colorName);

  // Update infotainment object color
  toggleObject.traverse((child) => {
    if (child.isMesh) {
      child.material.color.set(color);
    }
  });
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
      break;
    case 'b': //pogled strankse kamere
      console.log('stranski view');
      perspectiveCount += 1; // Toggle perspective view
      break;
    case 'v': 
    console.log('Toggling display visibility');
    if (!toggleObject) {
      LoadDisplay(); // Load the object if not already loaded
    } else {
      isObjectVisible = !isObjectVisible;
      toggleObject.visible = isObjectVisible; // Toggle visibility
      console.log("Display visibility: ${isObjectVisible}");
    }
    break;
    case 'm': 
      toggleMenu(); // Call the toggleMenu function when "M" is pressed
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
  toggleMenu();
  // Start animation logic
  startAnimation(selectedScene, distance);
  isAnimating = true; // Enable animation
});

// ===== Load and Place the Road Sections =====
function createRoadTile(position, roadMaterial) {
  const objLoader = new OBJLoader();
  const roadTile = new THREE.Group();  // Use a group to hold the road section
  const startTime = performance.now(); // Record start time
  objLoader.load('./models/cesta.obj', (object) => {
    const endTime = performance.now(); // Record end time after loading
        const loadTime = endTime - startTime; // Calculate the load time
        //console.log(`Object loaded in ${loadTime.toFixed(2)} ms`);
    if (!object) {
      console.error('Failed to load the cesta.obj file.');
      return;
    }

    // Center and scale each road section
    centerAndScaleObject(object, 1); // Adjust the scale factor as needed
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = roadMaterial; // Apply the road material
        child.receiveShadow = true;
        child.castShadow = true;
      }
    });

    // Correct rotation to ensure road is flat
    object.rotation.y = -Math.PI / 2; // Lay flat on the ground
    object.position.set(0, 0.01, position); // Position along the Z-axis

    // Add the road section to the group
    roadTile.add(object);
  });

  roadTile.traverse((child) => {
    if (child.isMesh) {
      child.receiveShadow = true;
      child.castShadow = true;
    }
  });

  return roadTile;
}

// Outer function: Creates the specified number of road tiles and returns them as an array
function createStraightRoad(roadLength) {
  const objLoader = new OBJLoader();
  const roadTexture = new THREE.TextureLoader().load('./textures/road-texture.jpg');
  roadTexture.wrapS = THREE.RepeatWrapping;
  roadTexture.wrapT = THREE.RepeatWrapping;
  roadTexture.repeat.set(10, 10);
  const roadMaterial = new THREE.MeshStandardMaterial({
    map: roadTexture,
    roughness: 0.9, // Add some roughness for a realistic road
    metalness: 0,   // Non-metallic surface
  });

  const roadTiles = [];  // Array to hold individual road tiles

  for (let i = -roadLength; i <= roadLength; i++) {
    const roadTile = createRoadTile(i * 5, roadMaterial);  // Create each road tile at the specified position
    roadTiles.push(roadTile);  // Add the tile to the array
  }

  return roadTiles;  // Return the array containing all road tiles
}

// Generate trees
const worldSize = 100; // Define the size of the world
const roadWidth = 10;  // Width of the road
const roadLength = 50; // Length of the road
const roadNum = 10;
const numTrees = 50;  // Number of trees to generate
const numBuildings = 10;

let grassPlaneThreshold = 0; // Distance threshold for adding grass planes
let grassPlaneLength = 100; // Length of each grass plane
let lastGrassZPosition = 100; // Tracks the last Z position of generated grass

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
  buildingMesh.castShadow = true; // Enable shadow casting for the building
  buildingMesh.receiveShadow = true;
  buildingGroup.add(buildingMesh);

  // Windows
  const windowRows = Math.min(Math.floor(height / 4), 20); // Limit rows
  const windowCols = Math.min(Math.floor(width / 4), 10);  // Limit columns
  const windowSpacing = 4; // Spacing between windows
  const windowGeometry = new THREE.PlaneGeometry(1.2, 1.2);
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0xADD8E6, // Light gray for windows
    emissive: 0x1E90FF, // Slight glow effect to make windows stand out even without light
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
      frontWindow.receiveShadow = true;
      buildingGroup.add(frontWindow);

      // Back face
      const backWindow = new THREE.Mesh(windowGeometry, windowMaterial);
      backWindow.position.set(xOffset, yOffset, -depth / 2 - 0.01);
      backWindow.rotation.y = Math.PI; // Flip to face outward
      backWindow.receiveShadow = true;
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
  trunk.castShadow = true; // Enable shadow casting for the trunk
  trunk.receiveShadow = true;

  const foliageGeometry = new THREE.SphereGeometry(2, 8, 8); // Foliage
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
  const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);

  foliage.position.y = 4; // Position foliage above the trunk
  foliage.castShadow = true; // Enable shadow casting for the foliage
  foliage.receiveShadow = true;
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
    tree.position.set(x, 0.5, z);
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
    leftSkyscraper.castShadow = true;
    scene.add(leftSkyscraper);

    // Right side of the road
    const rightSkyscraper = createSkyscraper(
      Math.random() * 2 + 2, // Random width
      Math.random() * 8 + 5, // Random height
      Math.random() * 2 + 2, // Random depth
      { x: xOffset, y: 0, z: zOffset } // Position
    );
    rightSkyscraper.castShadow = true;
    scene.add(rightSkyscraper);
    modelsToClear.push(leftSkyscraper, rightSkyscraper); // Add buildings to the list of models to clear
  }
}

function clear(){
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];
    if ( obj !== camera && obj !== directionalLight && obj !== ambientLight && obj !== sky) { 
      scene.remove(obj);
      //console.log('Removed object:', obj);
    }
  }
  
}

let modelsToClear = [];
let roadSections = []; // Store the road sections for later removal

let lastZPosition = 0;  // Keep track of the last Z position where we generated the road and objects
let roadThreshold = 0; // Threshold to generate new roads (ahead of the car)

let carPosition; // Keep track of the car's position

// ===== Handle Animation Logic =====
function startAnimation(sceneId, distance) {
  // Clear previous models
  clear(); 
  roadThreshold = 0; // Reset the road threshold
  lastGrassZPosition = 100;

  // Create the road
  
  createInitialRoad();
  generateGrassPlanes();

  const lakePosition = { x: 25, y: 0.01, z: -30 };
  const lake = addIrregularLake(lakePosition);

  lastGrassZPosition = 0;

  const objLoader = new OBJLoader();
  const carTexture = new THREE.TextureLoader().load('./textures/test-mesh3.jpg');
  
  const motoristTexture = new THREE.TextureLoader().load('./textures/test-mesh2.jpg');

  // Load avto.obj
  const startTime = performance.now(); // Record start time
  objLoader.load('./models/avto.obj', (object) => {
    const endTime = performance.now(); // Record end time after loading
        const loadTime = endTime - startTime; // Calculate the load time
        //console.log(`Object loaded in ${loadTime.toFixed(2)} ms`);
    console.log('Car model loaded:', object);
    centerAndScaleObject(object, 0.3); // Scale and center the model
    object.traverse((child) => {
      if (child.isMesh) {
        //child.material = whiteMaterial; // Apply white material
        child.material = new THREE.MeshStandardMaterial({
          map: carTexture, // Use the loaded texture
         // color: 0x0000ff, // Blue color    // Red overlay 0xff0000, 
          //transparent: true,    // Enable transparency if blending is needed
          opacity: 0.5,    
        });
        child.castShadow = true; // Allow the car to cast shadows
      }
    });
    object.rotation.y = Math.PI / 2; // Rotate to align with road
    object.position.set(0, 0.5, 35); // Position the car slightly above the road
    scene.add(object);

    car = object; // Save reference to car
    carPosition = car.position;
    //modelsToClear.push(car); // Add car to the list of models to clear
    console.log('Car assigned:', car);
  });
  

  if (sceneId % 2 === 0) {
    // Load bikered.obj
    const startTime2 = performance.now(); // Record start time
    objLoader.load('./models/bikered.obj', (object) => {
      const endTime2 = performance.now(); // Record end time after loading
        const loadTime2 = endTime2 - startTime2; // Calculate the load time
        //console.log(`Object loaded in ${loadTime2.toFixed(2)} ms`);
    centerAndScaleObject(object, 0.3); // Scale up the cyclist
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = redMaterial;
        child.castShadow = true;
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
    const startTime3 = performance.now(); // Record start time
    objLoader.load('./models/motorist.obj', (object) => {
      const endTime3 = performance.now(); // Record end time after loading
        const loadTime3 = endTime3 - startTime3; // Calculate the load time
        //console.log(`Object loaded in ${loadTime2.toFixed(2)} ms`);
      console.log('Motorist model loaded:', object);
    centerAndScaleObject(object, 0.3); // Scale up the motorist
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = modra;
        child.castShadow = true;
      }
    });
    object.rotation.y = Math.PI / 2; // Rotate to align with road
    object.position.set(distance, 0.4, 50); // Position the motorist slightly above the road
    scene.add(object);

    motorist = object; // Save reference to motorist
    //modelsToClear.push(motorist); // Add motorist to the list of models to clear
    console.log('Motorist assigned:', motorist);
  });
  }

  const mapsElement = document.getElementById('map');
  const selectedMap = mapsElement.value;

  switch (selectedMap) {
    case '1':
      generateTrees(scene, numTrees, roadWidth, roadLength, worldSize);
      break;
    case '2': 
      generateBuildings(scene, numBuildings, roadWidth, roadLength);
      break;
    }
}

function createInitialRoad() {
  const startZ = 35; // Starting coordinate for the road
  const endZ = -40;  // Ending coordinate for the road
  const roadLength = 20; // Assuming each road section is 10 units long

  let currentZ = startZ; // Initialize current Z position to the starting coordinate
  // Remove old road sections before creating new ones
  console.log('Removing old road sections...' + roadSections.length);
  removeOldRoadSections(roadSections.length);

  while (currentZ > endZ) {
    // Create a new road section
    const roadSectionsArray = createStraightRoad(roadNum); // Returns an array of road sections
    roadSectionsArray.forEach((road) => {
      road.position.z = currentZ; // Set the Z position for the road section
      road.traverse((child) => {
        if (child.isMesh) {
          child.receiveShadow = true;
          child.castShadow = true;
        }
      });
      scene.add(road); // Add the road section to the scene
      roadSections.push(road); // Add the road section to the management array
    });

    // Move to the next position
    currentZ -= roadLength;
  }

  // Update lastZPosition to the position of the last created road
  lastZPosition = currentZ + roadLength;
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
  // Create new road sections ahead of the car and get the returned array of roads
  console.log("roadSections: ", roadSections.length);
  const roads = createStraightRoad(roadNum);

  // For each road section returned, position it and add to the array
  roads.forEach(road => {
    road.position.z = lastZPosition + roadThreshold; // Position the new road section in front of the car
    road.traverse((child) => {
      if (child.isMesh) {
        child.receiveShadow = true;
        child.castShadow = true;
      }
    });
    scene.add(road); // Add the road to the scene
    roadSections.push(road); // Store the road section in the array
  });
  // get size of the road
  const roadSize = roads.length;

  // Update the last Z position after creating the road
  lastZPosition = roads[roads.length - 1].position.z + roadLength;

  console.log("Road size: ", roadSize);

  // Remove old road sections that are too far behind the car
  removeOldRoadSections(roadSize);
}

// ===== Utility Function to Remove Old Road Sections =====
function removeOldRoadSections(numSections = 1) {
  // Only proceed if there are road sections to remove
  if (roadSections.length > 0) {
    // Remove `numSections` of road sections from the start of the array
    for (let i = 0; i < numSections; i++) {
      const road = roadSections[0]; // Get the first road section
      //console.log('Removing road section:', road);
      // Remove the road section from the scene
      scene.remove(road);

      // Remove the road section from the array
      roadSections.shift(); // Removes the first element from the array
    }
  }
}

let total = 0;
function generateGrassPlanes() {
    lastGrassZPosition -= grassPlaneLength;
    const newGrassPlane = addGrassPlane(lastGrassZPosition);
    
    grassPlanes.push(newGrassPlane); // Add the new grass plane to the array
    total += 1;
    // If there are more than two grass planes, remove the oldest one
    if (grassPlanes.length > 2) {
      total -= 1;
      console.log('Removing oldest grass plane...');
      const oldestGrassPlane = grassPlanes.shift(); // Remove the first grass plane from the array
      scene.remove(oldestGrassPlane); // Remove it from the scene
    }
}

// ===== LAKE =====
function addIrregularLake(position = { x: 0, y: 0, z: 0 }) {
  // Create a custom shape for the lake
  const lakeShape = new THREE.Shape();
  lakeShape.moveTo(0, 0);
  lakeShape.quadraticCurveTo(7, 7, 14, 5); // Curve to the right
  lakeShape.bezierCurveTo(20, -10, 15, -15, 8, -11); // Complex curve
  lakeShape.quadraticCurveTo(0, -7, 0, 0); // Close the shape

  // Extrude the shape to create a 2D plane
  const lakeGeometry = new THREE.ShapeGeometry(lakeShape);
  const lakeMaterial = new THREE.MeshStandardMaterial({
    color: 0x1E90FF,
    roughness: 0.5,  
    metalness: 0.5,  
    transparent: true,
  });

  const lake = new THREE.Mesh(lakeGeometry, lakeMaterial);
  lake.rotation.x = -Math.PI / 2; // Lay flat
  lake.position.set(position.x, position.y, position.z); // Position the lake
  lake.receiveShadow = true; // Enable shadows on the lake

  scene.add(lake);
  return lake;
}

// ===== Animation Loop =====
function animate() {
  requestAnimationFrame(animate);

  let objectToCheck = null;
  // Update OrbitControls
  controls.update();

  // Update camera movement (if necessary)
  updateCameraMovement();
  updateSideCamera();
 

  // Early return if not animating
  if (!isAnimating) {
    renderer.render(scene, camera);
    return;
  }

  // Check if road generation is needed
  function generateScenery(){
    if (car.position.z < roadThreshold) {
      roadThreshold -= 35; // Move the threshold backward to generate new road sections
      console.log('Generating new road sections...');
      //createRoadAhead(); // Generate a new section of the road
    }
    if (car.position.z < grassPlaneThreshold) {
      grassPlaneThreshold -= 100; // Move the threshold backward to generate new grass planes
      generateGrassPlanes(); // Generate new grass planes
    }
  }

  // Utility function: Constrain object position within boundaries
  function gridBoundary(object, minZ, maxZ) {
    if (object.position.z > maxZ) object.position.z = maxZ;
    if (object.position.z < minZ) object.position.z = minZ;
  }

  // Utility function: Handle stop-and-go behavior
  function handleStopAndGo(object, maxSpeed, deceleration, stoppingPoint, acceleration, isVehicleType) {
    if (object.currentSpeed === undefined) object.currentSpeed = 0;
    if (object.takeOffCounter === undefined) object.takeOffCounter = 0;
    
    // Adjust stopping point based on vehicle type
    const adjustedStoppingPoint = isVehicleType === 'cyclist' 
        ? stoppingPoint - 0.75
        : stoppingPoint;
    
    if (!object.stopped) {
        // Slow down to the stopping point
        if (object.position.z > adjustedStoppingPoint) {
            object.position.z -= Math.max(0.02, (object.position.z - adjustedStoppingPoint) * deceleration);
        } else {
            object.position.z = adjustedStoppingPoint;
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
    // Motorist movement or falling
      // Check if road generation is needed
      objectToCheck = motorist;
      generateScenery();

      if (motorist.position.z > MAX_BOUNDARY_Z || motorist.position.z < MIN_BOUNDARY_Z) {
        //handleFalling(motorist, motorist.position.z > MAX_BOUNDARY_Z ? MAX_BOUNDARY_Z : MIN_BOUNDARY_Z, motorist.position.z > MAX_BOUNDARY_Z);
        motorist.position.z -= 0.09;
      } else {
        motorist.position.z -= 0.09;
      }

      // Car movement or falling
      if (car.position.z > MAX_BOUNDARY_Z || car.position.z < MIN_BOUNDARY_Z) {
        //handleFalling(car, car.position.z > MAX_BOUNDARY_Z ? MAX_BOUNDARY_Z : MIN_BOUNDARY_Z, car.position.z > MAX_BOUNDARY_Z);
        car.position.z -= 0.05;
      } else {
        car.position.z -= 0.05;
      }
    } else {
    console.log('Motorist or car not found.');
    }
    break;

    case 2: // Scene 2: Cyclist and car
      if (cyclist && car) {
        // Check if road generation is needed
        objectToCheck = cyclist;
        generateScenery();

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
        // Check if road generation is needed
        objectToCheck = motorist;
        generateScenery();

        handleStopAndGo(motorist, motoristMaxSpeed, motorbikeDeceleration, stoppingPoint, 0.005, "motorist"); // Motorist accelerates slower
        handleStopAndGo(car, carMaxSpeed, carDeceleration, stoppingPoint, 0.010, "car"); // Car accelerates slower
      } else {
        console.log('Motorist or car not found.');
      }
      break;

    case 4: // Scene 4: Stop-and-go behavior for cyclist and car
      if (cyclist && car) {
        // Check if road generation is needed
        objectToCheck = cyclist;
        generateScenery();

        handleStopAndGo(cyclist, cyclistMaxSpeed, cyclistDeceleration, stoppingPoint, 0.001, "cyclist"); // Cyclist accelerates faster
        handleStopAndGo(car, carMaxSpeed, carDeceleration, stoppingPoint, 0.1000, "car"); // Car accelerates slower
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
    if (perspectiveCount % numPerspectiv === 0) {
      // Default OrbitControls behavior
      controls.minDistance = 2; // Minimum zoom distance
      controls.maxDistance = 50; // Maximum zoom distance
      renderer.render(scene, camera); // Use the main camera for rendering
    } else if (perspectiveCount % 4 === 1) {
      // Normal camera behavior
      controls.target.copy(car.position);
      controls.enableDamping = true; // Smooth movement
      controls.dampingFactor = 0.1;
      controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation to top-down views
      controls.minDistance = 2; // Minimum zoom distance
      controls.maxDistance = 15; // Maximum zoom distance
      renderer.render(scene, camera); // Use the main camera for rendering
    } else if (perspectiveCount % numPerspectiv === 2) {
       // Front camera view (looking in the direction the car is going)
       console.log('Backview');

            // Get the car's direction
    const carDirection = new THREE.Vector3();
    car.getWorldDirection(carDirection); // Get the car's forward direction

      // Compute the rightward direction relative to the car (opposite of left vector)
    const carRight = new THREE.Vector3().crossVectors(carDirection, new THREE.Vector3(0, 1, 0)).normalize(); // Get the right vector
    
      // Position the back camera slightly behind the car
      const backCameraPosition = car.position.clone()
        .sub(carDirection.multiplyScalar(0.5)) // to gre desno
        .add(carRight.multiplyScalar(0.5)) // Move the camera 2 units to the right
        .add(new THREE.Vector3(1, 1.5, 0.3)); // 1.5 units upward to align with the car's height
      camera.position.copy(backCameraPosition);

      // Make the camera look at the car (looking forward relative to the car's direction)
      camera.lookAt(car.position.clone()
        .add(carDirection.multiplyScalar(20)) // Look forward
        .add(carRight.multiplyScalar(17))); // Look slightly right

      // Use the camera for rendering
      renderer.render(scene, camera);
    } else if(perspectiveCount % numPerspectiv === 3){
      // Side camera view (looking out of the car's window, but to the left)
      console.log('Side camera view');

      // Get the car's direction
      const carDirection = new THREE.Vector3();
      car.getWorldDirection(carDirection); // Get the car's forward direction

      // Compute the "left" vector for the car (invert the "right" vector)
      const carLeft = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), carDirection).normalize(); // Get the left vector

      // Position the side camera relative to the car (adjust these offsets as needed)
    const sideCameraPosition = car.position.clone()
        .add(carLeft.multiplyScalar(1)) // 5 units to the left of the car
        .add(new THREE.Vector3(0, 0.5, 0)) // 2 units upward
        .add(carDirection.multiplyScalar(1)); // Move slightly forward (2 units)
      camera.position.copy(sideCameraPosition);

    // Make the side camera look ahead of the car
      camera.lookAt(car.position.clone().add(carDirection.multiplyScalar(20))); // Look forward

        // Use the camera for rendering
        renderer.render(scene, camera);
    } else if(perspectiveCount % numPerspectiv === 4){
      // Front camera view (looking in the direction the car is going)
        console.log('Frontal view');

        // Get the car's direction
        const carDirection = new THREE.Vector3();
        car.getWorldDirection(carDirection); // Get the car's forward direction

        // Compute the leftward direction relative to the car
        const carLeft = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), carDirection).normalize(); // Get the left vector

        // Position the front camera relative to the car
        const frontCameraPosition = car.position.clone()
          //.add(carDirection.multiplyScalar(10)) // 10 units ahead of the car
          .add(carLeft.multiplyScalar(2)) // 2 units to the left of the car
          .add(new THREE.Vector3(0, 0.5, 0)); // 1 unit upward to align with the car's height
        camera.position.copy(frontCameraPosition);

        // Make the camera look slightly to the left of the car's forward direction
        camera.lookAt(car.position.clone()
          .add(carDirection.multiplyScalar(20)) // Look forward
          .add(carLeft.multiplyScalar(20))); // Look slightly left

        // Use the camera for rendering
        renderer.render(scene, camera);
    }else {
      // Rear camera view or another custom view
      const offset = new THREE.Vector3(0, 5, 10); // Adjust this vector to set your preferred distance
      camera.position.copy(car.position).add(offset); // Set camera position at fixed offset from the car
      camera.lookAt(car.position); // Make the camera look at the car
      renderer.render(scene, camera); // Use the main camera for rendering
    }
  
    // Draw the car track
    const currentCarPosition = car.position.clone();
    currentCarPosition.y += 0.01; // Raise the track slightly above the road
    if (trackPoints.length === 0 || trackPoints[trackPoints.length - 1].distanceTo(currentCarPosition) > 0.5) {
      trackPoints.push(currentCarPosition.clone());
    }
  }
  // Render the scene
  updateInfotainmentColor();
  renderer.render(scene, camera);

  if (sideViewRenderTarget) {
    renderer.setRenderTarget(sideViewRenderTarget);
    renderer.render(scene, sideCamera);
    renderer.setRenderTarget(null); // Reset back to main renderer
  }

}
animate();

// ===== Handle Window Resize =====
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const screenshotQueue = [];

function createSphereAtPosition(position, color) {
  const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16); // Adjust size and detail
  const sphereMaterial = new THREE.MeshBasicMaterial({ color });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.position.set(position.x, position.y, position.z);
  scene.add(sphere);
  return sphere;
}

// ===== Handle Start Button Click =====
document.getElementById("start").addEventListener("click", () => {
  const sceneId = parseInt(document.getElementById("scene").value, 10);

  activeScene = sceneId;

  setInterval(() => {
    const carPosition = car.position; // Assuming this function exists
    const sphere = createSphereAtPosition(carPosition, "blue"); // Create blue sphere at car's position

    // Capture screenshot
    const timestamp = Date.now();

    screenshotQueue.push({ timestamp, sphere });

    if (screenshotQueue.length > 50) {
      const { sphere: oldSphere } = screenshotQueue.shift(); // Remove first item
      scene.remove(oldSphere); // Remove from scene
    }

    captureScreenshot(sideCamera, timestamp);
  }
  , 250);
});