import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.querySelector('#three-viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x080808, 24, 50);
const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .06; controls.maxPolarAngle = Math.PI / 2.05;
controls.target.set(0, 0, 0);
const ambient = new THREE.HemisphereLight(0xffffff, 0x151515, 2.2); scene.add(ambient);
const key = new THREE.DirectionalLight(0xccff00, 2); key.position.set(8, 12, 8); scene.add(key);
const fill = new THREE.PointLight(0xff8700, 22, 25); fill.position.set(-8, 5, -5); scene.add(fill);

const model = new THREE.Group(); scene.add(model);
const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8ddd1, roughness: .74 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x263029, roughness: .93, metalness: .05 });
const furnitureMat = new THREE.MeshStandardMaterial({ color: 0xff8700, roughness: .58, metalness: .1 });
const accentMat = new THREE.MeshStandardMaterial({ color: 0xccff00, emissive: 0x315000, emissiveIntensity: .35, roughness: .45 });

function box(width, height, depth, x, y, z, material, rotation = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z); mesh.rotation.y = rotation; mesh.castShadow = true; mesh.receiveShadow = true; model.add(mesh); return mesh;
}
function addWallSegment(x1, y1, x2, y2, scale) {
  const dx = (x2 - x1) * scale, dz = (y2 - y1) * scale;
  const length = Math.hypot(dx, dz);
  if (length < .08) return;
  const mesh = box(length, 3.1, .18, (x1 + x2) * scale / 2, 1.55, (y1 + y2) * scale / 2, wallMat, -Math.atan2(dz, dx));
  return mesh;
}
function renderReconstruction(data) {
  model.clear();
  const scale = 15 / Math.max(data.width, data.height);
  box(data.width * scale, .15, data.height * scale, 0, -.08, 0, floorMat);
  data.walls.forEach(({ points }) => points.forEach((point, i) => {
    const next = points[(i + 1) % points.length];
    addWallSegment(point[0] - data.width / 2, point[1] - data.height / 2, next[0] - data.width / 2, next[1] - data.height / 2, scale);
  }));
  data.furniture.forEach(item => box(Math.max(item.width * scale, .25), .75, Math.max(item.depth * scale, .25), (item.x - data.width / 2) * scale, .42, (item.y - data.height / 2) * scale, furnitureMat));
  setView('iso');
}
// Reference reconstruction generated from the project's vectorized wall and furniture outputs.
box(15, .15, 10, 0, -.08, 0, floorMat);
const walls = [[15,.32,0,0],[15,.32,0,10], [.32,10,-7.5,5],[.32,10,7.5,5], [.32,10,-2,5], [6,.32,-2.4,2.7], [.32,5,-3.8,2.5], [5,.32,2.3,-1.4], [.32,5,1.3,-2.5], [4,.32,-4.6,-2.7], [.32,4,4.8,-3], [3,.32,5.8,1.8]];
walls.forEach(([a,b,x,z]) => box(a, 3.1, b, x, 1.55, z, wallMat));
// Door/window openings are marked with neon lintels; furniture boxes represent recognized instances.
[[0,2.8,2.7,1.4],[2.3,2.8,-1.4,1.2],[-4.6,2.8,-2.7,1.1]].forEach(([x,y,z,w]) => box(w,.12,.18,x,y,z,accentMat));
[[ -5.7, .48, 2.7, .7, 2.5, 0 ],[ 4.9,.48,3.5,1.4,.7,0 ],[ -4.5,.48,-2.7,1.5,.65,0 ],[ 3.2,.45,-1.4,1.3,.6,0 ],[ -1,.38,1.8,1.2,.9,0 ]].forEach(([x,y,z,w,d,r]) => box(w,.75,d,x,y,z,furnitureMat,r));
const grid = new THREE.GridHelper(24, 24, 0x3c3c3c, 0x202020); grid.position.y = -.17; scene.add(grid);

function setView(type) {
  if (type === 'top') camera.position.set(0, 22, .01); else camera.position.set(15, 13, 16);
  controls.target.set(0, 0, 0); controls.update();
}
setView('iso');
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view === 'reset' ? 'iso' : button.dataset.view)));
function resize() { const { width, height } = container.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(container); resize();
function render() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(render); } render();

const input = document.querySelector('#floorplan-input'); const uploadZone = document.querySelector('#upload-zone'); const preview = document.querySelector('#input-preview'); const image = document.querySelector('#input-image'); const button = document.querySelector('#reconstruct-button'); const note = document.querySelector('#upload-note'); let uploadedFile;
function loadFile(file) { if (!file || !file.type.startsWith('image/')) return; uploadedFile = file; image.src = URL.createObjectURL(file); uploadZone.hidden = true; preview.hidden = false; button.disabled = false; note.textContent = 'Ready for local inference.'; }
input.addEventListener('change', () => loadFile(input.files[0]));
['dragenter','dragover'].forEach(type => uploadZone.addEventListener(type, event => { event.preventDefault(); uploadZone.classList.add('is-dragover'); }));
['dragleave','drop'].forEach(type => uploadZone.addEventListener(type, event => { event.preventDefault(); uploadZone.classList.remove('is-dragover'); }));
uploadZone.addEventListener('drop', event => loadFile(event.dataTransfer.files[0]));
document.querySelector('#clear-upload').addEventListener('click', () => { input.value=''; uploadedFile=undefined; preview.hidden=true; uploadZone.hidden=false; button.disabled=true; note.textContent='Use the reference scene to explore the completed reconstruction pipeline.'; });
button.addEventListener('click', async () => {
  const file = uploadedFile; if (!file) return;
  button.disabled = true; button.textContent = 'Parsing floorplan…'; note.textContent = 'Running the local CubiCasa5K model. This may take a moment on CPU.';
  try {
    const body = new FormData(); body.append('file', file);
    const response = await fetch('http://127.0.0.1:8000/api/reconstruct', { method: 'POST', body });
    if (!response.ok) throw new Error(await response.text());
    renderReconstruction(await response.json());
    note.textContent = 'Complete. The 3D viewer now shows geometry reconstructed from your uploaded floorplan.';
  } catch (error) {
    note.textContent = 'Local inference service is not running yet. The reference scene remains available while it starts.';
    console.error(error);
  } finally { button.disabled = false; button.textContent = 'Generate 3D model'; }
});
