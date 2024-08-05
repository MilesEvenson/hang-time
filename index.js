

const tsStart = Date.now();
let tsLast = tsStart;
let tickerId = 0;
// Check every 20ms
const interval = 20;
const THRESHOLD = 7.0;

const samples = [];
const data = [];


const MODES = {
  STANDBY: 'STANDBY',
  LAUNCH: 'LAUNCH',
  AIR: 'AIR',
  DOWN: 'DOWN',
  RELOAD: 'RELOAD',
};
let mode = MODES.STANDBY;


function changeToStandby() {
  mode = MODES.STANDBY;

  document.getElementById('standby').classList.remove('hide');

  document.getElementById('launch').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('down').classList.add('hide');
  document.getElementById('reload').classList.add('hide');
}


function changeToLaunch() {
  mode = MODES.LAUNCH;

  document.getElementById('launch').classList.remove('hide');

  document.getElementById('standby').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('down').classList.add('hide');
  document.getElementById('reload').classList.add('hide');
}


function changeToAir() {
  mode = MODES.AIR;

  tickerId = window.setInterval(
    () => document.getElementById('ticker').innerText = (Date.now() - tsStart),
    50
  );

  document.getElementById('air').classList.remove('hide');

  document.getElementById('standby').classList.add('hide');
  document.getElementById('launch').classList.add('hide');
  document.getElementById('down').classList.add('hide');
  document.getElementById('reload').classList.add('hide');
}


function changeToDown(now) {
  clearInterval(tickerId);
  mode = MODES.AIR;

  window.removeEventListener('devicemotion', handleMotion);

  document.getElementById('down').classList.remove('hide');
  document.getElementById('time').innerText = `${(now - tsStart)}ms`;

  document.getElementById('standby').classList.add('hide');
  document.getElementById('launch').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('reload').classList.add('hide');
}


function changeToReload() {
  mode = MODES.AIR;

  window.removeEventListener('devicemotion', handleMotion);

  document.getElementById('reload').classList.remove('hide');

  document.getElementById('standby').classList.add('hide');
  document.getElementById('launch').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('down').classList.add('hide');
}




function handleMotion(ev) {
  if (mode !== MODES.STANDBY
    && mode !== MODES.LAUNCH
    && mode !== MODES.AIR
  ) {
    return;
  }

  const now = Date.now();
  if ((now - tsLast) < interval) {
    return;
  }

  const { x, y, z } = event.acceleration;
  const magnitude = Math.sqrt( (x * x) + (y * y) + (z * z) );

  //console.log(ev);
  samples.push(ev);
  data.push({
    ts: now,
    value: Number(magnitude.toFixed(4)),
  });
  tsLast = now;

  const delta = Math.abs(
    data[data.length-2].value
    - data[data.length-1].value
  );


  if (mode === MODES.LAUNCH && THRESHOLD <= delta) {
    changeToAir();
  } else if (mode === MODES.AIR && THRESHOLD <= delta) {
    changeToDown(now);
  }

  const block = document.createElement('ul');
  block.innerHTML = `
  <li>Tick: ${now - tsStart}</li>
  <li>Magnitude: ${magnitude.toFixed(4)}</li>
  <li>Sum: ${sum.toFixed(4)}</li>
  <li>Avg: ${avg.toFixed(4)}</li>`;
  document.getElementById('air').append(block);
  document.getElementById('down').append(block);
}


/*
function handleOrientation(ev) {
  if (ev.alpha < 0.5 && ev.beta < 0.5 && ev.gamma < 0.5) {
    return
  }
  console.log(ev);
  const h4 = document.createElement('h4');
  h4.innerText = 'Orientation';
  //document.getElementById('logs').append(h4);

  const block = document.createElement('pre');
  block.innerHTML = `<ul>
  <li>alpha - ${ev.alpha}</li>
  <li>beta - ${ev.beta}</li>
  <li>gamma - ${ev.gamma}</li>
</ul>`;
  //document.getElementById('logs').append(block);
}
*/


function init() {

  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission().then(response => {
      if (response == 'granted') {
        window.addEventListener('devicemotion', handleMotion);
        changeToLaunch();
      } else {
        changeToReload();
      }
    });
  } else {
    window.addEventListener('devicemotion', handleMotion);
    changeToLaunch();
  }
}


