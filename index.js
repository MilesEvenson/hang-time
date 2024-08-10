

let tsStart = -1;
let tsLast = Date.now();
let tickerId = 0;
const MIN_ACCELERATION = 19.0;
// Check every 30ms
const INTERVAL = 30;
// Hold samples from the last ~900ms
const WINDOW_SIZE = 30;

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


function changeToAir(now) {
  mode = MODES.AIR;

  tsStart = now;

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
  mode = MODES.DOWN;

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


function isLaunchDetected(samples) {
  if (samples.length < WINDOW_SIZE) {
    return false;
  }

  const MIN_BOOST = 1.0;
  const MIN_BOOST_SAMPLES = 3;
  // Try to enforce a minimum of ~500ms in the air.
  const MIN_AIR_SAMPLES = 16;

  let boostCount = 0;
  let flyingCount = 0;
  let isBoosting = true;
  let boost = 0.0;
  let peakBoost = 0.0;
  let peakAcceleration = 0.0;

  for (let i = 1; i < samples.length; i++) {
    boost = samples[i].value - samples[i-1].value;

    if (isBoosting) {
      if (0.0 < boost) {
        boostCount++;
        peakBoost = Math.max(peakBoost, boost);
        peakAcceleration = Math.max(peakAcceleration, samples[i].value);
      } else {
        flyingCount++;
        isBoosting = false;
      }
    } else {
      // We expect boost (acceleration) to decline after the phone is in the air.
      // Allow a fair amount of jitter here by accepting acceleration values up to 11.0 m/s^2.
      if (boost < 0 || samples[i].value < 11.0) {
        flyingCount++;
      } else if (MIN_BOOST < boost) {
        isBoosting = true;
        peakAcceleration = Math.max(peakAcceleration, samples[i].value);
        peakBoost = boost;
        boostCount = 1;
        flyingCount = 0;
      }
    }

    if (MIN_BOOST_SAMPLES <= boostCount
        && MIN_AIR_SAMPLES <= flyingCount
        && MIN_ACCELERATION < peakAcceleration
    ) {
      return true;
    }
  }

  return false;
}


function handleMotion(ev) {
  if (mode !== MODES.STANDBY
    && mode !== MODES.LAUNCH
    && mode !== MODES.AIR
  ) {
    return;
  }

  const now = Date.now();
  if ((now - tsLast) < INTERVAL) {
    return;
  }
  tsLast = now;

  const { x, y, z } = ev.acceleration;
  const magnitude = Math.sqrt( (x * x) + (y * y) + (z * z) );

  data.push({
    ts: now,
    value: Number(magnitude.toFixed(4)),
  });

  if (WINDOW_SIZE < data.length) {
    // Drop the oldest measurement
    data.shift();

    //console.log(data);

    //if (mode === MODES.LAUNCH && data.length === WINDOW_SIZE) {
    if (mode === MODES.LAUNCH && WINDOW_SIZE <= data.length) {
      if (isLaunchDetected(data)) {
        data.splice(0, WINDOW_SIZE);
        changeToAir(now);
      }
      //else { console.log('no launch detected'); }
    } else if (mode === MODES.AIR && WINDOW_SIZE <= data.length) {
      if (isLandingDetected(data)) {
        changeToDown(now);
        data.splice(0, WINDOW_SIZE);
      }
      //else { console.log('no down detected'); }
    }
    else {
      console.log(`mode (${mode}) with data length (${data?.length})`);
    }
  }
}


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


