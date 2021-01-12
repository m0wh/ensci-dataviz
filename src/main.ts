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
camera.position.z = CONFIG.n * -4

const { composer } = fx({ renderer, scene, camera })

let data = 'taken'

const minMax = {
  taken: [9999999, 0],
  free: [9999999, 0],
  capacity: [9999999, 0],
  electric: [9999999, 0]
}

const hueMinMax = {
  taken: [200, 230],
  free: [350, 375],
  capacity: [15, 45],
  electric: [120, 150]
}

document.querySelectorAll('.change').forEach(btn => {
  btn.addEventListener('click', () => {
    data = btn.getAttribute('data')
  })
})

let values = new Array(CONFIG.n * 2).fill(new Array(CONFIG.n * 2).fill({ taken: 0, free: 0 }))
const bars = values.map((row, x) => row.map((val, y) => {
  const geo = new BoxBufferGeometry(CONFIG.siz, 1, CONFIG.siz)
  const mat = new MeshPhongMaterial({ color: 0xffffff })
  const mesh = new Mesh(geo, mat)
  mesh.position.set(x - CONFIG.n, (CONFIG.scale * val.taken) / 2, y - CONFIG.n)
  mesh.scale.setY(CONFIG.scale * val.taken)
  mesh.visible = val.taken > 0
  return { mesh, geo, mat }
}))

bars.forEach(row => row.forEach(bar => scene.add(bar.mesh)))

const biggeo = new BoxBufferGeometry(0.1, 50, 0.1)
const bigmat = new MeshPhongMaterial({ color: 0xff0000 })
const bigbar = new Mesh(biggeo, bigmat)
bigbar.visible = false
scene.add(bigbar)

function getData () {
  fetch('https://opendata.paris.fr/api/records/1.0/search/?dataset=velib-disponibilite-en-temps-reel&rows=1400')
    .then(res => res.json())
    .then(velib => {
      const grided = []
      for (let x = -CONFIG.n; x < CONFIG.n; x++) {
        const row = []
        for (let y = -CONFIG.n; y < CONFIG.n; y++) {
          const inTile = velib.records.filter(station => {
            const isInX = x === Math.floor(range(station.geometry.coordinates[0], 2.485008, 2.204614, -CONFIG.n, CONFIG.n))
            const isInY = y === Math.floor(range(station.geometry.coordinates[1], 48.767656, 48.955623, -CONFIG.n, CONFIG.n))
            return isInX && isInY
          })

          const velibsInTile = inTile.reduce((acc, val) => acc + val.fields.numbikesavailable, 0)
          const freeInTile = inTile.reduce((acc, val) => acc + (val.fields.capacity - val.fields.numbikesavailable), 0)
          const capacityInTile = inTile.reduce((acc, val) => acc + val.fields.capacity, 0)
          const electricInTile = inTile.reduce((acc, val) => acc + val.fields.ebike, 0)

          if (velibsInTile > minMax.taken[1]) minMax.taken[1] = velibsInTile
          if (velibsInTile < minMax.taken[0]) minMax.taken[0] = velibsInTile

          if (capacityInTile > minMax.capacity[1]) minMax.capacity[1] = capacityInTile
          if (capacityInTile < minMax.capacity[0]) minMax.capacity[0] = capacityInTile

          if (freeInTile > minMax.free[1]) minMax.free[1] = freeInTile
          if (freeInTile < minMax.free[0]) minMax.free[0] = freeInTile

          if (electricInTile > minMax.electric[1]) minMax.electric[1] = electricInTile
          if (electricInTile < minMax.electric[0]) minMax.electric[0] = electricInTile

          row.push({
            taken: velibsInTile,
            free: freeInTile,
            capacity: capacityInTile,
            electric: electricInTile
          })
        }
        grided.push(row)
      }

      values = grided

      setSpanText('total', grided.reduce((acc, val) => acc + val.reduce((acc2, val2) => acc2 + val2.taken, 0), 0))
      const biggest = velib.records.sort((a, b) => b.fields.numbikesavailable - a.fields.numbikesavailable)[0]
      setSpanText('stat', biggest.fields.name)
      setSpanText('maxstatvelibs', biggest.fields.numbikesavailable)

      bigbar.position.set(
        range(biggest.geometry.coordinates[0], 2.485008, 2.204614, -CONFIG.n, CONFIG.n),
        range(biggest.geometry.coordinates[1], 48.767656, 48.955623, -CONFIG.n, CONFIG.n),
        0
      )
    })
    .catch(console.error)
}

document.getElementById('stat').addEventListener('mouseenter', e => { bigbar.visible = true })
document.getElementById('stat').addEventListener('mouseleave', e => { bigbar.visible = false })

getData()
setInterval(getData, 60000)

const texture = new TextureLoader().load(parismap)
const planeGeo = new PlaneBufferGeometry(CONFIG.n * 2, CONFIG.n * 2, 1)
const planeMat = new MeshPhongMaterial({ map: texture, side: DoubleSide })
const plane = new Mesh(planeGeo, planeMat)
plane.position.y = -0.01
plane.rotation.x = Math.PI / 2
plane.rotation.y = Math.PI

const sun = new DirectionalLight(0xFFFFFF, 1.2)
const ambient = new AmbientLight(0xFFFFFF, 0.5)
sun.target.position.set(0, 0, 0)
sun.position.set(1000, 300, -500)

scene.add(plane)
scene.add(sun)
scene.add(sun.target)
scene.add(ambient)

raf.subscribe(() => {
  values.forEach((row, x) => {
    row.forEach((tile, y) => {
      const value = tile[data]
      const rng = minMax[data]

      bars[x][y].mesh.position.set(
        lerp(bars[x][y].mesh.position.x, x - CONFIG.n, 0.1),
        lerp(bars[x][y].mesh.position.y, (CONFIG.scale * value) / 2, 0.1),
        lerp(bars[x][y].mesh.position.z, y - CONFIG.n, 0.1)
      )
      bars[x][y].mesh.scale.y = lerp(bars[x][y].mesh.scale.y, CONFIG.scale * value, 0.1)
      bars[x][y].mesh.visible = value > 0

      const hue = Math.round(range(value, rng[0], rng[1], hueMinMax[data][0], hueMinMax[data][1])) % 360
      const sat = Math.round(range(value, rng[0], rng[1], 50, 100))
      const lum = Math.round(range(value, rng[0], rng[1], 80, 40))
      bars[x][y].mat.color = new Color(`hsl(${hue}, ${sat}%, ${lum}%)`)
    })
  })

  composer.render()
})

function setSpanText (id, text: string) {
  const span = document.getElementById(id)
  if (span) span.textContent = text
}
