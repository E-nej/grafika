import * as THREE from '../node_modules/three/build/three.module.js';


// ===== Create Scene, Camera, and Renderer =====
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
});

// Set up renderer
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
camera.position.z = 5;

// ===== Add a Rotating Cube =====
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green cube
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// ===== Menu Toggle and Start Button =====
// Select menu elements
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

startButton.addEventListener('click', () => {
    console.log('Start Animation button clicked');
  });
  

// ===== Handle Animation Logic =====
function startAnimation(scene, distance) {
    // Update the cube's properties based on the selected scene
    if (scene === '1') {
      cube.material.color.set(0xff0000); // Red for Scene 1
      cube.position.x = distance / 10; // Position based on distance
    } else if (scene === '2') {
      cube.material.color.set(0x0000ff); // Blue for Scene 2
      cube.position.x = -distance / 10;
    } else {
      cube.material.color.set(0x00ff00); // Default green for other scenes
      cube.position.x = 0;
    }
  
    console.log(`Scene ${scene} started with cyclist at ${distance} meters.`);
  }
  

// ===== Animation Loop =====
function animate() {
  requestAnimationFrame(animate);

  // Rotate the cube
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

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
