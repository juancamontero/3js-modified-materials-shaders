import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import GUI from 'lil-gui'

/**
 * Base
 */
// Debug
const gui = new GUI()
const debugObject = {
  rotationSpeed: 0.4,
}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Loaders
 */
const textureLoader = new THREE.TextureLoader()
const gltfLoader = new GLTFLoader()
const cubeTextureLoader = new THREE.CubeTextureLoader()

/**
 * Update all materials
 */
const updateAllMaterials = () => {
  scene.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.material instanceof THREE.MeshStandardMaterial
    ) {
      child.material.envMapIntensity = 1
      child.material.needsUpdate = true
      child.castShadow = true
      child.receiveShadow = true
    }
  })
}

/**
 * Environment map
 */
const environmentMap = cubeTextureLoader.load([
  '/textures/environmentMaps/0/px.jpg',
  '/textures/environmentMaps/0/nx.jpg',
  '/textures/environmentMaps/0/py.jpg',
  '/textures/environmentMaps/0/ny.jpg',
  '/textures/environmentMaps/0/pz.jpg',
  '/textures/environmentMaps/0/nz.jpg',
])

scene.background = environmentMap
scene.environment = environmentMap

/**
 * Material
 */

// Textures
const mapTexture = textureLoader.load('/models/LeePerrySmith/color.jpg')
mapTexture.colorSpace = THREE.SRGBColorSpace
const normalTexture = textureLoader.load('/models/LeePerrySmith/normal.jpg')

// Material
const material = new THREE.MeshStandardMaterial({
  map: mapTexture,
  normalMap: normalTexture,
})

// ? we need to create a depthMaterial to change it with the shadows
// ? we will override the existen one in the standardMaterial
// todo: Add to the model
const depthMaterial = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking, //! to load en every RGB channel
})

//********* Hooking the material ***********//
//********* -------------------- ***********//
// ? 'node_modules/three/src/renderers/shaders/ShaderLib/meshphysical.glsl.js'

// * create an object so i can map later the uniforms inside the beforeCompile
const customUniforms = {
  uTime: {
    value: 0,
  },
}

material.onBeforeCompile = (shader) => {
  // * Add uniforms
  shader.uniforms.uTime = customUniforms.uTime

  // * out main()
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `
    #include <common>
    uniform float uTime;

    mat2 get2dRotateMatrix(float _angle)
    {
      return mat2(cos(_angle), - sin(_angle), sin(_angle), cos(_angle));
    }   
    `
  )

  // ****** UPDATE CORE SHADOWS ********//
// ? Own shadows
// ? this about the normal, which must be updated to
shader.vertexShader = shader.vertexShader.replace(
  '#include <beginnormal_vertex>',
  `
  #include <beginnormal_vertex>

    float angle = sin(position.y + uTime) * ${debugObject.rotationSpeed};
    mat2 rotateMatrix = get2dRotateMatrix(angle);
    objectNormal.xz = rotateMatrix * objectNormal.xz;
  
  `
)

  // * inside main()
  // ? transformed in the matrix that can be changed generated in
  // ? node_modules/three/src/renderers/shaders/ShaderChunk/begin_vertex.glsl.js
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>  
    
    // !this 2 already in the core shadow adjustment
    // !float angle = (position.y + uTime) * 0.9;
    //! mat2 rotateMatrix = get2dRotateMatrix(angle);
    transformed.xz = rotateMatrix * transformed.xz;
    `
  )
}

// ****** UPDATE DROP SHADOWS ********//
// ? Reflected shadows
depthMaterial.onBeforeCompile = (shader) => {
  // * Add uniforms
  shader.uniforms.uTime = customUniforms.uTime

   // * out main()
   shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `
    #include <common>

    uniform float uTime;

    mat2 get2dRotateMatrix(float _angle)
    {
      return mat2(cos(_angle), - sin(_angle), sin(_angle), cos(_angle));
    }
    `
  )

  // * inside main()
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>  
    
    float angle = sin(position.y + uTime) * ${debugObject.rotationSpeed};
    mat2 rotateMatrix = get2dRotateMatrix(angle);
    transformed.xz = rotateMatrix * transformed.xz;
    `
  )
}





/**
 * Models
 */
gltfLoader.load('/models/LeePerrySmith/LeePerrySmith.glb', (gltf) => {
  // Model
  const mesh = gltf.scene.children[0]
  mesh.rotation.y = Math.PI * 0.5
  mesh.material = material
  mesh.customDepthMaterial = depthMaterial // ? to adjust shadows
  scene.add(mesh)

  // Update materials
  updateAllMaterials()
})

//**
// ** PLANE
// */

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(15, 15, 15),
  new THREE.MeshStandardMaterial({})
)
plane.rotation.y = Math.PI
plane.position.y = -5
plane.position.z = 5
scene.add(plane)

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight('#ffffff', 3)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.normalBias = 0.05
directionalLight.position.set(0.25, 2, -2.25)
scene.add(directionalLight)

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
}

window.addEventListener('resize', () => {
  // Update sizes
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  // Update camera
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

  // Update renderer
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
)
camera.position.set(4, 1, -4)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () => {
  const elapsedTime = clock.getElapsedTime()

  // Update objects
  customUniforms.uTime.value = elapsedTime

  // Update controls
  controls.update()

  // Render
  renderer.render(scene, camera)

  // Call tick again on the next frame
  window.requestAnimationFrame(tick)
}

tick()
