import { init } from './ts/utils/three-helpers'
import raf from './ts/utils/raf'
import fx from './ts/effects'
import { DirectionalLight, Mesh, MeshPhongMaterial, AmbientLight, DoubleSide, PlaneBufferGeometry, Color, TextureLoader, BoxBufferGeometry } from 'three'
import { lerp, range } from './ts/utils/helpers'
import parismap from './mapparis.jpg'

const CONFIG = {
  scale: 0.2,
  n: 30,
  siz: 0.6
}

const { camera, renderer, scene } = init()
renderer.pixelRatio = 2
// renderer.shadowMap.enabled = true
scene.background = new Color(0xEEEEEE)

camera.position.x = CONFIG.n * 4
camera.position.y = CONFIG.n * 4
camera.position.z = CONFIG.n * 4

const { composer } = fx({ renderer, scene, camera })

const minMax = [9999999, 0]

let values = new Array(CONFIG.n * 2).fill(new Array(CONFIG.n * 2).fill(0))
const bars = values.map((row, x) => row.map((val, y) => {
  const geo = new BoxBufferGeometry(CONFIG.siz, 1, CONFIG.siz)
  const mat = new MeshPhongMaterial({ color: 0xffffff })
  const bar = new Mesh(geo, mat)
  bar.position.set(x - CONFIG.n, (CONFIG.scale * val) / 2, y - CONFIG.n)
  bar.scale.setY(CONFIG.scale * val)
  bar.visible = val > 0
  return { mesh: bar, geo, mat }
}))

bars.forEach(row => row.forEach(bar => scene.add(bar.mesh)))

function getData () {
  fetch('https://opendata.paris.fr/api/records/1.0/search/?dataset=velib-disponibilite-en-temps-reel&rows=1400')
    .then(res => res.json())
    .then(velib => {
      const grided = []
      for (let x = -CONFIG.n; x < CONFIG.n; x++) {
        const row = []
        for (let y = -CONFIG.n; y < CONFIG.n; y++) {
          const velibsInTile = velib.records.filter(station => {
            const isInX = x === Math.floor(range(station.geometry.coordinates[0], 2.204614, 2.485008, -CONFIG.n, CONFIG.n))
            const isInY = y === Math.floor(range(station.geometry.coordinates[1], 48.767656, 48.955623, -CONFIG.n, CONFIG.n))
            return isInX && isInY
          }).reduce((acc, val) => acc + val.fields.numbikesavailable, 0)

          if (velibsInTile > minMax[1]) minMax[1] = velibsInTile
          if (velibsInTile < minMax[0]) minMax[0] = velibsInTile

          row.push(velibsInTile)
        }
        grided.push(row)
      }

      values = grided

      setSpanText('total', grided.reduce((acc, val) => acc + val.reduce((acc2, val2) => acc2 + val2, 0), 0))
      const biggest = velib.records.sort((a, b) => b.fields.numbikesavailable - a.fields.numbikesavailable)[0]
      setSpanText('stat', biggest.fields.name)
      setSpanText('maxstatvelibs', biggest.fields.numbikesavailable)
    })
    .catch(console.error)
}

getData()
setInterval(getData, 60000)

const texture = new TextureLoader().load(parismap)
const planeGeo = new PlaneBufferGeometry(CONFIG.n * 2, CONFIG.n * 2, 1)
const planeMat = new MeshPhongMaterial({
  map: texture,
  side: DoubleSide
})
const plane = new Mesh(planeGeo, planeMat)
plane.position.y = -0.01
plane.rotation.x = Math.PI / 2

const sun = new DirectionalLight(0xFFFFFF, 1.2)
const ambient = new AmbientLight(0xFFFFFF, 0.5)
sun.target.position.set(0, 0, 0)
sun.position.set(1000, 300, 500)

scene.add(plane)
scene.add(sun)
scene.add(sun.target)
scene.add(ambient)

raf.subscribe((time) => {
  composer.render()

  values.forEach((row, x) => {
    row.forEach((tile, y) => {
      bars[x][y].mesh.position.set(
        lerp(bars[x][y].mesh.position.x, x - CONFIG.n, 0.1),
        lerp(bars[x][y].mesh.position.y, (CONFIG.scale * tile) / 2, 0.1),
        lerp(bars[x][y].mesh.position.z, y - CONFIG.n, 0.1)
      )
      bars[x][y].mesh.scale.y = lerp(bars[x][y].mesh.scale.y, CONFIG.scale * tile, 0.1)
      bars[x][y].mesh.visible = tile > 0

      const hue = Math.round(range(tile, minMax[0], minMax[1], 200, 230)) % 360
      const sat = Math.round(range(tile, minMax[0], minMax[1], 50, 100))
      const lum = Math.round(range(tile, minMax[0], minMax[1], 80, 40))
      bars[x][y].mat.color = new Color(`hsl(${hue}, ${sat}%, ${lum}%)`)
    })
  })
})

function setSpanText (id, text: string) {
  const span = document.getElementById(id)
  if (span) span.textContent = text
}
